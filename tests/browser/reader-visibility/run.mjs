import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { generated, localConfiguration, root } from "./config.mjs";
import { getPool } from "../../../lib/db.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
} from "../../../lib/evidence/store.ts";
import { DEMO_IDS } from "../../../lib/evidence/demo.ts";
import {
  loadApprovedContent,
  getCuratedQuestion,
} from "../../../lib/evidence/content.ts";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { origin: base, database } = localConfiguration();
assert.ok(
  process.env.DEMO_STUDENT_TWO_EMAIL && process.env.DEMO_STUDENT_TWO_PASSWORD,
  "Configure the existing fictional student login.",
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(generated, "fixture-manifest.json"), "utf8"),
);
assert.equal(manifest.owner, "learning-pulse-reader-visibility-v1");
assert.equal(manifest.origin, base);
assert.equal(manifest.database, database);
const runName =
  process.env.READER_RUN ||
  "results-" + new Date().toISOString().replace(/[:.]/g, "-");
assert.match(
  runName,
  /^[a-zA-Z0-9_-]+$/,
  "READER_RUN must be a simple directory name.",
);
const out = path.join(generated, runName);
assert.ok(
  !fs.existsSync(out),
  "Retain the existing evidence; choose a new READER_RUN.",
);
fs.mkdirSync(out);
const report = {
  origin: base,
  startedAt: new Date().toISOString(),
  providersDisabled: true,
  paidModelCalls: 0,
  browser: "Chromium via Playwright",
  sources: Object.fromEntries(
    [
      "app/study/reading/reader.tsx",
      "app/study/reading/visibility.ts",
      "app/study/reading/page.tsx",
    ].map((file) => [
      file,
      createHash("sha256")
        .update(fs.readFileSync(path.join(root, file)))
        .digest("hex"),
    ]),
  ),
  cases: [],
};
const pool = getPool();
let b;
let context;
try {
  const actor = (
    await pool.query("SELECT id,auth_user_id FROM profiles WHERE id=$1", [
      DEMO_IDS.studentTwo,
    ])
  ).rows[0];
  const access = evidenceAccess({
    profileId: actor.id,
    userId: actor.auth_user_id,
  });
  async function fixture(live = false) {
    const session = await startSession(
      access,
      DEMO_IDS.assignmentId,
      live ? "live_demo" : "synthetic_fixture",
    );
    const attempt = await presentQuestion(access, session.id, {
      question: getCuratedQuestion(loadApprovedContent(), "NP-TX-01"),
      intent: "initial_retrieval",
    });
    return {
      sessionId: session.id,
      attemptId: attempt.id,
      assignmentId: DEMO_IDS.assignmentId,
      sourceVersion: attempt.question.content_ref.content_version,
    };
  }
  async function snapshot(f) {
    const rows = (
      await pool.query(
        "SELECT id, related_attempt_id, source_passage_ids, content_ref, delivery_status, visible_at FROM interventions WHERE session_id=$1 ORDER BY created_at,id",
        [f.sessionId],
      )
    ).rows;
    const attempts = (
      await pool.query(
        "SELECT id,response_text,submitted_at,assistance,current_evaluation_id FROM attempts WHERE session_id=$1 ORDER BY id",
        [f.sessionId],
      )
    ).rows;
    return { interventions: rows, attempts };
  }
  b = await chromium.launch({
    headless: true,
    ...(process.env.READER_BROWSER_PATH
      ? { executablePath: process.env.READER_BROWSER_PATH }
      : {}),
  });
  context = await b.newContext();
  report.browserVersion = b.version();
  const loginPage = await context.newPage();
  const loginResponse = await loginPage.goto(base + "/login");
  assert.equal(loginResponse.status(), 200);
  assert.equal(new URL(loginPage.url()).origin, base);
  assert.match(await loginPage.locator("body").innerText(), /Welcome back/);
  const login = await context.request.post(base + "/api/auth/sign-in/email", {
    headers: { Origin: base },
    data: {
      email: process.env.DEMO_STUDENT_TWO_EMAIL,
      password: process.env.DEMO_STUDENT_TWO_PASSWORD,
    },
  });
  assert.equal(login.status(), 200);
  await loginPage.close();
  function tracking(page) {
    const calls = [];
    page.on("request", (r) => {
      if (
        r.method() === "POST" &&
        (/\/api\/tutoring\/[^/]+\/reading$/.test(r.url()) ||
          /\/api\/sessions\/[^/]+\/interventions\//.test(r.url()))
      )
        calls.push({
          path: new URL(r.url()).pathname,
          body: r.postData(),
          time: Date.now(),
        });
    });
    return calls;
  }
  async function check(id, run) {
    if (
      process.env.READER_CASES &&
      !process.env.READER_CASES.split(",").includes(id)
    )
      return;
    const entry = { id, status: "running" };
    report.cases.push(entry);
    try {
      Object.assign(entry, await run());
      entry.status = "passed";
      console.log("PASS " + id);
    } catch (error) {
      entry.status = "failed";
      entry.error = error.stack;
      console.log("FAIL " + id + ": " + error.message);
    }
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2),
    );
  }
  const route = (f, extra = "") =>
    `${base}/study/reader-visibility-check?session=${f.sessionId}&passage=P08${extra}`;
  async function ready(page) {
    await page
      .getByRole("heading", {
        name: "Reader visibility verification",
        exact: true,
      })
      .waitFor();
    await page.waitForTimeout(400);
  }
  async function state(page, value) {
    await page.waitForFunction(
      (value) =>
        document
          .querySelector("[data-reading-state]")
          ?.getAttribute("data-reading-state") === value,
      value,
      { timeout: 15000 },
    );
  }
  async function show(page) {
    await page
      .getByRole("button", { name: "Show reading", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await page.locator(".reading-body").waitFor({ state: "visible" });
    await page.locator(".reading-body").scrollIntoViewIfNeeded();
  }
  async function hide(page) {
    await page
      .getByRole("button", { name: "Hide reading", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await state(page, "hidden");
  }
  const pause = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
  };
  await check("baseline-hidden-mount-writes", async () => {
    const f = await fixture();
    const before = await snapshot(f);
    const page = await context.newPage();
    const calls = tracking(page);
    const receipt = page.waitForResponse(
      (r) =>
        /\/api\/sessions\/[^/]+\/interventions\//.test(r.url()) &&
        r.status() === 200,
    );
    await page.goto(route(f, "&baseline=true"));
    await ready(page);
    await receipt;
    const after = await snapshot(f);
    assert.equal(before.interventions.length, 0);
    assert.equal(after.interventions.length, 1);
    assert.equal(after.interventions[0].delivery_status, "displayed");
    assert.equal(calls.length, 2);
    await page.close();
    return { fixture: f, before, after, calls, observedDefect: true };
  });
  for (const width of [1440, 1024, 390, 320])
    await check("hidden-visible-keyboard-switch-" + width, async () => {
      const f = await fixture();
      const before = await snapshot(f);
      const page = await context.newPage();
      await page.setViewportSize({
        width,
        height: width === 1440 ? 1000 : width === 1024 ? 768 : 844,
      });
      const calls = tracking(page);
      await page.goto(route(f));
      await ready(page);
      await state(page, "hidden");
      assert.equal(calls.length, 0);
      assert.deepEqual(await snapshot(f), before);
      await page
        .getByLabel("Unsent harness draft")
        .fill("Keep this unsent draft exactly.");
      await show(page);
      await state(page, "acknowledged");
      const displayed = await snapshot(f);
      assert.equal(displayed.interventions.length, 1);
      assert.equal(displayed.interventions[0].delivery_status, "displayed");
      for (let n = 0; n < 3; n++) {
        await hide(page);
        await show(page);
        await state(page, "acknowledged");
      }
      assert.equal(
        await page.getByLabel("Unsent harness draft").inputValue(),
        "Keep this unsent draft exactly.",
      );
      assert.equal(calls.length, 2);
      assert.deepEqual(await snapshot(f), displayed);
      await page.screenshot({
        path: path.join(out, `visible-${width}.png`),
        fullPage: true,
      });
      await page.close();
      return {
        fixture: f,
        before,
        after: displayed,
        calls,
        width,
        keyboard: true,
        harnessDraftPreserved: true,
      };
    });
  await check("inflight-open-hidden-then-resumed", async () => {
    const f = await fixture();
    const page = await context.newPage();
    const calls = tracking(page);
    const entered = pause(),
      release = pause();
    await page.route("**/api/tutoring/*/reading", async (r) => {
      const response = await r.fetch();
      entered.resolve();
      await release.promise;
      await r.fulfill({ response });
    });
    await page.goto(route(f));
    await ready(page);
    await page
      .getByRole("button", { name: "Show reading", exact: true })
      .click();
    await entered.promise;
    await hide(page);
    release.resolve();
    await page.waitForTimeout(500);
    const pending = await snapshot(f);
    assert.equal(pending.interventions.length, 1);
    assert.equal(pending.interventions[0].delivery_status, "created");
    assert.equal(pending.interventions[0].visible_at, null);
    assert.equal(calls.length, 1);
    await page.reload();
    await ready(page);
    await state(page, "hidden");
    assert.equal(calls.length, 1);
    await show(page);
    await state(page, "acknowledged");
    const after = await snapshot(f);
    assert.equal(after.interventions[0].id, pending.interventions[0].id);
    assert.equal(calls.length, 3);
    await page.close();
    return { fixture: f, pending, after, calls };
  });
  await check("acknowledgment-pending-switch-no-duplicates", async () => {
    const f = await fixture();
    const page = await context.newPage();
    const calls = tracking(page);
    const entered = pause(),
      release = pause();
    await page.route("**/api/sessions/*/interventions/*", async (r) => {
      entered.resolve();
      await release.promise;
      await r.continue();
    });
    await page.goto(route(f));
    await ready(page);
    await show(page);
    await entered.promise;
    await state(page, "acknowledgment-pending");
    const pending = await snapshot(f);
    await hide(page);
    await show(page);
    await state(page, "acknowledgment-pending");
    assert.equal(calls.length, 2);
    release.resolve();
    await state(page, "acknowledged");
    const after = await snapshot(f);
    assert.equal(after.interventions.length, 1);
    assert.equal(after.interventions[0].id, pending.interventions[0].id);
    await page.close();
    return { fixture: f, pending, after, calls };
  });
  for (const unknown of [false, true])
    await check(
      unknown
        ? "unknown-ack-reconciles-same-id"
        : "failed-ack-survives-context-refresh",
      async () => {
        const f = await fixture();
        const page = await context.newPage();
        const calls = tracking(page);
        let count = 0;
        await page.route("**/api/sessions/*/interventions/*", async (r) => {
          count++;
          if (count === 1) {
            if (unknown) {
              await r.fetch();
              await r.abort("failed");
            } else
              await r.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({
                  error: "Controlled failed acknowledgment",
                }),
              });
          } else await r.continue();
        });
        await page.goto(route(f));
        await ready(page);
        await show(page);
        await state(page, "acknowledgment-failed");
        const failed = await snapshot(f);
        assert.equal(
          failed.interventions[0].delivery_status,
          unknown ? "displayed" : "created",
        );
        await hide(page);
        await show(page);
        await state(page, "acknowledgment-failed");
        assert.equal(count, 1);
        await page
          .getByRole("button", { name: "Refresh context", exact: true })
          .click();
        await page.waitForTimeout(800);
        await state(page, "acknowledgment-failed");
        await page
          .getByRole("button", { name: "Retry saving reading", exact: true })
          .waitFor({ state: "visible" });
        assert.equal(count, 1);
        await page
          .getByRole("button", { name: "Retry saving reading", exact: true })
          .click();
        await page.locator(".reading-body").scrollIntoViewIfNeeded();
        await state(page, "acknowledged");
        const after = await snapshot(f);
        assert.equal(count, 2);
        assert.equal(after.interventions.length, 1);
        assert.equal(after.interventions[0].id, failed.interventions[0].id);
        assert.equal(after.interventions[0].delivery_status, "displayed");
        if (unknown)
          assert.deepEqual(
            after,
            failed,
            "Replay must preserve the already committed visible_at and evidence",
          );
        await page.close();
        return {
          fixture: f,
          failed,
          after,
          calls,
          responseLostAfterCommit: unknown,
        };
      },
    );
  await check("browser-hidden-signal-simulation", async () => {
    const f = await fixture();
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__readerVisibility = "hidden";
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => window.__readerVisibility,
      });
    });
    const calls = tracking(page);
    await page.goto(route(f, "&active=true"));
    await ready(page);
    await state(page, "hidden");
    const before = await snapshot(f);
    assert.equal(calls.length, 0);
    assert.equal(before.interventions.length, 0);
    await page.evaluate(() => {
      window.__readerVisibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.locator(".reading-body").waitFor({ state: "visible" });
    await page.locator(".reading-body").scrollIntoViewIfNeeded();
    await state(page, "acknowledged");
    const after = await snapshot(f);
    await page.close();
    return {
      fixture: f,
      before,
      after,
      calls,
      qualification:
        "Injected document.visibilityState/visibilitychange in actual browser; not native tab-background proof",
    };
  });
  await check("standalone-back-forward-refresh", async () => {
    const f = await fixture();
    const page = await context.newPage();
    const calls = tracking(page);
    await page.goto(
      `${base}/study/reading?session=${f.sessionId}&passage=P08&from=study`,
    );
    await page.locator(".reading-body").waitFor();
    await page.locator(".reading-body").scrollIntoViewIfNeeded();
    await state(page, "acknowledged");
    await page.locator('a[href*="passage=P09"]').first().click();
    await page.waitForURL((u) => u.searchParams.get("passage") === "P09");
    await page.getByText("Passage 9 of 13", { exact: true }).waitFor();
    await page.locator(".reading-body").scrollIntoViewIfNeeded();
    await state(page, "acknowledged");
    const displayed = await snapshot(f);
    assert.equal(displayed.interventions.length, 2);
    await page.goBack();
    await page.getByText("Passage 8 of 13", { exact: true }).waitFor();
    await page.locator(".reading-body").scrollIntoViewIfNeeded();
    await state(page, "acknowledged");
    assert.equal(new URL(page.url()).searchParams.get("passage"), "P08");
    await page.goForward();
    await page.getByText("Passage 9 of 13", { exact: true }).waitFor();
    await page.locator(".reading-body").scrollIntoViewIfNeeded();
    await state(page, "acknowledged");
    assert.equal(new URL(page.url()).searchParams.get("passage"), "P09");
    await page.reload();
    await page.locator(".reading-body").scrollIntoViewIfNeeded();
    await state(page, "acknowledged");
    assert.deepEqual(await snapshot(f), displayed);
    await page.close();
    return {
      fixture: f,
      after: displayed,
      calls,
      storedAssistanceNotDuplicated: true,
    };
  });
  await check("standalone-unsent-draft-roundtrip", async () => {
    const f = await fixture(true);
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    const calls = tracking(page);
    const before = await snapshot(f);
    await page.goto(
      base +
        "/study/assignments/" +
        f.assignmentId +
        "?tab=study&session=" +
        f.sessionId,
    );
    const composer = page.getByPlaceholder(
      "Ask a question or share your thinking...",
    );
    await composer.waitFor();
    const draft =
      "My unsent answer: transmission delay depends on packet size and link rate.";
    await composer.fill(draft);
    await page.waitForFunction(
      ({ attempt, draft }) =>
        JSON.parse(
          sessionStorage.getItem("learning-pulse:" + attempt) || "null",
        )?.response === draft,
      { attempt: f.attemptId, draft },
    );
    await page.goto(
      base +
        "/study/reading?session=" +
        f.sessionId +
        "&passage=P08&from=study",
    );
    await page.locator(".reading-body").waitFor();
    await page.locator(".reading-body").scrollIntoViewIfNeeded();
    await state(page, "acknowledged");
    await page
      .getByRole("link", { name: "Back to study session", exact: true })
      .click();
    await composer.waitFor();
    await page.waitForFunction(
      ({ attempt, draft }) =>
        document.getElementById("tutor-message-" + attempt)?.value === draft,
      { attempt: f.attemptId, draft },
    );
    assert.equal(await composer.inputValue(), draft);
    await page.reload();
    await composer.waitFor();
    await page.waitForFunction(
      ({ attempt, draft }) =>
        document.getElementById("tutor-message-" + attempt)?.value === draft,
      { attempt: f.attemptId, draft },
    );
    assert.equal(await composer.inputValue(), draft);
    const after = await snapshot(f);
    assert.deepEqual(after.attempts, before.attempts);
    await page.close();
    return { fixture: f, before, after, calls, unsentDraftExact: true };
  });
  await check("offscreen-body-awaits-presentation", async () => {
    const f = await fixture();
    const page = await context.newPage();
    await page.setViewportSize({ width: 320, height: 844 });
    const calls = tracking(page);
    await page.goto(route(f, "&active=true&offscreen=true"));
    await ready(page);
    await page.locator(".reading-body").waitFor();
    await state(page, "awaiting-presentation");
    const pending = await snapshot(f);
    assert.equal(pending.interventions[0].delivery_status, "created");
    assert.equal(calls.length, 1);
    const rect = await page.locator(".reading-body").boundingBox();
    assert.ok(rect.y >= 844);
    await page.locator(".reading-body").scrollIntoViewIfNeeded();
    await state(page, "acknowledged");
    const after = await snapshot(f);
    await page.close();
    return { fixture: f, pending, after, calls, offscreenBody: rect };
  });
  await check("background-during-open-signal-simulation", async () => {
    const f = await fixture();
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__readerVisibility = "visible";
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => window.__readerVisibility,
      });
    });
    const calls = tracking(page);
    const entered = pause(),
      release = pause();
    await page.route("**/api/tutoring/*/reading", async (r) => {
      const response = await r.fetch();
      entered.resolve();
      await release.promise;
      await r.fulfill({ response });
    });
    await page.goto(route(f, "&active=true"));
    await entered.promise;
    await page.evaluate(() => {
      window.__readerVisibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    release.resolve();
    await ready(page);
    await state(page, "hidden");
    const pending = await snapshot(f);
    assert.equal(pending.interventions[0].delivery_status, "created");
    assert.equal(calls.length, 1);
    await page.evaluate(() => {
      window.__readerVisibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.locator(".reading-body").scrollIntoViewIfNeeded();
    await state(page, "acknowledged");
    const after = await snapshot(f);
    assert.equal(after.interventions[0].id, pending.interventions[0].id);
    await page.close();
    return {
      fixture: f,
      pending,
      after,
      calls,
      qualification:
        "Injected document.visibilityState/visibilitychange in actual browser; not native tab-background proof",
    };
  });
  await check("hidden-browsing-selects-only-final-passage", async () => {
    const f = await fixture();
    const page = await context.newPage();
    const calls = tracking(page);
    await page.goto(route(f));
    await ready(page);
    await state(page, "hidden");
    const before = await snapshot(f);
    for (const passage of ["P09", "P10", "P11", "P10"]) {
      await page
        .getByLabel("Requested passage", { exact: true })
        .selectOption(passage);
      await page.waitForTimeout(100);
      await state(page, "hidden");
      assert.equal(calls.length, 0);
      assert.deepEqual(await snapshot(f), before);
    }
    await show(page);
    await state(page, "acknowledged");
    const after = await snapshot(f);
    assert.equal(after.interventions.length, 1);
    assert.deepEqual(after.interventions[0].source_passage_ids, ["P10"]);
    assert.equal(calls.length, 2);
    assert.equal(JSON.parse(calls[0].body).passage_id, "P10");
    await page.close();
    return {
      fixture: f,
      before,
      after,
      calls,
      selectedWhileHidden: ["P09", "P10", "P11", "P10"],
    };
  });
  for (const inflight of [false, true])
    await check(
      inflight
        ? "native-background-during-open"
        : "native-background-before-open",
      async () => {
        const f = await fixture();
        const native = await chromium.launchPersistentContext(
          path.join(out, "native-profile-" + inflight),
          {
            headless: false,
            args: ["--window-position=-32000,-32000"],
            ignoreDefaultArgs: [
              "--disable-backgrounding-occluded-windows",
              "--disable-renderer-backgrounding",
              "--disable-background-timer-throttling",
            ],
            executablePath:
              process.env.READER_NATIVE_BROWSER_PATH ||
              process.env.READER_BROWSER_PATH ||
              chromium.executablePath(),
          },
        );
        try {
          const auth = await native.request.post(
            base + "/api/auth/sign-in/email",
            {
              headers: { Origin: base },
              data: {
                email: process.env.DEMO_STUDENT_TWO_EMAIL,
                password: process.env.DEMO_STUDENT_TWO_PASSWORD,
              },
            },
          );
          assert.equal(auth.status(), 200);
          const page = native.pages()[0];
          const background = await native.newPage();
          await background.goto("about:blank");
          const pcdp = await native.newCDPSession(page),
            bcdp = await native.newCDPSession(background);
          await pcdp.send("Emulation.setFocusEmulationEnabled", {
            enabled: false,
          });
          await bcdp.send("Emulation.setFocusEmulationEnabled", {
            enabled: false,
          });
          const calls = tracking(page);
          const entered = pause(),
            release = pause();
          if (inflight)
            await page.route("**/api/tutoring/*/reading", async (r) => {
              const response = await r.fetch();
              entered.resolve();
              await release.promise;
              await r.fulfill({ response });
            });
          if (inflight) await page.bringToFront();
          else await background.bringToFront();
          await page.goto(route(f, "&active=true"));
          if (inflight) {
            await entered.promise;
            await background.bringToFront();
          }
          await pcdp.send("Emulation.setFocusEmulationEnabled", {
            enabled: false,
          });
          await bcdp.send("Emulation.setFocusEmulationEnabled", {
            enabled: false,
          });
          await background.bringToFront();
          console.log(
            "Native background signal",
            inflight,
            await page.evaluate(() => ({
              visibility: document.visibilityState,
              focused: document.hasFocus(),
            })),
          );
          await page.waitForFunction(() => !document.hasFocus());
          const backgroundSignal = await page.evaluate(() => ({
            visibility: document.visibilityState,
            focused: document.hasFocus(),
          }));
          assert.equal(backgroundSignal.focused, false);
          if (inflight) release.resolve();
          await ready(page);
          await state(page, "hidden");
          const pending = await snapshot(f);
          assert.equal(calls.length, inflight ? 1 : 0);
          assert.equal(pending.interventions.length, inflight ? 1 : 0);
          if (inflight) {
            assert.equal(pending.interventions[0].delivery_status, "created");
            assert.equal(pending.interventions[0].visible_at, null);
          }
          await page.bringToFront();
          await page.waitForFunction(() => document.hasFocus());
          const foregroundSignal = await page.evaluate(() => ({
            visibility: document.visibilityState,
            focused: document.hasFocus(),
          }));
          await page.locator(".reading-body").waitFor({ state: "visible" });
          await page.locator(".reading-body").scrollIntoViewIfNeeded();
          await state(page, "acknowledged");
          const after = await snapshot(f);
          assert.equal(after.interventions.length, 1);
          assert.equal(after.interventions[0].delivery_status, "displayed");
          assert.equal(calls.length, 2);
          return {
            fixture: f,
            pending,
            after,
            calls,
            backgroundSignal,
            foregroundSignal,
            method:
              "Real browser tab bringToFront with CDP focus emulation disabled on both tabs; no document/focus mutation",
          };
        } finally {
          await native.close();
        }
      },
    );
} finally {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await context?.close();
  await b?.close();
  await pool.end();
}
console.log(
  JSON.stringify({
    passed: report.cases.filter((c) => c.status === "passed").length,
    failed: report.cases.filter((c) => c.status === "failed").length,
    out,
  }),
);
assert.ok(report.cases.length, "No cases matched READER_CASES.");
if (report.cases.some((c) => c.status !== "passed")) process.exitCode = 1;
