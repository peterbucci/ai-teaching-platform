import type { z } from "zod";
import type { ApprovedContent } from "../evidence/content.ts";
import type { QuestionSnapshot } from "../evidence/contracts.ts";
import type { LessonAnchor } from "../dialogue/contracts.ts";
import type {
  ConceptGraph,
  PacketDelayExperiment,
  SequenceDiagram,
} from "./contracts.ts";

export type VisualKind =
  "concept_graph" | "sequence_diagram" | "packet_experiment";
export type GeneratedVisual =
  ConceptGraph | SequenceDiagram | PacketDelayExperiment;

/** IDs/selection only. Actor, permission, source and original evidence come from the server port. */
export type VisualGenerationRequest = {
  session_id: string;
  operation_id: string;
  expected_revision: number;
  kind: VisualKind;
  concept_ids: string[];
  source_passage_ids: string[];
};

/** Construct inside the authorized lesson/operation resolver; never deserialize from HTTP. */
export type VisualGenerationContext = {
  content: ApprovedContent;
  lesson: LessonAnchor;
  operation_id: string;
  revision: number;
  question: QuestionSnapshot;
  student_text: string;
  assessment_status: "unanswered" | "evaluated";
  runtime_generation_allowed: boolean;
  permitted_kinds: readonly VisualKind[];
  scope: { concept_ids: ReadonlySet<string>; passage_ids: ReadonlySet<string> };
};

// Structural adapter for #98's existing generic transport and reservation contracts.
// No provider SDK, spending counter, retry loop or operation store lives here.
export type VisualModelUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};
export type VisualModelOutcome<T> =
  | {
      ok: true;
      result: T;
      model: string;
      responseId: string;
      latencyMs: number;
      usage: VisualModelUsage | null;
      needs_reconciliation: false;
      completedAt: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
      model: string | null;
      responseId: string | null;
      latencyMs: number;
      usage: VisualModelUsage | null;
      needs_reconciliation: boolean;
    };
export type VisualModelRequest = <T>(
  input: {
    instructions: string;
    input: string;
    schema: z.ZodType<T>;
    schemaName: string;
  },
  options: { signal: AbortSignal },
) => Promise<VisualModelOutcome<T>>;
export type VisualReservedCall = <T>(
  descriptor: {
    step_id: "generate" | "review";
    stage: "generate" | "review";
    model: string;
    prompt_version: string;
    input_hash: string;
  },
  call: (signal: AbortSignal) => Promise<T>,
) => Promise<T>;
export type VisualGenerationServices = {
  resolveAuthorizedContext: (
    request: VisualGenerationRequest,
  ) => Promise<VisualGenerationContext>;
  /** Reauthorize the same operation/revision/source immediately before each call and acceptance. */
  assertCurrent: (
    request: VisualGenerationRequest,
    context: VisualGenerationContext,
  ) => Promise<void>;
  /** Bound to this authenticated session/operation using #98 createReservedCall. Required, no default. */
  runReservedCall: VisualReservedCall;
  provider: { model: string | null; request: VisualModelRequest };
};

export type VisualCallProvenance = {
  stage: "generate" | "review";
  outcome: "succeeded" | "failed";
  code: string | null;
  needs_reconciliation: boolean;
  model: string | null;
  response_id: string | null;
  prompt_version: string;
  input_hash: string;
  completed_at: string | null;
  latency_ms: number;
  usage: VisualModelUsage | null;
};
export type VisualGrounding = {
  field: string;
  support: "supported" | "unsupported" | "uncertain";
  sources: { passage_id: string; quote: string }[];
};
export type VisualGenerationResult =
  | {
      ok: true;
      activity: GeneratedVisual;
      provenance: {
        generator_version: string;
        session_id: string;
        operation_id: string;
        expected_revision: number;
        lesson: LessonAnchor;
        source_passage_ids: string[];
        activity_sha256: string;
        calls: VisualCallProvenance[];
        factual_review: { status: "accepted"; coverage: VisualGrounding[] };
      };
    }
  | {
      ok: false;
      code:
        | "invalid_request"
        | "not_authorized"
        | "stale"
        | "unsupported_contract"
        | "configuration"
        | "invalid_output"
        | "unsafe_output"
        | "ungrounded"
        | "provider_failure"
        | "operation_denied"
        | "operation_unresolved";
      message: string;
      fallback: "text_tutoring";
      needs_reconciliation: boolean;
      calls: VisualCallProvenance[];
    };

/** Adapters may classify a known pre-dispatch denial; unknown exceptions stay unresolved. */
export class VisualOperationError extends Error {
  readonly code: "stale" | "not_authorized" | "operation_denied";
  constructor(code: VisualOperationError["code"]) {
    super(code);
    this.name = "VisualOperationError";
    this.code = code;
  }
}
