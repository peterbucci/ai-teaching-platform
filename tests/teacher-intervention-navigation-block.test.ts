import test from "node:test";
import assert from "node:assert/strict";
import { blockInterventionNavigation } from "../app/teacher/interventions/navigation-block.ts";

test("a capture guard closes the modal before focusing blocked-navigation feedback", () => {
  const steps: string[] = [];
  const event = new Event("click", { cancelable: true, bubbles: true });
  const drawer = {
    open: true,
    close() {
      this.open = false;
      steps.push("drawer closed");
    },
  };
  blockInterventionNavigation(event, drawer, () => {
    assert.equal(drawer.open, false, "feedback must no longer be inert");
    assert.equal(event.defaultPrevented, true, "navigation stays cancelled");
    assert.equal(
      event.cancelBubble,
      true,
      "the link cannot navigate afterward",
    );
    steps.push("feedback focused");
  });
  assert.deepEqual(steps, ["drawer closed", "feedback focused"]);
});

test("desktop and already closed drawers still reveal actionable feedback", () => {
  for (const drawer of [
    null,
    {
      open: false,
      close() {
        assert.fail("already closed");
      },
    },
  ]) {
    let revealed = 0;
    const event = new Event("click", { cancelable: true });
    blockInterventionNavigation(event, drawer, () => revealed++);
    assert.equal(revealed, 1);
    assert.equal(event.defaultPrevented, true);
  }
});
