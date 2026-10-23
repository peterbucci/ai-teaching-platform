import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { startTutoring } from "../lib/tutoring/store.ts";
import { assignmentStudyHref } from "../lib/tutoring/navigation.ts";
import { evidenceAccess, readSession } from "../lib/evidence/store.ts";
import { createApprovedRuntimeLesson } from "./fixtures/approved-r7-lesson.ts";
import { makeDialogueExamples } from "../lib/dialogue/examples.ts";
import { CONVERSATION_VERSION } from "../lib/dialogue/conversation.ts";
import { makeDisplayAcknowledgement } from "../lib/dialogue/student-view.ts";
import {
  loadConversation,
  reserveConversationOperation,
  commitConversationIntent,
  commitConversationHelp,
} from "../lib/dialogue/store.ts";

// Uses synthetic lesson/dialogue fixtures and the actual optional local speech
// service. No model key or generated learning judgment is used.
assert.equal(process.env.OPENAI_API_KEY?.trim() ?? "", "");
const base = new URL(process.env.AUTH_URL!);
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname));
const db = getPool();
const cookies: string[] = [];
async function actor(profileId: string) {
  const result = await db.query(
    "SELECT auth_user_id FROM profiles WHERE id=$1",
    [profileId],
  );
  assert.equal(typeof result.rows[0]?.auth_user_id, "string");
  return evidenceAccess({ profileId, userId: result.rows[0].auth_user_id });
}
async function post(
  path: string,
  input: unknown,
  cookie = "",
  origin = base.origin,
) {
  return fetch(new URL(path, base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(55000),
    redirect: "manual",
  });
}
async function login(prefix: string) {
  const result = await post("/api/auth/sign-in/email", {
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  });
  assert.equal(result.status, 200, "Fictional login failed");
  const cookie = result.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert.ok(cookie);
  cookies.push(cookie);
  return cookie;
}
try {
  const teacher = await actor(DEMO_IDS.teacher);
  const student = await actor(DEMO_IDS.studentOne);
  const classId = randomUUID();
  await db.query("INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)", [
    classId,
    teacher.actor.profileId,
    "Synthetic optional speech verification",
  ]);
  await db.query("INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)", [
    classId,
    student.actor.profileId,
  ]);
  const { assignmentId, content } = await createApprovedRuntimeLesson(
    teacher,
    classId,
  );
  // Use the actual student start service so the saved session can be opened in
  // the real study UI. Its source/help stay explicitly synthetic; no answer is graded.
  const { session } = await startTutoring(student, assignmentId);
  const attempt = (
    await readSession(student, session.id, "student")
  ).attempts.at(-1);
  assert.ok(attempt, "The real start service must present the first question.");
  const initial = await loadConversation(student, session.id);
  const action = {
    version: CONVERSATION_VERSION,
    action: "send_message" as const,
    request_id: randomUUID(),
    session_id: session.id,
    attempt_id: attempt.id,
    expected_revision: initial.dialogue.state.revision,
    text: "Please explain the difference in a source-supported way.",
  };
  await reserveConversationOperation(student, action);
  await commitConversationIntent(
    student,
    session.id,
    action.request_id,
    {
      category: "QUESTION_OR_HELP",
      rationale: "Synthetic fixture, not a model classification.",
    },
    { answer_intent: "uncertain", disclosure: "safe" },
  );
  const examples = makeDialogueExamples(content);
  if (examples.help.kind !== "help") throw new Error("Expected help fixture.");
  const accepted = await commitConversationHelp(
    student,
    session.id,
    action.request_id,
    {
      ...examples.help,
      content_id: randomUUID(),
      generation: {
        ...examples.help.generation,
        model: "synthetic-speech-fixture",
        generated_at: new Date().toISOString(),
      },
    },
    examples.review,
  );
  const turn = accepted.dialogue.turns.find(
    (item) => item.request_id === action.request_id,
  )!;
  assert.equal(turn.response.status, "accepted");
  if (turn.response.status !== "accepted")
    throw new Error("Expected accepted fixture help");
  const input = {
    session_id: session.id,
    intervention_id: turn.response.intervention_id,
  };
  const studentCookie = await login("DEMO_STUDENT_ONE");
  const studyUrl = new URL(assignmentStudyHref(assignmentId, session.id), base);
  const studyPage = await fetch(studyUrl, {
    headers: { Cookie: studentCookie },
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(
    studyPage.status,
    200,
    "The fixture must open in the real study UI.",
  );
  const peerCookie = await login("DEMO_STUDENT_TWO");
  const teacherCookie = await login("DEMO_TEACHER");
  assert.equal((await post("/api/speech", input)).status, 401);
  assert.equal((await post("/api/speech", input, peerCookie)).status, 404);
  assert.equal((await post("/api/speech", input, teacherCookie)).status, 404);
  assert.equal(
    (await post("/api/speech", input, studentCookie)).status,
    404,
    "Undisplayed feedback must stay unavailable",
  );
  assert.equal(
    (
      await post(
        "/api/speech",
        input,
        studentCookie,
        "https://unrelated.example.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        "/api/speech",
        { ...input, text: "Private rubric substitution" },
        studentCookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/api/speech",
        { ...input, text: "x".repeat(2000) },
        studentCookie,
      )
    ).status,
    400,
  );
  const acknowledgment = makeDisplayAcknowledgement(
    accepted.dialogue.state,
    turn,
  );
  assert.equal(
    (
      await post(
        `/api/tutoring/${session.id}/conversation/display`,
        acknowledgment,
        studentCookie,
      )
    ).status,
    200,
  );
  const before = await readSession(student, session.id, "student");
  const audio = await post("/api/speech", input, studentCookie);
  assert.equal(audio.status, 200, "Local Piper must return audio.");
  assert.equal(audio.headers.get("content-type"), "audio/wav");
  assert.equal(audio.headers.get("cache-control"), "no-store");
  const wav = new Uint8Array(await audio.arrayBuffer());
  assert.ok(wav.length > 44);
  assert.equal(new TextDecoder().decode(wav.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(wav.slice(8, 12)), "WAVE");
  const replay = await post("/api/speech", input, studentCookie);
  assert.equal(replay.status, 200);
  assert.deepEqual(new Uint8Array(await replay.arrayBuffer()), wav);
  assert.deepEqual(
    await readSession(student, session.id, "student"),
    before,
    "Speech cannot submit, evaluate, advance or add assistance",
  );
  console.log(
    JSON.stringify({
      status: "passed",
      learning_content: "synthetic_fixture",
      speech_engine: "actual-local-piper",
      paid_model_calls: 0,
      audio_bytes: wav.length,
      assignment_id: assignmentId,
      session_id: session.id,
      intervention_id: input.intervention_id,
      study_url: new URL(assignmentStudyHref(assignmentId, session.id), base)
        .href,
      checks: [
        "owner-only displayed feedback",
        "anonymous/peer/teacher/origin/input/body-size rejection",
        "actual WAV and cached replay",
        "unchanged learning evidence",
      ],
    }),
  );
} finally {
  for (const cookie of cookies) await post("/api/auth/sign-out", {}, cookie);
  await db.end();
}
