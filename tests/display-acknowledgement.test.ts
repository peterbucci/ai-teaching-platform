import assert from "node:assert/strict";
import test from "node:test";
import { createDisplayAcknowledgements } from "../app/study/display-acknowledgement.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("feedback waits for actual visibility and repeated observer events cannot duplicate a pending acknowledgment", async () => {
  let documentVisible = false;
  const inViewport = new Set(["first", "second"]);
  const calls: string[] = [];
  const saved = new Set<string>();
  const firstSave = deferred();
  const delivery = createDisplayAcknowledgements({
    ids: ["first", "second"],
    acknowledging: saved,
    isVisible: (id) => documentVisible && inViewport.has(id),
    async acknowledge(id) {
      calls.push(id);
      if (id === "first") await firstSave.promise;
    },
    onError() {
      assert.fail("Unexpected save failure");
    },
  });
  await delivery.check();
  assert.deepEqual(calls, [], "Hidden documents must not count as assistance");
  documentVisible = true;
  inViewport.clear();
  await delivery.check();
  assert.deepEqual(
    calls,
    [],
    "Offscreen feedback must not count as assistance",
  );
  inViewport.add("first").add("second");
  const pending = delivery.check();
  await delivery.check();
  assert.deepEqual(calls, ["first"]);
  documentVisible = false;
  firstSave.resolve();
  await pending;
  assert.deepEqual(
    calls,
    ["first"],
    "Recheck visibility after awaiting a save",
  );
  documentVisible = true;
  await delivery.check();
  await delivery.check();
  assert.deepEqual(calls, ["first", "second"]);
});

test("cleanup stops unissued acknowledgments and effect restarts share pending identities", async () => {
  const calls: string[] = [];
  const acknowledging = new Set<string>();
  const firstSave = deferred();
  const options = {
    ids: ["first", "second"],
    acknowledging,
    isVisible: () => true,
    async acknowledge(id: string) {
      calls.push(id);
      if (id === "first") await firstSave.promise;
    },
    onError() {
      assert.fail("Unexpected save failure");
    },
  };
  const previous = createDisplayAcknowledgements(options);
  const pending = previous.check();
  previous.stop();
  await previous.check();
  const next = createDisplayAcknowledgements(options);
  await next.check();
  assert.deepEqual(
    calls,
    ["first", "second"],
    "A pending ID is not resent by a new effect",
  );
  next.stop();
  firstSave.resolve();
  await pending;
  assert.deepEqual(
    calls,
    ["first", "second"],
    "Old effect cannot continue dispatching after cleanup",
  );
});

test("a failed display save requires explicit retry and a late failure does not update unmounted UI", async () => {
  const acknowledging = new Set<string>();
  let calls = 0;
  let errors = 0;
  const options = {
    ids: ["help"],
    acknowledging,
    isVisible: () => true,
    async acknowledge() {
      calls += 1;
      if (calls === 1) throw new Error("Uncertain network outcome");
    },
    onError() {
      errors += 1;
    },
  };
  const first = createDisplayAcknowledgements(options);
  await first.check();
  await first.check();
  assert.equal(
    calls,
    1,
    "Scroll/visibility events do not cause a retry cascade",
  );
  assert.equal(errors, 1);
  assert.equal(
    acknowledging.size,
    0,
    "Explicit refresh can retry the same stable ID",
  );
  first.stop();
  const retry = createDisplayAcknowledgements(options);
  await retry.check();
  assert.equal(calls, 2);
  assert.equal(errors, 1);
  retry.stop();

  const wait = deferred();
  const stopped = createDisplayAcknowledgements({
    ...options,
    ids: ["later"],
    async acknowledge() {
      await wait.promise;
      throw new Error("Late failure");
    },
  });
  const late = stopped.check();
  stopped.stop();
  wait.resolve();
  await late;
  assert.equal(errors, 1);
});
