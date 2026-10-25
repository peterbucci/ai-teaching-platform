import assert from "node:assert/strict";
import test from "node:test";
import {
  parseTeacherWorkspaceContext,
  teacherReturnHref,
  teacherWorkspaceHref,
} from "../lib/teacher/workspace-contracts.ts";

const assignment = "b2dbbc74-af0c-4e4d-a365-dc2cb73a3a91";
const attempt = "946850b3-aec5-4de2-93b7-d060352e2e29";

test("workspace handoff retains exact evidence identities without private content or mutation identities", () => {
  const context = parseTeacherWorkspaceContext({
    assignment,
    origin: "synthetic_fixture",
    concept: "latency",
    attempt,
    seedAttempt: [attempt],
    returnTo: "evidence",
    draft: "old-draft",
    request: "old-request",
    response: "private student text",
  });
  const href = teacherWorkspaceHref("/teacher/interventions", context);
  const query = new URL(href, "https://example.test").searchParams;
  assert.equal(query.get("assignment"), assignment);
  assert.equal(query.get("origin"), "synthetic_fixture");
  assert.equal(query.get("concept"), "latency");
  assert.equal(query.get("attempt"), attempt);
  assert.deepEqual(query.getAll("seedAttempt"), [attempt]);
  assert.ok(!href.includes("old-") && !href.includes("private"));
  assert.ok(teacherReturnHref(context).startsWith("/teacher/evidence?"));
});

test("explicit invalid, ambiguous and oversized selections cannot silently change scope", () => {
  for (const params of [
    { assignment: "" },
    { assignment: [assignment, assignment] },
    { origin: "anything" },
    { attempt: "not-an-attempt" },
    { seedAttempt: Array(61).fill(attempt) },
    { returnTo: "https://example.test" },
  ])
    assert.throws(() => parseTeacherWorkspaceContext(params));
  assert.throws(() => teacherWorkspaceHref("//example.test", {}));
  assert.throws(() => teacherWorkspaceHref("/teacher/../api", {}));
});

test("a deliberate scope change clears selected records and repeated seeds deduplicate", () => {
  const context = parseTeacherWorkspaceContext({
    assignment,
    attempt,
    seedAttempt: [attempt, attempt],
    concept: "latency",
  });
  assert.deepEqual(context.seedAttempt, [attempt]);
  const query = new URL(
    teacherWorkspaceHref("/teacher/evidence", context, {
      concept: undefined,
      attempt: undefined,
      seedAttempt: [],
    }),
    "https://example.test",
  ).searchParams;
  assert.equal(query.get("assignment"), assignment);
  assert.equal(query.has("attempt"), false);
  assert.equal(query.has("concept"), false);
  assert.equal(query.has("seedAttempt"), false);
  assert.equal(context.attempt, attempt);
});
