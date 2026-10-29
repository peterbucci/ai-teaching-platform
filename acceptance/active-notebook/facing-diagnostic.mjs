/** Authenticated facing-reader checks at four real viewport sizes; zero providers. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fresh, pool, base } from "./fixtures.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const sourceFiles = () =>
  git("ls-files", "--cached", "--others", "--exclude-standard", "app", "lib")
    .split(/\r?\n/)
    .filter(Boolean)
    .sort()
    .map((file) => ({ file, sha256: hash(fs.readFileSync(file)) }));
const files = sourceFiles();
const out = path.join(
  "acceptance/active-notebook/evidence",
  `facing-diagnostic-${Date.now()}`,
);
fs.mkdirSync(out, { recursive: true });
const report = {
  source: git("rev-parse", "HEAD"),
  appSourceSha256: hash(JSON.stringify(files)),
  diffSha256: hash(git("diff", "HEAD", "--", "app", "lib")),
  runtime: process.env.S1_RUNTIME || "development",
  buildId:
    process.env.S1_RUNTIME === "production"
      ? fs.readFileSync(".next/BUILD_ID", "utf8").trim()
      : null,
  providersDisabled: true,
  paidCalls: 0,
  cases: [],
  errors: [],
  consoleErrors: [],
  blockedExternal: [],
  result: "RUNNING",
};
fs.writeFileSync(
  path.join(out, "source-files.json"),
  JSON.stringify(files, null, 2),
);
const save = () =>
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.READER_BROWSER_PATH,
});
const context = await browser.newContext();
context.setDefaultTimeout(20000);
context.setDefaultNavigationTimeout(60000);
await context.route("**/*", (route) => {
  const origin = new URL(route.request().url()).origin;
  if (origin === base) return route.continue();
  report.blockedExternal.push(origin);
  return route.abort();
});
await context.addInitScript(() => {
  window.__s1ScrollTrace = [];
  const record = (type, extra = {}) =>
    window.__s1ScrollTrace.push({
      type,
      ...extra,
      y: scrollY,
      max: document.documentElement.scrollHeight - innerHeight,
      pane: document
        .querySelector("[data-active-study]")
        ?.getAttribute("data-pane"),
      at: performance.now(),
    });
  const original = window.scrollTo.bind(window);
  window.scrollTo = (...args) => {
    record("scrollTo", { args, stack: new Error().stack });
    return original(...args);
  };
  const originalBy = window.scrollBy.bind(window);
  window.scrollBy = (...args) => {
    record("scrollBy", { args, stack: new Error().stack });
    return originalBy(...args);
  };
  addEventListener("scroll", () => record("scroll"), { passive: true });
  addEventListener(
    "click",
    (e) =>
      record("click", {
        target: e.target
          ?.closest("button,a,summary")
          ?.textContent?.trim()
          .slice(0, 100),
      }),
    true,
  );
});
const page = await context.newPage();
const writes = [];
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error")
    report.consoleErrors.push(message.text().slice(0, 2000));
});
page.on("request", (request) => {
  if (request.method() === "POST")
    writes.push({ url: request.url(), body: request.postDataJSON() });
});
const until = async (predicate, label) => {
  for (let i = 0; i < 150; i++) {
    if (await predicate()) return;
    await page.waitForTimeout(100);
  }
  assert.fail(label);
};
const composer = () => page.locator('textarea[id^="tutor-message-"]');
const readingButton = () =>
  page
    .locator("[data-active-study] > header")
    .getByRole("button", { name: "Reading", exact: true });
const menuButton = () =>
  page
    .locator("[data-active-study] > header")
    .getByRole("button", { name: "Menu", exact: true });
const readingRows = async (fixture) =>
  (
    await pool.query(
      "SELECT id,delivery_status,visible_at,source_passage_ids FROM interventions WHERE session_id=$1 AND type='reading' ORDER BY created_at,id",
      [fixture.sessionId],
    )
  ).rows;
const counts = (fixture) => {
  const sessionWrites = writes.filter((request) =>
    request.url.includes(fixture.sessionId),
  );
  const open = sessionWrites.filter(
    (request) =>
      request.url === base + `/api/tutoring/${fixture.sessionId}/reading`,
  );
  const receipts = sessionWrites.filter((request) =>
    request.url.includes(`/api/sessions/${fixture.sessionId}/interventions/`),
  );
  return {
    open: open.length,
    receipts: receipts.length,
    other: sessionWrites.length - open.length - receipts.length,
  };
};
const layout = () =>
  page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    outerScrollWidth: document.documentElement.scrollWidth,
    scrollY,
    maxScroll: Math.max(0, document.documentElement.scrollHeight - innerHeight),
  }));
async function screenshot(entry, label) {
  const filename = `${entry.viewport.width}x${entry.viewport.height}-${label}.png`;
  await page.screenshot({ path: path.join(out, filename) });
  entry.screenshots.push(filename);
}

