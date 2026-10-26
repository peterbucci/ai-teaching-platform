import "server-only";
import type { PoolClient } from "pg";
import { isDeepStrictEqual as same } from "node:util";
import { z } from "zod";
import { SessionEvidenceSchema } from "./contracts.ts";
import { resolveAssignmentContent } from "../lessons/store.ts";
import { validateContentRef, validateQuestionSnapshot } from "./content.ts";
import { InterventionApprovalSchema } from "../interventions/approval-contracts.ts";
import { interventionRevisionEvidence } from "../interventions/evidence.ts";
import { EvidenceError, transaction, type EvidenceAccess } from "./store.ts";
import {
  NOTEBOOK_LIMITS,
  NotebookQuerySchema,
  type NotebookReview,
} from "./student-notebook-contracts.ts";
import {
  NotebookError,
  notebookAssert,
  notebookLink,
  projectStudentNotebook,
  type NotebookRelations,
} from "./student-notebook-project.ts";

// Every query is static SQL with bound values. A LIMIT+1 detects overflow; do not
// silently truncate a whole attempt. Large private JSON never crosses the DB boundary.
async function boundedRows(
  client: PoolClient,
  sql: string,
  values: unknown[],
  limit: number,
) {
  const result = await client.query(
    `WITH bounded AS (${sql}), measured AS (
    SELECT record, sum(pg_column_size(record)) OVER () AS bytes FROM bounded
  ) SELECT CASE WHEN bytes <= ${NOTEBOOK_LIMITS.input_bytes} THEN record ELSE NULL END AS record, bytes::text FROM measured`,
    values,
  );
  if (
    result.rows.length > limit ||
    result.rows.some((row) => row.record === null)
  )
    throw new NotebookError("NOTEBOOK_LIMIT");
  return result.rows.map((row: { record: unknown }) => row.record);
}

