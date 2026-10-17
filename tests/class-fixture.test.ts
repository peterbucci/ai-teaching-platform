import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClassFixture,
  CLASS_SCENARIOS,
} from "../lib/evidence/class-fixture.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import { validateSessionEvidence } from "../lib/evidence/rules.ts";

const content = loadApprovedContent();
test("24-student fixture is deterministic, retains original histories and covers the five concepts without real accounts", () => {
  const small = buildDemoFixture(content);
  const full = buildClassFixture(content);
  assert.deepEqual(full, buildClassFixture(content));
  assert.deepEqual(full.sessions.slice(0, 2), small.sessions);
  assert.deepEqual(full.profiles.slice(0, 4), small.profiles);
  assert.equal(full.enrollments.length, 24);
  assert.equal(new Set(full.enrollments.map((e) => e.student_id)).size, 24);
  assert.equal(CLASS_SCENARIOS.length, 24);
  assert.ok(full.profiles.every((p) => p.auth_user_id === null));
  const active = new Set(full.sessions.map((e) => e.session.student_id));
  assert.equal(
    full.enrollments.filter((e) => !active.has(e.student_id)).length,
    2,
  );
  assert.deepEqual(
    new Set(
      full.sessions.flatMap((e) =>
        e.attempts.flatMap((a) => a.question.concept_ids),
      ),
    ),
    content.concept_ids,
  );
  const allIds = full.sessions.flatMap((e) => [
    e.session.id,
    ...e.attempts.map((a) => a.id),
    ...e.evaluations.map((v) => v.id),
    ...e.interventions.map((i) => i.id),
  ]);
  assert.equal(new Set(allIds).size, allIds.length);
  for (const e of full.sessions) {
    validateSessionEvidence(content, e);
    assert.equal(e.session.data_origin, "synthetic_fixture");
    assert.equal(e.session.ended_at === null, e.session.status === "active");
    assert.ok(
      e.evaluations.every(
        (v) =>
          v.evaluator.type === "synthetic_fixture" &&
          v.evaluator.model === null,
      ),
    );
    if (e.session.ended_at)
      assert.ok(
        e.evaluations.every(
          (v) => Date.parse(v.evaluated_at) <= Date.parse(e.session.ended_at!),
        ),
      );
  }
});
test("fictional scenarios retain uncertainty, contradictory history, assistance, failure and simulated delayed links", () => {
  const full = buildClassFixture(content);
  const evaluations = full.sessions.flatMap((e) => e.evaluations);
  assert.deepEqual(
    new Set(
      evaluations.flatMap(
        (e) => e.result?.per_concept_results.map((j) => j.correctness) ?? [],
      ),
    ),
    new Set(["correct", "incorrect", "partially_correct", "uncertain"]),
  );
  const events = evaluations.flatMap(
    (e) => e.applied_result?.hypothesis_events ?? [],
  );
  assert.deepEqual(
    new Set(events.map((e) => e.status)),
    new Set(["suspected", "supported", "not_supported", "uncertain"]),
  );
  for (const event of events.filter((e) => e.status === "not_supported")) {
    assert.equal(event.previous_status, "suspected");
    assert.equal(event.evidence_evaluation_ids.length, 1);
    assert.equal(event.contradicting_evaluation_ids.length, 1);
  }
  for (const failed of evaluations.filter(
    (e) => e.validation_status !== "accepted",
  )) {
    assert.equal(failed.result, null);
    assert.equal(failed.applied_result, null);
    assert.equal(
      full.sessions
        .flatMap((e) => e.attempts)
        .find((a) => a.id === failed.attempt_id)?.current_evaluation_id,
      null,
    );
  }
  assert.ok(
    evaluations.some((e) => e.validation_status === "evaluation_failed"),
  );
  assert.ok(evaluations.some((e) => e.validation_status === "pending_review"));
  const delayedSession = full.sessions.find((e) =>
    e.attempts.some((a) => a.intent === "delayed_review"),
  )!;
  const delayed = delayedSession.attempts[0];
  const initial = full.sessions
    .flatMap((e) => e.attempts)
    .find((a) => a.id === delayed.review_of_attempt_id)!;
  assert.equal(delayed.review_of_attempt_id, initial.id);
  assert.notEqual(delayed.question.question_id, initial.question.question_id);
  assert.ok(
    Date.parse(delayed.presented_at) - Date.parse(initial.submitted_at!) >
      86400000,
  );
  assert.match(
    delayedSession.evaluations[0].result!.reasoning_observed,
    /Simulated delayed/,
  );
  assert.ok(
    full.sessions.some(
      (e) =>
        e.attempts.some(
          (a) => a.outcome?.outcome === "correct_after_feedback",
        ) &&
        e.attempts.some(
          (a) => a.assistance?.assistance_level === "corrective_feedback",
        ),
    ),
  );
});