try {
  const login = await context.request.post(base + "/api/auth/sign-in/email", {
    headers: { Origin: base },
    data: {
      email: process.env.DEMO_STUDENT_ONE_EMAIL,
      password: process.env.DEMO_STUDENT_ONE_PASSWORD,
    },
  });
  assert.equal(login.status(), 200, "fictional student login");

  for (const viewport of [{ width: 1024, height: 768 }]) {
    const fixture = await fresh();
    const desktop = viewport.width >= 1280;
    const entry = {
      name: `facing reading ${viewport.width}x${viewport.height}`,
      viewport,
      sessionId: fixture.sessionId,
      attemptId: fixture.attemptId,
      status: "RUNNING",
      screenshots: [],
    };
    report.cases.push(entry);
    const readingUrl = base + `/api/tutoring/${fixture.sessionId}/reading`;
    let release;
    let delivery;
    try {
      await page.setViewportSize(viewport);
      await page.goto(base + fixture.url);
      await page.locator("[data-active-notebook]").waitFor();
      await until(() => composer().isEnabled(), "current composer ready");
      const draft = `  ${viewport.width}px café 🌱 draft.\nKeep  exact spaces.  `;
      await composer().fill(draft);
      await composer().evaluate((element) => {
        element.dataset.facingIdentity = "retained";
      });
      await page.evaluate(() =>
        scrollTo(
          0,
          Math.min(160, document.documentElement.scrollHeight - innerHeight),
        ),
      );
      await page.waitForTimeout(100);
      entry.before = await layout();
      if (!desktop) await readingButton().click();
      assert.equal(await page.locator(".nb-context-summary").isVisible(), true);
      assert.deepEqual(counts(fixture), { open: 0, receipts: 0, other: 0 });
      assert.equal((await readingRows(fixture)).length, 0);
      entry.summaryZeroWrites = true;
      await screenshot(entry, "summary");

      const held = new Promise((resolve) => {
        release = resolve;
      });
      await page.route(readingUrl, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const response = await route.fetch();
        assert.equal(response.status(), 200);
        delivery = await response.json();
        await held;
        await route.fulfill({ response });
      });
      await page
        .locator(".nb-passage-list button")
        .filter({ hasText: "P07" })
        .first()
        .click();
      await until(() => Boolean(delivery), "real passage delivery committed");
      assert.equal(delivery.passage.id, "P07");
      assert.deepEqual(delivery.content_ref, fixture.content.content_ref);
      entry.deliveryId = delivery.intervention_id;
      entry.contentVersion = delivery.content_ref.content_version;
      if (desktop) {
        assert.equal(await composer().isVisible(), true);
        assert.equal(
          await page
            .locator("[data-active-notebook-reader] .lp-s-reader-refined")
            .isVisible(),
          true,
        );
        entry.desktopPageAndReaderVisible = true;
        const question = page.locator("details[data-notebook-prompt]");
        await question.locator("summary").focus();
        await page.keyboard.press("Enter");
        assert.equal(await question.getAttribute("open"), "");
        assert.equal(
          await question.locator("p").innerText(),
          fixture.attempt.question.prompt_text,
        );
        release();
        await page.waitForTimeout(400);
        assert.deepEqual(counts(fixture), { open: 1, receipts: 0, other: 0 });
        assert.equal(
          (await readingRows(fixture))[0]?.delivery_status,
          "created",
        );
        entry.questionDisclosureSuppressesReceipt = true;
        await screenshot(entry, "question-disclosure");
        await menuButton().click();
        await page
          .locator('[data-active-study][data-pane="navigation"]')
          .waitFor();
        await page.keyboard.press("Escape");
        assert.equal(await question.getAttribute("open"), null);
        assert.equal(
          await question
            .locator("summary")
            .evaluate((element) => document.activeElement === element),
          true,
        );
        entry.questionEscapeRestoresFocus = true;
      } else {
        await page
          .getByRole("button", { name: "Back to page", exact: true })
          .filter({ visible: true })
          .click();
        await page.locator('[data-active-study][data-pane="page"]').waitFor();
      }
      release();
      await page.waitForTimeout(400);
      let records = await readingRows(fixture);
      assert.equal(records.length, 1);
      assert.equal(records[0].id, delivery.intervention_id);
      assert.equal(records[0].delivery_status, "created");
      assert.equal(records[0].visible_at, null);
      assert.deepEqual(counts(fixture), { open: 1, receipts: 0, other: 0 });
      assert.equal(await composer().inputValue(), draft);
      entry.hiddenResponseNoReceipt = true;
      entry.hiddenBy = desktop ? "Menu" : "Back to page";
      await screenshot(entry, "held-response-hidden");

      if (desktop) await menuButton().click();
      else await readingButton().click();
      await page.locator(".reading-article").scrollIntoViewIfNeeded();
      await until(
        async () =>
          (await readingRows(fixture))[0]?.delivery_status === "displayed",
        "genuinely exposed passage acknowledged",
      );
      await until(
        () => composer().isEnabled(),
        "confirmed reading reconciles current question",
      );
      records = await readingRows(fixture);
      assert.equal(records[0].id, delivery.intervention_id);
      assert.deepEqual(records[0].source_passage_ids, ["P07"]);
      assert.deepEqual(counts(fixture), { open: 1, receipts: 1, other: 0 });
      assert.equal(
        await page.locator(".reading-body").getAttribute("data-delivery-id"),
        delivery.intervention_id,
      );
      assert.ok(
        (await page.locator(".reading-body").innerText()).length > 80,
        "actual approved passage body is displayed",
      );
      if (desktop) assert.equal(await composer().isVisible(), true);
      entry.actualPassageReceiptOnce = true;
      await screenshot(entry, "displayed-reading");
      await page
        .getByRole("link", { name: "Back to study session", exact: true })
        .click();
      await until(
        () => composer().isVisible(),
        "return exposes retained composer",
      );
      await until(() => composer().isEnabled(), "return keeps composer usable");
      await page.waitForTimeout(150);
      assert.equal(await composer().inputValue(), draft);
      assert.equal(await composer().count(), 1);
      assert.equal(
        await composer().getAttribute("data-facing-identity"),
        "retained",
      );
      entry.after = await layout();
      assert.ok(
        Math.abs(
          entry.after.scrollY -
            Math.min(entry.before.scrollY, entry.after.maxScroll),
        ) <= 4,
        "reading return preserves document scroll subject to final document bounds",
      );
      assert.ok(
        entry.after.outerScrollWidth <= viewport.width + 1,
        "no outer horizontal overflow",
      );
      assert.deepEqual(counts(fixture), { open: 1, receipts: 1, other: 0 });
      const attempt = (
        await pool.query(
          "SELECT submitted_at,response_text,submission_key FROM attempts WHERE id=$1",
          [fixture.attemptId],
        )
      ).rows[0];
      assert.deepEqual(attempt, {
        submitted_at: null,
        response_text: null,
        submission_key: null,
      });
      entry.draftIdentityScrollPreserved = true;
      entry.noAnswerOrOtherSessionWrites = true;
      await screenshot(entry, "returned-page");

      if (viewport.width <= 390) {
        const group = page.getByRole("group", {
          name: "Optional starting points",
          exact: true,
        });
        const chips = group.locator(".lp-dialogue-chip");
        assert.equal(await chips.count(), 3);
        const tops = await chips.evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().top),
        );
        assert.ok(
          Math.max(...tops) - Math.min(...tops) <= 1,
          "mobile suggestions stay in one row",
        );
        await chips.first().focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        const geometry = await chips.last().evaluate((element) => {
          const chip = element.getBoundingClientRect();
          const container = element
            .closest('[role="group"]')
            .getBoundingClientRect();
          return {
            focused: document.activeElement === element,
            chipLeft: chip.left,
            chipRight: chip.right,
            containerLeft: container.left,
            containerRight: container.right,
            containerScrollLeft: element.parentElement.scrollLeft,
            viewportWidth: innerWidth,
            outerScrollWidth: document.documentElement.scrollWidth,
          };
        });
        assert.equal(geometry.focused, true);
        assert.ok(
          geometry.chipLeft >= geometry.containerLeft - 1 &&
            geometry.chipRight <= geometry.containerRight + 1,
          "Tab reveals the complete final suggestion inside its own horizontal container",
        );
        assert.ok(
          geometry.outerScrollWidth <= geometry.viewportWidth + 1,
          "keyboard chip navigation does not overflow the document",
        );
        assert.equal(
          await composer().inputValue(),
          draft,
          "Tab does not activate a suggestion or change the draft",
        );
        assert.deepEqual(counts(fixture), { open: 1, receipts: 1, other: 0 });
        entry.mobileKeyboardSuggestions = geometry;
        await screenshot(entry, "keyboard-last-suggestion");
      }
      entry.status = "PASS";
      console.log(`PASS ${entry.name}`);
    } catch (error) {
      entry.status = "FAIL";
      entry.error = error.stack;
      await screenshot(entry, "failure").catch(() => {});
      console.error(`FAIL ${entry.name}: ${error.message}`);
    } finally {
      entry.scrollTrace = await page.evaluate(() => window.__s1ScrollTrace);
      release?.();
      await page.unroute(readingUrl);
      save();
    }
  }
} catch (error) {
  report.errors.push(error.stack);
} finally {
  report.sourceAfter = git("rev-parse", "HEAD");
  report.appSourceAfterSha256 = hash(JSON.stringify(sourceFiles()));
  report.sourceUnchanged =
    report.appSourceAfterSha256 === report.appSourceSha256;
  report.result =
    report.cases.length === 4 &&
    report.cases.every((entry) => entry.status === "PASS") &&
    report.errors.length === 0 &&
    report.sourceUnchanged
      ? "PASS"
      : "FAIL";
  save();
  await context.close();
  await browser.close();
  await pool.end();
}
if (report.result !== "PASS") process.exitCode = 1;
console.log(
  JSON.stringify({
    out,
    result: report.result,
    cases: report.cases.map(({ name, status }) => ({ name, status })),
  }),
);
