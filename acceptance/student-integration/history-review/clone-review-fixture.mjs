/** Reuse authored fictional source/evidence; real approval and delivery create
 * a new fresh-check identity without requesting another generation. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool } from "../../../lib/db.ts";
import { DEMO_IDS } from "../../../lib/evidence/demo.ts";
import { InterventionDraftSchema } from "../../../lib/interventions/drafts.ts";
import {
  readInterventionReview,
  applyInterventionAction,
} from "../../../lib/interventions/approval.ts";

export async function cloneReviewFixture(teacher, sourceIdentity) {
  assert.equal(process.env.PGDATABASE, "student_notebook_final_01a17503");
  assert.equal(process.env.OPENAI_API_KEY, "");
  assert.equal(process.env.OPENAI_MODEL, "");
  const source = (await readInterventionReview(teacher, sourceIdentity.draftId))
    .draft;
  assert.ok(
    source.evidence.observations.every(
      (row) => row.data_origin === "synthetic_fixture",
    ),
  );
  const now = new Date().toISOString();
  const draft = InterventionDraftSchema.parse({
    ...source,
    id: randomUUID(),
    revision: 1,
    status: "private_draft",
    created_at: now,
    updated_at: now,
  });
  await getPool().query(
    "INSERT INTO teacher_intervention_drafts(id,teacher_id,assignment_id,revision,snapshot) VALUES($1,$2,$3,1,$4)",
    [draft.id, DEMO_IDS.teacher, draft.assignment_id, draft],
  );
  const approved = await applyInterventionAction(teacher, draft.id, {
    action: "approve",
    request_id: randomUUID(),
    expected_revision: 1,
    recipient_ids: [DEMO_IDS.studentOne],
  });
  assert.ok(approved.approval);
  await applyInterventionAction(teacher, draft.id, {
    action: "deliver",
    request_id: randomUUID(),
    expected_revision: approved.draft.revision,
    approval_id: approved.approval.id,
  });
  return {
    ...sourceIdentity,
    draftId: draft.id,
    approvalId: approved.approval.id,
  };
}
