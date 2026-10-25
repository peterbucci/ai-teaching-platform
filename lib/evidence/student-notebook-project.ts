import "server-only";
import { createHash } from "node:crypto";
import { isDeepStrictEqual as same } from "node:util";
import { z } from "zod";
import {
  SessionEvidenceSchema,
  type Attempt,
  type Evaluation,
  type Intervention,
} from "./contracts.ts";
import {
  validateContentRef,
  validateQuestionSnapshot,
  type ApprovedContent,
} from "./content.ts";
import { validateEvaluationReferences } from "./rules.ts";
import { EvidenceError } from "./store.ts";
import {
  OperationSchema,
  type DialogueOperation,
} from "../dialogue/persistence.ts";
import { validateDialogueEvents } from "../dialogue/rules.ts";
import { assignmentStudyHref } from "../tutoring/navigation.ts";
import {
  NOTEBOOK_LIMITS,
  NOTEBOOK_VERSION,
  NotebookPageSchema,
  NotebookQuerySchema,
  StudentNotebookSchema,
  type NotebookPage,
  type NotebookLink,
  type NotebookReview,
  type NotebookEvent,
  type StudentNotebook,
} from "./student-notebook-contracts.ts";

export class NotebookError extends EvidenceError {
  readonly code:
    | "SNAPSHOT_CHANGED"
    | "NOTEBOOK_LIMIT"
    | "EVIDENCE_UNAVAILABLE"
    | "INVALID_CURSOR";
  constructor(code: NotebookError["code"]) {
    super(
      code === "INVALID_CURSOR" ? 400 : 409,
      {
        SNAPSHOT_CHANGED:
          "Saved work changed. Reload the Notebook from the first page.",
        NOTEBOOK_LIMIT: "This session exceeds the Notebook reading limit.",
        EVIDENCE_UNAVAILABLE:
          "This saved chronology cannot currently be verified.",
        INVALID_CURSOR: "Invalid Notebook cursor.",
      }[code],
    );
    this.code = code;
  }
}
export function notebookAssert(value: unknown): asserts value {
  if (!value) throw new NotebookError("EVIDENCE_UNAVAILABLE");
}