/** No writes, locks, dispatch, reconciliation, display acknowledgment or evaluator. */
export async function readStudentNotebook(
  access: EvidenceAccess,
  sessionId: string,
  rawQuery: unknown = {},
) {
  z.uuid().parse(sessionId);
  const query = NotebookQuerySchema.parse(rawQuery);
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    await client.query("SET LOCAL statement_timeout = '10s'");
    // Both actor identities are verified. Teacher/class ownership does not grant this view.
    const scope = await client.query(
      `SELECT to_jsonb(s) AS session, a.lesson_id, a.lesson_version::text AS lesson_version,
      a.title, to_jsonb(transaction_timestamp()) AS read_at
      FROM sessions s JOIN profiles p ON p.id=s.student_id
      JOIN enrollments e ON e.class_id=s.class_id AND e.student_id=s.student_id
      JOIN assignments a ON a.id=s.assignment_id AND a.class_id=s.class_id
      WHERE s.id=$1 AND p.id=$2 AND p.auth_user_id=$3 AND a.teacher_approved_at IS NOT NULL`,
      [sessionId, access.actor.profileId, access.actor.userId],
    );
    if (!scope.rows[0]) throw new EvidenceError(404, "Session not found.");
    const row = z
      .object({
        session: SessionEvidenceSchema.shape.session,
        lesson_id: z.string(),
        lesson_version: z.string(),
        title: z.string(),
        read_at: z.iso.datetime({ offset: true }),
      })
      .parse(scope.rows[0]);
    const content = await resolveAssignmentContent(
      client,
      access,
      row.session.assignment_id,
      "student",
    );
    const attempts = await boundedRows(
      client,
      `SELECT to_jsonb(a) AS record FROM attempts a WHERE a.session_id=$1
      ORDER BY a.sequence_index,a.id LIMIT ${NOTEBOOK_LIMITS.attempts + 1}`,
      [sessionId],
      NOTEBOOK_LIMITS.attempts,
    );
    const evaluations = await boundedRows(
      client,
      `SELECT to_jsonb(e) AS record FROM evaluations e JOIN attempts a ON a.id=e.attempt_id
      WHERE a.session_id=$1 ORDER BY e.evaluated_at,e.id LIMIT ${NOTEBOOK_LIMITS.evaluations + 1}`,
      [sessionId],
      NOTEBOOK_LIMITS.evaluations,
    );
    const interventions = await boundedRows(
      client,
      `SELECT to_jsonb(i) AS record FROM interventions i WHERE i.session_id=$1
      ORDER BY i.created_at,i.id LIMIT ${NOTEBOOK_LIMITS.interventions + 1}`,
      [sessionId],
      NOTEBOOK_LIMITS.interventions,
    );
    const operations = await boundedRows(
      client,
      `SELECT to_jsonb(o) AS record FROM dialogue_operations o WHERE o.session_id=$1
      ORDER BY o.created_at,o.request_id LIMIT ${NOTEBOOK_LIMITS.operations + 1}`,
      [sessionId],
      NOTEBOOK_LIMITS.operations,
    );
    const audit = await boundedRows(
      client,
      `SELECT to_jsonb(e) || jsonb_build_object('sequence', e.sequence::text) AS record
      FROM dialogue_events e JOIN dialogue_operations o USING(request_id) WHERE o.session_id=$1
      ORDER BY e.sequence LIMIT ${NOTEBOOK_LIMITS.audit_events + 1}`,
      [sessionId],
      NOTEBOOK_LIMITS.audit_events,
    );
    const providerCalls = await boundedRows(
      client,
      `SELECT jsonb_build_object('request_id',p.request_id,'status',p.status) AS record
      FROM dialogue_provider_calls p WHERE p.session_id=$1 ORDER BY p.started_at,p.id LIMIT ${NOTEBOOK_LIMITS.provider_calls + 1}`,
      [sessionId],
      NOTEBOOK_LIMITS.provider_calls,
    );
    const evidence = SessionEvidenceSchema.parse({
      session: row.session,
      attempts,
      evaluations,
      interventions,
    });
    const relations: NotebookRelations = {
      links: new Map(),
      reviews: new Map(),
      followup: null,
      pendingEvaluationAttempts: new Set(),
      laterReviews: new Map(),
    };
    // Historical review_of links are identity joins, separately authorized in this same snapshot.
    const priorIds = evidence.attempts.flatMap((a) =>
      a.review_of_attempt_id ? [a.review_of_attempt_id] : [],
    );
    if (priorIds.length) {
      const prior = await client.query(
        `SELECT a.id,a.session_id,s.assignment_id FROM attempts a
        JOIN sessions s ON s.id=a.session_id JOIN enrollments e ON e.class_id=s.class_id AND e.student_id=s.student_id
        WHERE a.id=ANY($1::uuid[]) AND s.student_id=$2`,
        [priorIds, access.actor.profileId],
      );
      for (const raw of prior.rows) {
        const link = z
          .object({
            id: z.uuid(),
            session_id: z.uuid(),
            assignment_id: z.uuid(),
          })
          .parse(raw);
        relations.links.set(
          link.id,
          notebookLink(link.assignment_id, link.session_id, link.id),
        );
      }
    }
    const later = await boundedRows(
      client,
      `SELECT jsonb_build_object('id',a.id,'session_id',a.session_id,
      'assignment_id',s.assignment_id,'review_of',a.review_of_attempt_id) AS record FROM attempts a
      JOIN sessions s ON s.id=a.session_id JOIN enrollments e ON e.class_id=s.class_id AND e.student_id=s.student_id
      WHERE a.review_of_attempt_id=ANY($1::uuid[]) AND s.student_id=$2 AND s.id<>$3
      ORDER BY a.presented_at,a.id LIMIT ${NOTEBOOK_LIMITS.attempts + 1}`,
      [evidence.attempts.map((a) => a.id), access.actor.profileId, sessionId],
      NOTEBOOK_LIMITS.attempts,
    );
    for (const raw of later) {
      const link = z
        .object({
          id: z.uuid(),
          session_id: z.uuid(),
          assignment_id: z.uuid(),
          review_of: z.uuid(),
        })
        .parse(raw);
      relations.laterReviews!.set(link.review_of, [
        ...(relations.laterReviews!.get(link.review_of) ?? []),
        notebookLink(link.assignment_id, link.session_id, link.id),
      ]);
    }
    const reviewRows = await boundedRows(
      client,
      `SELECT jsonb_build_object('snapshot',a.snapshot,'approval_id',a.id,
      'assignment_id',a.assignment_id,'approved_revision',a.approved_revision,'delivered_at',d.delivered_at,
      'displayed_at',r.displayed_at,'followup',to_jsonb(f)) AS record
      FROM teacher_intervention_approvals a
      JOIN teacher_intervention_deliveries d ON d.approval_id=a.id
      JOIN teacher_intervention_recipients r ON r.approval_id=a.id AND r.class_id=a.class_id
      JOIN enrollments e ON e.class_id=r.class_id AND e.student_id=r.student_id
      LEFT JOIN teacher_intervention_followups f ON f.approval_id=a.id AND f.student_id=r.student_id
      WHERE r.student_id=$2 AND a.assignment_id=$3 AND (f.session_id=$1 OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(a.snapshot->'activity'->'evidence_references') ref
        JOIN attempts t ON t.id::text=ref->>'attempt_id' WHERE t.session_id=$1))
      ORDER BY d.delivered_at,a.id LIMIT ${NOTEBOOK_LIMITS.reviews + 1}`,
      [sessionId, access.actor.profileId, row.session.assignment_id],
      NOTEBOOK_LIMITS.reviews,
    );
    for (const raw of reviewRows) {
      const review = z
        .object({
          snapshot: InterventionApprovalSchema,
          approval_id: z.uuid(),
          assignment_id: z.uuid(),
          approved_revision: z.int(),
          delivered_at: z.iso.datetime({ offset: true }),
          displayed_at: z.iso.datetime({ offset: true }).nullable(),
          followup: z
            .object({
              student_id: z.uuid(),
              approval_id: z.uuid(),
              session_id: z.uuid(),
              attempt_id: z.uuid(),
            })
            .nullable(),
        })
        .parse(raw);
      const approval = review.snapshot;
      notebookAssert(
        approval.id === review.approval_id &&
          approval.assignment_id === row.session.assignment_id &&
          approval.approved_revision === review.approved_revision &&
          approval.recipient_ids.includes(access.actor.profileId),
      );
      validateContentRef(content, approval.content_ref);
      interventionRevisionEvidence(
        content,
        approval.evidence,
        approval.provenance.prompt_template_version,
      );
      validateQuestionSnapshot(content, approval.activity.fresh_check);
      const followup = review.followup;
      if (followup)
        notebookAssert(
          followup.student_id === access.actor.profileId &&
            followup.approval_id === approval.id,
        );
      // FK/guard enforce recipient/session/attempt ownership. Recheck before exposing links.
      let target = null;
      if (followup) {
        const owned = await client.query(
          `SELECT 1 FROM sessions s JOIN attempts t ON t.session_id=s.id
          JOIN enrollments e ON e.class_id=s.class_id AND e.student_id=s.student_id
          WHERE s.id=$1 AND t.id=$2 AND s.student_id=$3 AND s.assignment_id=$4 AND t.question=$5::jsonb`,
          [
            followup.session_id,
            followup.attempt_id,
            access.actor.profileId,
            row.session.assignment_id,
            JSON.stringify(approval.activity.fresh_check),
          ],
        );
        notebookAssert(owned.rowCount === 1);
        target = {
          ...notebookLink(
            row.session.assignment_id,
            followup.session_id,
            followup.attempt_id,
          ),
          href: `/study/interventions/${approval.id}`,
        };
      }
      const ownReferences = approval.activity.evidence_references.filter(
        (ref) =>
          evidence.attempts.some((a) => a.id === ref.attempt_id) &&
          approval.evidence.observations.some(
            (o) =>
              o.student_id === access.actor.profileId &&
              o.session_id === sessionId &&
              o.attempt.id === ref.attempt_id &&
              o.attempt.session_id === sessionId &&
              o.evaluation.id === ref.evaluation_id &&
              o.evaluation.attempt_id === ref.attempt_id,
          ) &&
          evidence.evaluations.some(
            (e) =>
              e.id === ref.evaluation_id && e.attempt_id === ref.attempt_id,
          ),
      );
      const affected = [...new Set(ownReferences.map((ref) => ref.attempt_id))];
      if (followup?.session_id === sessionId) {
        notebookAssert(
          !relations.followup &&
            evidence.attempts.length === 1 &&
            same(
              evidence.attempts[0].question,
              approval.activity.fresh_check,
            ) &&
            evidence.attempts[0].id === followup.attempt_id,
        );
        relations.followup = {
          approval_id: approval.id,
          attempt_id: followup.attempt_id,
          displayed_at: review.displayed_at,
        };
        affected.push(followup.attempt_id);
      }
      for (const attemptId of new Set(affected)) {
        const item: NotebookReview = {
          approval_id: approval.id,
          approved_revision: approval.approved_revision,
          assignment_id: row.session.assignment_id,
          delivered_at: review.delivered_at,
          displayed_at: review.displayed_at,
          relation:
            attemptId === followup?.attempt_id
              ? "fresh_check_for_this_approval"
              : "references_this_attempt",
          followup: target,
          href: `/study/interventions/${approval.id}`,
        };
        relations.reviews.set(attemptId, [
          ...(relations.reviews.get(attemptId) ?? []),
          item,
        ]);
      }
    }
    const membership = await client.query(
      "SELECT approval_id FROM teacher_intervention_followups WHERE session_id=$1",
      [sessionId],
    );
    // Do not accidentally treat an inaccessible follow-up as an ordinary tutoring session.
    notebookAssert(membership.rowCount === (relations.followup ? 1 : 0));
    if (relations.followup) {
      const pending = await client.query(
        `SELECT DISTINCT attempt_id FROM teacher_intervention_evaluation_requests
        WHERE student_id=$1 AND approval_id=$2 AND attempt_id=$3 AND state='pending'`,
        [
          access.actor.profileId,
          relations.followup.approval_id,
          relations.followup.attempt_id,
        ],
      );
      for (const item of pending.rows)
        relations.pendingEvaluationAttempts.add(
          z.object({ attempt_id: z.uuid() }).parse(item).attempt_id,
        );
    }
    try {
      return projectStudentNotebook(
        {
          actorId: access.actor.profileId,
          evidence,
          content,
          lesson: {
            id: row.lesson_id,
            version: row.lesson_version,
            title: row.title,
          },
          operations,
          providerCalls,
          audit,
          relations,
          readAt: row.read_at,
        },
        query,
      );
    } catch (error) {
      if (error instanceof EvidenceError) throw error;
      throw new NotebookError("EVIDENCE_UNAVAILABLE");
    }
  }).catch((error) => {
    // Invalid caller input was parsed before the transaction. A malformed saved
    // record is unavailable evidence, never an invalid browser request.
    if (error instanceof z.ZodError)
      throw new NotebookError("EVIDENCE_UNAVAILABLE");
    throw error;
  });
}
