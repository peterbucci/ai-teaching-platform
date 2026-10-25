// Additional fictional ownership boundary for the isolated browser suite.
import assert from "node:assert/strict";
import { getPool } from "../lib/db.ts";

assert.equal(process.env.PGDATABASE, "roster_test");
assert.equal(process.env.PGHOST, "127.0.0.1");
assert.ok(!process.env.OPENAI_API_KEY);
const db = getPool();
const client = await db.connect();
try {
  await client.query("BEGIN");
  await client.query(`INSERT INTO profiles (id, display_name) VALUES
    ('10000000-0000-4000-8000-000000000098', 'Foreign fictional teacher'),
    ('10000000-0000-4000-8000-000000000099', 'FOREIGN_ROSTER_STUDENT')
    ON CONFLICT DO NOTHING`);
  await client.query(`INSERT INTO classes (id, teacher_id, name) VALUES
    ('20000000-0000-4000-8000-000000000099',
     '10000000-0000-4000-8000-000000000098', 'FOREIGN_ROSTER_CLASS')
    ON CONFLICT DO NOTHING`);
  await client.query(`INSERT INTO enrollments (class_id, student_id) VALUES
    ('20000000-0000-4000-8000-000000000099',
     '10000000-0000-4000-8000-000000000099') ON CONFLICT DO NOTHING`);
  await client.query(`INSERT INTO assignments
    (id, class_id, title, content_ref, approved_concept_ids,
     approved_passage_ids, approved_misconception_ids, approval)
    SELECT '30000000-0000-4000-8000-000000000099',
      '20000000-0000-4000-8000-000000000099', 'FOREIGN_ROSTER_ASSIGNMENT',
      content_ref, approved_concept_ids, approved_passage_ids,
      approved_misconception_ids, approval
    FROM assignments WHERE id = '30000000-0000-4000-8000-000000000001'
    ON CONFLICT DO NOTHING`);
  await client.query(`INSERT INTO sessions
    (id, student_id, assignment_id, class_id, data_origin)
    VALUES ('40000000-0000-4000-8000-000000000099',
      '10000000-0000-4000-8000-000000000099',
      '30000000-0000-4000-8000-000000000099',
      '20000000-0000-4000-8000-000000000099', 'synthetic_fixture')
    ON CONFLICT DO NOTHING`);
  await client.query("COMMIT");
  console.log(
    "Separate fictional class, owner, student, assignment and session ready.",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await db.end();
}
