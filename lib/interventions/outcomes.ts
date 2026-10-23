import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import type { SessionEvidence } from "../evidence/contracts.ts";
import { ContentRefSchema } from "../evidence/contracts.ts";
import {
  validateContentRef,
  validateQuestionSnapshot,
} from "../evidence/content.ts";
import { deriveAssistance } from "../evidence/rules.ts";
import { resolveAssignmentContent } from "../lessons/store.ts";
import { interventionRevisionEvidence } from "./evidence.ts";
import {
  EvidenceError,
  sessionEvidence,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { evaluateSubmittedAttempt } from "../evaluation/evaluate.ts";
import { evaluationRecovery } from "../evaluation/recovery.ts";
import type { requestEvaluation } from "../evaluation/provider.ts";
import { calculateClassMetrics } from "../teacher/metrics.ts";
import { InterventionApprovalSchema } from "./approval-contracts.ts";
import {
  InterventionComparisonSchema,
  InterventionFollowupActionSchema,
  StudentInterventionFollowupSchema,
  type StudentInterventionFollowup,
  type InterventionComparison,
} from "./outcomes-contracts.ts";

const ScopeSchema = z.object({
  snapshot: InterventionApprovalSchema,
  class_id: z.uuid(),
  displayed_at: z.iso.datetime({ offset: true }).nullable(),
  content_ref: ContentRefSchema,
  approved_concept_ids: z.array(z.string()),
  approved_passage_ids: z.array(z.string()),
  teacher_approved_at: z.unknown(),
  assignment_approval: z.object({ status: z.string() }),
});
type Scope = z.infer<typeof ScopeSchema>;
const LinkSchema = z.object({
  approval_id: z.uuid(),
  student_id: z.uuid(),
  session_id: z.uuid(),
  attempt_id: z.uuid(),
  started_at: z.iso.datetime({ offset: true }),
});
const DispatchSchema = z.object({
  request_id: z.uuid(),
  request: InterventionFollowupActionSchema,
  state: z.enum(["pending", "completed", "failed"]),
  evaluation_id: z.uuid().nullable(),
  failure_code: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  finished_at: z.iso.datetime({ offset: true }).nullable(),
  provider_metadata: z
    .object({
      provider_origin: z
        .enum(["injected_fixture", "configured_model"])
        .optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
});
type Dispatch = z.infer<typeof DispatchSchema>;

async function recipientScope(
  client: PoolClient,
  access: EvidenceAccess,
  approvalId: string,
  lock = false,
) {
  const result = await client.query(
    `SELECT a.snapshot,a.class_id,to_jsonb(r.displayed_at) AS displayed_at,
    assignment.content_ref,assignment.approved_concept_ids,assignment.approved_passage_ids,
    assignment.teacher_approved_at,assignment.approval AS assignment_approval
    FROM teacher_intervention_recipients r
    JOIN teacher_intervention_approvals a ON a.id=r.approval_id AND a.class_id=r.class_id
    JOIN teacher_intervention_deliveries d ON d.approval_id=a.id
    JOIN assignments assignment ON assignment.id=a.assignment_id AND assignment.class_id=r.class_id
    JOIN enrollments e ON e.class_id=r.class_id AND e.student_id=r.student_id
    JOIN profiles p ON p.id=r.student_id
    WHERE a.id=$1 AND r.student_id=$2 AND p.auth_user_id=$3
    ${lock ? "FOR UPDATE OF r FOR SHARE OF assignment,e,p" : ""}`,
    [approvalId, access.actor.profileId, access.actor.userId],
  );
  if (!result.rows[0])
    throw new EvidenceError(404, "Assigned intervention not found.");
  return ScopeSchema.parse(evidenceRow(result.rows[0]));
}

async function validateScope(
  client: PoolClient,
  access: EvidenceAccess,
  scope: Scope,
) {
  const content = await resolveAssignmentContent(
    client,
    access,
    scope.snapshot.assignment_id,
    "student",
  );
  try {
    validateContentRef(content, scope.content_ref);
    interventionRevisionEvidence(
      content,
      scope.snapshot.evidence,
      scope.snapshot.provenance.prompt_template_version,
    );
    validateQuestionSnapshot(content, scope.snapshot.activity.fresh_check);
  } catch {
    throw new EvidenceError(
      409,
      "This exact approved lesson version is unavailable for follow-up.",
    );
  }
  const question = scope.snapshot.activity.fresh_check;
  if (
    !scope.teacher_approved_at ||
    scope.assignment_approval.status !== "approved" ||
    !isDeepStrictEqual(scope.content_ref, scope.snapshot.content_ref) ||
    !isDeepStrictEqual(scope.content_ref, question.content_ref) ||
    question.concept_ids.some(
      (id) => !scope.approved_concept_ids.includes(id),
    ) ||
    question.source_passage_ids.some(
      (id) => !scope.approved_passage_ids.includes(id),
    )
  )
    throw new EvidenceError(
      409,
      "The approved intervention no longer matches the authorized assignment scope.",
    );
}

async function linkFor(
  client: PoolClient,
  approvalId: string,
  studentId: string,
) {
  const result = await client.query(
    "SELECT * FROM teacher_intervention_followups WHERE approval_id=$1 AND student_id=$2",
    [approvalId, studentId],
  );
  return result.rows[0] ? LinkSchema.parse(evidenceRow(result.rows[0])) : null;
}

/** Called while holding the recipient lock, before the session lock everywhere. */
export async function mirrorInterventionDisplay(
  client: PoolClient,
  approvalId: string,
  studentId: string,
) {
  const link = await linkFor(client, approvalId, studentId);
  if (!link) return;
  await client.query("SELECT id FROM sessions WHERE id=$1 FOR UPDATE", [
    link.session_id,
  ]);
  const result = await client.query(
    `SELECT a.snapshot,to_jsonb(r.displayed_at) AS displayed_at
    FROM teacher_intervention_recipients r JOIN teacher_intervention_approvals a ON a.id=r.approval_id
    WHERE r.approval_id=$1 AND r.student_id=$2`,
    [approvalId, studentId],
  );
  const row = z
    .object({
      snapshot: InterventionApprovalSchema,
      displayed_at: z.iso.datetime({ offset: true }).nullable(),
    })
    .parse(evidenceRow(result.rows[0]));
  if (!row.displayed_at) return;
  const existing = await client.query(
    "SELECT id FROM interventions WHERE session_id=$1 AND related_attempt_id=$2 AND type='corrective_feedback'",
    [link.session_id, link.attempt_id],
  );
  if (existing.rowCount) return;
  const activity = row.snapshot.activity;
  const concepts = [
    ...new Set([
      row.snapshot.evidence.concept.id,
      ...activity.fresh_check.concept_ids,
      ...activity.practice_questions.flatMap((q) => q.concept_ids),
    ]),
  ];
  await client.query(
    `INSERT INTO interventions(id,session_id,related_attempt_id,type,text_shown,concept_ids,source_passage_ids,content_ref,created_at,visible_at,delivery_status)
    VALUES($1,$2,$3,'corrective_feedback',$4,$5,$6,$7,$8,$8,'displayed')`,
    [
      randomUUID(),
      link.session_id,
      link.attempt_id,
      activity.explanation +
        "\n\n" +
        activity.source_references.map((s) => s.quote).join("\n\n"),
      concepts,
      activity.source_references.map((s) => s.passage_id),
      row.snapshot.content_ref,
      row.displayed_at,
    ],
  );
}

async function dispatches(client: PoolClient, attemptId: string) {
  const result = await client.query(
    "SELECT * FROM teacher_intervention_evaluation_requests WHERE attempt_id=$1 ORDER BY created_at,request_id",
    [attemptId],
  );
  return result.rows.map((row) => DispatchSchema.parse(evidenceRow(row)));
}

export function projectInterventionFollowup(
  approvalId: string,
  evidence: SessionEvidence | null,
  requests: readonly Dispatch[],
  now = Date.now(),
): StudentInterventionFollowup {
  const attempt = evidence?.attempts[0];
  const evaluations = evidence?.evaluations ?? [];
  const evaluation =
    evaluations.find((e) => e.id === attempt?.current_evaluation_id) ??
    evaluations.at(-1);
  const request = requests.at(-1);
  const accepted = evaluation?.validation_status === "accepted";
  const pending =
    !accepted &&
    (request?.state === "pending" ||
      evaluation?.validation_status === "pending_review" ||
      evaluation?.evaluator.provider_outcome === "unknown" ||
      (attempt?.submitted_at && !request));
  const failed =
    !accepted &&
    !pending &&
    (request?.state === "failed" ||
      evaluation?.validation_status === "rejected" ||
      evaluation?.validation_status === "evaluation_failed");
  const recovery = evaluationRecovery(evaluations, now);
  const retryAfter = request?.finished_at
    ? new Date(Date.parse(request.finished_at) + 60_000).toISOString()
    : null;
  const retryAllowed =
    !!failed &&
    requests.length < 3 &&
    !!retryAfter &&
    now >= Date.parse(retryAfter) &&
    (!evaluation || recovery.allowed);
  const uncertain =
    !!accepted &&
    (evaluation.result?.uncertainty_reason !== null ||
      evaluation.result?.per_concept_results.some(
        (r) => r.correctness === "uncertain",
      ));
  const results = accepted
    ? evaluation.result!.per_concept_results.map((r) => ({
        concept_id: r.concept_id,
        correctness: r.correctness,
      }))
    : [];
  return StudentInterventionFollowupSchema.parse({
    approval_id: approvalId,
    started_at: evidence?.session.started_at ?? null,
    attempt_id: attempt?.id ?? null,
    submitted_at: attempt?.submitted_at ?? null,
    response_text: attempt?.response_text ?? null,
    assistance: attempt?.assistance ?? null,
    evaluation_status: !attempt?.submitted_at
      ? "not_submitted"
      : accepted
        ? "accepted"
        : failed
          ? "failed"
          : "pending",
    evaluation_id: evaluation?.id ?? null,
    results,
    uncertain,
    feedback: !attempt?.submitted_at
      ? null
      : accepted
        ? uncertain
          ? "Your response is saved. The evaluation has uncertainty; review it with your teacher."
          : results.every((r) => r.correctness === "correct")
            ? "Your response demonstrates the assessed reasoning on this check. Success after review does not establish lasting retention."
            : "Your response is saved. Some assessed reasoning needs more work; compare it with the review activity and discuss it with your teacher."
        : pending
          ? "Your response is saved. Evaluation is pending or its outcome is unknown. Check status; another paid evaluation will not start automatically."
          : "Your response is saved, but evaluation did not succeed. You can retry when available without resubmitting your answer.",
    retry_allowed: retryAllowed,
    retry_after: failed ? retryAfter : null,
    evaluator_type: evaluation?.evaluator.type ?? null,
    evaluation_provenance: !evaluation
      ? null
      : evaluation.evaluator.type === "human_review"
        ? "human_review"
        : evaluation.evaluator.type === "synthetic_fixture"
          ? "injected_fixture"
          : (requests.findLast((r) => r.evaluation_id === evaluation.id)
              ?.provider_metadata?.provider_origin ?? "unknown"),
  });
}

export async function readStudentInterventionFollowup(
  access: EvidenceAccess,
  approvalId: string,
) {
  z.uuid().parse(approvalId);
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const scope = await recipientScope(client, access, approvalId);
    await validateScope(client, access, scope);
    const link = await linkFor(client, approvalId, access.actor.profileId);
    return projectInterventionFollowup(
      approvalId,
      link
        ? await sessionEvidence(
            client,
            access,
            link.session_id,
            "student",
            false,
          )
        : null,
      link ? await dispatches(client, link.attempt_id) : [],
    );
  });
}

/** One approved question, one original answer; no deterministic tutor transition. */
export async function applyStudentInterventionFollowup(
  access: EvidenceAccess,
  approvalId: string,
  raw: unknown,
  options: { provider?: typeof requestEvaluation } = {},
) {
  z.uuid().parse(approvalId);
  const input = InterventionFollowupActionSchema.parse(raw);
  const reserved = await transaction(async (client) => {
    const scope = await recipientScope(client, access, approvalId, true);
    await validateScope(client, access, scope);
    let link = await linkFor(client, approvalId, access.actor.profileId);
    if (input.action === "start") {
      if (!link) {
        const sessionId = randomUUID(),
          attemptId = randomUUID();
        const clock = await client.query(
          "SELECT to_jsonb(clock_timestamp()) AS now",
        );
        const now = z
          .object({ now: z.iso.datetime({ offset: true }) })
          .parse(clock.rows[0]).now;
        await client.query(
          "INSERT INTO sessions(id,student_id,assignment_id,class_id,data_origin,started_at) VALUES($1,$2,$3,$4,'live_demo',$5)",
          [
            sessionId,
            access.actor.profileId,
            scope.snapshot.assignment_id,
            scope.class_id,
            now,
          ],
        );
        await client.query(
          "INSERT INTO attempts(id,session_id,sequence_index,root_attempt_id,question,intent,presented_at) VALUES($1,$2,0,$1,$3,'immediate_retest',$4)",
          [attemptId, sessionId, scope.snapshot.activity.fresh_check, now],
        );
        await client.query(
          "INSERT INTO teacher_intervention_followups(approval_id,student_id,session_id,attempt_id,started_at) VALUES($1,$2,$3,$4,$5)",
          [approvalId, access.actor.profileId, sessionId, attemptId, now],
        );
        link = await linkFor(client, approvalId, access.actor.profileId);
      }
      await mirrorInterventionDisplay(
        client,
        approvalId,
        access.actor.profileId,
      );
      return null;
    }
    if (!link)
      throw new EvidenceError(
        409,
        "Start the fresh check before submitting an answer.",
      );
    const replay = await client.query(
      "SELECT approval_id,request FROM teacher_intervention_evaluation_requests WHERE student_id=$1 AND request_id=$2",
      [access.actor.profileId, input.request_id],
    );
    if (replay.rows[0]) {
      if (
        replay.rows[0].approval_id !== approvalId ||
        !isDeepStrictEqual(replay.rows[0].request, input)
      )
        throw new EvidenceError(
          409,
          "This request identity already belongs to different saved work.",
        );
      return null;
    }
    await mirrorInterventionDisplay(client, approvalId, access.actor.profileId);
    const evidence = await sessionEvidence(
      client,
      access,
      link.session_id,
      "student",
      true,
    );
    const attempt = evidence.attempts[0];
    if (
      !attempt ||
      attempt.id !== link.attempt_id ||
      !isDeepStrictEqual(attempt.question, scope.snapshot.activity.fresh_check)
    )
      throw new EvidenceError(
        409,
        "The saved fresh-check identity does not match its approval.",
      );
    let retryOf: string | undefined;
    if (input.action === "submit") {
      if (attempt.submitted_at)
        throw new EvidenceError(
          409,
          "This fresh check already has a saved answer. Reload it to inspect the response.",
        );
      const clock = await client.query(
        "SELECT to_jsonb(clock_timestamp()) AS now",
      );
      const now = z
        .object({ now: z.iso.datetime({ offset: true }) })
        .parse(clock.rows[0]).now;
      const assistance = deriveAssistance(
        attempt.question,
        attempt.intent,
        attempt.presented_at,
        now,
        evidence.interventions,
      );
      await client.query("SELECT * FROM submit_answer($1,$2,$3,$4,$5)", [
        attempt.id,
        input.request_id,
        input.response_text,
        assistance,
        now,
      ]);
    } else {
      const current = projectInterventionFollowup(
        approvalId,
        evidence,
        await dispatches(client, attempt.id),
      );
      if (
        !current.retry_allowed ||
        current.evaluation_id !== input.expected_evaluation_id
      )
        throw new EvidenceError(
          409,
          "This evaluation cannot be retried now. Refresh the saved status; unknown outcomes need teacher review.",
        );
      retryOf = current.evaluation_id ?? undefined;
    }
    await client.query(
      "INSERT INTO teacher_intervention_evaluation_requests(student_id,request_id,approval_id,attempt_id,request) VALUES($1,$2,$3,$4,$5)",
      [access.actor.profileId, input.request_id, approvalId, attempt.id, input],
    );
    return {
      sessionId: link.session_id,
      attemptId: link.attempt_id,
      requestId: input.request_id,
      retryOf,
    };
  });
  if (reserved) {
    try {
      const run = await evaluateSubmittedAttempt(
        access,
        reserved.sessionId,
        reserved.attemptId,
        reserved.retryOf,
        options,
      );
      const pending =
        run.evaluation?.validation_status === "pending_review" ||
        run.evaluation?.evaluator.provider_outcome === "unknown" ||
        run.failure?.code === "persistence_failed";
      const provider = run.provider;
      await transaction(async (client) => {
        // Completing a started operation cannot alter the approval or original answer.
        await recipientScope(client, access, approvalId, true);
        await client.query(
          `UPDATE teacher_intervention_evaluation_requests SET state=$3,evaluation_id=$4,failure_code=$5,
          provider_metadata=$6,finished_at=CASE WHEN $3='pending' THEN NULL ELSE clock_timestamp() END
          WHERE student_id=$1 AND request_id=$2 AND state='pending'`,
          [
            access.actor.profileId,
            reserved.requestId,
            pending
              ? "pending"
              : run.evaluation?.validation_status === "accepted"
                ? "completed"
                : "failed",
            run.evaluation?.id ?? null,
            run.failure?.code ?? null,
            provider
              ? {
                  model: provider.model,
                  response_id: provider.responseId ?? null,
                  usage: provider.usage ?? null,
                  provider_origin: options.provider
                    ? "injected_fixture"
                    : "configured_model",
                }
              : null,
          ],
        );
      });
    } catch {
      // The durable reservation remains pending: never infer that an interrupted
      // call did not spend, and never erase the student's committed response.
    }
  }
  return readStudentInterventionFollowup(access, approvalId);
}

/** Authorized projection of existing evidence; no dashboard-only answer store. */
export async function readInterventionComparison(
  access: EvidenceAccess,
  draftId: string,
) {
  z.uuid().parse(draftId);
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const owned = await client.query(
      `SELECT d.id FROM teacher_intervention_drafts d JOIN assignments a ON a.id=d.assignment_id
      JOIN classes c ON c.id=a.class_id JOIN profiles p ON p.id=c.teacher_id
      WHERE d.id=$1 AND d.teacher_id=$2 AND c.teacher_id=$2 AND p.auth_user_id=$3`,
      [draftId, access.actor.profileId, access.actor.userId],
    );
    if (!owned.rows[0])
      throw new EvidenceError(404, "Intervention draft not found.");
    const approvals = await client.query(
      "SELECT a.snapshot FROM teacher_intervention_approvals a JOIN teacher_intervention_deliveries d ON d.approval_id=a.id WHERE a.draft_id=$1",
      [draftId],
    );
    if (!approvals.rows[0]) return null;
    const approval = InterventionApprovalSchema.parse(
      approvals.rows[0].snapshot,
    );
    const rows = await client.query(
      `SELECT r.student_id,p.display_name,to_jsonb(r.displayed_at) AS displayed_at
      FROM teacher_intervention_recipients r JOIN profiles p ON p.id=r.student_id WHERE r.approval_id=$1 ORDER BY p.display_name,r.student_id`,
      [approval.id],
    );
    const roster = z
      .array(
        z.object({
          student_id: z.uuid(),
          display_name: z.string(),
          displayed_at: z.iso.datetime({ offset: true }).nullable(),
        }),
      )
      .parse(evidenceRow(rows.rows));
    const sessions: SessionEvidence[] = [];
    const recipients: InterventionComparison["recipients"] = [];
    for (const row of roster) {
      const link = await linkFor(client, approval.id, row.student_id);
      const evidence = link
        ? await sessionEvidence(
            client,
            access,
            link.session_id,
            "teacher",
            false,
          )
        : null;
      if (evidence) sessions.push(evidence);
      const followup = projectInterventionFollowup(
        approval.id,
        evidence,
        link ? await dispatches(client, link.attempt_id) : [],
      );
      recipients.push({
        ...row,
        session_id: link?.session_id ?? null,
        followup,
        attempt: evidence?.attempts[0] ?? null,
        evaluation:
          evidence?.evaluations.find((e) => e.id === followup.evaluation_id) ??
          null,
        evaluations: evidence?.evaluations ?? [],
      });
    }
    const count = (predicate: (row: (typeof recipients)[number]) => boolean) =>
      new Set(recipients.filter(predicate).map((row) => row.student_id)).size;
    return InterventionComparisonSchema.parse({
      approval_id: approval.id,
      draft_id: draftId,
      approved_revision: approval.approved_revision,
      assignment_id: approval.assignment_id,
      content_ref: approval.content_ref,
      original_evidence: approval.evidence,
      counts: {
        intended: roster.length,
        started: count((r) => r.followup.started_at !== null),
        submitted: count((r) => r.followup.submitted_at !== null),
        missing: count((r) => r.followup.submitted_at === null),
        accepted: count((r) => r.followup.evaluation_status === "accepted"),
        pending: count((r) => r.followup.evaluation_status === "pending"),
        failed: count((r) => r.followup.evaluation_status === "failed"),
        uncertain: count((r) => r.followup.uncertain),
      },
      metrics: calculateClassMetrics(
        roster.map((r) => r.student_id),
        approval.activity.fresh_check.concept_ids,
        sessions,
      ),
      recipients,
    });
  });
}
