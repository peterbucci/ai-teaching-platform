import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { evidenceAccess, EvidenceError } from "../lib/evidence/store.ts";
import {
  readAssignmentEvidence,
  readTeacherSession,
} from "../lib/teacher/store.ts";

// Operator-only, read-only test of the reused authorization boundary. The HTTP
// browser suite separately verifies authenticated student and anonymous denial.
if (process.env.OPENAI_API_KEY) throw new Error("Disable the model provider.");
const pool = getPool();
try {
  const assignment = await pool.query<{ id: string }>(
    "select id from assignments where class_id=$1 order by id limit 1",
    [DEMO_IDS.classId],
  );
  assert.ok(assignment.rows[0]);
  const owner = evidenceAccess({
    profileId: DEMO_IDS.teacher,
    userId: "fictional-service-probe",
  });
  const data = await readAssignmentEvidence(
    owner,
    assignment.rows[0].id,
    "synthetic_fixture",
  );
  assert.ok(data.evidence.length);
  for (const profileId of [DEMO_IDS.studentOne, randomUUID()]) {
    const outsider = evidenceAccess({
      profileId,
      userId: "fictional-service-probe",
    });
    await assert.rejects(
      readAssignmentEvidence(outsider, data.assignment_id),
      (error: unknown) =>
        error instanceof EvidenceError && error.status === 404,
    );
    await assert.rejects(
      readTeacherSession(outsider, data.evidence[0].session.id),
      (error: unknown) =>
        error instanceof EvidenceError && [403, 404].includes(error.status),
    );
  }
  console.log(
    "PASS: existing assignment/session services deny student and non-owning actor access; authorized teacher snapshot remains available. No records changed.",
  );
} finally {
  await pool.end();
}
