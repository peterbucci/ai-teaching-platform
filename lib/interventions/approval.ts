import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import { ContentRefSchema } from "../evidence/contracts.ts";
import { validateContentRef } from "../evidence/content.ts";
import { resolveAssignmentContent } from "../lessons/store.ts";
import { interventionRevisionEvidence } from "./evidence.ts";
import {
  EvidenceError,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { InterventionDraftSchema, type InterventionDraft } from "./drafts.ts";
import { readInterventionDraft } from "./store.ts";
import { validateEditedIntervention } from "./approval-validation.ts";
import { mirrorInterventionDisplay } from "./outcomes.ts";
import {
  InterventionActionSchema,
  InterventionApprovalSchema,
  InterventionDeliverySchema,
  InterventionReviewSchema,
  StudentInterventionSchema,
  toStudentInterventionActivity,
  type InterventionApproval,
  type InterventionReview,
} from "./approval-contracts.ts";

const ScopeSchema = z.object({
  class_id: z.uuid(),
  assignment_id: z.uuid(),
  snapshot: InterventionDraftSchema,
  content_ref: ContentRefSchema,
  approved_concept_ids: z.array(z.string()),
  approved_passage_ids: z.array(z.string()),
  approval: z.object({ status: z.string() }),
  teacher_approved_by: z.uuid().nullable(),
  teacher_approved_at: z.iso.datetime({ offset: true }).nullable(),
});
type Scope = z.infer<typeof ScopeSchema>;

async function ownedDraft(
  client: PoolClient,
  access: EvidenceAccess,
  draftId: string,
): Promise<Scope> {
  const result = await client.query(
    `SELECT d.snapshot,d.assignment_id,a.class_id,a.content_ref,a.approved_concept_ids,
      a.approved_passage_ids,a.approval,a.teacher_approved_by,a.teacher_approved_at
     FROM teacher_intervention_drafts d JOIN assignments a ON a.id=d.assignment_id
     JOIN classes c ON c.id=a.class_id JOIN profiles p ON p.id=c.teacher_id
     WHERE d.id=$1 AND d.teacher_id=$2 AND c.teacher_id=$2 AND p.auth_user_id=$3 AND d.revision>0
     FOR UPDATE OF d FOR SHARE OF a,c,p`,
    [draftId, access.actor.profileId, access.actor.userId],
  );
  if (!result.rows[0])
    throw new EvidenceError(404, "Intervention draft not found.");
  return ScopeSchema.parse(evidenceRow(result.rows[0]));
}

async function validateScope(
  client: PoolClient,
  access: EvidenceAccess,
  scope: Scope,
  requireActivation: boolean,
) {
  const draft = scope.snapshot;
  const content = await resolveAssignmentContent(
    client,
    access,
    scope.assignment_id,
    "teacher",
  );
  try {
    validateContentRef(content, scope.content_ref);
    interventionRevisionEvidence(
      content,
      draft.evidence,
      draft.provenance.prompt_template_version,
    );
  } catch {
    throw new EvidenceError(
      409,
      "This exact approved lesson version is unavailable.",
    );
  }
  if (
    !isDeepStrictEqual(scope.content_ref, draft.evidence.content_ref) ||
    draft.assignment_id !== scope.assignment_id ||
    draft.evidence.selection.assignment_id !== scope.assignment_id ||
    scope.approval.status !== "approved" ||
    !scope.approved_concept_ids.includes(draft.evidence.concept.id) ||
    draft.evidence.sources.some(
      (source) => !scope.approved_passage_ids.includes(source.passage_id),
    )
  )
    throw new EvidenceError(
      409,
      "The draft no longer matches its authorized assignment and source version.",
    );
  for (const q of [
    ...draft.activity.practice_questions,
    draft.activity.fresh_check,
  ])
    if (
      q.concept_ids.some((id) => !scope.approved_concept_ids.includes(id)) ||
      q.source_passage_ids.some(
        (id) => !scope.approved_passage_ids.includes(id),
      )
    )
      throw new EvidenceError(
        409,
        "An activity question is outside the authorized assignment scope.",
      );
  if (
    requireActivation &&
    (!scope.teacher_approved_at || scope.teacher_approved_by === null)
  )
    throw new EvidenceError(
      409,
      "Activate the approved source assignment before approving or delivering this intervention.",
    );
}

async function review(
  client: PoolClient,
  scope: Scope,
): Promise<InterventionReview> {
  const recipients = await client.query(
    `SELECT e.student_id,p.display_name FROM enrollments e JOIN profiles p ON p.id=e.student_id
     WHERE e.class_id=$1 ORDER BY p.display_name,e.student_id FOR SHARE OF e,p`,
    [scope.class_id],
  );
  const approvals = await client.query(
    "SELECT snapshot FROM teacher_intervention_approvals WHERE draft_id=$1",
    [scope.snapshot.id],
  );
  const approval = approvals.rows[0]
    ? InterventionApprovalSchema.parse(approvals.rows[0].snapshot)
    : null;
  const deliveries = approval
    ? await client.query(
        "SELECT snapshot FROM teacher_intervention_deliveries WHERE approval_id=$1",
        [approval.id],
      )
    : null;
  return InterventionReviewSchema.parse({
    draft: scope.snapshot,
    eligible_recipients: recipients.rows,
    approval,
    delivery: deliveries?.rows[0]
      ? InterventionDeliverySchema.parse(deliveries.rows[0].snapshot)
      : null,
  });
}

export async function readInterventionReview(
  access: EvidenceAccess,
  draftId: string,
): Promise<InterventionReview> {
  // Consume #44's read contract; authorization is rechecked under the transaction lock.
  await readInterventionDraft(access, draftId);
  return transaction(async (client) =>
    review(client, await ownedDraft(client, access, draftId)),
  );
}

function editedActivity(raw: unknown, draft: InterventionDraft) {
  try {
    return validateEditedIntervention(raw, draft);
  } catch (error) {
    if (error instanceof z.ZodError) throw error;
    throw new EvidenceError(
      400,
      error instanceof Error ? error.message : "The activity is invalid.",
    );
  }
}

/** One atomic teacher decision. Saved journal outcomes reconcile lost HTTP responses. */
export async function applyInterventionAction(
  access: EvidenceAccess,
  draftId: string,
  raw: unknown,
): Promise<InterventionReview> {
  z.uuid().parse(draftId);
  const input = InterventionActionSchema.parse(raw);
  if (input.action === "approve") input.recipient_ids.sort();
  const hash = createHash("sha256")
    .update(JSON.stringify({ draft_id: draftId, ...input }))
    .digest("hex");
  return transaction(async (client) => {
    // Serialize the teacher's action IDs, including concurrent use on different drafts.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `intervention-action:${access.actor.profileId}`,
    ]);
    const scope = await ownedDraft(client, access, draftId);
    const prior = scope.snapshot;
    const replay = await client.query(
      "SELECT request_hash FROM teacher_intervention_actions WHERE teacher_id=$1 AND request_id=$2",
      [access.actor.profileId, input.request_id],
    );
    if (replay.rows[0]) {
      if (replay.rows[0].request_hash !== hash)
        throw new EvidenceError(
          409,
          "This request ID was used for a different action. Reload the saved intervention.",
        );
      return review(client, scope);
    }
    if (prior.revision !== input.expected_revision)
      throw new EvidenceError(
        409,
        "The draft changed. Reload and review its latest revision before continuing.",
      );
    let current = await review(client, scope);
    const now = new Date().toISOString();
    if (input.action === "deliver") {
      if (
        prior.status !== "approved" ||
        !current.approval ||
        current.approval.id !== input.approval_id
      )
        throw new EvidenceError(
          409,
          "Only the explicitly approved version can be delivered.",
        );
      await validateScope(client, access, scope, true);
      editedActivity(current.approval.activity, prior);
      validateRecipients(current.approval.recipient_ids, current);
      if (!current.delivery) {
        const delivery = InterventionDeliverySchema.parse({
          id: randomUUID(),
          approval_id: current.approval.id,
          delivered_by: access.actor.profileId,
          delivered_at: now,
          recipient_ids: current.approval.recipient_ids,
        });
        await client.query(
          `INSERT INTO teacher_intervention_deliveries(id,approval_id,delivered_by,delivered_at,snapshot)
          VALUES($1,$2,$3,$4,$5)`,
          [
            delivery.id,
            delivery.approval_id,
            delivery.delivered_by,
            delivery.delivered_at,
            delivery,
          ],
        );
      }
    } else {
      if (prior.status !== "private_draft")
        throw new EvidenceError(
          409,
          "Approved and dismissed drafts cannot be edited or approved again.",
        );
      if (input.action !== "dismiss")
        await validateScope(client, access, scope, input.action === "approve");
      const activity =
        input.action === "save"
          ? editedActivity(input.activity, prior)
          : prior.activity;
      if (input.action === "save")
        await validateScope(
          client,
          access,
          { ...scope, snapshot: { ...prior, activity } },
          false,
        );
      if (input.action === "approve") {
        editedActivity(activity, prior);
        validateRecipients(input.recipient_ids, current);
        const approval = InterventionApprovalSchema.parse({
          id: randomUUID(),
          draft_id: draftId,
          assignment_id: prior.assignment_id,
          approved_revision: prior.revision,
          approved_by: access.actor.profileId,
          approved_at: now,
          recipient_ids: input.recipient_ids,
          activity,
          content_ref: prior.evidence.content_ref,
          evidence: prior.evidence,
          provenance: prior.provenance,
        });
        await client.query(
          `INSERT INTO teacher_intervention_approvals(id,draft_id,teacher_id,assignment_id,class_id,approved_revision,snapshot,approved_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            approval.id,
            draftId,
            access.actor.profileId,
            prior.assignment_id,
            scope.class_id,
            prior.revision,
            approval,
            now,
          ],
        );
        await client.query(
          `INSERT INTO teacher_intervention_recipients(approval_id,class_id,student_id)
          SELECT $1,$2,unnest($3::uuid[])`,
          [approval.id, scope.class_id, input.recipient_ids],
        );
      }
      scope.snapshot = InterventionDraftSchema.parse({
        ...prior,
        activity,
        revision: prior.revision + 1,
        updated_at: now,
        status:
          input.action === "approve"
            ? "approved"
            : input.action === "dismiss"
              ? "dismissed"
              : "private_draft",
      });
      await client.query(
        `UPDATE teacher_intervention_drafts SET revision=$2,snapshot=$3,updated_at=$4
        WHERE id=$1 AND revision=$5`,
        [draftId, scope.snapshot.revision, scope.snapshot, now, prior.revision],
      );
    }
    current = await review(client, scope);
    await client.query(
      `INSERT INTO teacher_intervention_actions(teacher_id,request_id,draft_id,assignment_id,action,request_hash,request,previous_snapshot,result_snapshot)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        access.actor.profileId,
        input.request_id,
        draftId,
        prior.assignment_id,
        input.action,
        hash,
        input,
        prior,
        current,
      ],
    );
    return current;
  });
}

