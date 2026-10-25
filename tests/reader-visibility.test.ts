import assert from "node:assert/strict";
import test from "node:test";
import {
  readingIsActive,
  scheduleReadingPresentation,
} from "../app/study/reading/visibility.ts";

function frames() {
  let nextId = 0;
  const pending = new Map<number, () => void>();
  const cancelled: number[] = [];
  return {
    pending,
    cancelled,
    requestFrame(callback: () => void) {
      const id = ++nextId;
      pending.set(id, callback);
      return id;
    },
    cancelFrame(id: number) {
      cancelled.push(id);
      pending.delete(id);
    },
    takeNext() {
      const entry = pending.entries().next().value;
      assert.ok(entry, "Expected a pending browser frame");
      pending.delete(entry[0]);
      return entry[1];
    },
  };
}

test("reader activity requires owner permission, browser visibility and focus", () => {
  assert.equal(readingIsActive(true, "visible", true), true);
  assert.equal(readingIsActive(false, "visible", true), false);
  assert.equal(readingIsActive(true, "visible", false), false);
  assert.equal(readingIsActive(false, "visible", false), false);
  for (const state of ["hidden", "prerender", "unloaded", ""]) {
    assert.equal(readingIsActive(true, state, true), false);
    assert.equal(readingIsActive(true, state, false), false);
    assert.equal(readingIsActive(false, state, true), false);
    assert.equal(readingIsActive(false, state, false), false);
  }
});

test("an initially hidden delivery schedules nothing; visibility needs a fresh presentation", () => {
  const browser = frames();
  let visible = false;
  let presented = 0;
  const options = {
    ...browser,
    isVisible: () => visible,
    onPresented: () => presented++,
  };
  const stopHidden = scheduleReadingPresentation(options);
  assert.equal(browser.pending.size, 0);
  visible = true;
  assert.equal(presented, 0);
  assert.equal(browser.pending.size, 0);
  stopHidden();

  const stopVisible = scheduleReadingPresentation(options);
  browser.takeNext()();
  assert.equal(presented, 0, "A single pre-paint callback is insufficient");
  browser.takeNext()();
  assert.equal(presented, 1);
  assert.equal(browser.pending.size, 0);
  stopVisible();
  assert.equal(
    presented,
    1,
    "Cleanup cannot present an already completed delivery",
  );
});

test("a delayed first frame reads current visibility without needing a rerender", async () => {
  const browser = frames();
  let visibility = "visible";
  let presented = 0;
  scheduleReadingPresentation({
    ...browser,
    isVisible: () => readingIsActive(true, visibility, true),
    onPresented: () => presented++,
  });

  // A browser may suspend the queued frame while the tab is backgrounded.
  // Draining other work must neither count as presentation nor cache visibility.
  await Promise.resolve();
  assert.equal(presented, 0);
  visibility = "hidden";
  browser.takeNext()();
  assert.equal(presented, 0);
  assert.equal(browser.pending.size, 0);
});

test("owner hide, browser background or lost focus between frames prevents acknowledgment", () => {
  for (const hide of ["owner", "browser", "focus"] as const) {
    const browser = frames();
    let active = true;
    let visibility = "visible";
    let focused = true;
    let presented = 0;
    scheduleReadingPresentation({
      ...browser,
      isVisible: () => readingIsActive(active, visibility, focused),
      onPresented: () => presented++,
    });
    browser.takeNext()();
    if (hide === "owner") active = false;
    else if (hide === "browser") visibility = "hidden";
    else focused = false;
    browser.takeNext()();
    assert.equal(
      presented,
      0,
      `${hide} changed before the presentation boundary`,
    );
    assert.equal(browser.pending.size, 0);
  }
});

test("clipped or hidden passage at the final frame is not presented", () => {
  const browser = frames();
  let passageVisible = true;
  let presented = 0;
  scheduleReadingPresentation({
    ...browser,
    isVisible: () => passageVisible,
    onPresented: () => presented++,
  });
  browser.takeNext()();
  passageVisible = false;
  browser.takeNext()();
  assert.equal(presented, 0);
  passageVisible = true;
  assert.equal(
    browser.pending.size,
    0,
    "A stopped check must not retry itself",
  );
});

test("pane hide or unmount cancels either frame and rejects a queued callback race", () => {
  for (const completedFrames of [0, 1]) {
    const browser = frames();
    let presented = 0;
    const stop = scheduleReadingPresentation({
      ...browser,
      isVisible: () => true,
      onPresented: () => presented++,
    });
    if (completedFrames === 1) browser.takeNext()();
    // Hold a callback already taken by the browser's event loop: cancellation
    // still needs an internal guard even if removing the queued ID is too late.
    const queuedCallback = browser.takeNext();
    stop();
    queuedCallback();
    assert.equal(presented, 0);
    assert.equal(browser.pending.size, 0);
    assert.deepEqual(browser.cancelled, [completedFrames + 1]);
  }
});

test("rapid hide and resume permits only the new visible presentation callback", () => {
  const browser = frames();
  let presented = 0;
  const options = {
    ...browser,
    isVisible: () => true,
    onPresented: () => presented++,
  };
  const stopOld = scheduleReadingPresentation(options);
  browser.takeNext()();
  const oldCallback = browser.takeNext();
  stopOld();
  const stopNew = scheduleReadingPresentation(options);
  oldCallback();
  browser.takeNext()();
  assert.equal(presented, 0);
  browser.takeNext()();
  assert.equal(presented, 1);
  assert.equal(browser.pending.size, 0);
  stopNew();
  assert.equal(presented, 1);
});
