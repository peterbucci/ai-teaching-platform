/* Verification only. Run against an isolated fictional database with all model providers disabled.
 * Never commit the output directory: browser storage states contain disposable login cookies.
 * Source SHA/configuration are operator-supplied and recorded, not inferred from HTTP responses.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import {
  studyReady,
  teacherReady,
  readinessSha256,
} from "./browser-readiness.mjs";
const { chromium } = await import(
  pathToFileURL(
    process.env.ACCEPTANCE_PLAYWRIGHT ||
      "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  ).href
);
const base = process.env.ACCEPTANCE_BASE_URL || "http://localhost:3321";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Only local acceptance servers are permitted",
);
const setup =
  process.env.ACCEPTANCE_SETUP ||
  "C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-main";
const out = process.env.ACCEPTANCE_OUT || path.join(setup, "browser-student");
assert.equal(
  fs.existsSync(path.join(out, "student-browser-report.json")),
  false,
  "Choose a fresh ACCEPTANCE_OUT; use ACCEPTANCE_STATE_DIR to reuse only disposable login/session state.",
);
const stateDir = process.env.ACCEPTANCE_STATE_DIR || out;
const sha =
  process.env.ACCEPTANCE_SOURCE_SHA ||
  "723ed6fea41138b604a9d333ebcd4a07b2202c36";
assert.equal(base, "http://localhost:3355");
assert.equal(sha, "45326e243245c4941e2cefd0eab984bb7ee19765");
const assignment = "30000000-0000-4000-8000-000000000001";
fs.mkdirSync(out, { recursive: true });
const report = {
  readinessSha256,
  source_sha: sha,
  base,
  started_at: new Date().toISOString(),
  environment:
    "local isolated fictional PostgreSQL; providers disabled by operator; browser requests do not enable providers",
  evidence_category:
    "provider-disabled browser/HTTP; seeded evaluations are synthetic historical fixture data",
  setup:
    "Existing curated assignment reviewed and activated through teacher UI before this run; original seeded attempts not altered.",
  browser: null,
  cases: [],
  screenshots: [],
  requests: [],
  console_errors: [],
  unrun: [
    "Real screen-reader testing",
    "Actual browser 200% zoom (headless viewport emulation is not claimed as zoom)",
    "Fresh actual-model generation/evaluation",
    "Real provider unknown-outcome recovery (synthetic persistence suite owns this)",
    "Hosted release",
    "Failed accepted-help acknowledgment (provider-disabled help produces no accepted help in this run)",
  ],
};
function save() {
  fs.writeFileSync(
    path.join(out, "student-browser-report.json"),
    JSON.stringify(report, null, 2),
  );
}
function result(id, status, details = {}) {
  report.cases.push({ id, status, ...details });
  save();
}
function unrun(message) {
  const e = new Error(message);
  e.unrun = true;
  throw e;
}
async function step(id, action) {
  try {
    const details = await action();
    result(id, "PASS", details || {});
  } catch (e) {
    result(id, e.unrun ? "UNRUN" : "FAIL", { error: e.message });
  }
}
const state = (role) => path.join(stateDir, `storage-${role}.json`);
async function newContext(
  browser,
  role = "student",
  viewport = { width: 1440, height: 900 },
) {
  return browser.newContext({ viewport, storageState: state(role) });
}
async function ready(page) {
  await studyReady(page);
}
async function load(page, url) {
  await page.goto(url);
  await ready(page);
}
async function shot(page, name) {
  const filename = `${name}.png`;
  await page.screenshot({ path: path.join(out, filename), fullPage: false });
  report.screenshots.push({
    file: filename,
    url: page.url(),
    viewport: page.viewportSize(),
  });
  save();
}
async function get(context, route) {
  const response = await context.request.get(new URL(route, base).href);
  assert.equal(response.status(), 200, `GET ${route}: ${response.status()}`);
  return response.json();
}
function instrument(page) {
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/"))
      report.requests.push({ method: r.method(), path: u.pathname });
  });
  page.on("pageerror", (e) => report.console_errors.push(e.message));
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
  });
  report.browser = browser.version();
  try {
    const teacherContext = await browser.newContext();
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto(`${base}/login`);
    await teacherPage
      .getByRole("button", { name: "Demo teacher", exact: true })
      .click();
    await teacherPage.waitForURL("**/teacher");
    await teacherReady(teacherPage, "/teacher");
    await teacherPage.goto(
      `${base}/teacher/assignments?assignment=${assignment}&view=review`,
    );
    await teacherReady(
      teacherPage,
      `/teacher/assignments?assignment=${assignment}&view=review`,
    );
    const activate = teacherPage.getByRole("button", {
      name: "Approve and activate",
      exact: true,
    });
    const activationRequired = (await activate.count()) > 0;
    if (activationRequired) {
      await teacherPage
        .getByLabel("I have reviewed this reading, its learning goals")
        .check();
      await activate.click();
    }
    await teacherPage
      .getByText("Active for enrolled students", { exact: true })
      .first()
      .waitFor();
    result("SETUP-curated-assignment-reviewed-active", "PASS", {
      assignment,
      activatedThroughTeacherUi: activationRequired,
    });
    await teacherContext.close();
    if (!fs.existsSync(state("student"))) {
      const loginContext = await browser.newContext();
      const loginPage = await loginContext.newPage();
      await loginPage.goto(`${base}/login`);
      await loginPage
        .getByRole("button", { name: "Demo student", exact: true })
        .click();
      await loginPage.waitForURL(/\/study/);
      await loginContext.storageState({ path: state("student") });
      await loginContext.close();
    }
    const context = await newContext(browser);
    const page = await context.newPage();
    instrument(page);
    let active = process.env.ACCEPTANCE_SESSION_URL;
    const activeFile = path.join(stateDir, "active-session-url.txt");
    if (!active && fs.existsSync(activeFile))
      active = fs.readFileSync(activeFile, "utf8").trim();
    if (!active) {
      await page.goto(`${base}/study/assignments/${assignment}?tab=study`);
      await page.locator(".lp-s-assignment-detail").waitFor();
      const start = page.getByRole("button", {
        name: "Start assignment",
        exact: true,
      });
      if (await start.count()) {
        await start.click();
        await page.waitForURL(/session=/);
      } else await page.locator(".lp-turns").waitFor();
      active = page.url();
      if (!new URL(active).searchParams.get("session")) {
        const lessons = await get(context, "/api/tutoring");
        const assigned = lessons.find((item) => item.id === assignment);
        assert.ok(
          assigned?.session?.id,
          "Authorized assignment must expose its saved session identity",
        );
        const url = new URL(active);
        url.searchParams.set("session", assigned.session.id);
        active = url.href;
      }
      await load(page, active);
      const restart = page.getByRole("button", {
        name: "Start new session",
        exact: true,
      });
      if (await restart.count()) {
        await restart.click();
        await page
          .getByRole("textbox", { name: "Message your tutor", exact: true })
          .waitFor();
        active = page.url();
      }
      fs.writeFileSync(activeFile, active);
    }
    active = new URL(new URL(active).pathname + new URL(active).search, base)
      .href;
    const session = new URL(active).searchParams.get("session");
    assert.ok(session);
    report.session_id = session;
    const before = await get(context, `/api/tutoring/${session}`);
    report.initial_attempt = before.attempts.at(-1);
    await load(page, active);
    const input = page.getByRole("textbox", {
      name: "Message your tutor",
      exact: true,
    });
    await input.waitFor();
    const draft =
      "  Acceptance D unsent reasoning.\nCable distance may affect propagation; I am still deciding about transmission.  ";
    await step("ST-05-refresh-exact-draft", async () => {
      await input.fill(draft);
      await page.reload();
      await ready(page);
      assert.equal(await input.inputValue(), draft);
      return { exact_text: draft, attempt_id: before.attempts.at(-1).id };
    });
    await step("ST-05-reading-back-forward-draft", async () => {
      await input.fill(draft);
      const n0 = (await get(context, `/api/tutoring/${session}`)).attempts
        .length;
      await page
        .getByRole("link", { name: "Reading", exact: true })
        .first()
        .click();
      await ready(page);
      assert.match(page.url(), /\/study\/reading/);
      await shot(page, "reading-1440x900");
      await page.goBack();
      await ready(page);
      assert.equal(await input.inputValue(), draft);
      await page.goForward();
      await ready(page);
      await page.goBack();
      await ready(page);
      assert.equal(await input.inputValue(), draft);
      const current = await get(context, `/api/tutoring/${session}`);
      assert.equal(current.attempts.length, n0);
      assert.equal(current.attempts.at(-1).submitted_at, null);
      return { exact_draft_preserved: true, reading_did_not_submit: true };
    });
    await step("ST-05-quick-action-restores-original", async () => {
      await input.fill(draft);
      await page
        .getByRole("button", { name: "Help me understand", exact: true })
        .click();
      assert.notEqual(await input.inputValue(), draft);
      await page
        .getByRole("button", { name: "Restore previous draft", exact: true })
        .click();
      assert.equal(await input.inputValue(), draft);
    });
    const longDraft =
      "Acceptance long original student reasoning: distance changes propagation, packet size and rate control transmission.\n".repeat(
        24,
      );
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
      { width: 320, height: 844 },
    ]) {
      await step(`RESP-${viewport.width}x${viewport.height}`, async () => {
        await page.setViewportSize(viewport);
        await input.fill(longDraft);
        await page.evaluate(() => window.scrollTo(0, 0));
        await shot(page, `active-top-${viewport.width}x${viewport.height}`);
        const measure = await page.evaluate(() => ({
          viewport: innerWidth,
          document_width: document.documentElement.scrollWidth,
          body_width: document.body.scrollWidth,
          overflows: [...document.querySelectorAll("main *")]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width && (r.right > innerWidth + 1 || r.left < -1);
            })
            .slice(0, 8)
            .map((e) => ({
              tag: e.tagName,
              class: e.className,
              right: Math.round(e.getBoundingClientRect().right),
            })),
        }));
        await input.scrollIntoViewIfNeeded();
        await input.focus();
        await shot(page, `composer-${viewport.width}x${viewport.height}`);
        assert.ok(
          measure.document_width <= viewport.width + 1,
          JSON.stringify(measure),
        );
        assert.equal(await input.isEnabled(), true);
        assert.equal(await input.inputValue(), longDraft);
        return {
          ...measure,
          composer_enabled: true,
          note: "Viewport/layout check only; full keyboard and screen-reader compliance not implied.",
        };
      });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await step("A11Y-keyboard-composer-tab-order", async () => {
      await input.focus();
      const trail = [];
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
        trail.push(
          await page.evaluate(() => ({
            tag: document.activeElement.tagName,
            text: document.activeElement.innerText?.slice(0, 100),
            label: document.activeElement.getAttribute("aria-label"),
          })),
        );
      }
      assert.ok(
        trail.some(
          (x) => x.tag === "BUTTON" && /Send|Submit/.test(x.text || ""),
        ),
      );
      return { focus_trail: trail, limited_check: true };
    });

    {
      const c = await newContext(browser);
      const p = await c.newPage();
      instrument(p);
      await load(p, active);
      const box = p.getByRole("textbox", {
        name: "Message your tutor",
        exact: true,
      });
      await step("RC-05-uncertain-conversation-transport", async () => {
        const current = await get(
          c,
          "/api/tutoring/" + session + "/conversation",
        );
        if (current.messages.at(-1)?.outcome.status === "fallback")
          unrun(
            "This session is already in the disabled-help fallback; Send intentionally does not dispatch a conversation POST. Use a fresh pre-fallback session for this transport test.",
          );
        const text =
          "Acceptance D transport interruption: can you explain packet size?";
        await box.fill(text);
        let count = 0;
        await p.route(
          `**/api/tutoring/${session}/conversation`,
          async (route) => {
            if (route.request().method() === "POST") {
              count++;
              await route.abort("internetdisconnected");
            } else await route.continue();
          },
        );
        await p.getByRole("button", { name: "Send", exact: true }).click();
        await p
          .getByRole("button", {
            name: "Check saved conversation",
            exact: true,
          })
          .waitFor();
        await ready(p);
        assert.equal(await box.inputValue(), text);
        assert.equal(count, 1);
        await shot(p, "conversation-network-failure-preserved");
        await p.unroute(`**/api/tutoring/${session}/conversation`);
        const reconciled = p.waitForResponse(
          (response) =>
            response.url() === `${base}/api/tutoring/${session}/conversation` &&
            response.request().method() === "GET",
        );
        await p
          .getByRole("button", {
            name: "Check saved conversation",
            exact: true,
          })
          .click();
        assert.equal((await reconciled).status(), 200);
        await ready(p);
        const conv = await get(c, `/api/tutoring/${session}/conversation`);
        assert.ok(!conv.messages.some((m) => m.text === text));
        assert.equal(conv.dialogue.state.provider_requests_used, 0);
        return {
          local_text_preserved: true,
          requests_sent: count,
          no_automatic_resend: true,
          read_only_reconciliation: true,
          note: "HTTP request aborted before server, not a real uncertain paid provider call.",
        };
      });
      await c.close();
    }

    // The first operator help request may already exist. Verify it before issuing a new one.
    await step("ST-04-provider-disabled-help-ungraded", async () => {
      const prior = await get(context, `/api/tutoring/${session}/conversation`);
      const has = prior.messages.some(
        (m) =>
          m.text === "What do you mean by packet size?" &&
          m.outcome.status === "fallback",
      );
      if (!has) {
        await input.fill("What do you mean by packet size?");
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page
          .getByRole("button", { name: "I’m asking for help", exact: true })
          .last()
          .click();
        await page
          .getByText("Conversational help is unavailable for this step.", {
            exact: false,
          })
          .waitFor();
      }
      const conv = await get(context, `/api/tutoring/${session}/conversation`);
      const view = await get(context, `/api/tutoring/${session}`);
      assert.equal(view.attempts.at(-1).submitted_at, null);
      assert.equal(view.attempts.at(-1).response_text, null);
      assert.equal(conv.dialogue.state.provider_requests_used, 0);
      const msg = conv.messages.find(
        (m) => m.text === "What do you mean by packet size?",
      );
      assert.equal(msg.outcome.status, "fallback");
      await input.fill(draft);
      await shot(page, "help-fallback-ungraded");
      return {
        message: msg,
        provider_requests_used: 0,
        attempt_unchanged: true,
        classification_note:
          "No-provider route requested explicit clarification. This is not live classification.",
      };
    });
    await step("ST-03-refresh-read-only", async () => {
      const start = report.requests.length;
      await page.reload();
      await ready(page);
      const writes = report.requests
        .slice(start)
        .filter((r) => r.method !== "GET");
      assert.equal(writes.length, 0, JSON.stringify(writes));
      return { api_writes_on_refresh: writes };
    });
    await context.close();

    // Independent contexts prevent deliberate uncertainty in one fault case from affecting another.
    for (const fault of ["offline", "401"]) {
      const c = await newContext(browser);
      const p = await c.newPage();
      instrument(p);
      await load(p, active);
      const box = p.getByRole("textbox", {
        name: "Message your tutor",
        exact: true,
      });
      await step(`RC-02-answer-save-${fault}`, async () => {
        const text = `  Acceptance D ${fault} save must preserve this exact answer.\nNo assessed answer has been confirmed.  `;
        await box.fill(text);
        let intercepted = 0;
        await p.route(`**/api/sessions/${session}/answers`, async (route) => {
          intercepted++;
          if (fault === "offline") await route.abort("internetdisconnected");
          else
            await route.fulfill({
              status: 401,
              contentType: "application/json",
              body: JSON.stringify({
                error: "Synthetic expired authentication",
              }),
            });
        });
        await p
          .getByRole("button", {
            name: "Submit this as my answer",
            exact: true,
          })
          .click();
        await p
          .getByRole("button", {
            name: "Retry sending saved answer",
            exact: false,
          })
          .waitFor();
        await ready(p);
        const visible = await p.locator("body").innerText();
        assert.equal(await box.inputValue(), text);
        assert.equal(await box.isDisabled(), true);
        const view = await get(c, `/api/tutoring/${session}`);
        assert.equal(view.attempts.at(-1).response_text, null);
        assert.equal(intercepted, 1);
        await shot(p, `answer-save-${fault}-preserved`);
        if (
          fault === "401" &&
          visible.includes("Your submitted work is saved.")
        )
          result("S-02-confirmed-401-misleading-save-status", "FAIL", {
            reproduction:
              "Initial answer POST receives synthetic 401 before server; UI asserts submitted work saved while response_text remains null.",
            exact_status: "Please sign in again. Your submitted work is saved.",
            screenshot: `answer-save-${fault}-preserved.png`,
            owner: "Student recovery #76",
          });
        await p.unroute(`**/api/sessions/${session}/answers`);
        return {
          fault,
          text_preserved: true,
          saved_response: null,
          automatic_retry_count: intercepted - 1,
          next_action: "Retry sending saved answer / Check sign-in",
          fault_injection:
            "Browser route rejected request before server commit; no real network/auth expiry claimed.",
        };
      });
      await c.close();
    }

    result("ST-09-seeded-supported-history", "UNRUN", {
      reason:
        "Existing seeded records have synthetic_fixture origin; studentSessionAssignment intentionally permits only live_demo UI sessions. Teacher/API fixture inspection is separate.",
    });
    result("S-01-seeded-correct-result-visibility", "UNRUN", {
      reason:
        "Seeded correct fixture is intentionally excluded from student navigation. Static missing-result finding requires a fresh fictional UI session with explicitly injected synthetic accepted evaluation.",
    });
    save();
  } finally {
    report.finished_at = new Date().toISOString();
    save();
    await browser.close();
  }
  if (report.cases.some((item) => item.status === "FAIL")) process.exitCode = 1;
  console.log(
    JSON.stringify(
      {
        report: path.join(out, "student-browser-report.json"),
        cases: report.cases.map(({ id, status, error }) => ({
          id,
          status,
          error,
        })),
        screenshots: report.screenshots.length,
        unrun: report.unrun,
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  result("HARNESS", "FAIL", { error: e.message });
  console.error(e.message);
  process.exitCode = 1;
});
