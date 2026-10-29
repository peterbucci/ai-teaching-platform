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
    `/teacher/insights?assignment=${DEMO_IDS.assignmentId}&origin=synthetic_fixture`,
    teacher.cookie,
  );
  assert.equal(page.status, 200);
  const concernLink = [
    ...(await page.text()).matchAll(/<a\b[^>]*href="([^"]+)"/g),
  ]
    .map((match) => new URL(match[1].replaceAll("&amp;", "&"), base))
    .find(
      (url) =>
        url.pathname === "/teacher/insights" &&
        url.searchParams.get("misconception") ===
          content.sequence.hypothesis_id,
    );
  assert.ok(concernLink, "Insights omitted the named concern navigation");
  assert.equal(concernLink.origin, new URL(base).origin);
  assert.equal(
    concernLink.searchParams.get("assignment"),
    DEMO_IDS.assignmentId,
  );
  const concernPage = await request(
    concernLink.pathname + concernLink.search,
    teacher.cookie,
  );
  assert.equal(concernPage.status, 200);
  const html = await concernPage.text();
  assert.ok(html.includes(`evaluation-${contradiction}`));
  const contraryLink = [
    ...html
      .replaceAll(/<!--.*?-->/g, "")
      .matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>Contrary evidence \d+<\/a>/g),
  ]
    .map((match) => new URL(match[1].replaceAll("&amp;", "&"), base))
    .find((url) => url.searchParams.get("evaluation") === contradiction);
  assert.ok(
    contraryLink,
    "The concern omitted its exact contrary evidence link",
  );
  const contraryEvaluation = preserved.evaluations.find(
    (e) => e.id === contradiction,
  )!;
  assert.equal(contraryLink.origin, new URL(base).origin);
  assert.equal(contraryLink.pathname, "/teacher/evidence");
  assert.equal(
    contraryLink.searchParams.get("assignment"),
    DEMO_IDS.assignmentId,
  );
  assert.equal(contraryLink.searchParams.get("session"), preserved.session.id);
  assert.equal(
    contraryLink.searchParams.get("attempt"),
    contraryEvaluation.attempt_id,
  );
  const original = await request(
    contraryLink.pathname + contraryLink.search,
    teacher.cookie,
  );
  assert.equal(original.status, 200);
  const escapedResponse = preserved.attempts
    .find((a) => a.id === contraryEvaluation.attempt_id)!
    .response_text!.replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
  assert.ok(
    (await original.text()).includes(escapedResponse),
    "Contrary evidence omitted the exact original response",
  );
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
        "refreshed learning insights links contradiction",
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
