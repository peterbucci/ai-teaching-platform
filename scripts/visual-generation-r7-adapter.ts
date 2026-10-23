import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import type { ApprovedContent } from "../lib/evidence/content.ts";
import type {
  Evaluation,
  QuestionSnapshot,
} from "../lib/evidence/contracts.ts";
import type { EvidenceAccess } from "../lib/evidence/store.ts";
import type {
  DialogueRequest,
  LessonAnchor,
} from "../lib/dialogue/contracts.ts";
import type {
  VisualGenerationContext,
  VisualGenerationRequest,
  VisualGenerationResult,
  VisualGenerationServices,
  VisualModelRequest,
  VisualOperationError,
  VisualReservedCall,
} from "../lib/visual/generation-contracts.ts";

type RuntimeContent = ApprovedContent & {
  activity_policy: {
    allow_runtime_generation: boolean;
    allowed_actions: string[];
  };
};
type OperationContext = {
  content: RuntimeContent;
  lesson: LessonAnchor;
  revision: number;
  attempt: {
    id: string;
    question: QuestionSnapshot;
    response_text: string | null;
    submitted_at: string | null;
  };
  scope: { concept_ids: Set<string>; passage_ids: Set<string> };
};
type Operation = {
  request_id: string;
  expected_revision: number;
  message: { text: string } | null;
};
type WithOperation = <T>(
  access: EvidenceAccess,
  sessionId: string,
  operationId: string,
  callback: (
    client: PoolClient,
    context: OperationContext,
    operation: Operation,
  ) => Promise<T>,
) => Promise<T>;
type Generator = (
  request: VisualGenerationRequest,
  services: VisualGenerationServices,
) => Promise<VisualGenerationResult>;

/**
 * Explicit integration-checkout boundary, not a new production provider. The
 * trusted local modules are loaded by exact path and export name; their functions
 * retain the existing resolver, permission checks, reservations and transport.
 * Both generator and dependencies must come from the SAME combined checkout so
 * #93's uploaded ContentRef variant is validated by that checkout's real schema.
 */
export async function loadVisualIntegration(rootInput: string) {
  const root = resolve(rootInput);
  async function exported<T>(relative: string, name: string): Promise<T> {
    const namespace: unknown = await import(
      pathToFileURL(resolve(root, relative)).href
    );
    const entries = z.record(z.string(), z.unknown()).parse(namespace);
    return z
      .custom<T>(
        (value) => typeof value === "function",
        `Missing integration export ${name}`,
      )
      .parse(entries[name]);
  }
  const [
    getPool,
    withOperation,
    createReservedCall,
    configuredModel,
    request,
    generate,
    createLesson,
    startSession,
    presentQuestion,
    submitAnswer,
    recordEvaluation,
    readSession,
    reserveControllerOperation,
    reserveConversationOperation,
    readProviderCall,
    OperationError,
    EvidenceError,
  ] = await Promise.all([
    exported<() => Pool>("lib/db.ts", "getPool"),
    exported<WithOperation>(
      "lib/dialogue/persistence.ts",
      "withDialogueOperation",
    ),
    exported<
      (
        access: EvidenceAccess,
        session: string,
        operation: string,
      ) => VisualReservedCall
    >("lib/dialogue/provider-store.ts", "createReservedCall"),
    exported<() => string | null>(
      "lib/dialogue/model-provider.ts",
      "configuredDialogueModel",
    ),
    exported<VisualModelRequest>(
      "lib/dialogue/model-provider.ts",
      "requestStructuredProposal",
    ),
    exported<Generator>("lib/visual/generation.ts", "generateVisualActivity"),
    exported<
      (
        access: EvidenceAccess,
        classId: string,
      ) => Promise<{ assignmentId: string; content: RuntimeContent }>
    >("scripts/fixtures/approved-r7-lesson.ts", "createApprovedRuntimeLesson"),
    exported<
      (
        access: EvidenceAccess,
        assignmentId: string,
        origin: "synthetic_fixture",
      ) => Promise<{ id: string }>
    >("lib/evidence/store.ts", "startSession"),
    exported<
      (
        access: EvidenceAccess,
        sessionId: string,
        input: { question: QuestionSnapshot; intent: "initial_retrieval" },
      ) => Promise<{ id: string; question: QuestionSnapshot }>
    >("lib/evidence/store.ts", "presentQuestion"),
    exported<
      (
        access: EvidenceAccess,
        sessionId: string,
        input: unknown,
      ) => Promise<unknown>
    >("lib/evidence/store.ts", "submitAnswer"),
    exported<
      (
        access: EvidenceAccess,
        sessionId: string,
        input: Evaluation,
      ) => Promise<{ id: string }>
    >("lib/evidence/store.ts", "recordEvaluation"),
    exported<
      (
        access: EvidenceAccess,
        sessionId: string,
        role: "student",
      ) => Promise<unknown>
    >("lib/evidence/store.ts", "readSession"),
    exported<
      (
        access: EvidenceAccess,
        sessionId: string,
        evaluationId: string,
      ) => Promise<{ request: DialogueRequest }>
    >("lib/dialogue/controller-store.ts", "reserveControllerOperation"),
    exported<
      (
        access: EvidenceAccess,
        input: unknown,
      ) => Promise<{ request_id: string; replay: boolean }>
    >("lib/dialogue/store.ts", "reserveConversationOperation"),
    exported<
      (
        access: EvidenceAccess,
        sessionId: string,
        operationId: string,
        stage: string,
      ) => Promise<{ status: "reserved" | "succeeded" | "failed" | "unknown" }>
    >("lib/dialogue/provider-store.ts", "readProviderCall"),
    exported<typeof VisualOperationError>(
      "lib/visual/generation-contracts.ts",
      "VisualOperationError",
    ),
    exported<
      new (
        status: 400 | 403 | 404 | 409 | 503,
        message: string,
      ) => Error & { status: number }
    >("lib/evidence/store.ts", "EvidenceError"),
  ]);
  return {
    root,
    getPool,
    withOperation,
    createReservedCall,
    configuredModel,
    request,
    generate,
    createLesson,
    startSession,
    presentQuestion,
    submitAnswer,
    recordEvaluation,
    readSession,
    reserveControllerOperation,
    reserveConversationOperation,
    readProviderCall,
    OperationError,
    EvidenceError,
  };
}
export type VisualIntegration = Awaited<
  ReturnType<typeof loadVisualIntegration>