// Keep PostgreSQL microseconds and offsets. Date objects would silently lose precision.
export function notebookTime(value: string): bigint {
  z.iso.datetime({ offset: true }).parse(value);
  const match =
    /^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  notebookAssert(match);
  return (
    BigInt(Date.parse(match[1] + match[3])) * BigInt(1000) +
    BigInt((match[2] ?? "").padEnd(6, "0"))
  );
}
export const NotebookAuditSchema = z.object({
  sequence: z.string().regex(/^\d+$/),
  event_id: z.uuid(),
  request_id: z.uuid(),
  kind: z.string(),
  payload: z.record(z.string(), z.json()),
  at: z.iso.datetime({ offset: true }),
});
export type NotebookAudit = z.infer<typeof NotebookAuditSchema>;
export type NotebookRelations = {
  links: Map<string, NotebookLink>;
  reviews: Map<string, NotebookReview[]>;
  followup: {
    approval_id: string;
    attempt_id: string;
    displayed_at: string | null;
  } | null;
  pendingEvaluationAttempts: Set<string>;
  laterReviews?: Map<string, NotebookLink[]>;
};
export type NotebookInput = {
  actorId: string;
  evidence: unknown;
  content: ApprovedContent;
  lesson: { id: string; version: string; title: string };
  operations: unknown[];
  providerCalls?: unknown[];
  audit: unknown[];
  relations: NotebookRelations;
  readAt: string;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function notebookLink(
  assignmentId: string,
  sessionId: string,
  attemptId: string,
): NotebookLink {
  return {
    assignment_id: assignmentId,
    session_id: sessionId,
    attempt_id: attemptId,
    href: assignmentStudyHref(assignmentId, sessionId),
  };
}

function confirmedConversationDisplay(
  operation: DialogueOperation,
  events: NotebookAudit[],
  intervention: Intervention,
) {
  try {
    if (
      !operation.dialogue_request ||
      operation.dialogue_request.request_id !== operation.request_id ||
      operation.payload.action !== "send_message" ||
      operation.intervention_id !== intervention.id ||
      !same(operation.dialogue_request.lesson, operation.lesson)
    )
      return false;
    const history = validateDialogueEvents(
      operation.dialogue_request,
      events
        .filter(
          (e) => e.request_id === operation.request_id && e.kind === "dialogue",
        )
        .map((e) => e.payload),
    );
    let previousTime = notebookTime(operation.dialogue_request.requested_at);
    for (const event of history) {
      const recordedTime = notebookTime(event.at);
      if (recordedTime < previousTime) return false;
      previousTime = recordedTime;
    }
    const generated = history.find((e) => e.outcome === "generated");
    const displayed = history.at(-1);
    return (
      generated?.outcome === "generated" &&
      generated.content.kind === "help" &&
      displayed?.outcome === "displayed" &&
      displayed.intervention_id === intervention.id &&
      intervention.visible_at !== null &&
      notebookTime(displayed.at) === notebookTime(intervention.visible_at) &&
      generated.content.text === intervention.text_shown &&
      generated.content.assistance_type === intervention.type &&
      same(generated.content.content_ref, intervention.content_ref) &&
      same(generated.content.concept_ids, intervention.concept_ids) &&
      same(
        generated.content.source_passage_ids,
        intervention.source_passage_ids,
      )
    );
  } catch {
    return false;
  }
}

function assessmentState(
  attempt: Attempt,
  evaluations: Evaluation[],
  pendingDispatch: boolean,
): NotebookPage["assessment"] {
  if (!attempt.submitted_at) return { status: "not_submitted" };
  if (attempt.current_evaluation_id) {
    const current = evaluations.find(
      (e) => e.id === attempt.current_evaluation_id,
    );
    return current?.validation_status === "accepted" && current.result
      ? { status: "accepted", current_evaluation_id: current.id }
      : { status: "unavailable" };
  }
  if (evaluations.some((e) => e.validation_status === "accepted"))
    return { status: "unavailable" };
  const unresolved = evaluations.some(
    (e) =>
      e.validation_status === "pending_review" &&
      !evaluations.some(
        (later) =>
          later.evaluator.provider_reservation_id === e.id &&
          later.evaluator.provider_outcome === "settled",
      ),
  );
  if (
    pendingDispatch ||
    unresolved ||
    evaluations.some(
      (e) =>
        e.evaluator.provider_outcome === "unknown" &&
        !evaluations.some(
          (later) =>
            later.evaluator.provider_reservation_id ===
              e.evaluator.provider_reservation_id &&
            later.evaluator.provider_outcome === "settled",
        ),
    )
  )
    return { status: "pending", outcome: "unknown" };
  const last = evaluations.at(-1);
  return last
    ? { status: last.validation_status === "rejected" ? "rejected" : "failed" }
    : { status: "not_recorded" };
}

/** Input must come from one authorized, read-only database snapshot. Never a browser payload. */
export function projectStudentNotebook(
  input: NotebookInput,
  rawQuery: unknown = {},
): StudentNotebook {
  const query = NotebookQuerySchema.parse(rawQuery);
  const { session, attempts, evaluations, interventions } =
    SessionEvidenceSchema.parse(input.evidence);
  notebookAssert(session.student_id === input.actorId);
  const operations = OperationSchema.array().parse(input.operations);
  const providerCalls = z
    .array(
      z.strictObject({
        request_id: z.uuid(),
        status: z.enum(["reserved", "unknown", "succeeded", "failed"]),
      }),
    )
    .max(NOTEBOOK_LIMITS.provider_calls)
    .parse(input.providerCalls ?? []);
  const audit = NotebookAuditSchema.array()
    .parse(input.audit)
    .sort((a, b) =>
      BigInt(a.sequence) < BigInt(b.sequence)
        ? -1
        : BigInt(a.sequence) > BigInt(b.sequence)
          ? 1
          : 0,
    );
  for (const [count, cap] of [
    [attempts.length, NOTEBOOK_LIMITS.attempts],
    [evaluations.length, NOTEBOOK_LIMITS.evaluations],
    [interventions.length, NOTEBOOK_LIMITS.interventions],
    [operations.length, NOTEBOOK_LIMITS.operations],
    [audit.length, NOTEBOOK_LIMITS.audit_events],
  ])
    if (count > cap) throw new NotebookError("NOTEBOOK_LIMIT");
  attempts.sort(
    (a, b) => a.sequence_index - b.sequence_index || a.id.localeCompare(b.id),
  );
  evaluations.sort((a, b) =>
    notebookTime(a.evaluated_at) < notebookTime(b.evaluated_at)
      ? -1
      : notebookTime(a.evaluated_at) > notebookTime(b.evaluated_at)
        ? 1
        : a.id.localeCompare(b.id),
  );
  const byId = new Map(attempts.map((a) => [a.id, a]));
  notebookAssert(
    byId.size === attempts.length &&
      new Set(attempts.map((a) => a.sequence_index)).size === attempts.length,
  );
  const ops = new Map(operations.map((o) => [o.request_id, o]));
  notebookAssert(
    ops.size === operations.length &&
      new Set(audit.map((e) => e.sequence)).size === audit.length &&
      new Set(audit.map((e) => e.event_id)).size === audit.length,
  );
  for (const attempt of attempts) {
    notebookAssert(attempt.session_id === session.id);
    validateQuestionSnapshot(input.content, attempt.question);
    const root = byId.get(attempt.root_attempt_id);
    const parent = attempt.parent_attempt_id
      ? byId.get(attempt.parent_attempt_id)
      : null;
    notebookAssert(
      root &&
        root.root_attempt_id === root.id &&
        (!attempt.parent_attempt_id ||
          (parent &&
            parent.root_attempt_id === root.id &&
            parent.sequence_index < attempt.sequence_index)),
    );
    if (attempt.submitted_at)
      notebookAssert(
        notebookTime(attempt.submitted_at) >=
          notebookTime(attempt.presented_at),
      );
    if (attempt.assistance) {
      const concepts = Object.keys(
        attempt.assistance.independent_retrieval_eligible_by_concept,
      );
      notebookAssert(
        concepts.length === attempt.question.concept_ids.length &&
          concepts.every((id) => attempt.question.concept_ids.includes(id)),
      );
      if (attempt.assistance.most_recent_content_assistance_at)
        notebookAssert(
          attempt.submitted_at &&
            notebookTime(
              attempt.assistance.most_recent_content_assistance_at,
            ) <= notebookTime(attempt.submitted_at),
        );
    }
    notebookAssert(!attempt.current_evaluation_id || attempt.submitted_at);
    for (const aidId of attempt.assistance?.intervention_ids ?? []) {
      const aid = interventions.find((i) => i.id === aidId);
      notebookAssert(
        aid?.visible_at &&
          attempt.submitted_at &&
          aid.delivery_status === "displayed" &&
          notebookTime(aid.visible_at) <= notebookTime(attempt.submitted_at),
      );
    }
  }
  for (const op of operations) {
    const attempt = byId.get(op.attempt_id);
    notebookAssert(
      attempt &&
        op.session_id === session.id &&
        op.actor_id === input.actorId &&
        op.payload.session_id === session.id &&
        op.payload.attempt_id === attempt.id &&
        op.payload.request_id === op.request_id &&
        op.lesson.session_id === session.id &&
        op.lesson.assignment_id === session.assignment_id &&
        op.lesson.attempt_id === attempt.id &&
        op.lesson.root_attempt_id === attempt.root_attempt_id &&
        op.lesson.sequence_index === attempt.sequence_index &&
        same(op.lesson.content_ref, attempt.question.content_ref),
    );
    if (op.message)
      notebookAssert(
        op.payload.action === "send_message" &&
          op.message.request_id === op.request_id &&
          op.message.attempt_id === attempt.id &&
          op.message.text === op.payload.text,
      );
  }
  for (const event of audit) notebookAssert(ops.has(event.request_id));
  for (const call of providerCalls) notebookAssert(ops.has(call.request_id));
  for (const evaluation of evaluations) {
    const attempt = byId.get(evaluation.attempt_id);
    notebookAssert(attempt);
    validateEvaluationReferences(
      input.content,
      evaluation,
      attempt,
      attempts,
      evaluations,
    );
    notebookAssert(
      attempt.submitted_at &&
        notebookTime(evaluation.evaluated_at) >=
          notebookTime(attempt.submitted_at),
    );
  }
  for (const aid of interventions) {
    notebookAssert(
      aid.session_id === session.id && byId.has(aid.related_attempt_id),
    );
    validateContentRef(input.content, aid.content_ref);
    notebookAssert(
      aid.concept_ids.every((id) => input.content.concept_ids.has(id)) &&
        aid.source_passage_ids.every((id) =>
          input.content.passage_ids.has(id),
        ) &&
        (!aid.related_evaluation_id ||
          evaluations.some(
            (e) =>
              e.id === aid.related_evaluation_id &&
              e.attempt_id === aid.related_attempt_id,
          )),
    );
  }
  const followup = input.relations.followup;
  const resumeHref = followup
    ? `/study/interventions/${followup.approval_id}`
    : assignmentStudyHref(session.assignment_id, session.id);
  const fullPages = attempts.map((attempt): NotebookPage => {
    const events: NotebookEvent[] = [];
    const gaps: NotebookPage["gaps"] = ["question_view_time_not_recorded"];
    const base = (
      id: string,
      at: string,
      basis: NotebookEvent["time_basis"],
    ) => ({
      event_id: id,
      recorded_at: at,
      time_basis: basis,
      order: 0,
      order_basis: "recorded_time" as const,
    });
    events.push({
      ...base(
        `question:${attempt.id}`,
        attempt.presented_at,
        "question_presentation",
      ),
      kind: "question_presented",
    });
    const attemptOps = operations.filter(
      (o) => o.attempt_id === attempt.id && o.payload.action === "send_message",
    );
    const linked = attemptOps.find(
      (o) =>
        o.request_id === attempt.submission_key &&
        o.message?.outcome.status === "answer" &&
        o.message.outcome.submission_key === attempt.submission_key,
    );
    if (linked) notebookAssert(linked.message?.text === attempt.response_text);
    for (const op of attemptOps) {
      notebookAssert(op.payload.action === "send_message");
      events.push({
        ...base(`message:${op.request_id}`, op.created_at, "message_saved"),
        kind: "student_message",
        request_id: op.request_id,
        content:
          linked?.request_id === op.request_id
            ? { kind: "submitted_answer_reference", answer_id: attempt.id }
            : { kind: "text", text: op.payload.text },
      });
      for (const event of audit.filter((e) => e.request_id === op.request_id)) {
        const b = base(`audit:${event.event_id}`, event.at, "audit_recorded");
        if (
          event.kind === "intent_review" &&
          event.payload.authorized_route === "clarify"
        ) {
          events.push({
            ...b,
            kind: "intent_clarification_requested",
            request_id: op.request_id,
          });
          gaps.push("clarification_wording_not_recorded");
        } else if (event.kind === "intent_resolution") {
          const parsed = z
            .object({
              request_id: z.uuid(),
              choice: z.enum(["answer", "help"]),
            })
            .safeParse(event.payload);
          const resolution = parsed.success
            ? ops.get(parsed.data.request_id)
            : undefined;
          if (
            parsed.success &&
            resolution?.payload.action === "resolve_intent" &&
            resolution.attempt_id === attempt.id &&
            resolution.payload.message_request_id === op.request_id &&
            resolution.payload.choice === parsed.data.choice
          )
            events.push({
              ...b,
              kind: "intent_resolved",
              request_id: op.request_id,
              resolution_request_id: resolution.request_id,
              choice: parsed.data.choice,
            });
        } else if (event.kind === "cancelled") {
          const cancelId = event.payload.cancellation_request_id;
          const cancellation =
            typeof cancelId === "string" ? ops.get(cancelId) : undefined;
          if (
            cancellation?.payload.action === "cancel_message" &&
            cancellation.attempt_id === attempt.id &&
            cancellation.payload.message_request_id === op.request_id
          )
            events.push({
              ...b,
              kind: "message_cancelled",
              request_id: op.request_id,
              cancellation_request_id: cancellation.request_id,
            });
        } else if (event.kind === "service_unavailable")
          events.push({
            ...b,
            kind: "message_unavailable",
            request_id: op.request_id,
            reason: "unavailable",
          });
      }
    }
    if (attemptOps.length) gaps.push("message_transition_time_not_recorded");
    const pending: NotebookPage["pending_deliveries"] = [];
    for (const aid of interventions.filter(
      (i) => i.related_attempt_id === attempt.id,
    )) {
      const owners = operations.filter((o) => o.intervention_id === aid.id);
      notebookAssert(owners.length <= 1);
      const owner = owners[0];
      notebookAssert(!owner || owner.attempt_id === aid.related_attempt_id);
      const ownership = owner
        ? "conversation"
        : followup
          ? "teacher_review"
          : aid.type === "reading"
            ? "reading"
            : "controller";
      const confirmed =
        aid.delivery_status === "displayed" &&
        aid.visible_at &&
        (owner
          ? confirmedConversationDisplay(owner, audit, aid)
          : !followup ||
            (aid.type === "corrective_feedback" &&
              aid.related_evaluation_id === null &&
              followup.attempt_id === aid.related_attempt_id &&
              followup.displayed_at &&
              notebookTime(aid.created_at) ===
                notebookTime(followup.displayed_at) &&
              notebookTime(followup.displayed_at) ===
                notebookTime(aid.visible_at)));
      if (!confirmed || !aid.visible_at) {
        pending.push({
          intervention_id: aid.id,
          owner: ownership,
          state:
            aid.delivery_status === "failed"
              ? "unavailable"
              : aid.delivery_status === "created"
                ? "awaiting_display"
                : "display_unconfirmed",
          resume_href: resumeHref,
        });
        if (aid.delivery_status === "displayed")
          gaps.push("display_receipt_unconfirmed");
        continue;
      }
      events.push({
        ...base(`display:${aid.id}`, aid.visible_at, "display_acknowledged"),
        kind: "help_displayed",
        aid: {
          intervention_id: aid.id,
          owner: ownership,
          related_evaluation_id: aid.related_evaluation_id,
          message_request_id: owner?.request_id ?? null,
          type: aid.type,
          text: aid.text_shown,
          displayed_at: aid.visible_at,
          source_passage_ids: aid.source_passage_ids,
          counted_at_submission: attempt.assistance
            ? attempt.assistance.intervention_ids.includes(aid.id)
            : null,
        },
      });
    }
    const attemptEvaluations = evaluations.filter(
      (e) => e.attempt_id === attempt.id,
    );
    const assessment = assessmentState(
      attempt,
      attemptEvaluations,
      input.relations.pendingEvaluationAttempts.has(attempt.id),
    );
    if (assessment.status === "unavailable")
      gaps.push("accepted_result_unavailable");
    // Only the authoritative pointer's explicit supersession chain is an accepted history.
    const accepted = new Set<string>();
    let current =
      assessment.status === "accepted" ? attempt.current_evaluation_id : null;
    while (current) {
      notebookAssert(!accepted.has(current));
      const evaluation = attemptEvaluations.find((e) => e.id === current);
      notebookAssert(
        evaluation?.validation_status === "accepted" && evaluation.result,
      );
      accepted.add(current);
      current = evaluation.supersedes_id;
    }
    for (const evaluation of attemptEvaluations) {
      const b = base(
        `evaluation:${evaluation.id}`,
        evaluation.evaluated_at,
        "evaluation_recorded",
      );
      if (accepted.has(evaluation.id) && evaluation.result)
        events.push({
          ...b,
          kind: "assessment_recorded",
          assessment: {
            evaluation_id: evaluation.id,
            evaluated_at: evaluation.evaluated_at,
            supersedes_id: evaluation.supersedes_id,
            is_current: evaluation.id === attempt.current_evaluation_id,
            results: evaluation.result.per_concept_results.map((r) => ({
              concept_id: r.concept_id,
              correctness: r.correctness,
            })),
            uncertainty_recorded:
              evaluation.result.uncertainty_reason !== null ||
              evaluation.result.per_concept_results.some(
                (r) => r.correctness === "uncertain",
              ),
          },
        });
      else if (evaluation.validation_status !== "accepted")
        events.push({
          ...b,
          kind: "evaluation_status_recorded",
          evaluation_id: evaluation.id,
          status:
            evaluation.evaluator.provider_outcome === "unknown"
              ? "outcome_unknown"
              : evaluation.validation_status === "pending_review"
                ? "pending"
                : evaluation.validation_status === "rejected"
                  ? "rejected"
                  : "failed",
        });
    }
    if (attempt.submitted_at)
      events.push({
        ...base(
          `answer:${attempt.id}`,
          attempt.submitted_at,
          "answer_submitted",
        ),
        kind: "answer_submitted",
        answer_id: attempt.id,
      });
    events.sort((a, b) =>
      notebookTime(a.recorded_at) < notebookTime(b.recorded_at)
        ? -1
        : notebookTime(a.recorded_at) > notebookTime(b.recorded_at)
          ? 1
          : a.event_id.localeCompare(b.event_id),
    );
    const times = events.map((e) => notebookTime(e.recorded_at));
    events.forEach((event, index) => {
      event.order = index;
      event.order_basis =
        times[index] === times[index - 1] || times[index] === times[index + 1]
          ? "stable_tie"
          : "recorded_time";
    });
    if (events.length > NOTEBOOK_LIMITS.events_per_attempt)
      throw new NotebookError("NOTEBOOK_LIMIT");
    const ref = attempt.question.content_ref;
    const safeRef =
      "source_kind" in ref
        ? {
            source_kind: ref.source_kind,
            source_id: ref.source_id,
            source_version: ref.source_version,
            document_sha256: ref.document_sha256,
            excerpt_sha256: ref.excerpt_sha256,
            attribution: ref.attribution,
            package_id: ref.package_id,
            content_version: ref.content_version,
          }
        : ref;
    const reviewOf = attempt.review_of_attempt_id
      ? (input.relations.links.get(attempt.review_of_attempt_id) ?? null)
      : null;
    if (attempt.review_of_attempt_id && !reviewOf)
      gaps.push("related_record_unavailable");
    return NotebookPageSchema.parse({
      attempt_id: attempt.id,
      sequence_index: attempt.sequence_index,
      root_attempt_id: attempt.root_attempt_id,
      parent_attempt_id: attempt.parent_attempt_id,
      review_of: reviewOf,
      intent: attempt.intent,
      source: {
        lesson_id: input.lesson.id,
        lesson_version: input.lesson.version,
        title: input.lesson.title,
        content_ref: safeRef,
      },
      question: {
        question_id: attempt.question.question_id,
        origin: attempt.question.origin,
        prompt_text: attempt.question.prompt_text,
        concept_ids: attempt.question.concept_ids,
        source_passage_ids: attempt.question.source_passage_ids,
        presented_at: attempt.presented_at,
        display_evidence: "not_recorded",
      },
      submission: attempt.submitted_at
        ? {
            answer_id: attempt.id,
            submission_key: attempt.submission_key,
            submitted_at: attempt.submitted_at,
            response_text: attempt.response_text,
            message_request_id: linked?.request_id ?? null,
            assistance_at_submission: attempt.assistance,
          }
        : null,
      assessment,
      events,
      messages: attemptOps.map((o) => ({
        request_id: o.request_id,
        state: o.message?.outcome.status ?? "pending",
        execution: providerCalls.some(
          (call) =>
            call.request_id === o.request_id && call.status === "unknown",
        )
          ? "outcome_unknown"
          : providerCalls.some(
                (call) =>
                  call.request_id === o.request_id &&
                  call.status === "reserved",
              )
            ? "pending"
            : providerCalls.some((call) => call.request_id === o.request_id)
              ? "settled"
              : "not_recorded",
      })),
      pending_deliveries: pending.sort((a, b) =>
        a.intervention_id.localeCompare(b.intervention_id),
      ),
      subsequent: [
        ...attempts
          .filter(
            (a) =>
              a.parent_attempt_id === attempt.id ||
              a.review_of_attempt_id === attempt.id,
          )
          .map((a) => ({
            relation:
              a.review_of_attempt_id === attempt.id
                ? "delayed_review"
                : "child_attempt",
            target: notebookLink(session.assignment_id, session.id, a.id),
          })),
        ...(input.relations.laterReviews?.get(attempt.id) ?? []).map(
          (target) => ({ relation: "delayed_review", target }),
        ),
      ],
      teacher_reviews: input.relations.reviews.get(attempt.id) ?? [],
      gaps: [...new Set(gaps)],
    });
  });
  const safeSession: StudentNotebook["session"] = {
    id: session.id,
    assignment_id: session.assignment_id,
    kind: followup ? "teacher_intervention_followup" : "tutoring",
    status: session.status,
    data_origin: session.data_origin,
    started_at: session.started_at,
    ended_at: session.ended_at,
    resume_href: resumeHref,
  };
  const serialized = canonical({
    version: NOTEBOOK_VERSION,
    session: safeSession,
    pages: fullPages,
  });
  if (Buffer.byteLength(serialized) > NOTEBOOK_LIMITS.bytes)
    throw new NotebookError("NOTEBOOK_LIMIT");
  const snapshot = createHash("sha256")
    .update(input.actorId)
    .update("\n")
    .update(serialized)
    .digest("hex");
  let start = 0;
  if (query.cursor) {
    let cursor: z.infer<typeof CursorSchema>;
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(query.cursor)) throw new Error();
      cursor = CursorSchema.parse(
        JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")),
      );
    } catch {
      throw new NotebookError("INVALID_CURSOR");
    }
    if (cursor.session_id !== session.id)
      throw new NotebookError("INVALID_CURSOR");
    if (cursor.snapshot !== snapshot)
      throw new NotebookError("SNAPSHOT_CHANGED");
    const index = fullPages.findIndex(
      (p) =>
        p.attempt_id === cursor.attempt_id &&
        p.sequence_index === cursor.sequence_index,
    );
    if (index < 0) throw new NotebookError("INVALID_CURSOR");
    start = index + 1;
  }
  if (query.attempt_id) {
    start = fullPages.findIndex((p) => p.attempt_id === query.attempt_id);
    if (start < 0) throw new EvidenceError(404, "Attempt not found.");
  }
  const pages = fullPages.slice(
    start,
    start + (query.attempt_id ? 1 : query.limit),
  );
  const last = pages.at(-1);
  const linkAt = (index: number) =>
    fullPages[index]
      ? notebookLink(
          session.assignment_id,
          session.id,
          fullPages[index].attempt_id,
        )
      : null;
  const nextCursor =
    !query.attempt_id && last && start + pages.length < fullPages.length
      ? Buffer.from(
          JSON.stringify({
            version: NOTEBOOK_VERSION,
            session_id: session.id,
            snapshot,
            attempt_id: last.attempt_id,
            sequence_index: last.sequence_index,
          }),
        ).toString("base64url")
      : null;
  return StudentNotebookSchema.parse({
    version: NOTEBOOK_VERSION,
    mode: "recorded_chronology",
    snapshot: { id: snapshot, read_at: input.readAt },
    session: safeSession,
    pages,
    paging: {
      next_cursor: nextCursor,
      total_attempts: fullPages.length,
      selected_attempt_id: query.attempt_id ?? null,
      previous: linkAt(start - 1),
      next: linkAt(start + pages.length),
    },
    coverage: "all_available_recorded_events_in_returned_pages",
  });
}
const CursorSchema = z.strictObject({
  version: z.literal(NOTEBOOK_VERSION),
  session_id: z.uuid(),
  snapshot: z.string().regex(/^[a-f0-9]{64}$/),
  attempt_id: z.uuid(),
  sequence_index: z.int().nonnegative(),
});
