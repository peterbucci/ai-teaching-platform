import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import {
  EvidenceError,
  sessionEvidence,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { DIALOGUE_LIMITS } from "./contracts.ts";
import {
  appendOperationEvent,
  conflict,
  currentOperation,
  dialogueContext,
  same,
} from "./persistence.ts";

export const ProviderCallDescriptorSchema = z.strictObject({
  step_id: z.string().min(1).max(120),
  stage: z.enum(["classify", "generate", "review", "propose"]),
  model: z.string().min(1).max(200),
  prompt_version: z.string().min(1).max(200),
  input_hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ProviderCallDescriptor = z.infer<
  typeof ProviderCallDescriptorSchema
>;
export type ReservedCall = <T>(
  descriptor: ProviderCallDescriptor,
  call: (signal: AbortSignal) => Promise<T>,
) => Promise<T>;

const CallSchema = z.object({
  id: z.uuid(),
  session_id: z.uuid(),
  request_id: z.uuid(),
  step_id: ProviderCallDescriptorSchema.shape.step_id,
  metadata: ProviderCallDescriptorSchema,
  status: z.enum(["reserved", "succeeded", "failed", "unknown"]),
  result: z.json().nullable(),
  started_at: z.iso.datetime({ offset: true }),
  finished_at: z.iso.datetime({ offset: true }).nullable(),
});
export type ProviderCallRecord = z.infer<typeof CallSchema>;
const OutcomeSchema = z
  .object({
    ok: z.boolean(),
    needs_reconciliation: z.boolean(),
  })
  .refine(
    (outcome) => !outcome.ok || !outcome.needs_reconciliation,
    "A successful provider result must have a known outcome",
  );
const resultLimit = 64_000;

function boundedResult(value: unknown) {
  const result = z.json().parse(value);
  const serialized = JSON.stringify(result);
  conflict(
    Buffer.byteLength(serialized, "utf8") <= resultLimit,
    "The provider result cannot be stored safely.",
  );
  const outcome = OutcomeSchema.parse(result);
  return { result, serialized, outcome };
}

/** Only this generic cache boundary asserts T: the descriptor must identify the
 * same model, prompt and input, and typed consumers validate their model schema.
 * Persistence additionally rejects non-JSON, oversized and malformed outcomes. */
function replayResult<T>(record: ProviderCallRecord): T {
  conflict(
    record.status === "succeeded" || record.status === "failed",
    "The provider outcome is unresolved. Read its saved status before retrying.",
  );
  const { result } = boundedResult(record.result);
  return result as T;
}

async function authorize(
  client: PoolClient,
  access: EvidenceAccess,
  sessionId: string,
  lock: boolean,
) {
  const identity = await client.query(
    "SELECT id FROM profiles WHERE id=$1 AND auth_user_id=$2",
    [access.actor.profileId, access.actor.userId],
  );
  if (!identity.rowCount) throw new EvidenceError(404, "Session not found.");
  await sessionEvidence(client, access, sessionId, "student", lock);
}

async function findCall(
  client: PoolClient,
  sessionId: string,
  requestId: string,
  stepId: string,
) {
  const rows = await client.query(
    "SELECT * FROM dialogue_provider_calls WHERE session_id=$1 AND request_id=$2 AND step_id=$3",
    [sessionId, requestId, stepId],
  );
  return rows.rows[0] ? CallSchema.parse(evidenceRow(rows.rows[0])) : null;
}

/** Private, read-only reconciliation. This never contacts the model or expires a
 * reservation; a pending/unknown external result is not proof that no charge ran. */
export async function readProviderCall(
  access: EvidenceAccess,
  sessionId: string,
  requestId: string,
  stepId: string,
) {
  z.uuid().parse(requestId);
  ProviderCallDescriptorSchema.shape.step_id.parse(stepId);
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    await authorize(client, access, sessionId, false);
    const record = await findCall(client, sessionId, requestId, stepId);
    if (!record) throw new EvidenceError(404, "Provider call not found.");
    return record;
  });
}

/** Read an original successful outcome without dispatching, reserving, or changing history. */
export async function readSuccessfulProviderCall(
  access: EvidenceAccess,
  sessionId: string,
  requestId: string,
  stepId: ProviderCallDescriptor["stage"],
) {
  const record = await readProviderCall(access, sessionId, requestId, stepId);
  conflict(
    record.status === "succeeded",
    "The saved provider result is not a confirmed success. No request was repeated.",
  );
  const outcome = boundedResult(record.result).outcome;
  conflict(
    outcome.ok && !outcome.needs_reconciliation,
    "The saved provider result is not a confirmed success. No request was repeated.",
  );
  return record;
}

/** The callback is intentionally never invoked. Exact descriptors bind cached
 * output to the original model, prompt version, input, operation and session. */
export function createRecordedCall(
  access: EvidenceAccess,
  sessionId: string,
  requestId: string,
): ReservedCall {
  return async function recorded<T>(input: ProviderCallDescriptor): Promise<T> {
    const descriptor = ProviderCallDescriptorSchema.parse(input);
    const record = await readSuccessfulProviderCall(
      access,
      sessionId,
      requestId,
      descriptor.stage,
    );
    conflict(
      same(record.metadata, descriptor),
      "Saved provider input differs from the current recovery context.",
    );
    return replayResult<T>(record);
  };
}

/** Each paid callback has a durable reservation before it starts, and runs outside
 * the database transaction. A known result is reusable even after its operation
 * settles. Content acceptance still requires the caller's current-operation lock. */
export function createReservedCall(
  access: EvidenceAccess,
  sessionId: string,
  requestId: string,
): ReservedCall {
  z.uuid().parse(sessionId);
  z.uuid().parse(requestId);
  return async function runReservedCall<T>(
    input: ProviderCallDescriptor,
    call: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const descriptor = ProviderCallDescriptorSchema.parse(input);
    conflict(
      descriptor.step_id === descriptor.stage,
      "Provider steps must use their server-owned stage identity.",
    );
    const reservation = await transaction(async (client) => {
      await authorize(client, access, sessionId, true);
      const previous = await findCall(
        client,
        sessionId,
        requestId,
        descriptor.step_id,
      );
      if (previous) {
        conflict(
          same(previous.metadata, descriptor),
          "This provider step ID was already used with different input.",
        );
        return { reused: true as const, record: previous };
      }
      const context = await dialogueContext(client, access, sessionId, true);
      currentOperation(context, requestId);
      const failed = await client.query(
        "SELECT 1 FROM dialogue_provider_calls WHERE session_id=$1 AND request_id=$2 AND status='failed' LIMIT 1",
        [sessionId, requestId],
      );
      conflict(
        failed.rows.length === 0,
        "This operation has a settled provider failure. No further paid stages are authorized.",
      );
      conflict(
        context.unresolved_provider_calls === 0,
        "Another provider operation is unresolved in this session.",
      );
      conflict(
        context.provider_requests_used <
          DIALOGUE_LIMITS.providerRequestsPerSession,
        "The session provider limit has been reached.",
      );
      const rows = await client.query(
        `INSERT INTO dialogue_provider_calls(id,session_id,request_id,step_id,metadata,status)
         VALUES($1,$2,$3,$4,$5::jsonb,'reserved') RETURNING *`,
        [
          randomUUID(),
          sessionId,
          requestId,
          descriptor.step_id,
          JSON.stringify(descriptor),
        ],
      );
      const record = CallSchema.parse(evidenceRow(rows.rows[0]));
      await appendOperationEvent(client, requestId, {
        kind: "provider_reserved",
        payload: { provider_call_id: record.id, ...descriptor },
      });
      return { reused: false as const, record };
    });
    if (reservation.reused) return replayResult<T>(reservation.record);

    async function markUnknown(
      reason: "timeout" | "interrupted" | "invalid_result",
    ) {
      await transaction(async (client) => {
        await authorize(client, access, sessionId, true);
        const record = await findCall(
          client,
          sessionId,
          requestId,
          descriptor.step_id,
        );
        conflict(
          record?.id === reservation.record.id,
          "Provider reservation changed.",
        );
        // A late known completion can win this race; never downgrade its result.
        if (record.status !== "reserved") return;
        await client.query(
          "UPDATE dialogue_provider_calls SET status='unknown' WHERE id=$1 AND status='reserved'",
          [record.id],
        );
        await appendOperationEvent(client, requestId, {
          kind: "provider_unknown",
          payload: {
            provider_call_id: record.id,
            step_id: descriptor.step_id,
            reason,
          },
        });
      });
    }

    async function persistResult(value: unknown) {
      let output: ReturnType<typeof boundedResult>;
      try {
        output = boundedResult(value);
      } catch {
        await markUnknown("invalid_result");
        throw new EvidenceError(
          503,
          "The provider result was not safely stored. Reconcile this operation before retrying.",
        );
      }
      await transaction(async (client) => {
        await authorize(client, access, sessionId, true);
        const record = await findCall(
          client,
          sessionId,
          requestId,
          descriptor.step_id,
        );
        conflict(
          record?.id === reservation.record.id,
          "Provider reservation changed.",
        );
        if (record.status === "succeeded" || record.status === "failed") {
          conflict(
            same(record.result, output.result),
            "A provider outcome cannot be overwritten.",
          );
          return;
        }
        const status = output.outcome.needs_reconciliation
          ? "unknown"
          : output.outcome.ok
            ? "succeeded"
            : "failed";
        await client.query(
          `UPDATE dialogue_provider_calls SET status=$2,result=$3::jsonb,
           finished_at=CASE WHEN $2='unknown' THEN NULL ELSE clock_timestamp() END WHERE id=$1`,
          [record.id, status, output.serialized],
        );
        await appendOperationEvent(client, requestId, {
          kind:
            status === "unknown" ? "provider_unknown" : "provider_completed",
          payload: {
            provider_call_id: record.id,
            step_id: descriptor.step_id,
            status,
          },
        });
      });
      return output;
    }

    const controller = new AbortController();
    const completion = Promise.resolve()
      .then(() => call(controller.signal))
      .then(
        (value) => ({ kind: "result" as const, value }),
        () => ({ kind: "interrupted" as const }),
      );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<{ kind: "timeout" }>((resolve) => {
      timer = setTimeout(() => {
        // Resolve the race before an abort listener can settle the callback.
        resolve({ kind: "timeout" });
        controller.abort();
      }, DIALOGUE_LIMITS.timeoutMs);
    });
    const completed = await Promise.race([completion, timeout]);
    clearTimeout(timer);
    if (completed.kind === "timeout") {
      // The original callback alone may reconcile a late known result. No new
      // provider call or content application happens in this continuation.
      void completion
        .then(async (late) => {
          if (late.kind === "result") await persistResult(late.value);
        })
        .catch(() => {
          console.error(
            "A late dialogue provider result could not be reconciled; its reservation remains recorded.",
          );
        });
      await markUnknown("timeout");
      throw new EvidenceError(
        503,
        "The provider timed out. Its outcome must be reconciled before retrying.",
      );
    }
    if (completed.kind === "interrupted") {
      await markUnknown("interrupted");
      throw new EvidenceError(
        503,
        "The provider operation was interrupted. Its outcome must be reconciled before retrying.",
      );
    }
    const output = await persistResult(completed.value);
    // This result can settle the paid call even if cancellation or legacy progress
    // invalidated the operation. It must not be returned for new content acceptance.
    await transaction(async (client) => {
      const context = await dialogueContext(client, access, sessionId, true);
      currentOperation(context, requestId);
    });
    // The callback's exact validated JSON survives a reconnect without a second call.
    return output.result as T;
  };
}
