import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { resolveActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import { buildDemoFixture, DEMO_IDS } from "../lib/evidence/demo.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import {
  SessionEvidenceSchema,
  StudentSessionViewSchema,
} from "../lib/evidence/contracts.ts";
import { toStudentSessionView } from "../lib/evidence/rules.ts";
import {
  evidenceAccess,
  EvidenceError,
  finishSession,
  presentQuestion,
  readSession,
  recordEvaluation,
  recordIntervention,
  startSession,
} from "../lib/evidence/store.ts";

// Run against a dedicated development installation after db:seed.
// Each run retains one labeled synthetic probe; it never overwrites live work.
const baseUrl = process.env.CHECK_BASE_URL ?? process.env.AUTH_URL;
if (!baseUrl) throw new Error("Set AUTH_URL in the ignored .env file.");
const origin = new URL(process.env.AUTH_URL ?? baseUrl).origin;
const statePath = join(tmpdir(), "learning-platform-restart-check.json");
const AuthSessionSchema = z.object({ user: z.object({ id: z.string() }) });

async function request(
  path: string,
  cookie = "",
  body?: unknown,
): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
}

async function responseJson(response: Response): Promise<unknown> {
  assert.equal(
    response.status,
    200,
    `Unexpected HTTP ${response.status} at ${new URL(response.url).pathname}`,
  );
  return response.json();
}

async function login(prefix: string) {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password)
    throw new Error(`Set ${prefix}_EMAIL and ${prefix}_PASSWORD in .env.`);
  const result = await request("/api/auth/sign-in/email", "", {
    email,
    password,
  });
  assert.equal(result.status, 200, `${prefix} login failed`);
  const cookies = result.headers.getSetCookie();
  assert.ok(cookies.some((cookie) => /httponly/i.test(cookie)));
  assert.ok(cookies.some((cookie) => /samesite=lax/i.test(cookie)));
  const cookie = cookies.map((value) => value.split(";", 1)[0]).join("; ");
  assert.ok(cookie, "Login must establish a session cookie");
  const session = AuthSessionSchema.parse(
    await responseJson(await request("/api/auth/get-session", cookie)),
  );
  const actor = await resolveActor(new Headers({ Cookie: cookie }));
  assert.equal(actor.userId, session.user.id);
  return { cookie, actor, access: evidenceAccess(actor) };
}

async function logout(cookie: string) {
  assert.equal((await request("/api/auth/sign-out", cookie, {})).status, 200);
  assert.equal(
    await responseJson(await request("/api/auth/get-session", cookie)),
    null,
    "A revoked session cookie must not authenticate again",
  );
  assert.equal(
    (await request(`/api/sessions/${DEMO_IDS.supportedSession}`, cookie))
      .status,
    401,
  );
}

async function counts() {
  // Fixed table names, never request data. Covers evidence and provisioned users.
  const result = await getPool().query(`
    select (select count(*)::int from profiles) as profiles,
           (select count(*)::int from classes) as classes,
           (select count(*)::int from enrollments) as enrollments,
           (select count(*)::int from assignments) as assignments,
           (select count(*)::int from sessions) as sessions,
           (select count(*)::int from attempts) as attempts,
           (select count(*)::int from evaluations) as evaluations,
           (select count(*)::int from interventions) as interventions,
           (select count(*)::int from auth_user) as auth_users
  `);
  return z.record(z.string(), z.number()).parse(result.rows[0]);
}

const RestartStateSchema = z.object({
  teacherCookie: z.string(),
  studentCookie: z.string(),
  evidence: SessionEvidenceSchema,
  counts: z.record(z.string(), z.number()),
});

async function verifyRestart() {
  const saved = RestartStateSchema.parse(
    JSON.parse(await readFile(statePath, "utf8")),
  );
  const retrieved = SessionEvidenceSchema.parse(
    await responseJson(
      await request(
        `/api/teacher/sessions/${saved.evidence.session.id}`,
        saved.teacherCookie,
      ),
    ),
  );
  assert.deepEqual(retrieved, saved.evidence);
  assert.deepEqual(await counts(), saved.counts);
  StudentSessionViewSchema.parse(
    await responseJson(
      await request(
        `/api/sessions/${saved.evidence.session.id}`,
        saved.studentCookie,
      ),
    ),
  );
  await logout(saved.teacherCookie);
  await logout(saved.studentCookie);
  await unlink(statePath);
  console.log(
    "PASS: evidence and authenticated sessions survived restart; repeated migration/seed preserved record counts; logout revoked both sessions.",
  );
}

