import assert from "node:assert/strict";
import test from "node:test";
import {
  focusInterventionAnchor,
  interventionAnchorTarget,
} from "../app/teacher/interventions/evidence-navigation.ts";

const attempts = [
  "9dde5548-eb2f-4671-83fc-5cdb9483c41b",
  "a61c83a6-bd99-490b-858b-58da7dffad99",
];

test("bookmarked or history-restored evidence hashes resolve only saved response identities", () => {
  for (const id of attempts)
    assert.equal(
      interventionAnchorTarget(`#evidence-${id}`, attempts),
      `evidence-${id}`,
    );
  assert.equal(
    interventionAnchorTarget("#evidence-foreign-response", attempts),
    null,
  );
  assert.equal(interventionAnchorTarget("#evidence-%ZZ", attempts), null);
  assert.equal(interventionAnchorTarget("", attempts), null);
});

test("pane navigation resolves both headings without treating arbitrary hashes as evidence", () => {
  assert.equal(
    interventionAnchorTarget("#intervention-evidence-title", attempts),
    "intervention-evidence-title",
  );
  assert.equal(
    interventionAnchorTarget("#intervention-draft-title", attempts),
    "intervention-draft-title",
  );
  assert.equal(interventionAnchorTarget("#main-content", attempts), null);
});

test("revealed response opens its detail before receiving focus and scrolling", () => {
  const details = { open: false };
  const actions: string[] = [];
  focusInterventionAnchor(
    {
      focus(options) {
        assert.equal(details.open, true);
        assert.deepEqual(options, { preventScroll: true });
        actions.push("focus");
      },
      scrollIntoView(options) {
        assert.deepEqual(options, { block: "start" });
        actions.push("scroll");
      },
    },
    details,
  );
  assert.deepEqual(actions, ["focus", "scroll"]);
});

test("switching to a pane heading supports focus without requiring response details", () => {
  const actions: string[] = [];
  focusInterventionAnchor({
    focus() {
      actions.push("focus");
    },
    scrollIntoView() {
      actions.push("scroll");
    },
  });
  assert.deepEqual(actions, ["focus", "scroll"]);
});
