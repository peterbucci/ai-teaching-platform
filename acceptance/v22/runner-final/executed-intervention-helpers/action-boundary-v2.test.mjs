/** Consequential response-boundary tests; no browser, Docker, or real lock. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(
  new URL("./intervention-continuation-browser.mjs", import.meta.url),
  "utf8",
);
// Execute the actual helper functions in isolation. Do not import the executable
// browser entry point, which would acquire a real guard or open a browser.
const helpers = source.slice(
  source.indexOf("async function bounded("),
  source.indexOf("async function capture("),
);
assert.ok(helpers.includes("async function action("));

function fixture({ status = 200, body, failCompletedReceipt = false }) {
  const report = { progress: [], mutations: [], checks: [] };
  let clicks = 0;
  const response = {
    status: () => status,
    text: body,
    request: () => ({
      postData: () => '{"action":"approve","expected_revision":2}',
    }),
  };
  const context = {
    assert,
    report,
    guard() {},
    hash: (value) => createHash("sha256").update(value).digest("hex"),
    async save() {
      if (
        failCompletedReceipt &&
        report.mutations[0]?.status === "response-completed"
      )
        throw new Error(
          "simulated receipt I/O failure after complete response",
        );
    },
    setTimeout: (callback) => setTimeout(callback, 10),
    clearTimeout,
  };
  const api = runInNewContext(
    `let mutationUncertain = false; ${helpers}; ({action, uncertain: () => mutationUncertain})`,
    context,
  );
  return {
    report,
    api,
    clickCount: () => clicks,
    run: () =>
      api.action(
        { waitForResponse: () => Promise.resolve(response) },
        "/exact/draft",
        "approve",
        async () => {
          clicks++;
        },
      ),
  };
}

test("unfinished response body preserves uncertainty and never retries the click", async () => {
  let finish;
  const item = fixture({
    body: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  await assert.rejects(item.run(), /response body approve exceeded/);
  assert.equal(item.api.uncertain(), true);
  assert.equal(item.report.mutations[0].status, "outcome-unestablished");
  assert.equal(item.clickCount(), 1);
  finish('{"approval":{"id":"late"}}');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    item.api.uncertain(),
    true,
    "A late body cannot clear the timed-out operation's latch.",
  );
});

test("fully received HTTP rejection is known and is not called transport uncertainty", async () => {
  const item = fixture({
    status: 409,
    body: async () => '{"error":"stale revision"}',
  });
  await assert.rejects(item.run(), /approve:.*stale revision/);
  assert.equal(item.api.uncertain(), false);
  assert.equal(item.report.mutations[0].status, "rejected");
  assert.equal(item.report.mutations[0].http_status, 409);
  assert.equal(item.clickCount(), 1);
});

test("response completion is latched before a receipt-write failure", async () => {
  const item = fixture({
    body: async () => '{"approval":{"id":"observed"}}',
    failCompletedReceipt: true,
  });
  await assert.rejects(item.run(), /receipt I\/O failure/);
  assert.equal(item.api.uncertain(), false);
  assert.equal(item.report.mutations[0].status, "response-completed");
  assert.equal(item.clickCount(), 1);
});