async function checkPersistence(prepareRestart: boolean) {
  const teacher = await login("DEMO_TEACHER");
  const student = await login("DEMO_STUDENT_ONE");
  const other = await login("DEMO_STUDENT_TWO");
  assert.equal(teacher.actor.profileId, DEMO_IDS.teacher);
  assert.equal(student.actor.profileId, DEMO_IDS.studentOne);
  assert.equal(other.actor.profileId, DEMO_IDS.studentTwo);
  assert.equal(
    (await request(`/api/sessions/${DEMO_IDS.supportedSession}`)).status,
    401,
  );
  assert.equal(
    (await request("/api/auth/sign-up/email", "", {})).status,
    404,
    "Public account registration must be unavailable",
  );
  const invalidLogin = await request("/api/auth/sign-in/email", "", {
    email: process.env.DEMO_STUDENT_ONE_EMAIL,
    password: randomUUID(),
  });
  assert.equal(invalidLogin.status, 401);

  const content = loadApprovedContent();
  const fixture = buildDemoFixture(content);
  const prepared = SessionEvidenceSchema.parse(
    await responseJson(
      await request(
        `/api/teacher/sessions/${DEMO_IDS.supportedSession}`,
        teacher.cookie,
      ),
    ),
  );
  assert.equal(prepared.attempts.length, 4);
  assert.equal(prepared.evaluations.length, 4);
  assert.equal(prepared.interventions.length, 2);
  assert.deepEqual(
    prepared.attempts.map((attempt) => attempt.question.question_id),
    fixture.sessions[0].attempts.map((attempt) => attempt.question.question_id),
  );
  assert.equal(prepared.attempts[0].outcome?.outcome, "correct_after_feedback");
  assert.ok(
    prepared.evaluations.every(
      (evaluation) => evaluation.result?.per_concept_results.length === 2,
    ),
  );
  const studentView = await responseJson(
    await request(`/api/sessions/${DEMO_IDS.supportedSession}`, student.cookie),
  );
  StudentSessionViewSchema.parse(studentView); // strict: extra private fields fail
  assert.deepEqual(studentView, toStudentSessionView(prepared));
  for (const [path, cookie] of [
    [`/api/teacher/sessions/${DEMO_IDS.supportedSession}`, other.cookie],
    [`/api/teacher/sessions/${DEMO_IDS.supportedSession}`, student.cookie],
    [`/api/sessions/${DEMO_IDS.supportedSession}`, other.cookie],
  ])
    assert.ok([403, 404].includes((await request(path, cookie)).status));
  const denied = (error: unknown) =>
    error instanceof EvidenceError && [403, 404].includes(error.status);
  await assert.rejects(
    readSession(other.access, DEMO_IDS.supportedSession, "student"),
    denied,
  );

  // A second class has a different owner, without adding another login account.
  const foreignClass = randomUUID();
  const foreignAssignment = randomUUID();
  const foreignSession = randomUUID();
  try {
    await getPool().query(
      "insert into classes(id, teacher_id, name) values ($1, $2, $3)",
      [foreignClass, DEMO_IDS.inactiveStudent, "Synthetic authorization probe"],
    );
    await getPool().query(
      "insert into enrollments(class_id, student_id) values ($1, $2)",
      [foreignClass, DEMO_IDS.studentTwo],
    );
    await getPool().query(
      "insert into assignments select (jsonb_populate_record(null::assignments, $1::jsonb)).*",
      [
        JSON.stringify({
          ...fixture.assignment,
          id: foreignAssignment,
          class_id: foreignClass,
        }),
      ],
    );
    await getPool().query(
      "insert into sessions(id, student_id, assignment_id, class_id, status, data_origin, started_at) values ($1, $2, $3, $4, 'active', 'synthetic_fixture', now())",
      [foreignSession, DEMO_IDS.studentTwo, foreignAssignment, foreignClass],
    );
    assert.ok(
      [403, 404].includes(
        (
          await request(
            `/api/teacher/sessions/${foreignSession}`,
            teacher.cookie,
          )
        ).status,
      ),
      "A teacher must not read another class's evidence",
    );
  } finally {
    // Only these fresh, empty probe records are removed; no existing IDs are touched.
    await getPool().query("delete from sessions where id = $1", [
      foreignSession,
    ]);
    await getPool().query("delete from assignments where id = $1", [
      foreignAssignment,
    ]);
    await getPool().query("delete from enrollments where class_id = $1", [
      foreignClass,
    ]);
    await getPool().query("delete from classes where id = $1", [foreignClass]);
  }

  // The public endpoint chooses identity; it accepts only assignment ID.
  const newSession = z
    .object({
      session: z.object({ id: z.uuid(), status: z.literal("active") }),
    })
    .parse(
      await responseJson(
        await request("/api/sessions", student.cookie, {
          assignment_id: DEMO_IDS.assignmentId,
        }),
      ),
    ).session;
  const created = (await readSession(teacher.access, newSession.id, "teacher"))
    .session;
  assert.equal(created.data_origin, "live_demo");
  assert.equal(created.student_id, student.actor.profileId);
  // Remove only this new empty API probe, then retain a clearly labeled fixture.
  await getPool().query(
    "delete from sessions where id = $1 and student_id = $2",
    [created.id, student.actor.profileId],
  );
  const session = await startSession(
    student.access,
    DEMO_IDS.assignmentId,
    "synthetic_fixture",
  );
  const question = getCuratedQuestion(content, "NP-TX-01");
  await assert.rejects(
    presentQuestion(student.access, session.id, {
      question: { ...question, source_passage_ids: ["missing-passage"] },
      intent: "initial_retrieval",
    }),
  );
  const attempt = await presentQuestion(student.access, session.id, {
    question,
    intent: "initial_retrieval",
  });
  const submission = {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text: fixture.sessions[1].attempts[0].response_text ?? "",
  };
  const answerPath = `/api/sessions/${session.id}/answers`;
  const first = await responseJson(
    await request(answerPath, student.cookie, submission),
  );
  assert.deepEqual(
    await responseJson(await request(answerPath, student.cookie, submission)),
    first,
  );
  assert.equal(
    (
      await request(answerPath, student.cookie, {
        ...submission,
        response_text: "Changed answer",
      })
    ).status,
    409,
  );
  assert.ok(
    [403, 404].includes(
      (await request(answerPath, other.cookie, submission)).status,
    ),
  );
  assert.equal(
    (
      await request(answerPath, student.cookie, {
        ...submission,
        correctness: "correct",
        student_id: other.actor.profileId,
      })
    ).status,
    400,
  );

  const failed = {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "evaluation_failed" as const,
    evaluator: {
      type: "synthetic_fixture" as const,
      model: null,
      version: "persistence-check-v1",
    },
    supersedes_id: null,
    result: null,
    applied_result: null,
    failure_reason: "Deliberate persistence-check failure",
  };
  await recordEvaluation(student.access, session.id, failed);
  const acceptedSource = fixture.sessions[1].evaluations[0];
  assert.ok(acceptedSource.result);
  const accepted = await recordEvaluation(student.access, session.id, {
    ...failed,
    id: randomUUID(),
    validation_status: "accepted",
    failure_reason: null,
    result: {
      ...acceptedSource.result,
      evidence_quotes: acceptedSource.result.evidence_quotes.map((quote) => ({
        ...quote,
        response_id: attempt.id,
      })),
    },
    applied_result: null,
  });
  await recordEvaluation(student.access, session.id, {
    ...failed,
    id: randomUUID(),
  });
  const afterFailure = await readSession(teacher.access, session.id, "teacher");
  assert.equal(afterFailure.attempts[0].current_evaluation_id, accepted.id);
  assert.equal(
    afterFailure.attempts[0].response_text,
    submission.response_text,
  );
  assert.equal(afterFailure.evaluations.length, 3);

  const feedback = prepared.interventions[0];
  const intervention = await recordIntervention(student.access, session.id, {
    id: randomUUID(),
    related_attempt_id: attempt.id,
    related_evaluation_id: accepted.id,
    type: feedback.type,
    text_shown: feedback.text_shown,
    concept_ids: feedback.concept_ids,
    source_passage_ids: feedback.source_passage_ids,
    content_ref: feedback.content_ref,
  });
  assert.equal(intervention.visible_at, null);
  await responseJson(
    await request(
      `/api/sessions/${session.id}/interventions/${intervention.id}`,
      student.cookie,
      {},
    ),
  );
  const retestSource = prepared.attempts[2];
  const retest = await presentQuestion(student.access, session.id, {
    question: retestSource.question,
    intent: "immediate_retest",
    parent_attempt_id: attempt.id,
  });
  await responseJson(
    await request(answerPath, student.cookie, {
      attempt_id: retest.id,
      submission_key: randomUUID(),
      response_text: retestSource.response_text ?? "",
    }),
  );
  const helped = await readSession(teacher.access, session.id, "teacher");
  assert.equal(
    helped.attempts[1].assistance?.assistance_level,
    "corrective_feedback",
  );
  assert.ok(
    Object.values(
      helped.attempts[1].assistance
        ?.independent_retrieval_eligible_by_concept ?? {},
    ).every((eligible) => !eligible),
  );
  assert.deepEqual(
    helped.attempts[1].question.content_ref,
    content.content_ref,
  );
  assert.ok(helped.attempts[1].submitted_at);
  assert.ok(helped.interventions[0].visible_at);

  // Bypass TypeScript deliberately to check the database's own constraints.
  await assert.rejects(
    getPool().query(
      "insert into attempts select (jsonb_populate_record(null::attempts, $1::jsonb)).*",
      [
        JSON.stringify({
          ...retest,
          id: randomUUID(),
          sequence_index: 10,
          parent_attempt_id: DEMO_IDS.correctRoot,
          root_attempt_id: DEMO_IDS.correctRoot,
        }),
      ],
    ),
  );
  await assert.rejects(
    getPool().query(
      "insert into sessions select (jsonb_populate_record(null::sessions, $1::jsonb)).*",
      [
        JSON.stringify({
          ...session,
          id: randomUUID(),
          class_id: randomUUID(),
        }),
      ],
    ),
  );
  await assert.rejects(
    getPool().query("update attempts set response_text = $1 where id = $2", [
      "Illegal rewrite",
      attempt.id,
    ]),
  );
  await finishSession(student.access, session.id, {
    root_attempt_id: attempt.id,
    concept_ids: question.concept_ids,
    hypothesis_instance_id: null,
    latest_hypothesis_status: null,
    outcome: "pending_evaluation",
    supporting_attempt_ids: [attempt.id, retest.id],
    intervention_ids: [intervention.id],
    next_review_at: null,
    review_policy_version: "persistence-check-v1",
    review_reason:
      "Synthetic persistence probe; no model evaluated the retest.",
  });
  const saved = SessionEvidenceSchema.parse(
    await responseJson(
      await request(`/api/teacher/sessions/${session.id}`, teacher.cookie),
    ),
  );
  assert.equal(saved.session.status, "pending_evaluation");
  assert.deepEqual(
    saved.attempts.map((item) => item.sequence_index),
    [0, 1],
  );
  await logout(other.cookie);
  if (prepareRestart) {
    await writeFile(
      statePath,
      JSON.stringify({
        teacherCookie: teacher.cookie,
        studentCookie: student.cookie,
        evidence: saved,
        counts: await counts(),
      }),
      { mode: 0o600 },
    );
    console.log("Restart verification state saved privately in the container.");
  } else {
    await logout(teacher.cookie);
    await logout(student.cookie);
  }
  console.log(
    "PASS: HTTP login/session/logout, scoped APIs, prepared interaction reconstruction, student-safe responses, idempotent answers, evaluation retention, assistance and SQL integrity.",
  );
}

try {
  const mode = process.argv[2];
  if (mode === "--verify-restart") await verifyRestart();
  else if (mode === undefined || mode === "--prepare-restart")
    await checkPersistence(mode === "--prepare-restart");
  else
    throw new Error("Use no option, --prepare-restart, or --verify-restart.");
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Persistence verification failed.",
  );
  process.exitCode = 1;
} finally {
  await getPool().end();
}
