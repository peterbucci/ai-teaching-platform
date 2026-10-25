import assert from "node:assert/strict";
import test from "node:test";
import {
  evidenceResponseAnchor,
  evidenceResultsNavigationKey,
  evidenceResultsScope,
  evidenceResultsTarget,
  evidenceSeedSelectionHref,
  focusEvidenceResultsTarget,
  readEvidenceResultsMemory,
  responseVisibleScrollTop,
  withEvidenceResultsMemory,
} from "../app/teacher/evidence/results-navigation.ts";

const ids = ["response-a", "response-b"];
const context = {
  assignment: "fictional-assignment",
  origin: "synthetic_fixture" as const,
  concept: "transmission_delay",
};
const scope = evidenceResultsScope(context);

test("selecting another response keeps list identity while every list filter isolates recovery", () => {
  assert.equal(
    evidenceResultsScope({ ...context, attempt: ids[0], session: "session-a" }),
    evidenceResultsScope({
      ...context,
      attempt: ids[1],
      session: "session-b",
      evaluation: "evaluation-b",
      seedAttempt: ids,
    }),
  );
  for (const changed of [
    { assignment: "other-assignment" },
    { origin: "live_demo" as const },
    { concept: "other-concept" },
    { q: "different search" },
    { student: "another-student" },
  ])
    assert.notEqual(evidenceResultsScope({ ...context, ...changed }), scope);
});

test("history entries retain their own list position and preserve Next router state", () => {
  const router = { __NA: true, tree: ["existing-router-state"] };
  const before = withEvidenceResultsMemory(router, {
    scope,
    attemptId: ids[1],
    scrollTop: 6175,
    focusRow: true,
  });
  const after = withEvidenceResultsMemory(before, {
    scope,
    attemptId: ids[0],
    scrollTop: 100,
    focusRow: false,
  });
  assert.equal(before.tree, router.tree);
  assert.equal(before.__NA, true);
  assert.deepEqual(readEvidenceResultsMemory(before, scope, ids), {
    scope,
    attemptId: ids[1],
    scrollTop: 6175,
    focusRow: true,
  });
  assert.equal(readEvidenceResultsMemory(after, scope, ids)?.scrollTop, 100);
  assert.deepEqual(router, { __NA: true, tree: ["existing-router-state"] });
});

test("foreign scopes, filtered responses and malformed stored positions cannot redirect focus", () => {
  const state = withEvidenceResultsMemory(null, {
    scope,
    attemptId: ids[1],
    scrollTop: 6585,
    focusRow: true,
  });
  assert.equal(readEvidenceResultsMemory(state, "other-assignment", ids), null);
  assert.equal(readEvidenceResultsMemory(state, scope, [ids[0]]), null);
  for (const scrollTop of [-1, Infinity, NaN])
    assert.equal(
      readEvidenceResultsMemory(
        withEvidenceResultsMemory(null, { scope, scrollTop, focusRow: false }),
        scope,
        ids,
      ),
      null,
    );
});

test("Back/Forward and reload restore a semantic row; detail navigation focuses the exact detail", () => {
  const memory = { scope, attemptId: ids[1], scrollTop: 6706, focusRow: true };
  assert.equal(
    evidenceResultsTarget("", ids, ids[0], memory),
    evidenceResponseAnchor(ids[1]),
  );
  assert.equal(
    evidenceResultsTarget("#evidence-results", ids, ids[1]),
    evidenceResponseAnchor(ids[1]),
  );
  assert.equal(
    evidenceResultsTarget(`#${evidenceResponseAnchor(ids[1])}`, ids, ids[0]),
    evidenceResponseAnchor(ids[1]),
  );
  assert.equal(
    evidenceResultsTarget("#response-detail-title", ids, ids[1], memory),
    "response-detail-title",
  );
  assert.equal(evidenceResultsTarget("", ids, ids[0]), null);
  assert.equal(evidenceResultsTarget("#evidence-response-foreign", ids), null);
  assert.equal(evidenceResultsTarget("#evidence-%ZZ", ids), null);
  assert.equal(
    evidenceResultsTarget("#evidence-results", [], ids[0]),
    "evidence-results",
  );
});

