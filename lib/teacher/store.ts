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
export async function readAssignmentEvidence(
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
      `SELECT a.id,a.class_id,a.title,c.name AS class_name,a.approved_concept_ids,a.approved_misconception_ids FROM assignments a JOIN classes c ON c.id=a.class_id WHERE a.id=$1 AND c.teacher_id=$2`,
      [assignmentId, access.actor.profileId],
    );
    if (!result.rows[0]) throw new EvidenceError(404, "Assignment not found.");
    const assignment = z
      .object({
        id: z.uuid(),
        class_id: z.uuid(),
        title: z.string(),
        class_name: z.string(),
        approved_concept_ids: z.array(z.string()),
        approved_misconception_ids: z.array(z.string()),
      })
      .parse(evidenceRow(result.rows[0]));
    const roster = await client.query(
      "SELECT e.student_id,p.display_name FROM enrollments e JOIN profiles p ON p.id=e.student_id WHERE e.class_id=$1 ORDER BY p.display_name,e.student_id",
      [assignment.class_id],
    );
    const students = z
      .array(z.object({ student_id: z.uuid(), display_name: z.string() }))
      .parse(roster.rows);
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
      title: assignment.title,
      class_name: assignment.class_name,
      approved_misconception_ids: assignment.approved_misconception_ids,
      students,
      evidence,
      metrics: calculateClassMetrics(
        students.map((s) => s.student_id),
        assignment.approved_concept_ids,
        evidence,
        origin,
      ),
    };
  });
}

// Preserve the existing small public teacher API projection.
export async function readAssignmentMetrics(
  access: EvidenceAccess,
  assignmentId: string,
  origin: z.infer<typeof OriginFilterSchema> = "all",
) {
  const { assignment_id, class_id, metrics } = await readAssignmentEvidence(
    access,
    assignmentId,
    origin,
  );
  return { assignment_id, class_id, metrics };
}

export async function teacherAssignments(access: EvidenceAccess) {
  return transaction(async (client) => {
    const result = await client.query(
      `SELECT a.id,a.title,c.name AS class_name FROM assignments a JOIN classes c ON c.id=a.class_id WHERE c.teacher_id=$1 ORDER BY c.name,a.title,a.id`,
      [access.actor.profileId],
    );
    return z
      .array(
        z.object({ id: z.uuid(), title: z.string(), class_name: z.string() }),
      )
      .parse(result.rows);
  });
}

export async function readTeacherSession(
  access: EvidenceAccess,
  sessionId: string,
) {
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const evidence = await sessionEvidence(
      client,
      access,
      sessionId,
      "teacher",
      false,
    );
    const result = await client.query(
      `SELECT p.display_name,a.title FROM sessions s JOIN profiles p ON p.id=s.student_id JOIN assignments a ON a.id=s.assignment_id JOIN classes c ON c.id=s.class_id WHERE s.id=$1 AND c.teacher_id=$2`,
      [sessionId, access.actor.profileId],
    );
    const names = z
      .object({ display_name: z.string(), title: z.string() })
      .parse(result.rows[0]);
    return { ...names, evidence };
  });
}