function validateRecipients(ids: string[], current: InterventionReview) {
  const eligible = new Set(
    current.eligible_recipients.map((r) => r.student_id),
  );
  if (!ids.length || ids.some((id) => !eligible.has(id)))
    throw new EvidenceError(
      409,
      "Select only students currently enrolled in this assignment's class.",
    );
}

const StudentRowSchema = z.object({
  snapshot: InterventionApprovalSchema,
  delivered_at: z.iso.datetime({ offset: true }),
  displayed_at: z.iso.datetime({ offset: true }).nullable(),
});
async function validateStudentSource(
  client: PoolClient,
  access: EvidenceAccess,
  row: z.infer<typeof StudentRowSchema>,
) {
  const approval = row.snapshot;
  const content = await resolveAssignmentContent(
    client,
    access,
    approval.assignment_id,
    "student",
  );
  validateContentRef(content, approval.content_ref);
  interventionRevisionEvidence(
    content,
    approval.evidence,
    approval.provenance.prompt_template_version,
  );
}
function studentView(row: z.infer<typeof StudentRowSchema>) {
  const approval: InterventionApproval = row.snapshot;
  return StudentInterventionSchema.parse({
    approval_id: approval.id,
    draft_id: approval.draft_id,
    assignment_id: approval.assignment_id,
    delivered_at: row.delivered_at,
    displayed_at: row.displayed_at,
    content_ref: approval.content_ref,
    activity: toStudentInterventionActivity(approval.activity),
  });
}

