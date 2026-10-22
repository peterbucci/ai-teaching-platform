import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolveActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import type { SessionEvidence } from "../lib/evidence/contracts.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
  submitAnswer,
  recordEvaluation,
  readSession,
  type EvidenceAccess,
} from "../lib/evidence/store.ts";
import { applyTutoring } from "../lib/tutoring/store.ts";
import { calculatePatterns } from "../lib/teacher/patterns.ts";
import { readAssignmentEvidence } from "../lib/teacher/store.ts";

const base = process.env.AUTH_URL;
if (!base) throw new Error("Configure AUTH_URL");
async function request(path: string, cookie: string, body?: unknown) {
  return fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
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
  assert.equal(
    response.status,
    200,
    "Demo login failed; respect authentication cooldown",
  );
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";", 1)[0])
    .join("; ");
  return {
    cookie,
    access: evidenceAccess(await resolveActor(new Headers({ Cookie: cookie }))),
  };
}
const content = loadApprovedContent();
const fixture = buildClassFixture(content).sessions.find((s) =>
  s.evaluations.some((e) =>
    e.applied_result?.hypothesis_events.some(
      (h) => h.status === "not_supported",
    ),
  ),
)!;

async function applyFixture(
  access: EvidenceAccess,
  sessionId: string,
  source: SessionEvidence,
  index: number,
) {
  const evidence = await readSession(access, sessionId, "student");
  const attempt = evidence.attempts.at(-1)!;
  const authored = source.attempts[index];
  assert.equal(attempt.question.question_id, authored.question.question_id);
  await submitAnswer(access, sessionId, {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text: authored.response_text!,
  });
  const evaluation = source.evaluations.find(
    (e) => e.attempt_id === authored.id,
  )!;
  const result = structuredClone(evaluation.result!);
  result.evidence_quotes = result.evidence_quotes.map((q) => ({
    ...q,
    response_id: attempt.id,
  }));
  const event = evaluation.applied_result!.hypothesis_events[0];
  result.misconception_candidates =
    index === 0
      ? [
          {
            concept_id: event.concept_id,
            misconception_id: event.misconception_id,
            status: "tentative",
            uncertainty_reason:
              "Synthetic candidate requiring a distinct follow-up.",
            evidence_quotes: result.evidence_quotes,
          },
        ]
      : [];
  const accepted = await recordEvaluation(access, sessionId, {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "patterns-integration-v1",
    },
    supersedes_id: null,
    result,
    applied_result: null,
    failure_reason: null,
  });
  await applyTutoring(access, sessionId, accepted.id);
  return accepted.id;
}
try {
  const teacher = await login("DEMO_TEACHER");
  const students = [
    await login("DEMO_STUDENT_ONE"),
    await login("DEMO_STUDENT_TWO"),
  ];
  const sessions = [];
  for (const student of students) {
    const session = await startSession(
      student.access,
      DEMO_IDS.assignmentId,
      "synthetic_fixture",
    );
    await presentQuestion(student.access, session.id, {
      question: getCuratedQuestion(
        content,
        content.sequence.initial_question_id,
      ),
      intent: "initial_retrieval",
    });
    await applyFixture(student.access, session.id, fixture, 0);
    sessions.push(session);
  }
  async function patterns() {
    const data = await readAssignmentEvidence(
      teacher.access,
      DEMO_IDS.assignmentId,
      "synthetic_fixture",
    );
    return calculatePatterns(
      data.students.map((s) => s.student_id),
      new Set(data.approved_misconception_ids),
      data.evidence,
    ).find((g) => g.misconception_id === content.sequence.hypothesis_id)!;
  }
  const before = await patterns();
  for (const student of students)
    assert.equal(
      before.students.find(
        (s) => s.student_id === student.access.actor.profileId,
      )?.current.status,
      "suspected",
    );
  const initial = await readSession(
    students[0].access,
    sessions[0].id,
    "student",
  );
  const contradiction = await applyFixture(
    students[0].access,
    sessions[0].id,
    fixture,
    1,
  );
  const after = await patterns();
  assert.equal(after.students.length, before.students.length);
  assert.equal(after.counts.suspected, before.counts.suspected - 1);
  assert.equal(after.counts.not_supported, before.counts.not_supported + 1);
  const changed = after.students.find(
    (s) => s.student_id === students[0].access.actor.profileId,
  )!;
  assert.equal(changed.current.status, "not_supported");
  assert.ok(
    changed.current.contradicting_evaluation_ids.includes(contradiction),
  );
  const preserved = await readSession(
    teacher.access,
    sessions[0].id,
    "teacher",
  );
  assert.equal(
    preserved.attempts[0].response_text,
    initial.attempts[0].response_text,
  );
  assert.deepEqual(
    preserved.evaluations.find((e) => e.id === initial.evaluations[0].id),
    initial.evaluations[0],
  );
  const page = await request(
    `/teacher/patterns?assignment=${DEMO_IDS.assignmentId}&origin=synthetic_fixture`,
    teacher.cookie,
  );
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("Possible reasoning patterns"));
  assert.ok(html.includes(`evaluation-${contradiction}`));
  assert.ok(html.includes("Inspect contradiction"));
  for (const account of [teacher, ...students])
    await request("/api/auth/sign-out", account.cookie, {});
  console.log(
    JSON.stringify({
      status: "passed",
      checks: [
        "two distinct suspected students",
        "persisted diagnostic changes one status",
        "denominator unchanged",
        "original response and evaluation preserved",
        "refreshed patterns page links contradiction",
      ],
      before: before.counts,
      after: after.counts,
      provider: "synthetic fixtures only",
      paidRequests: 0,
    }),
  );
} finally {
  await getPool().end();
}
