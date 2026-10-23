import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  ORCHESTRATION_VERSION,
  TutorProposalSchema,
  type OrchestrationPorts,
} from "./contracts.ts";
import { OrchestrationError } from "./errors.ts";

// Structural subset of #74's ModelOutcome: keep its full provenance in #75's
// reserved result, while exposing only the checked proposal to the dispatcher.
type ProposalOutcome<T> =
  | { ok: true; result: T; needs_reconciliation: false }
  | { ok: false; code: string; needs_reconciliation: boolean };
type Provider = <T>(
  input: {
    instructions: string;
    input: string;
    schema: z.ZodType<T>;
    schemaName: string;
  },
  options: { signal: AbortSignal },
) => Promise<ProposalOutcome<T>>;
export type ReservedProposalCall = <T>(
  step: {
    step_id: string;
    stage: "propose";
    model: string;
    prompt_version: string;
    input_hash: string;
  },
  call: (signal: AbortSignal) => Promise<T>,
) => Promise<T>;

/** Pass #74 requestStructuredProposal and #75's operation-bound runReservedCall.
 * This adapter never opens a provider connection or owns a separate usage counter. */
export function createProposalService(services: {
  model: string | null;
  requestStructuredProposal: Provider;
  runReservedCall: ReservedProposalCall;
}): OrchestrationPorts["propose"] {
  return async (prompt, schema, signal) => {
    if (!services.model?.trim()) throw new OrchestrationError("disabled");
    if (signal.aborted) throw new OrchestrationError("cancelled");
    // Structured Outputs requires an object root rather than a top-level union.
    const envelope = z.strictObject({ proposal: schema });
    const schemaName = "tutor_instructional_proposal";
    const input_hash = createHash("sha256")
      .update(
        JSON.stringify({
          ...prompt,
          schemaName,
          schema: z.toJSONSchema(envelope),
          version: ORCHESTRATION_VERSION,
        }),
      )
      .digest("hex");
    const outcome = await services.runReservedCall(
      {
        step_id: "propose",
        stage: "propose",
        model: services.model,
        prompt_version: ORCHESTRATION_VERSION,
        input_hash,
      },
      (reservedSignal) =>
        services.requestStructuredProposal(
          {
            ...prompt,
            instructions: `${prompt.instructions}\nReturn one object with a proposal field.`,
            schema: envelope,
            schemaName,
          },
          { signal: AbortSignal.any([signal, reservedSignal]) },
        ),
    );
    if (!outcome.ok) {
      const reasons = z.enum([
        "limit_reached",
        "stale",
        "cancelled",
        "timeout",
        "invalid_output",
      ]);
      const parsed = reasons.safeParse(outcome.code);
      throw new OrchestrationError(
        outcome.code === "configuration"
          ? "disabled"
          : parsed.success
            ? parsed.data
            : "provider_error",
        outcome.needs_reconciliation,
      );
    }
    const parsed = z
      .strictObject({ proposal: TutorProposalSchema })
      .safeParse(outcome.result);
    if (!parsed.success) throw new OrchestrationError("invalid_proposal");
    return parsed.data.proposal;
  };
}