const studentQuery = `SELECT a.snapshot,d.delivered_at,r.displayed_at
  FROM teacher_intervention_recipients r
  JOIN teacher_intervention_approvals a ON a.id=r.approval_id AND a.class_id=r.class_id
  JOIN teacher_intervention_deliveries d ON d.approval_id=a.id
  JOIN assignments assignment ON assignment.id=a.assignment_id AND assignment.class_id=r.class_id
  JOIN enrollments e ON e.class_id=r.class_id AND e.student_id=r.student_id
  JOIN profiles p ON p.id=r.student_id
  WHERE r.student_id=$1 AND p.auth_user_id=$2`;

export async function listStudentInterventions(
  access: EvidenceAccess,
  assignmentId?: string,
) {
  if (assignmentId) z.uuid().parse(assignmentId);
  return transaction(async (client) => {
    const rows = await client.query(
      `${studentQuery} ${assignmentId ? "AND a.assignment_id=$3" : ""}
      ORDER BY d.delivered_at DESC,a.id LIMIT 100`,
      assignmentId
        ? [access.actor.profileId, access.actor.userId, assignmentId]
        : [access.actor.profileId, access.actor.userId],
    );
    const interventions = [];
    for (const result of rows.rows) {
      const row = StudentRowSchema.parse(evidenceRow(result));
      await validateStudentSource(client, access, row);
      interventions.push(studentView(row));
    }
    return interventions;
  });
}

