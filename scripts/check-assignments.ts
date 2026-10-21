import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { AssignedLessonSchema } from "../lib/tutoring/contracts.ts";

const base = process.env.AUTH_URL;
if (!base) throw new Error("Configure AUTH_URL.");
async function request(path: string, cookie = "", body?: unknown) {
  return fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    redirect: "manual",
    headers: {
      Cookie: cookie,
      Origin: new URL(base!).origin,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function login(prefix: string) {
  const response = await request("/api/auth/sign-in/email", "", {
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  });
  assert.equal(response.status, 200, `${prefix} login`);
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}
async function lessons(cookie: string) {
  const response = await request("/api/tutoring", cookie);
  assert.equal(response.status, 200);
  return z.array(AssignedLessonSchema).parse(await response.json());
}
const id = randomUUID();
const foreign = randomUUID();
const classId = randomUUID();
const previewSchema = z.object({
  review_token: z.string(),
  teacher_approved_by: z.string().nullable(),
  teacher_approved_at: z.string().nullable(),
  content_ref: z.unknown(),
});
try {
  const teacher = await login("DEMO_TEACHER");
  const student = await login("DEMO_STUDENT_ONE");
  const db = getPool();
  await db.query(
    "INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,'Temporary authorization check')",
    [classId, DEMO_IDS.studentTwo],
  );
  for (const [assignment, classOverride] of [
    [id, null],
    [foreign, classId],
  ])
    await db.query(
      `INSERT INTO assignments(id,class_id,title,content_ref,approved_concept_ids,approved_passage_ids,approved_misconception_ids,approval)
      SELECT $1,coalesce($2::uuid,class_id),'Temporary review check',content_ref,approved_concept_ids,approved_passage_ids,approved_misconception_ids,approval FROM assignments WHERE id=$3`,
      [assignment, classOverride, DEMO_IDS.assignmentId],
    );
  const path = `/api/teacher/assignments/${id}/approval`;
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, student)).status, 404);
  assert.equal(
    (await request(`/api/teacher/assignments/${foreign}/approval`, teacher))
      .status,
    404,
  );
  // Next.js can stream a not-found page with HTTP 200; verify it contains no preview.
  const blockedPage = await (
    await request(`/teacher/assignments?assignment=${id}`, student)
  ).text();
  assert.match(blockedPage, /404/);
  assert.doesNotMatch(
    blockedPage,
    /Questions and answer guidance|Approve and activate/,
  );
  const preview = previewSchema.parse(
    await (await request(path, teacher)).json(),
  );
  assert.equal(preview.teacher_approved_at, null);
  assert.ok(!(await lessons(student)).some((item) => item.id === id));
  assert.equal(
    (await request("/api/tutoring", student, { assignment_id: id })).status,
    409,
  );
  assert.equal(
    (await request("/api/sessions", student, { assignment_id: id })).status,
    409,
  );
  await assert.rejects(
    db.query(
      "INSERT INTO sessions(id,student_id,assignment_id,class_id,data_origin) VALUES($1,$2,$3,$4,'live_demo')",
      [randomUUID(), DEMO_IDS.studentOne, id, DEMO_IDS.classId],
    ),
    /activate/,
  );
  assert.equal(
    (await request(path, student, { review_token: preview.review_token }))
      .status,
    404,
  );
  assert.equal(
    (
      await request(path, teacher, {
        review_token: preview.review_token,
        teacher_approved_by: DEMO_IDS.studentOne,
      })
    ).status,
    400,
  );
  await db.query(
    "UPDATE assignments SET title='Updated review check' WHERE id=$1",
    [id],
  );
  assert.equal(
    (await request(path, teacher, { review_token: preview.review_token }))
      .status,
    409,
  );
  const fresh = previewSchema.parse(
    await (await request(path, teacher)).json(),
  );
  const approvedResponse = await request(path, teacher, {
    review_token: fresh.review_token,
  });
  assert.equal(approvedResponse.status, 200);
  const approved = previewSchema.parse(await approvedResponse.json());
  assert.equal(approved.teacher_approved_by, DEMO_IDS.teacher);
  assert.ok(approved.teacher_approved_at);
  assert.deepEqual(approved.content_ref, preview.content_ref);
  const repeated = previewSchema.parse(
    await (
      await request(path, teacher, { review_token: fresh.review_token })
    ).json(),
  );
  assert.deepEqual(repeated, approved);
  await assert.rejects(
    db.query(
      "UPDATE assignments SET approved_concept_ids=ARRAY['changed'] WHERE id=$1",
      [id],
    ),
    /immutable/,
  );
  await assert.rejects(
    db.query(
      "UPDATE assignments SET teacher_approved_by=null,teacher_approved_at=null WHERE id=$1",
      [id],
    ),
    /immutable/,
  );
  const available = await lessons(student);
  assert.equal(available.find((item) => item.id === id)?.session, null);
  assert.ok(!available.some((item) => item.id === foreign));
  // A synthetic history and another student's live session must not become
  // this student's "Continue session" destination.
  for (const [profile, origin] of [
    [DEMO_IDS.studentOne, "synthetic_fixture"],
    [DEMO_IDS.studentTwo, "live_demo"],
  ])
    await db.query(
      "INSERT INTO sessions(id,student_id,assignment_id,class_id,data_origin) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), profile, id, DEMO_IDS.classId, origin],
    );
  assert.equal(
    (await lessons(student)).find((item) => item.id === id)?.session,
    null,
  );
  const opened = await request("/api/sessions", student, { assignment_id: id });
  assert.equal(opened.status, 200);
  const openedSession = AssignedLessonSchema.shape.session
    .unwrap()
    .parse((await opened.json()).session);
  assert.deepEqual(
    (await lessons(student)).find((item) => item.id === id)?.session,
    openedSession,
  );
  const next = await request("/api/sessions", student, { assignment_id: id });
  assert.equal(next.status, 200);
  const latest = AssignedLessonSchema.shape.session
    .unwrap()
    .parse((await next.json()).session);
  assert.notEqual(latest.id, openedSession.id);
  await db.query(
    "UPDATE sessions SET status='completed',ended_at=clock_timestamp() WHERE id=$1",
    [latest.id],
  );
  assert.deepEqual(
    (await lessons(student)).find((item) => item.id === id)?.session,
    { id: latest.id, status: "completed" },
  );
  const historical = await request(
    `/api/teacher/sessions/${DEMO_IDS.supportedSession}`,
    teacher,
  );
  assert.equal(historical.status, 200);
  console.log(
    "PASS: teacher-only review, stale preview rejection, pending gate in HTTP and SQL, exact version, idempotent activation, immutable approval/scope, scoped latest live-session links, student opening, and historical evidence.",
  );
} finally {
  const db = getPool();
  await db.query(
    "DELETE FROM sessions WHERE assignment_id=$1 AND NOT EXISTS (SELECT 1 FROM attempts WHERE session_id=sessions.id)",
    [id],
  );
  await db.query("DELETE FROM assignments WHERE id=ANY($1::uuid[])", [
    [id, foreign],
  ]);
  await db.query("DELETE FROM classes WHERE id=$1", [classId]);
  await db.end();
}
