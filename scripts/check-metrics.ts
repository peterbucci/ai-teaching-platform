import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import {
  evidenceAccess,
  presentQuestion,
  recordEvaluation,
  startSession,
} from "../lib/evidence/store.ts";
import { ClassMetricsSchema } from "../lib/teacher/metrics.ts";
import { readAssignmentMetrics } from "../lib/teacher/store.ts";

// Real authenticated HTTP/database probe; the accepted judgment is explicitly
// synthetic. No paid provider call and no claim of real-model grading.
const base = process.env.CHECK_BASE_URL ?? process.env.AUTH_URL;
if (!base) throw new Error("Set AUTH_URL in ignored configuration");
async function request(path: string, cookie = "", body?: unknown) {
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
  const result = await request("/api/auth/sign-in/email", "", {
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  });
  assert.equal(
    result.status,
    200,
    `${prefix} login failed; respect the authentication cooldown`,
  );
  return result.headers
    .getSetCookie()
    .map((c) => c.split(";", 1)[0])
    .join("; ");
}
const path = `/api/teacher/assignments/${DEMO_IDS.assignmentId}/metrics`;
try {
  const teacher = await login("DEMO_TEACHER"),
    student = await login("DEMO_STUDENT_ONE");
  async function metrics(filter = "all") {
    const response = await request(`${path}?origin=${filter}`, teacher);
    assert.equal(response.status, 200);
    return z
      .object({ metrics: ClassMetricsSchema })
      .parse(await response.json()).metrics;
  }
  const before = await metrics();
  assert.ok([403, 404].includes((await request(path, student)).status));
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(`${path}?origin=unknown`, teacher)).status, 400);
  await assert.rejects(
    readAssignmentMetrics(
      evidenceAccess({
        profileId: DEMO_IDS.inactiveStudent,
        userId: "fixture-unrelated-owner",
      }),
      DEMO_IDS.assignmentId,
    ),
    /Assignment not found/,
  );
  const actor = await resolveActor(new Headers({ Cookie: student }));
  const access = evidenceAccess(actor);
  const content = loadApprovedContent();
  const question = getCuratedQuestion(content, "NP-BW-01");
  const session = await startSession(
    access,
    DEMO_IDS.assignmentId,
    "synthetic_fixture",
  );
  const attempt = await presentQuestion(access, session.id, {
    question,
    intent: "initial_retrieval",
  });
  const answer = question.rubric.answer_guidance;
  const submission = {
    attempt_id: attempt.id,
    submission_key: randomUUID(),
    response_text: answer,
  };
  assert.equal(
    (await request(`/api/sessions/${session.id}/answers`, student, submission))
      .status,
    200,
  );
  const pending = await metrics();
  await recordEvaluation(access, session.id, {
    id: randomUUID(),
    attempt_id: attempt.id,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "metrics-http-probe-v1",
    },
    supersedes_id: null,
    applied_result: null,
    failure_reason: null,
    result: {
      per_concept_results: [
        {
          concept_id: "bandwidth_throughput",
          correctness: "correct",
          error_type: null,
          rubric_criteria_met: question.rubric.criteria,
          rubric_criteria_missing: [],
        },
      ],
      source_passage_ids: question.source_passage_ids,
      evidence_quotes: [
        {
          response_id: attempt.id,
          quote: answer,
          start_character: 0,
          end_character: Array.from(answer).length,
          interpretation: "Synthetic test judgment, not model output.",
        },
      ],
      reasoning_observed:
        "Fixture judgment verifies persisted metrics refresh, not AI accuracy.",
      uncertainty_reason: null,
      proposed_next_action: "SCHEDULE_REVIEW",
    },
  });
  const after = await metrics();
  const concept = (m: typeof after) =>
    m.concepts.find((c) => c.concept_id === "bandwidth_throughput")!;
  assert.equal(
    concept(after).latest.pending,
    concept(pending).latest.pending - 1,
  );
  assert.equal(
    concept(after).latest.correct,
    concept(pending).latest.correct + 1,
  );
  for (const c of before.concepts.filter(
    (c) => c.concept_id !== "bandwidth_throughput",
  ))
    assert.deepEqual(
      after.concepts.find((a) => a.concept_id === c.concept_id),
      c,
    );
  assert.equal(
    (await request(`/api/sessions/${session.id}/answers`, student, submission))
      .status,
    200,
  );
  assert.deepEqual(
    await metrics(),
    after,
    "Duplicate submission changed class metrics",
  );
  const live = await metrics("live_demo");
  assert.equal(live.origins.synthetic_fixture, 0);
  assert.ok(live.origins.live_demo <= live.enrolled_students);
  for (const cookie of [teacher, student])
    await request("/api/auth/sign-out", cookie, {});
  console.log(
    JSON.stringify({
      status: "passed",
      enrolled: after.enrolled_students,
      participation: after.participation,
      sessionId: session.id,
      checks: [
        "authorized teacher metrics",
        "student/anonymous/unrelated-owner denied",
        "pending-to-accepted refetch",
        "unrelated concepts unchanged",
        "duplicate answer unchanged",
        "origin filtering",
      ],
      provider: "synthetic fixture only",
      paidRequests: 0,
    }),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Metrics check failed",
  );
  process.exitCode = 1;
} finally {
  await getPool().end();
}
