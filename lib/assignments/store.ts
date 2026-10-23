import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { evidenceRow } from "../db.ts";
import { ContentRefSchema } from "../evidence/contracts.ts";
import { validateContentRef } from "../evidence/content.ts";
import type { ApprovedContent } from "../evidence/content.ts";
import { resolveAssignmentContent } from "../lessons/store.ts";
import {
  EvidenceError,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";

const AssignmentSchema = z.object({
  id: z.uuid(),
  class_id: z.uuid(),
  title: z.string(),
  instructions: z.string(),
  class_name: z.string(),
  content_ref: ContentRefSchema,
  approved_concept_ids: z.array(z.string()),
  approved_passage_ids: z.array(z.string()),
  approved_misconception_ids: z.array(z.string()),
  approval: z.record(z.string(), z.unknown()),
  teacher_approved_by: z.uuid().nullable(),
  teacher_approved_at: z.iso.datetime({ offset: true }).nullable(),
});

async function ownedAssignment(
  client: PoolClient,
  access: EvidenceAccess,
  id: string,
) {
  z.uuid().parse(id);
  const result = await client.query(
    `SELECT a.*, c.name AS class_name FROM assignments a JOIN classes c ON c.id=a.class_id
     WHERE a.id=$1 AND c.teacher_id=$2 FOR UPDATE OF a FOR SHARE OF c`,
    [id, access.actor.profileId],
  );
  if (!result.rows[0]) throw new EvidenceError(404, "Assignment not found.");
  return AssignmentSchema.parse(evidenceRow(result.rows[0]));
}

function review(
  assignment: z.infer<typeof AssignmentSchema>,
  content: ApprovedContent,
) {
  try {
    validateContentRef(content, assignment.content_ref);
  } catch {
    throw new EvidenceError(
      409,
      "This reading version is unavailable. Ask the team to restore it before reviewing.",
    );
  }
  const same = (ids: string[], known: ReadonlySet<string>) =>
    ids.length === known.size &&
    new Set(ids).size === ids.length &&
    ids.every((id) => known.has(id));
  if (
    !same(assignment.approved_concept_ids, content.concept_ids) ||
    !same(assignment.approved_passage_ids, content.passage_ids) ||
    !same(
      assignment.approved_misconception_ids,
      new Set(content.misconceptions.keys()),
    ) ||
    assignment.approval.status !== "approved"
  )
    throw new EvidenceError(
      409,
      "This assignment does not match the prepared lesson. Review its content before activation.",
    );
  // Exclude activation metadata so a repeated approval of the same preview is idempotent.
  const {
    teacher_approved_by: _by,
    teacher_approved_at: _at,
    ...snapshot
  } = assignment;
  void _by;
  void _at;
  const review_token = createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
  return { ...assignment, review_token };
}

export async function assignmentReview(access: EvidenceAccess, id: string) {
  return transaction(async (client) => {
    const assignment = await ownedAssignment(client, access, id);
    const content = await resolveAssignmentContent(
      client,
      access,
      id,
      "teacher",
    );
    return review(assignment, content);
  });
}

export async function approveAssignment(
  access: EvidenceAccess,
  id: string,
  token: string,
) {
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(token);
  return transaction(async (client) => {
    const assignment = await ownedAssignment(client, access, id);
    const content = await resolveAssignmentContent(
      client,
      access,
      id,
      "teacher",
    );
    const current = review(assignment, content);
    if (token !== current.review_token)
      throw new EvidenceError(
        409,
        "The assignment changed. Reload and review it before approving.",
      );
    if (!current.teacher_approved_at)
      await client.query(
        "UPDATE assignments SET teacher_approved_by=$2, teacher_approved_at=clock_timestamp() WHERE id=$1",
        [id, access.actor.profileId],
      );
    return review(await ownedAssignment(client, access, id), content);
  });
}
