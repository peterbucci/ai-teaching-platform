import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  availableData,
  assistanceLabels,
  filterSavedWork,
  findSavedQuestion,
  recordedDate,
  recordKey,
} from "../app/study/notebook/records/presentation.ts";
import {
  workFixture,
  original,
  attemptId,
  repeatedId,
  assignmentId,
} from "../app/study/notebook/records/verification/fixtures.ts";
import { notebookHref } from "../app/study/notebook/route-state.ts";

test("saved question lookup requires the entire immutable identity, even for repeated equal text and timestamps", () => {
  const identity = workFixture.sessions[0].questions[0].identity;
  const first = findSavedQuestion(workFixture, identity);
  const repeat = findSavedQuestion(workFixture, {
    ...identity,
    attemptId: repeatedId,
  });
  assert.equal(first?.question.response.responseText, original);
  assert.equal(repeat?.question.response.responseText, original);
  assert.notEqual(recordKey(identity), recordKey(repeat!.question.identity));
  for (const field of ["assignmentId", "sessionId", "attemptId"] as const) {
    assert.equal(
      findSavedQuestion(workFixture, {
        ...identity,
        [field]: "10000000-0000-4000-8000-000000000099",
      }),
      null,
    );
  }
});

test("local search preserves exact originals, server order, repeated responses and historical versions", () => {
  const before = structuredClone(workFixture);
  const result = filterSavedWork(workFixture, "   PACKET travels   ");
  assert.deepEqual(
    result.sessions[0].questions.map((q) => q.identity.attemptId),
    [attemptId, repeatedId],
  );
  assert.equal(result.sessions[0].questions[0].response.responseText, original);
  assert.equal(
    filterSavedWork(workFixture, "").sessions[1].questions[0].response
      .contentVersion,
    "historical-v0",
  );
  assert.deepEqual(workFixture, before);
  assert.equal(
    filterSavedWork(workFixture, "missing words").sessions.length,
    0,
  );
  assert.equal(filterSavedWork(workFixture, "  "), workFixture);
});

test("empty submitted originals survive without becoming unanswered or failed", () => {
  const last = workFixture.sessions[1].questions[0];
  const found = findSavedQuestion(workFixture, last.identity);
  assert.equal(found?.question.response.promptText, "");
  assert.equal(found?.question.response.responseText, "");
  assert.deepEqual(found?.question.assessment, {
    status: "unavailable",
    reason: "not-in-current-projection",
  });
});

test("pending refresh preserves supplied data; unloaded and unavailable remain distinct", () => {
  assert.equal(
    availableData({ status: "pending", message: "Waiting", data: workFixture }),
    workFixture,
  );
  assert.equal(
    availableData({ status: "pending", message: "Waiting", data: null }),
    null,
  );
  assert.equal(availableData({ status: "loading" }), null);
  assert.equal(
    availableData({ status: "unavailable", message: "Offline" }),
    null,
  );
  assert.equal(availableData({ status: "empty", message: "No records" }), null);
});

test("recorded assistance is not relabeled as correctness, unaided mastery or retention", () => {
  assert.equal(
    assistanceLabels.none_recorded,
    "No content assistance recorded",
  );
  assert.equal(
    assistanceLabels.prompt_supplied_content,
    "Supporting content in the question",
  );
  assert.equal(
    assistanceLabels.corrective_feedback,
    "Corrective feedback recorded",
  );
  assert.equal(Object.keys(assistanceLabels).length, 7);
});

test("exact session and attempt remain in explicit native study and work links", () => {
  for (const session of workFixture.sessions) {
    for (const q of session.questions) {
      const url = new URL(q.href, "https://fixture.invalid");
      assert.equal(url.searchParams.get("session"), session.identity.sessionId);
      assert.equal(url.hash, `#question-${q.identity.attemptId}`);
      assert.ok(url.pathname.endsWith(assignmentId));
    }
    const href = notebookHref({
      kind: "assignment",
      assignmentId,
      sessionId: session.identity.sessionId,
      tab: "work",
    });
    assert.ok(href.includes(`session=${session.identity.sessionId}`));
  }
});

test("timestamps are explicitly UTC and missing timestamps are not approximated", () => {
  assert.match(recordedDate("2026-10-25T12:03:00Z"), /12:03 PM UTC$/);
  assert.equal(recordedDate("unknown"), "Recorded time unavailable");
});

test("records package has no mutation, delivery observer, composer or speculative chronology dependency", () => {
  const source = readFileSync(
    new URL("../app/study/notebook/records/records.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /\bfetch\s*\(|useEffect|IntersectionObserver|localStorage|sessionStorage|<textarea|<form|dangerouslySetInnerHTML|student-notebook-contracts/,
  );
  assert.match(source, /Assessment unavailable in this view/);
  assert.match(source, /Full historical source identity/);
});
