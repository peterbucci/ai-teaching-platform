import assert from "node:assert/strict";
import test from "node:test";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { calculateClassMetrics } from "../lib/teacher/metrics.ts";
import { calculatePatterns } from "../lib/teacher/patterns.ts";
import { parseTeacherWorkspaceContext } from "../lib/teacher/workspace-contracts.ts";
import {
  teacherEvidenceRows,
  canPrepareFromRow,
  evidenceResult,
} from "../app/teacher/evidence/model.ts";
import {
  assistanceLabel,
  concernPreparation,
  concernResponses,
  evaluationRows,
  investigationContext,
  originalEvidenceHref,
  originalSessionHref,
} from "../app/teacher/insights/model.ts";

const content = loadApprovedContent();
const fixture = buildClassFixture(content);
const students = fixture.enrollments.map((e) => ({
  student_id: e.student_id,
  display_name: fixture.profiles.find((p) => p.id === e.student_id)!
    .display_name,
}));
const snapshot = {
  students,
  evidence: fixture.sessions,
  metrics: calculateClassMetrics(
    students.map((s) => s.student_id),
    [...content.concept_ids],
    fixture.sessions,
  ),
};
const rows = teacherEvidenceRows(snapshot);
const refs = evaluationRows(rows, fixture.sessions);
const groups = calculatePatterns(
  students.map((s) => s.student_id),
  new Set(content.misconceptions.keys()),
  fixture.sessions,
);
const group = groups.find(
  (g) => g.misconception_id === content.sequence.hypothesis_id,
)!;
const context = parseTeacherWorkspaceContext({
  assignment: fixture.sessions[0].session.assignment_id,
  origin: "synthetic_fixture",
  concept: group.concept_id,
  misconception: group.misconception_id!,
  returnTo: "patterns",
});

test("concerns count distinct students and responses without inferring new diagnoses", () => {
  assert.deepEqual(group.counts, {
    suspected: 1,
    supported: 4,
    not_supported: 2,
    uncertain: 1,
  });
  assert.equal(group.students.length, 8);
  assert.equal(group.denominator, 24);
  assert.equal(concernResponses(group, refs), 15);
  const repeated = structuredClone(group);
  repeated.students[0].history.push(repeated.students[0].history[0]);
  assert.equal(concernResponses(repeated, refs), 15);
});
test("support and contrary links resolve exact authorized evaluations, attempts and sessions", () => {
  for (const student of group.students)
    for (const observation of student.history)
      for (const id of [
        observation.evaluation_id,
        ...observation.supporting_evaluation_ids,
        ...observation.contradicting_evaluation_ids,
      ]) {
        const row = refs.get(id)!;
        assert.ok(row);
        const url = new URL(originalEvidenceHref(context, row), "http://local");
        assert.equal(url.pathname, "/teacher/evidence");
        assert.equal(url.searchParams.get("evaluation"), id);
        assert.equal(url.searchParams.get("attempt"), row.attempt.id);
        assert.equal(url.searchParams.get("session"), row.session_id);
        assert.equal(url.searchParams.get("returnTo"), "patterns");
        assert.equal(
          url.searchParams.get("misconception"),
          group.misconception_id,
        );
        assert.equal(refs.get("not-in-authorized-snapshot"), undefined);
      }
});
test("historical evaluation links do not silently substitute current evaluation", () => {
  const row = rows.find((r) => r.evaluation)!;
  const session = fixture.sessions.find(
    (s) => s.session.id === row.session_id,
  )!;
  const old = {
    ...row.evaluation!,
    id: "91239acd-677c-40ef-80d3-ef03c2b80bc1",
  };
  const ref = evaluationRows(rows, [
    { ...session, evaluations: [...session.evaluations, old] },
  ]).get(old.id)!;
  assert.equal(
    new URL(
      originalEvidenceHref(context, ref),
      "http://local",
    ).searchParams.get("evaluation"),
    old.id,
  );
  assert.equal(
    ref.attempt.current_evaluation_id,
    row.attempt.current_evaluation_id,
  );
});
test("preparation includes accepted supporting work only and carries no recipients or private text", () => {
  const url = new URL(
    concernPreparation(group, rows, context)!,
    "http://local",
  );
  const seeds = url.searchParams.getAll("seedAttempt");
  assert.ok(seeds.length);
  for (const id of seeds) {
    const row = rows.find((r) => r.attempt.id === id)!;
    assert.ok(canPrepareFromRow(row, group.concept_id));
    assert.ok(
      group.students.some(
        (s) =>
          s.current.attempt_id === id &&
          ["supported", "suspected"].includes(s.current.status),
      ),
    );
  }
  assert.equal(url.searchParams.has("student"), false);
  assert.equal(url.searchParams.has("response_text"), false);
  assert.equal(
    concernPreparation({ ...group, misconception_id: null }, rows, context),
    null,
  );
  assert.equal(concernPreparation(group, [], context), null);
});
test("uncertain, failed and missing evaluations retain honest labels and assistance", () => {
  assert.ok(rows.some((r) => evidenceResult(r).includes("uncertain")));
  assert.ok(rows.some((r) => evidenceResult(r) === "Evaluation failed"));
  assert.ok(rows.some((r) => evidenceResult(r) === "Awaiting evaluation"));
  const assisted = rows.find(
    (r) =>
      r.attempt.assistance?.assistance_level !== "none_recorded" &&
      r.attempt.assistance,
  )!;
  assert.match(
    assistanceLabel(assisted, group.concept_id),
    /retrieval|Independence/,
  );
  assert.equal(
    assistanceLabel(
      { ...assisted, attempt: { ...assisted.attempt, assistance: null } },
      group.concept_id,
    ),
    "Assistance not recorded",
  );
});
test("empty origin has no fabricated concerns, responses or assessments", () => {
  const sessions = fixture.sessions.filter(
    (s) => s.session.data_origin === "live_demo",
  );
  assert.equal(sessions.length, 0);
  assert.deepEqual(
    calculatePatterns(
      students.map((s) => s.student_id),
      new Set(content.misconceptions.keys()),
      sessions,
    ),
    [],
  );
});
test("contextual session links carry investigation scope and exact anchor, clearing stale seeds", () => {
  const row = rows[0];
  const dirty = {
    ...context,
    seedAttempt: [rows[1].attempt.id],
    attempt: rows[1].attempt.id,
    student: "unrelated",
  };
  const clean = investigationContext(dirty);
  assert.deepEqual(clean.seedAttempt, []);
  assert.equal(clean.attempt, undefined);
  assert.equal(clean.student, undefined);
  const url = new URL(originalSessionHref(dirty, row), "http://local");
  assert.equal(url.searchParams.get("returnTo"), "patterns");
  assert.equal(url.searchParams.get("concept"), context.concept);
  assert.equal(url.searchParams.getAll("seedAttempt").length, 0);
  assert.equal(
    url.hash,
    `#${row.evaluation ? `evaluation-${row.evaluation.id}` : `attempt-${row.attempt.id}`}`,
  );
});
test("pattern service rejects out-of-roster evidence at the reused boundary", () => {
  assert.throws(
    () =>
      calculatePatterns(
        [],
        new Set(content.misconceptions.keys()),
        fixture.sessions,
      ),
    /outside the roster/,
  );
});
