import "server-only";
import { z } from "zod";
import { evidenceRow } from "../db.ts";
import {
  EvidenceError,
  sessionEvidence,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
import { calculateClassMetrics, OriginFilterSchema } from "./metrics.ts";

/** One consistent authorized snapshot; no unscoped browser-provided class/role. */
export async function readAssignmentMetrics(
  access: EvidenceAccess,
  assignmentId: string,
  origin: z.infer<typeof OriginFilterSchema> = "all",
) {
  z.uuid().parse(assignmentId);
  OriginFilterSchema.parse(origin);
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const result = await client.query(
      `SELECT a.id,a.class_id,a.approved_concept_ids FROM assignments a JOIN classes c ON c.id=a.class_id WHERE a.id=$1 AND c.teacher_id=$2`,
      [assignmentId, access.actor.profileId],
    );
    if (!result.rows[0]) throw new EvidenceError(404, "Assignment not found.");
    const assignment = z
      .object({
        id: z.uuid(),
        class_id: z.uuid(),
        approved_concept_ids: z.array(z.string()),
      })
      .parse(evidenceRow(result.rows[0]));
    const roster = await client.query(
      "SELECT student_id FROM enrollments WHERE class_id=$1 ORDER BY student_id",
      [assignment.class_id],
    );
    const students = z
      .array(z.object({ student_id: z.uuid() }))
      .parse(roster.rows)
      .map((r) => r.student_id);
    const sessions = await client.query(
      "SELECT id FROM sessions WHERE assignment_id=$1 AND ($2='all' OR data_origin=$2) ORDER BY started_at,id",
      [assignment.id, origin],
    );
    const ids = z.array(z.object({ id: z.uuid() })).parse(sessions.rows);
    const evidence = [];
    for (const { id } of ids)
      evidence.push(
        await sessionEvidence(client, access, id, "teacher", false),
      );
    return {
      assignment_id: assignment.id,
      class_id: assignment.class_id,
      metrics: calculateClassMetrics(
        students,
        assignment.approved_concept_ids,
        evidence,
        origin,
      ),
    };
  });
}