export async function readStudentIntervention(
  access: EvidenceAccess,
  approvalId: string,
) {
  z.uuid().parse(approvalId);
  return transaction(async (client) => {
    const rows = await client.query(`${studentQuery} AND a.id=$3`, [
      access.actor.profileId,
      access.actor.userId,
      approvalId,
    ]);
    if (!rows.rows[0])
      throw new EvidenceError(404, "Assigned intervention not found.");
    const row = StudentRowSchema.parse(evidenceRow(rows.rows[0]));
    await validateStudentSource(client, access, row);
    return studentView(row);
  });
}

/** The mounted student panel explicitly acknowledges display; reads never create assistance. */
export async function markStudentInterventionDisplayed(
  access: EvidenceAccess,
  approvalId: string,
) {
  z.uuid().parse(approvalId);
  return transaction(async (client) => {
    const rows = await client.query(
      `${studentQuery} AND a.id=$3 FOR UPDATE OF r FOR SHARE OF e,p`,
      [access.actor.profileId, access.actor.userId, approvalId],
    );
    if (!rows.rows[0])
      throw new EvidenceError(404, "Assigned intervention not found.");
    const row = StudentRowSchema.parse(evidenceRow(rows.rows[0]));
    await validateStudentSource(client, access, row);
    if (!row.displayed_at) {
      const updated = await client.query(
        `UPDATE teacher_intervention_recipients SET displayed_at=clock_timestamp()
        WHERE approval_id=$1 AND student_id=$2 AND displayed_at IS NULL RETURNING displayed_at`,
        [approvalId, access.actor.profileId],
      );
      row.displayed_at = z
        .object({ displayed_at: z.iso.datetime({ offset: true }) })
        .parse(evidenceRow(updated.rows[0])).displayed_at;
    }
    await mirrorInterventionDisplay(client, approvalId, access.actor.profileId);
    return studentView(row);
  });
}