>;

/**
 * Operator-only adapter for the explicitly enabled synthetic verification run.
 * The family allowlist is a TEST selection: #42 has not installed a visual tool
 * in #98. Do not expose this helper as an application route or count it as #42.
 * Actual identity, content, revision and spending checks still use #93/#98.
 */
export function createVisualCheckServices(
  dependencies: VisualIntegration,
  access: EvidenceAccess,
  identity: Pick<VisualGenerationRequest, "session_id" | "operation_id">,
): VisualGenerationServices {
  assert.equal(process.env.VISUAL_CHECK_SYNTHETIC, "1");
  assert.match(process.env.PGDATABASE ?? "", /^visual41_[a-z0-9_]+$/);
  const load = async (
    request: VisualGenerationRequest,
  ): Promise<VisualGenerationContext> => {
    assert.equal(request.session_id, identity.session_id);
    assert.equal(request.operation_id, identity.operation_id);
    return dependencies.withOperation(
      access,
      request.session_id,
      request.operation_id,
      async (_client, context, operation) => {
        assert.equal(operation.request_id, request.operation_id);
        assert.equal(operation.expected_revision, request.expected_revision);
        assert.equal(context.revision, request.expected_revision);
        assert.ok(context.content.activity_policy.allow_runtime_generation);
        assert.ok(
          context.content.activity_policy.allowed_actions.includes(
            context.attempt.submitted_at
              ? "GIVE_CORRECTIVE_FEEDBACK"
              : "GIVE_HINT",
          ),
        );
        const originalText =
          operation.message?.text ?? context.attempt.response_text;
        assert.ok(originalText);
        return {
          content: context.content,
          lesson: context.lesson,
          operation_id: operation.request_id,
          revision: context.revision,
          question: context.attempt.question,
          student_text: originalText,
          assessment_status: context.attempt.submitted_at
            ? "evaluated"
            : "unanswered",
          runtime_generation_allowed: true,
          permitted_kinds: ["concept_graph", "sequence_diagram"],
          scope: context.scope,
        };
      },
    );
  };
  return {
    resolveAuthorizedContext: load,
    assertCurrent: async (request, previous) => {
      const current = await load(request);
      assert.ok(
        isDeepStrictEqual(current, previous),
        "Authorized visual context changed.",
      );
    },
    runReservedCall: async (descriptor, call) => {
      let dispatched = false;
      try {
        return await dependencies.createReservedCall(
          access,
          identity.session_id,
          identity.operation_id,
        )(descriptor, async (signal) => {
          dispatched = true;
          return call(signal);
        });
      } catch (error) {
        // A thrown transport/post-dispatch exception is never evidence of a
        // settled failure. Known pre-dispatch denials may be classified only
        // after checking that this durable stage is absent or settled.
        if (dispatched || !(error instanceof dependencies.EvidenceError))
          throw error;
        if (error.status === 403 || error.status === 404)
          throw new dependencies.OperationError("not_authorized");
        if (
          error.status !== 409 ||
          /unresolved|reconcile|outcome/i.test(error.message)
        )
          throw error;
        try {
          const record = await dependencies.readProviderCall(
            access,
            identity.session_id,
            identity.operation_id,
            descriptor.stage,
          );
          if (record.status === "reserved" || record.status === "unknown")
            throw error;
        } catch (readError) {
          if (!(
            readError instanceof dependencies.EvidenceError &&
            readError.status === 404
          ))
            throw readError;
        }
        throw new dependencies.OperationError(
          /stale|cancelled|settled\.$/.test(error.message)
            ? "stale"
            : "operation_denied",
        );
      }
    },
    provider: {
      model: dependencies.configuredModel(),
      request: dependencies.request,
    },
  };
}