test("long mobile lists preserve a visible originating row or minimally reveal it", () => {
  const list = { scrollTop: 6585, viewportHeight: 420, scrollHeight: 7400 };
  assert.equal(
    responseVisibleScrollTop({ ...list, rowTop: 6650, rowHeight: 220 }),
    6585,
  );
  assert.equal(
    responseVisibleScrollTop({ ...list, rowTop: 7100, rowHeight: 220 }),
    6900,
  );
  assert.equal(
    responseVisibleScrollTop({ ...list, rowTop: 6400, rowHeight: 220 }),
    6400,
  );
  assert.equal(
    responseVisibleScrollTop({ ...list, rowTop: 7100, rowHeight: 900 }),
    6980,
  );
  assert.equal(
    responseVisibleScrollTop({
      ...list,
      scrollTop: 0,
      rowTop: 6650,
      rowHeight: 900,
    }),
    6650,
  );
});

test("restoration gives the visible response keyboard focus without an initial scroll jump", () => {
  const actions: string[] = [];
  focusEvidenceResultsTarget({
    focus(options) {
      assert.deepEqual(options, { preventScroll: true });
      actions.push("focus-response");
    },
    scrollIntoView(options) {
      assert.deepEqual(options, { block: "nearest" });
      actions.push("reveal-response");
    },
  });
  assert.deepEqual(actions, ["focus-response", "reveal-response"]);
});

test("evidence checkbox changes do not retrigger detail focus or disturb list navigation", () => {
  assert.equal(
    evidenceResultsNavigationKey("assignment=a&attempt=b&seedAttempt=a"),
    evidenceResultsNavigationKey(
      "seedAttempt=b&assignment=a&attempt=b&seedAttempt=a",
    ),
  );
  assert.notEqual(
    evidenceResultsNavigationKey("assignment=a&attempt=b"),
    evidenceResultsNavigationKey("assignment=a&attempt=c"),
  );
});

test("checkboxes on minimal deep links preserve omitted defaults and the current focus target", () => {
  const minimal =
    "https://fictional.test/teacher/evidence?assignment=a&concept=delay&attempt=b#response-detail-title";
  for (const selected of [["a"], ["a", "b"], []]) {
    const next = new URL(evidenceSeedSelectionHref(minimal, selected), minimal);
    assert.equal(next.hash, "#response-detail-title");
    assert.deepEqual(next.searchParams.getAll("seedAttempt"), selected);
    assert.equal(
      evidenceResultsNavigationKey(new URL(minimal).search),
      evidenceResultsNavigationKey(next.search),
    );
    assert.equal(next.searchParams.has("session"), false);
    assert.equal(next.searchParams.has("returnTo"), false);
  }
});

test("scroll memory yields no-hash focus to the shell after the teacher enters a search field", () => {
  const state = withEvidenceResultsMemory(null, {
    scope,
    attemptId: ids[1],
    scrollTop: 6585,
    focusRow: false,
  });
  const memory = readEvidenceResultsMemory(state, scope, ids);
  assert.equal(memory?.scrollTop, 6585);
  assert.equal(evidenceResultsTarget("", ids, ids[1], memory), null);
  assert.equal(
    evidenceResultsTarget(
      `#${evidenceResponseAnchor(ids[1])}`,
      ids,
      ids[1],
      memory,
    ),
    evidenceResponseAnchor(ids[1]),
  );
  const focused = readEvidenceResultsMemory(
    withEvidenceResultsMemory(state, {
      scope,
      attemptId: ids[1],
      scrollTop: 6585,
      focusRow: true,
    }),
    scope,
    ids,
  );
  assert.equal(
    evidenceResultsTarget("", ids, ids[1], focused),
    evidenceResponseAnchor(ids[1]),
  );
});
