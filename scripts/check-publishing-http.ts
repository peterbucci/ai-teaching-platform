import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool } from "../lib/db.ts";
import { resolveActor } from "../lib/auth.ts";
import { evidenceAccess } from "../lib/evidence/store.ts";
import { createSourceVersion } from "../lib/lessons/sources.ts";
import { readLessonDraft, saveLessonDraft } from "../lib/lessons/store.ts";
import {
  AssignedLessonSchema,
  TutorViewSchema,
} from "../lib/tutoring/contracts.ts";
import { ReadingSchema } from "../lib/assignments/contracts.ts";
import {
  makeTeacherLesson,
  teacherSourceAttribution,
  teacherSourceDocument,
  teacherSourcePassages,
} from "../tests/fixtures/teacher-lesson.ts";

// Run after db:migrate and db:seed against a dedicated local development app/DB.
// This checks authenticated HTTP boundaries with reviewed example content. No
// answer-evaluation endpoint, paid model, or content generator is invoked.
const base = z.url().parse(process.env.AUTH_URL);
const db = getPool();
const run = randomUUID();
const foreignClassId = randomUUID();

async function request(
  path: string,
  cookie = "",
  body?: unknown,
  origin = new URL(base).origin,
) {
  return fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
    headers: {
      Cookie: cookie,
      Origin: origin,
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
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  return {
    cookie,
    access: evidenceAccess(await resolveActor(new Headers({ Cookie: cookie }))),
  };
}

async function status(
  path: string,
  cookie: string,
  body: unknown,
  expected: number,
) {
  const response = await request(path, cookie, body);
  assert.equal(
    response.status,
    expected,
    `${path}: expected ${expected}, received ${response.status}`,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response;
}

async function assigned(cookie: string) {
  const response = await request("/api/tutoring", cookie);
  assert.equal(response.status, 200);
  return z.array(AssignedLessonSchema).parse(await response.json());
}

const CreatedAssignmentSchema = z.object({
  id: z.uuid(),
  class_id: z.uuid(),
  lesson_id: z.string(),
  lesson_version: z.string(),
});
const ActivationReviewSchema = z.object({
  review_token: z.string(),
  instructions: z.string(),
  teacher_approved_by: z.string().nullable(),
  teacher_approved_at: z.string().nullable(),
});

try {
  const teacher = await login("DEMO_TEACHER");
  const student = await login("DEMO_STUDENT_ONE");
  const other = await login("DEMO_STUDENT_TWO");
  const classId = randomUUID();
  for (const [id, owner, name] of [
    [classId, teacher.access.actor.profileId, "owned"],
    [foreignClassId, other.access.actor.profileId, "foreign"],
  ]) {
    await db.query("INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)", [
      id,
      owner,
      `Synthetic publishing HTTP ${run}: ${name}`,
    ]);
  }
  await db.query("INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)", [
    classId,
    student.access.actor.profileId,
  ]);
  const source = await createSourceVersion(teacher.access, {
    request_id: randomUUID(),
    original_bytes: Buffer.from(teacherSourceDocument),
    file_name: "synthetic-publishing-http.txt",
    mime_type: "text/plain",
    attribution: teacherSourceAttribution,
    extraction: teacherSourcePassages,
    passages: teacherSourcePassages,
    review_status: "approved",
    permitted_use: true,
  });
  let draft = await saveLessonDraft(teacher.access, {
    expected_revision: 0,
    title: `Synthetic publishing HTTP ${run}`,
    draft: {},
  });
  const path = `/api/teacher/lessons/${draft.id}`;
  const action = () => ({ expected_revision: draft.revision, confirmed: true });
  const newVersion = () => ({ ...action(), version: "2" });
  const assignmentInput = {
    request_id: randomUUID(),
    class_id: classId,
    version: "1",
    title: `Synthetic publishing HTTP assignment ${run}`,
    instructions:
      "Explain the direction of each change using the approved water reading.",
  };

  for (const [endpoint, body] of [
    [`${path}/approval`, action()],
    [`${path}/publication`, action()],
    [`${path}/assignments`, assignmentInput],
    [`${path}/versions`, newVersion()],
  ] as const) {
    await status(endpoint, "", body, 401);
    await status(endpoint, student.cookie, body, 404);
    await status(endpoint, other.cookie, body, 404);
  }
  for (const body of [
    { version: "2", confirmed: true },
    { expected_revision: draft.revision, version: "2" },
    { ...newVersion(), confirmed: false },
    { ...newVersion(), version: " " },
    { ...newVersion(), owner_id: other.access.actor.profileId },
  ])
    await status(`${path}/versions`, teacher.cookie, body, 400);
  assert.equal(
    (
      await request(
        `${path}/versions`,
        teacher.cookie,
        newVersion(),
        "https://unrelated.example.invalid",
      )
    ).status,
    403,
  );
  await status(`${path}/versions`, teacher.cookie, newVersion(), 409);
  for (const endpoint of [`${path}/approval`, `${path}/publication`]) {
    for (const body of [
      { confirmed: true },
      { expected_revision: draft.revision },
      { expected_revision: draft.revision, confirmed: false },
      { ...action(), teacher_approved_by: student.access.actor.profileId },
    ])
      await status(endpoint, teacher.cookie, body, 400);
    assert.equal(
      (
        await request(
          endpoint,
          teacher.cookie,
          action(),
          "https://unrelated.example.invalid",
        )
      ).status,
      403,
    );
  }
  await status(`${path}/approval`, teacher.cookie, action(), 400);
  await status(`${path}/publication`, teacher.cookie, action(), 409);
  assert.equal(
    (await readLessonDraft(teacher.access, draft.id)).approved_revision,
    null,
  );

  const lesson = makeTeacherLesson(source.source_ref, draft.id, "1");
  const badSource = structuredClone(lesson);
  badSource.content_ref.excerpt_sha256 = "f".repeat(64);
  draft = await saveLessonDraft(teacher.access, {
    lesson_id: draft.id,
    expected_revision: draft.revision,
    title: draft.title,
    draft: badSource,
  });
  await status(`${path}/approval`, teacher.cookie, action(), 409);
  await status(`${path}/publication`, teacher.cookie, action(), 409);
  const beforeComplete = draft.revision;
  draft = await saveLessonDraft(teacher.access, {
    lesson_id: draft.id,
    expected_revision: draft.revision,
    title: draft.title,
    draft: lesson,
  });
  await status(
    `${path}/approval`,
    teacher.cookie,
    { expected_revision: beforeComplete, confirmed: true },
    409,
  );
  await status(`${path}/publication`, teacher.cookie, action(), 409);
  await status(`${path}/assignments`, teacher.cookie, assignmentInput, 404);
  await status(`${path}/approval`, teacher.cookie, action(), 200);
  assert.equal(
    (await readLessonDraft(teacher.access, draft.id)).approved_revision,
    draft.revision,
  );
  // Lesson approval alone must not publish or assign anything.
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::integer AS count FROM lesson_versions WHERE lesson_id=$1",
        [draft.id],
      )
    ).rows[0].count,
    0,
  );
  const firstPublication = await (
    await status(`${path}/publication`, teacher.cookie, action(), 200)
  ).json();
  assert.deepEqual(
    await (
      await status(`${path}/publication`, teacher.cookie, action(), 200)
    ).json(),
    firstPublication,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::integer AS count FROM assignments WHERE lesson_id=$1",
        [draft.id],
      )
    ).rows[0].count,
    0,
  );

  const { request_id: _requestId, ...withoutRequestId } = assignmentInput;
  void _requestId;
  await status(`${path}/assignments`, teacher.cookie, withoutRequestId, 400);
  await status(
    `${path}/assignments`,
    teacher.cookie,
    { ...assignmentInput, request_id: randomUUID(), class_id: foreignClassId },
    404,
  );
  await status(
    `${path}/assignments`,
    teacher.cookie,
    { ...assignmentInput, request_id: randomUUID(), version: "missing" },
    404,
  );
  const created = CreatedAssignmentSchema.parse(
    await (
      await status(`${path}/assignments`, teacher.cookie, assignmentInput, 200)
    ).json(),
  );
  assert.deepEqual(
    CreatedAssignmentSchema.parse(
      await (
        await status(
          `${path}/assignments`,
          teacher.cookie,
          assignmentInput,
          200,
        )
      ).json(),
    ),
    created,
  );
  await status(
    `${path}/assignments`,
    teacher.cookie,
    { ...assignmentInput, instructions: "Changed request details" },
    409,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::integer AS count FROM assignments WHERE creation_request_id=$1",
        [assignmentInput.request_id],
      )
    ).rows[0].count,
    1,
  );
  assert.ok(
    !(await assigned(student.cookie)).some((item) => item.id === created.id),
  );
  await status(
    "/api/tutoring",
    student.cookie,
    { assignment_id: created.id },
    409,
  );

  const activationPath = `/api/teacher/assignments/${created.id}/approval`;
  assert.equal((await request(activationPath)).status, 401);
  assert.equal((await request(activationPath, student.cookie)).status, 404);
  const previewResponse = await request(activationPath, teacher.cookie);
  assert.equal(previewResponse.status, 200);
  const preview = ActivationReviewSchema.parse(await previewResponse.json());
  assert.equal(preview.teacher_approved_at, null);
  assert.equal(preview.instructions, assignmentInput.instructions);
  await status(
    activationPath,
    student.cookie,
    { review_token: preview.review_token },
    404,
  );
  await status(
    activationPath,
    other.cookie,
    { review_token: preview.review_token },
    404,
  );
  const activationBody = { review_token: preview.review_token };
  const activated = ActivationReviewSchema.parse(
    await (
      await status(activationPath, teacher.cookie, activationBody, 200)
    ).json(),
  );
  assert.equal(activated.teacher_approved_by, teacher.access.actor.profileId);
  assert.ok(activated.teacher_approved_at);
  assert.deepEqual(
    ActivationReviewSchema.parse(
      await (
        await status(activationPath, teacher.cookie, activationBody, 200)
      ).json(),
    ),
    activated,
  );
  assert.ok(
    (await assigned(student.cookie)).some((item) => item.id === created.id),
  );
  assert.ok(
    !(await assigned(other.cookie)).some((item) => item.id === created.id),
  );

  // Opening approved text/questions has no evaluation or generation side effect.
  const opened = TutorViewSchema.parse(
    await (
      await status(
        "/api/tutoring",
        student.cookie,
        { assignment_id: created.id },
        200,
      )
    ).json(),
  );
  const readingResponse = await request(
    `/api/tutoring/${opened.session.id}/reading`,
    student.cookie,
  );
  assert.equal(readingResponse.status, 200);
  const reading = ReadingSchema.parse(await readingResponse.json());
  assert.deepEqual(reading.content_ref, lesson.content_ref);
  assert.equal(reading.sections[0].id, "water-01");
  assert.doesNotMatch(
    JSON.stringify(reading),
    /rubric|answer_guidance|original_bytes/,
  );
  assert.doesNotMatch(
    JSON.stringify(opened),
    /rubric|answer_guidance|original_bytes/,
  );
  const counts = await db.query(
    "SELECT count(*)::integer AS count FROM evaluations e JOIN attempts a ON a.id=e.attempt_id WHERE a.session_id=$1",
    [opened.session.id],
  );
  assert.equal(counts.rows[0].count, 0);
  // Starting a version does not rewrite the publication, active assignment or student attempt.
  const history = async () => ({
    publications: (
      await db.query(
        "SELECT * FROM lesson_versions WHERE lesson_id=$1 ORDER BY version",
        [draft.id],
      )
    ).rows,
    assignment: (
      await db.query("SELECT * FROM assignments WHERE id=$1", [created.id])
    ).rows,
    attempts: (
      await db.query("SELECT * FROM attempts WHERE session_id=$1 ORDER BY id", [
        opened.session.id,
      ])
    ).rows,
  });
  const beforeVersion = await history();
  const current = await readLessonDraft(teacher.access, draft.id);
  await status(
    `${path}/versions`,
    teacher.cookie,
    { ...newVersion(), version: "1" },
    409,
  );
  await status(
    `${path}/versions`,
    teacher.cookie,
    { ...newVersion(), expected_revision: draft.revision - 1 },
    409,
  );
  assert.deepEqual(await readLessonDraft(teacher.access, draft.id), current);
  const started = z
    .object({
      lesson_id: z.string(),
      revision: z.number(),
      version: z.string(),
    })
    .parse(
      await (
        await status(`${path}/versions`, teacher.cookie, newVersion(), 200)
      ).json(),
    );
  const next = await readLessonDraft(teacher.access, draft.id);
  assert.deepEqual(started, {
    lesson_id: draft.id,
    revision: current.revision + 1,
    version: "2",
  });
  assert.equal(next.approved_revision, null);
  assert.deepEqual(next.draft?.content_ref, {
    ...current.draft!.content_ref!,
    content_version: "2",
  });
  assert.deepEqual(next.draft?.concepts, current.draft?.concepts);
  assert.deepEqual(next.draft?.passages, current.draft?.passages);
  assert.deepEqual(
    next.draft?.questions,
    current.draft!.questions!.map((question) => ({
      ...question,
      content_ref: next.draft!.content_ref,
    })),
  );
  await status(`${path}/versions`, teacher.cookie, newVersion(), 409);
  await status(
    `${path}/versions`,
    teacher.cookie,
    { ...newVersion(), expected_revision: next.revision, version: "3" },
    409,
  );
  await status(
    `${path}/assignments`,
    teacher.cookie,
    { ...assignmentInput, request_id: randomUUID(), version: "2" },
    404,
  );
  assert.deepEqual(await history(), beforeVersion);
  const preservedReading = await request(
    `/api/tutoring/${opened.session.id}/reading`,
    student.cookie,
  );
  assert.equal(preservedReading.status, 200);
  assert.deepEqual(ReadingSchema.parse(await preservedReading.json()), reading);
  console.log(
    "PASS: authenticated teacher-only publishing APIs; explicit confirmation and revision; incomplete/mismatched source rejection; approval/publication/activation separation; new-version ownership/confirmation/collision/stale gates preserve exact source, concepts, v1 publication, assignment, attempt and reading; required idempotency identity; replay/conflict handling; class ownership and enrollment; exact student reading with private guidance withheld. No model call was made.",
  );
  console.log(
    `Retained synthetic HTTP probe ${run} in the configured development environment.`,
  );
} finally {
  try {
    // This empty permission-probe class must not turn a demo student into a teacher.
    // Published assignments and their historical evidence are retained above.
    await db.query("DELETE FROM classes WHERE id=$1", [foreignClassId]);
  } finally {
    await db.end();
  }
}
