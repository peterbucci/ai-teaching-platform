/** Independent event-boundary reader regression. Fictional local data only. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { getPool } from "../../../lib/db.ts";
import { DEMO_IDS } from "../../../lib/evidence/demo.ts";
import {
  assignmentReview,
  approveAssignment,
} from "../../../lib/assignments/store.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
} from "../../../lib/evidence/store.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../../../lib/evidence/content.ts";

assert.equal(process.env.PGHOST, "127.0.0.1");
assert.match(
  process.env.PGDATABASE || "",
  /notebook.*final|student.*integration/,
);
assert.match(process.env.AUTH_URL || "", /^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const base = process.env.AUTH_URL;
const pool = getPool();
const out = path.resolve(
  "acceptance/student-integration/reader-timing",
  `run-${Date.now()}`,
);
fs.mkdirSync(out, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  buildId: fs.readFileSync(".next/BUILD_ID", "utf8").trim(),
  ownerHashes: Object.fromEntries(
    [
      "app/study/notebook/integration/standalone-reading.tsx",
      "app/study/reading/reader.tsx",
      "app/study/notebook/shell/notebook-shell.tsx",
      "app/components/account-menu.tsx",
    ].map((file) => [file, hash(fs.readFileSync(file))]),
  ),
  paidCalls: 0,
  measures: [],
  checks: [],
  errors: [],
  result: "RUNNING",
};
const actor = (
  await pool.query("SELECT id,auth_user_id FROM profiles WHERE id=$1", [
    DEMO_IDS.studentOne,
  ])
).rows[0];
const access = evidenceAccess({
  profileId: actor.id,
  userId: actor.auth_user_id,
});
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
context.setDefaultTimeout(15000);
const page = await context.newPage();
page.on("pageerror", (error) => report.errors.push(error.message));
const until = async (predicate) => {
  for (let i = 0; i < 120; i++) {
    if (await predicate()) return;
    await page.waitForTimeout(100);
  }
  assert.fail("bounded condition timed out");
};

// Document bubble observes after React's capture handler. No application state
// is changed by this instrumentation. The attribute assertion is never polled.
await context.addInitScript(() => {
  window.__readerTiming = [];
  const sample = (phase, kind) => {
    const host = document.querySelector("[data-n7-standalone-reader]");
    if (!host) return;
    window.__readerTiming.push({
      phase,
      kind,
      at: performance.now(),
      active: host.getAttribute("data-reader-active"),
      accountOpen: Boolean(
        document.querySelector("details.lp-account-menu[open]"),
      ),
      pane: host.querySelector("[data-pane]")?.getAttribute("data-pane"),
    });
  };
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const kind = event.target.closest("details.lp-account-menu > summary")
      ? "account"
      : event.target.closest('button[aria-label="Menu"][aria-controls]')
        ? "menu"
        : null;
    if (!kind) return;
    window.__readerTiming.push({
      phase: "target",
      kind,
      target: event.target.tagName,
      matched: event.target.closest("details.lp-account-menu > summary")
        ?.tagName,
      insideHost: Boolean(event.target.closest("[data-n7-standalone-reader]")),
      ancestors: Array.from(
        (function* () {
          let node = event.target;
          while (node) {
            yield node.tagName;
            node = node.parentElement;
          }
        })(),
      ),
    });
    sample("click-bubble", kind);
    queueMicrotask(() => sample("microtask", kind));
    requestAnimationFrame(() => {
      sample("frame-1", kind);
      requestAnimationFrame(() => sample("frame-2", kind));
    });
  });
  document.addEventListener(
    "toggle",
    (event) => {
      if (
        event.target instanceof Element &&
        event.target.matches("details.lp-account-menu")
      )
        sample("toggle", "account");
    },
    true,
  );
  window.addEventListener("click", (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest("details.lp-account-menu > summary")
    )
      sample("window-bubble", "account");
  });
});

try {
  const teacher = (
    await pool.query("SELECT id,auth_user_id FROM profiles WHERE id=$1", [
      DEMO_IDS.teacher,
    ])
  ).rows[0];
  const teacherAccess = evidenceAccess({
    profileId: teacher.id,
    userId: teacher.auth_user_id,
  });
  const preview = await assignmentReview(teacherAccess, DEMO_IDS.assignmentId);
  await approveAssignment(
    teacherAccess,
    DEMO_IDS.assignmentId,
    preview.review_token,
  );
  const login = await context.request.post(base + "/api/auth/sign-in/email", {
    headers: { Origin: base },
    data: {
      email: process.env.DEMO_STUDENT_ONE_EMAIL,
      password: process.env.DEMO_STUDENT_ONE_PASSWORD,
    },
  });
  assert.equal(login.status(), 200);
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    const session = await startSession(
      access,
      DEMO_IDS.assignmentId,
      "live_demo",
    );
    const attempt = await presentQuestion(access, session.id, {
      question: getCuratedQuestion(loadApprovedContent(), "NP-TX-01"),
      intent: "initial_retrieval",
    });
    const readRows = async () =>
      (
        await pool.query(
          "SELECT id,delivery_status,visible_at,source_passage_ids FROM interventions WHERE session_id=$1 ORDER BY created_at,id",
          [session.id],
        )
      ).rows;
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    let delivery;
    const receipts = [];
    const onRequest = (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes(`/api/sessions/${session.id}/interventions/`)
      )
        receipts.push({ url: new URL(request.url()).pathname, at: Date.now() });
    };
    page.on("request", onRequest);
    const routePath = base + `/api/tutoring/${session.id}/reading`;
    await page.route(routePath, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      delivery = await response.json();
      await held;
      await route.fulfill({ response });
    });
    await page.goto(
      base +
        `/study/reading?assignment=${DEMO_IDS.assignmentId}&session=${session.id}&version=${encodeURIComponent(attempt.question.content_ref.content_version)}&passage=P07&from=study`,
    );
    await until(() => Boolean(delivery));
    await page.evaluate(() => {
      window.__readerTiming = [];
      const host = document.querySelector("[data-n7-standalone-reader]");
      new MutationObserver((records) => {
        for (const record of records)
          window.__readerTiming.push({
            phase: "active-mutation",
            at: performance.now(),
            old: record.oldValue,
            active: host.getAttribute("data-reader-active"),
            accountOpen: Boolean(
              document.querySelector("details.lp-account-menu[open]"),
            ),
          });
      }).observe(host, {
        attributes: true,
        attributeFilter: ["data-reader-active"],
        attributeOldValue: true,
      });
      for (const capture of [true, false])
        host.addEventListener(
          "click",
          (event) => {
            window.__readerTiming.push({
              phase: capture ? "host-capture" : "host-bubble",
              active: host.getAttribute("data-reader-active"),
              target: event.target.tagName,
              targetElement: event.target instanceof Element,
            });
          },
          capture,
        );
    });
    await page.getByLabel("Account menu", { exact: true }).click();
    const immediate = await page
      .locator("[data-n7-standalone-reader]")
      .getAttribute("data-reader-active");
    release();
    await page.waitForTimeout(500);
    let rows = await readRows();
    const pendingTrace = await page.evaluate(() => window.__readerTiming);
    report.measures.push({
      width,
      stage: "held-delivery-account",
      immediate,
      trace: pendingTrace,
      receipts: receipts.length,
    });
    assert.equal(
      immediate,
      "false",
      `${width}: immediate account deactivation`,
    );
    assert.ok(
      pendingTrace.some(
        (event) => event.phase === "click-bubble" && event.active === "false",
      ),
    );
    assert.ok(
      pendingTrace
        .filter((event) => event.accountOpen)
        .every((event) => event.active === "false"),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].delivery_status, "created");
    assert.equal(rows[0].visible_at, null);
    assert.equal(receipts.length, 0);
    report.checks.push(
      `${width}: delayed delivered body under account menu has zero display receipts`,
    );
    await page.keyboard.press("Escape");
    await page.locator(".reading-article").scrollIntoViewIfNeeded();
    await until(
      async () => (await readRows())[0]?.delivery_status === "displayed",
    );
    rows = await readRows();
    const identity = {
      id: rows[0].id,
      visibleAt: rows[0].visible_at.toISOString(),
    };
    assert.equal(receipts.length, 1);

    for (let cycle = 0; cycle < 12; cycle++) {
      const mode =
        cycle % 3 === 0 ? "Enter" : cycle % 3 === 1 ? "Space" : "mouse";
      await page.evaluate(() => {
        window.__readerTiming = [];
      });
      const account = page.getByLabel("Account menu", { exact: true });
      if (mode === "mouse") await account.click();
      else {
        await account.focus();
        await page.keyboard.press(mode === "Space" ? " " : "Enter");
      }
      const active = await page
        .locator("[data-n7-standalone-reader]")
        .getAttribute("data-reader-active");
      await page.waitForTimeout(50);
      const trace = await page.evaluate(() => window.__readerTiming);
      report.measures.push({
        width,
        stage: "account-cycle",
        cycle,
        mode,
        immediate: active,
        trace,
      });
      assert.equal(active, "false", `${width}: account ${mode} cycle ${cycle}`);
      assert.ok(
        trace.some(
          (event) => event.phase === "click-bubble" && event.active === "false",
        ),
      );
      assert.ok(
        trace
          .filter((event) => event.accountOpen)
          .every((event) => event.active === "false"),
      );
      await page.keyboard.press("Escape");
      await page.locator(".reading-article").scrollIntoViewIfNeeded();
      await until(
        async () =>
          (await page
            .locator("[data-n7-standalone-reader]")
            .getAttribute("data-reader-active")) === "true",
      );
    }
    report.checks.push(
      `${width}: 12 mouse/Enter/Space account cycles deactivate at click boundary and remain inactive through frames`,
    );
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    if (await menu.isVisible()) {
      for (let cycle = 0; cycle < 6; cycle++) {
        await page.evaluate(() => {
          window.__readerTiming = [];
        });
        await menu.click();
        const active = await page
          .locator("[data-n7-standalone-reader]")
          .getAttribute("data-reader-active");
        await page.waitForTimeout(50);
        const trace = await page.evaluate(() => window.__readerTiming);
        report.measures.push({
          width,
          stage: "menu-cycle",
          cycle,
          immediate: active,
          trace,
        });
        assert.equal(active, "false", `${width}: menu cycle ${cycle}`);
        assert.ok(
          trace.some(
            (event) =>
              event.phase === "click-bubble" && event.active === "false",
          ),
        );
        assert.ok(
          trace
            .filter((event) => event.pane === "navigation")
            .every((event) => event.active === "false"),
        );
        await page
          .getByRole("button", { name: "Back to page", exact: true })
          .click();
        await page.locator(".reading-article").scrollIntoViewIfNeeded();
        await until(
          async () =>
            (await page
              .locator("[data-n7-standalone-reader]")
              .getAttribute("data-reader-active")) === "true",
        );
      }
      report.checks.push(
        `${width}: six navigation menu cycles deactivate immediately`,
      );
    } else
      report.checks.push(
        `${width}: navigation menu not offered at this breakpoint`,
      );
    rows = await readRows();
    assert.deepEqual(
      { id: rows[0].id, visibleAt: rows[0].visible_at.toISOString() },
      identity,
    );
    assert.equal(rows.length, 1);
    assert.equal(receipts.length, 1);
    report.checks.push(
      `${width}: one original receipt identity/time retained after overlay cycles`,
    );
    await page.screenshot({
      path: path.join(out, `reader-${width}.png`),
      fullPage: true,
    });
    await page.unroute(routePath);
    page.off("request", onRequest);
  }
  assert.deepEqual(report.errors, []);
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error.stack;
  process.exitCode = 1;
  await page
    .screenshot({ path: path.join(out, "failure.png"), fullPage: true })
    .catch(() => {});
} finally {
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      result: report.result,
      checks: report.checks,
      error: report.error,
      out,
    }),
  );
  await context.close();
  await browser.close();
  await pool.end();
}
