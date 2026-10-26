/** Combined authenticated S1 pane/reader checks; authored fixtures, zero providers. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fresh, help, feedback, pool, base } from "./fixtures.mjs";
import { tutorView } from "../../lib/tutoring/store.ts";
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const out = path.join(
  "acceptance/active-notebook/evidence",
  `panes-${Date.now()}`,
);
fs.mkdirSync(out, { recursive: true });
const fingerprint = () =>
  createHash("sha256")
    .update(
      execFileSync("git", ["diff", "HEAD", "--", "app", "lib", "tests"], {
        windowsHide: true,
      }),
    )
    .digest("hex");
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim(),
  diffSha256: fingerprint(),
  runtime: process.env.S1_RUNTIME || "development",
  buildId:
    process.env.S1_RUNTIME === "production"
      ? fs.readFileSync(".next/BUILD_ID", "utf8").trim()
      : null,
  providersDisabled: true,
  paidCalls: 0,
  cases: [],
  result: "RUNNING",
};
const save = () =>
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.READER_BROWSER_PATH,
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
ctx.setDefaultTimeout(20000);
await ctx.route("**/*", (route) =>
  new URL(route.request().url()).origin === base
    ? route.continue()
    : route.abort(),
);
const login = await ctx.request.post(base + "/api/auth/sign-in/email", {
  headers: { Origin: base },
  data: {
    email: process.env.DEMO_STUDENT_ONE_EMAIL,
    password: process.env.DEMO_STUDENT_ONE_PASSWORD,
  },
});
assert.equal(login.status(), 200);
const page = await ctx.newPage(),
  writes = [];
page.on("request", (r) => {
  if (r.method() === "POST")
    writes.push({ url: r.url(), body: r.postDataJSON() });
});
const until = async (fn, label) => {
  for (let i = 0; i < 150; i++) {
    if (await fn()) return;
    await page.waitForTimeout(100);
  }
  assert.fail(label);
};
const rows = async (f) =>
  (
    await pool.query(
      "SELECT id,type,delivery_status,visible_at,source_passage_ids FROM interventions WHERE session_id=$1 ORDER BY created_at,id",
      [f.sessionId],
    )
  ).rows;
const composer = () =>
  page.getByRole("textbox", { name: "Message your tutor", exact: true });
const readingButton = () =>
  page
    .locator("[data-active-study] > header")
    .getByRole("button", { name: "Reading", exact: true });
const readerPostCount = (f) =>
  writes.filter((x) => x.url === base + `/api/tutoring/${f.sessionId}/reading`)
    .length;
const displayCount = (f) =>
  writes.filter((x) =>
    x.url.includes(`/api/sessions/${f.sessionId}/interventions/`),
  ).length;
const answerCount = (f) =>
  writes.filter(
    (x) =>
      x.url === base + `/api/sessions/${f.sessionId}/answers` ||
      x.url === base + `/api/tutoring/${f.sessionId}`,
  ).length;
async function open(f) {
  await page.goto(base + f.url);
  await page.locator("[data-active-notebook]").waitFor();
  await until(async () => await composer().isEnabled(), "composer settles");
}
async function reading() {
  await readingButton().click();
  await page.locator('[data-active-study][data-pane="context"]').waitFor();
}
async function back() {
  await page
    .getByRole("button", { name: "Back to page", exact: true })
    .filter({ visible: true })
    .click();
  await page.locator('[data-active-study][data-pane="page"]').waitFor();
}
async function passage() {
  await page
    .locator(".nb-passage-list button")
    .filter({ hasText: "P07" })
    .first()
    .click();
}
async function check(name, run) {
  try {
    await run();
    report.cases.push({ name, status: "PASS", url: page.url() });
    console.log("PASS " + name);
  } catch (error) {
    report.cases.push({
      name,
      status: "FAIL",
      error: error.stack,
      url: page.url(),
    });
    await page.screenshot({
      path: path.join(out, `failure-${report.cases.length}.png`),
    });
    throw error;
  } finally {
    save();
  }
}
try {
  await check(
    "hidden reader and pane navigation make zero reading/answer writes; one composer and exact draft survive",
    async () => {
      const f = await fresh();
      await open(f);
      const header = page.locator("[data-active-study] > header");
      assert.equal(
        await header.locator('[title="No submitted answer"]').count(),
        1,
      );
      const draft = "  Unsent café 🌱 reasoning.\nKeep  spaces.  ";
      await composer().fill(draft);
      await until(
        async () =>
          (await header.locator('[title="Text kept in this tab"]').count()) ===
          1,
        "header reports tab-local draft without claiming a submission",
      );
      await page
        .locator(".lp-ask-composer")
        .getByRole("button", { name: "Open the reading", exact: true })
        .click();
      await page.locator('[data-active-study][data-pane="context"]').waitFor();
      assert.equal(readerPostCount(f), 0);
      assert.equal(displayCount(f), 0);
      assert.equal(answerCount(f), 0);
      await back();
      assert.equal(await composer().inputValue(), draft);
      await composer().evaluate(
        (e) => (e.dataset.s1Retained = "same-composer"),
      );
      await reading();
      assert.equal(readerPostCount(f), 0);
      assert.equal(displayCount(f), 0);
      await back();
      await page.getByRole("button", { name: "Pages", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Escape");
      await until(
        async () =>
          await page.evaluate(
            () =>
              document.activeElement?.getAttribute("aria-label") === "Pages",
          ),
        "keyboard pane close restores trigger focus",
      );
      await until(async () => await composer().isVisible(), "page exposed");
      await until(
        async () => (await composer().inputValue()) === draft,
        "exact draft retained after navigation",
      );
      assert.equal(
        await composer().getAttribute("data-s1-retained"),
        "same-composer",
      );
      assert.equal(await composer().count(), 1);
      assert.equal(answerCount(f), 0);
      assert.equal(readerPostCount(f), 0);
      assert.equal((await rows(f)).length, 0);
      await page.reload();
      await until(async () => await composer().isEnabled(), "reload settles");
      await until(
        async () => (await composer().inputValue()) === draft,
        "exact draft retained after navigation",
      );
      await page.goto(base + "/study/assignments");
      await page.goBack();
      await until(async () => await composer().isEnabled(), "Back settles");
      await until(
        async () => (await composer().inputValue()) === draft,
        "exact draft retained after navigation",
      );
      await page.goForward();
      await page.goBack();
      await until(
        async () => await composer().isEnabled(),
        "Forward Back settles",
      );
      await until(
        async () => (await composer().inputValue()) === draft,
        "exact draft retained after navigation",
      );
    },
  );
  await check(
    "in-flight reading keeps delivery identity while hidden; exposure acknowledges exactly once",
    async () => {
      const f = await fresh();
      await open(f);
      await composer().fill("Draft across pending reading");
      let release, delivery;
      const held = new Promise((r) => (release = r));
      const readingUrl = base + `/api/tutoring/${f.sessionId}/reading`;
      await page.route(readingUrl, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const response = await route.fetch();
        delivery = await response.json();
        await held;
        await route.fulfill({ response });
      });
      await reading();
      await passage();
      await until(() => Boolean(delivery), "reading server committed");
      await back();
      release();
      await page.waitForTimeout(400);
      let list = await rows(f);
      assert.equal(list.length, 1);
      assert.equal(list[0].delivery_status, "created");
      assert.equal(displayCount(f), 0);
      const identity = list[0].id;
      assert.equal(
        await composer().inputValue(),
        "Draft across pending reading",
      );
      assert.equal(
        await page.locator("[data-notebook-recovery]").isVisible(),
        true,
      );
      await reading();
      await page.locator(".reading-article").scrollIntoViewIfNeeded();
      await until(
        async () => (await rows(f))[0]?.delivery_status === "displayed",
        "visible receipt",
      );
      list = await rows(f);
      assert.equal(list[0].id, identity);
      assert.equal(readerPostCount(f), 1);
      assert.equal(displayCount(f), 1);
      assert.equal(answerCount(f), 0);
      await back();
      await reading();
      await page.waitForTimeout(250);
      assert.equal(displayCount(f), 1);
      await page
        .getByRole("link", { name: "Back to study session", exact: true })
        .click();
      await until(
        async () => await composer().isEnabled(),
        "composer enabled after reader return",
      );
      await reading();
      await passage();
      await page.locator(".reading-article").scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await back();
      await until(
        async () => await composer().isEnabled(),
        "same confirmed passage reopen must not leave blocker",
      );
      assert.equal(
        readerPostCount(f),
        1,
        "reopening same confirmed passage does not reopen delivery",
      );
      assert.equal(
        displayCount(f),
        1,
        "reopening same confirmed passage does not duplicate receipt",
      );

      assert.equal(
        await composer().inputValue(),
        "Draft across pending reading",
      );
      await page.unroute(readingUrl);
    },
  );
  for (const outcome of ["failed", "unknown"]) {
    await check(
      `${outcome} reading receipt preserves notice and retries original identity once`,
      async () => {
        const f = await fresh();
        await open(f);
        let intercepted = false;
        const pattern = base + `/api/sessions/${f.sessionId}/interventions/*`;
        await page.route(pattern, async (route) => {
          if (route.request().method() !== "POST" || intercepted)
            return route.continue();
          intercepted = true;
          if (outcome === "unknown") {
            await route.fetch();
            return route.abort("failed");
          }
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Authored receipt failure" }),
          });
        });
        await reading();
        await passage();
        await page.locator(".reading-article").scrollIntoViewIfNeeded();
        await page
          .getByRole("button", { name: "Retry saving reading", exact: true })
          .waitFor();
        const before = await rows(f);
        assert.equal(before.length, 1);
        const identity = before[0].id,
          posts = displayCount(f);
        assert.equal(
          before[0].delivery_status,
          outcome === "unknown" ? "displayed" : "created",
        );
        await back();
        assert.equal(
          await page
            .getByRole("button", {
              name: "Return to reading recovery",
              exact: true,
            })
            .isVisible(),
          true,
        );
        await page
          .getByRole("button", {
            name: "Return to reading recovery",
            exact: true,
          })
          .click();
        await page.waitForTimeout(200);
        assert.equal(displayCount(f), posts);
        await page
          .getByRole("button", { name: "Retry saving reading", exact: true })
          .click();
        await page.locator(".reading-article").scrollIntoViewIfNeeded();
        await until(
          async () =>
            !(await page
              .getByRole("button", {
                name: "Retry saving reading",
                exact: true,
              })
              .isVisible()),
          "explicit reading retry settles",
        );
        await until(
          async () => (await rows(f))[0]?.delivery_status === "displayed",
          "retry receipt persisted",
        );
        await page
          .locator(
            '[data-active-notebook-reader] [data-reading-state="acknowledged"]',
          )
          .waitFor();
        const after = await rows(f);
        assert.equal(after.length, 1);
        assert.equal(after[0].id, identity);
        assert.equal(after[0].delivery_status, "displayed");
        assert.equal(readerPostCount(f), 1);
        assert.equal(displayCount(f), posts + 1);
        assert.equal(answerCount(f), 0);
        await page.unroute(pattern);
      },
    );
  }
  await check(
    "question disclosure hides delayed accepted help until explicit return without stealing focus or draft",
    async () => {
      const original = await fresh({ runtime: true });
      await open(original);
      const draft = "  Disclosure café 🌱 draft.\nKeep  spaces.  ";
      await composer().fill(draft);
      const f = await help(original, { long: true });
      let release,
        responseArrived = false;
      const held = new Promise((resolve) => {
        release = resolve;
      });
      const conversation = base + `/api/tutoring/${f.sessionId}/conversation`;
      await page.route(conversation, async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        const response = await route.fetch();
        responseArrived = true;
        await held;
        await route.fulfill({ response });
      });
      await page.reload();
      await until(() => responseArrived, "accepted help response held");
      const disclosure = page.locator("details[data-notebook-prompt]");
      await disclosure.locator("summary").focus();
      await page.keyboard.press("Enter");
      assert.equal(await disclosure.getAttribute("open"), "");
      release();
      await page.waitForTimeout(500);
      assert.equal((await rows(f))[0].delivery_status, "created");
      assert.equal(
        writes.filter((item) => item.url === conversation + "/display").length,
        0,
      );
      assert.equal(
        await page.locator('textarea[id^="tutor-message-"]').inputValue(),
        draft,
      );
      assert.equal(
        await disclosure
          .locator("summary")
          .evaluate((element) => element === document.activeElement),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(await disclosure.getAttribute("open"), null);
      assert.equal(
        await disclosure
          .locator("summary")
          .evaluate((element) => element === document.activeElement),
        true,
      );
      await page.locator(`#dialogue-${f.requestId}`).scrollIntoViewIfNeeded();
      await until(
        async () => (await rows(f))[0].delivery_status === "displayed",
        "help genuinely exposed after disclosure closes",
      );
      assert.equal(
        writes.filter((item) => item.url === conversation + "/display").length,
        1,
      );
      assert.equal(answerCount(f), 0);
      assert.equal(await composer().inputValue(), draft);
      await page.unroute(conversation);
    },
  );
  await check(
    "accepted help arriving in hidden page neither acknowledges nor steals context focus",
    async () => {
      const f = await help(await fresh({ runtime: true }), { long: true });
      let release,
        responseArrived = false;
      const held = new Promise((r) => (release = r));
      const conversation = base + `/api/tutoring/${f.sessionId}/conversation`;
      await page.route(conversation, async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        const response = await route.fetch();
        responseArrived = true;
        await held;
        await route.fulfill({ response });
      });
      await page.goto(base + f.url);
      await page.locator("[data-active-notebook]").waitFor();
      await until(() => responseArrived, "conversation loaded");
      await reading();
      release();
      await page.waitForTimeout(500);
      assert.equal((await rows(f))[0].delivery_status, "created");
      assert.equal(
        writes.filter((x) => x.url === conversation + "/display").length,
        0,
      );
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.closest("aside")?.getAttribute("aria-label"),
        ),
        "Reading",
      );
      await back();
      await page.locator(`#dialogue-${f.requestId}`).scrollIntoViewIfNeeded();
      await until(
        async () => (await rows(f))[0].delivery_status === "displayed",
        "help exposed",
      );
      assert.equal(
        writes.filter((x) => x.url === conversation + "/display").length,
        1,
      );
      assert.equal(answerCount(f), 0);
      const paper = await page
        .locator(".lp-conversation-scroll")
        .getAttribute("data-scroll-mode");
      assert.equal(paper, "paper", "Active Notebook uses natural paper scroll");
      const target = await page.evaluate(() =>
        Math.min(180, document.documentElement.scrollHeight - innerHeight),
      );
      assert.ok(target > 0, "Long help must provide an actual scrollable page");
      await page.evaluate((y) => scrollTo(0, y), target);
      await page.waitForTimeout(150);
      const beforeScroll = await page.evaluate(() => scrollY);
      await reading();
      await back();
      await page.waitForTimeout(250);
      const afterScroll = await page.evaluate(() => scrollY);
      assert.ok(
        Math.abs(afterScroll - beforeScroll) <= 1,
        `Paper scroll restored after pane change: ${beforeScroll} → ${afterScroll}`,
      );

      await page.unroute(conversation);
    },
  );
  await check(
    "feedback loaded while page hidden is acknowledged only after return",
    async () => {
      const f = await fresh();
      await open(f);
      const url = base + `/api/tutoring/${f.sessionId}`;
      let failed = false;
      await page.route(url, async (route) => {
        if (route.request().method() !== "GET" || failed)
          return route.continue();
        failed = true;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Authored refresh failure" }),
        });
      });
      await reading();
      await passage();
      await page.locator(".reading-article").scrollIntoViewIfNeeded();
      await page
        .getByText(
          "The reading receipt was saved, but your current question could not be refreshed. Refresh saved progress before answering.",
          { exact: true },
        )
        .waitFor();
      await page.unroute(url);
      await feedback(f);
      let release,
        loaded = false;
      const held = new Promise((r) => (release = r)),
        beforeDisplays = displayCount(f);
      await page.route(url, async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        const response = await route.fetch();
        loaded = true;
        await held;
        await route.fulfill({ response });
      });
      await page
        .getByRole("button", { name: "Refresh saved progress", exact: true })
        .click();
      await until(() => loaded, "feedback response");
      release();
      await page.waitForTimeout(350);
      const pending = (await rows(f)).filter((x) => x.type !== "reading");
      assert.ok(pending.length);
      assert.ok(pending.every((x) => x.delivery_status === "created"));
      assert.equal(displayCount(f), beforeDisplays);
      await back();
      await page.getByRole("button", { name: "Pages", exact: true }).click();
      await page
        .locator('aside[aria-label="Pages"]')
        .locator(`a[href="#question-${f.attemptId}"]`)
        .click();
      await page.locator('[id^="feedback-"]').first().scrollIntoViewIfNeeded();
      await until(
        async () =>
          (await rows(f))
            .filter((x) => x.type !== "reading")
            .every((x) => x.delivery_status === "displayed"),
        "feedback exposed",
      );
      assert.equal(displayCount(f), beforeDisplays + pending.length);
      assert.equal(answerCount(f), 0);
      await page.unroute(url);
    },
  );
  await check(
    "confirmed reading with failed progress reload keeps blocker until explicit recovery",
    async () => {
      const f = await fresh();
      await open(f);
      await composer().fill("Draft while checking saved progress");
      let failNext = false;
      const receipt = base + `/api/sessions/${f.sessionId}/interventions/*`,
        progress = base + `/api/tutoring/${f.sessionId}`;
      await page.route(receipt, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const response = await route.fetch();
        failNext = true;
        await route.fulfill({ response });
      });
      await page.route(progress, async (route) => {
        if (route.request().method() === "GET" && failNext) {
          failNext = false;
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Authored progress read failure" }),
          });
        }
        return route.continue();
      });
      await reading();
      await passage();
      await page.locator(".reading-article").scrollIntoViewIfNeeded();
      await page
        .getByText(
          "The reading receipt was saved, but your current question could not be refreshed. Refresh saved progress before answering.",
          { exact: true },
        )
        .waitFor();
      const saved = await rows(f);
      assert.equal(saved.length, 1);
      assert.equal(saved[0].delivery_status, "displayed");
      const identity = saved[0].id;
      await back();
      assert.equal(await composer().isEnabled(), false);
      await page
        .getByRole("button", { name: "Refresh saved progress", exact: true })
        .click();
      await until(
        async () => await composer().isEnabled(),
        "explicit progress recovery clears blocker",
      );
      assert.equal(
        await composer().inputValue(),
        "Draft while checking saved progress",
      );
      assert.equal((await rows(f))[0].id, identity);
      assert.equal(readerPostCount(f), 1);
      assert.equal(displayCount(f), 1);
      assert.equal(answerCount(f), 0);
      await page.unroute(receipt);
      await page.unroute(progress);
    },
  );

  await check(
    "earlier page selection retains current draft and pending help identity without hidden acknowledgement",
    async () => {
      const f = await feedback(await fresh({ runtime: true }));
      await page.goto(base + f.url);
      await page.locator("[data-active-notebook]").waitFor();
      await page.getByRole("button", { name: "Pages", exact: true }).click();
      await page
        .locator('aside[aria-label="Pages"]')
        .locator(`a[href="#question-${f.attemptId}"]`)
        .click();
      await page.locator('[id^="feedback-"]').first().scrollIntoViewIfNeeded();
      await until(
        async () =>
          (await rows(f)).every((x) => x.delivery_status === "displayed"),
        "fixture feedback genuinely displayed",
      );
      await page
        .getByRole("button", {
          name: "Return to current question",
          exact: true,
        })
        .click();
      await until(
        async () => await composer().isEnabled(),
        "next-question composer ready",
      );
      const current = await tutorView(f.access, f.sessionId),
        latest = current.attempts.at(-1);
      assert.notEqual(latest.id, f.attemptId);
      const draft = "  Current page draft café 🌱.\nKeep my reasoning.  ";
      await composer().fill(draft);
      await composer().evaluate(
        (e) => (e.dataset.s1Retained = "current-page-composer"),
      );
      const folded = page.locator(
        `.nb-folded-page[href="#question-${f.attemptId}"]`,
      );
      await folded.focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("button", {
          name: "Return to current question",
          exact: true,
        })
        .waitFor();
      await page
        .getByRole("button", {
          name: "Return to current question",
          exact: true,
        })
        .focus();
      await page.keyboard.press("Enter");
      await until(
        async () => await composer().isVisible(),
        "folded leaf keyboard return exposes current page",
      );
      assert.equal(await composer().inputValue(), draft);
      assert.equal(answerCount(f), 0);

      await page.getByRole("button", { name: "Pages", exact: true }).click();
      await page
        .locator('aside[aria-label="Pages"]')
        .locator(`a[href="#question-${f.attemptId}"]`)
        .click();
      await page
        .getByRole("button", {
          name: "Return to current question",
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page
          .locator('textarea[id^="tutor-message-"]')
          .getAttribute("data-s1-retained"),
        "current-page-composer",
      );
      assert.equal(
        await page.locator('textarea[id^="tutor-message-"]').inputValue(),
        draft,
      );
      assert.equal(await composer().isVisible(), false);
      await page
        .getByRole("button", {
          name: "Return to current question",
          exact: true,
        })
        .click();
      await until(
        async () => await composer().isVisible(),
        "current page returned",
      );
      assert.equal(await composer().inputValue(), draft);
      assert.equal(answerCount(f), 0);
      const pending = await help(
        { ...f, attemptId: latest.id },
        { long: true },
      );
      let release,
        loaded = false;
      const held = new Promise((r) => (release = r)),
        url = base + `/api/tutoring/${f.sessionId}/conversation`;
      await page.route(url, async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        const response = await route.fetch();
        loaded = true;
        await held;
        await route.fulfill({ response });
      });
      await page.reload();
      await page.locator("[data-active-notebook]").waitFor();
      await until(() => loaded, "pending current help loaded");
      await page.getByRole("button", { name: "Pages", exact: true }).click();
      await page
        .locator('aside[aria-label="Pages"]')
        .locator(`a[href="#question-${f.attemptId}"]`)
        .click();
      release();
      await page.waitForTimeout(350);
      const pendingBefore = await rows(f),
        helpRow = pendingBefore.find((x) => x.delivery_status === "created");
      assert.ok(helpRow);
      assert.equal(writes.filter((x) => x.url === url + "/display").length, 0);
      await page
        .getByRole("button", {
          name: "Return to current question",
          exact: true,
        })
        .click();
      await page
        .locator(`#dialogue-${pending.requestId}`)
        .scrollIntoViewIfNeeded();
      await until(
        async () =>
          (await rows(f)).find((x) => x.id === helpRow.id)?.delivery_status ===
          "displayed",
        "current help exposed once",
      );
      assert.equal(writes.filter((x) => x.url === url + "/display").length, 1);
      await until(
        async () => await composer().isEnabled(),
        "current composer after help",
      );
      assert.equal(await composer().inputValue(), draft);
      assert.equal(answerCount(f), 0);
      await page.unroute(url);
    },
  );

  await check(
    "late first-reading progress response cannot unblock a newer pending passage",
    async () => {
      const f = await fresh();
      await open(f);
      await composer().fill("Draft across overlapping passage reloads");
      let releaseFirst,
        releaseSecond,
        firstRefresh = false,
        secondOpened = false,
        opens = 0;
      const heldFirst = new Promise((r) => (releaseFirst = r)),
        heldSecond = new Promise((r) => (releaseSecond = r)),
        progress = base + `/api/tutoring/${f.sessionId}`,
        readingUrl = base + `/api/tutoring/${f.sessionId}/reading`;
      await page.route(progress, async (route) => {
        if (route.request().method() !== "GET" || firstRefresh)
          return route.continue();
        const response = await route.fetch();
        firstRefresh = true;
        await heldFirst;
        await route.fulfill({ response });
      });
      await page.route(readingUrl, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        opens++;
        if (opens !== 2) return route.continue();
        const response = await route.fetch();
        secondOpened = true;
        await heldSecond;
        await route.fulfill({ response });
      });
      await reading();
      await passage();
      await page.locator(".reading-article").scrollIntoViewIfNeeded();
      await until(() => firstRefresh, "first reading refresh is delayed");
      await page
        .getByRole("link", { name: "Keep reading", exact: true })
        .click();
      await until(() => secondOpened, "second reading open held");
      await back();
      releaseFirst();
      await page.waitForTimeout(350);
      assert.equal(
        await composer().isEnabled(),
        false,
        "old progress response must not clear newer reading blocker",
      );
      const pending = await rows(f);
      assert.equal(pending.length, 2);
      assert.equal(pending[0].delivery_status, "displayed");
      assert.equal(pending[1].delivery_status, "created");
      releaseSecond();
      await page.waitForTimeout(250);
      assert.equal(await composer().isEnabled(), false);
      assert.equal(displayCount(f), 1);
      await reading();
      await page.locator(".reading-article").scrollIntoViewIfNeeded();
      await until(
        async () => (await rows(f))[1].delivery_status === "displayed",
        "second reading truly exposed",
      );
      await back();
      await until(
        async () => await composer().isEnabled(),
        "second reading saved progress settles",
      );
      assert.equal(
        await composer().inputValue(),
        "Draft across overlapping passage reloads",
      );
      assert.equal(readerPostCount(f), 2);
      assert.equal(displayCount(f), 2);
      assert.equal(answerCount(f), 0);
      await page.unroute(progress);
      await page.unroute(readingUrl);
    },
  );

  for (const routeToNewerState of [
    "second passage",
    "manual saved-progress refresh",
  ]) {
    await check(
      `late reading snapshot after ${routeToNewerState} and original save cannot roll the page back`,
      async () => {
        const f = await fresh();
        await open(f);
        let release,
          held = false;
        const blocked = new Promise((r) => (release = r)),
          url = base + `/api/tutoring/${f.sessionId}`;
        await page.route(url, async (route) => {
          if (route.request().method() !== "GET" || held)
            return route.continue();
          const response = await route.fetch();
          held = true;
          await blocked;
          await route.fulfill({ response });
        });
        await reading();
        await passage();
        await page.locator(".reading-article").scrollIntoViewIfNeeded();
        await until(() => held, "old reader progress snapshot held");
        if (routeToNewerState === "second passage") {
          await page
            .getByRole("link", { name: "Keep reading", exact: true })
            .click();
          await page.locator(".reading-article").scrollIntoViewIfNeeded();
          await until(
            async () =>
              (await rows(f)).length === 2 &&
              (await rows(f))[1].delivery_status === "displayed",
            "newer passage receipt persisted",
          );
          await back();
        } else {
          await back();
          await page
            .getByRole("button", {
              name: "Refresh saved progress",
              exact: true,
            })
            .click();
        }
        await until(
          async () => await composer().isEnabled(),
          "newer authoritative progress applied",
        );
        const original =
          "  Later original café 🌱 answer.\nKeep  exact text.  ";
        await composer().fill("What does packet size mean?");
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await page
          .getByRole("button", { name: "I’m asking for help", exact: true })
          .last()
          .click();
        await page
          .getByRole("button", {
            name: "Submit this as my answer",
            exact: true,
          })
          .waitFor();
        await composer().fill(original);
        await page
          .getByRole("button", {
            name: "Submit this as my answer",
            exact: true,
          })
          .click();
        await until(
          async () =>
            (await page.locator(".lp-answer").allTextContents()).includes(
              original,
            ),
          "new original rendered before old response",
        );
        release();
        await page.waitForTimeout(500);
        assert.ok(
          (await page.locator(".lp-answer").allTextContents()).includes(
            original,
          ),
          "late old reading snapshot must not erase rendered original",
        );
        const persisted = (
          await pool.query(
            "SELECT response_text,submission_key FROM attempts WHERE id=$1",
            [f.attemptId],
          )
        ).rows[0];
        assert.equal(persisted.response_text, original);
        assert.ok(persisted.submission_key);
        await page.unroute(url);
      },
    );
  }

  await check(
    "phone quick suggestions stay in one row and keyboard focus reveals the final pill without page overflow",
    async () => {
      const f = await fresh();
      await open(f);
      const group = page.getByRole("group", {
          name: "Optional starting points",
          exact: true,
        }),
        pills = group.getByRole("button");
      assert.equal(await pills.count(), 3);
      const before = await pills.evaluateAll((elements) =>
        elements.map((el) => ({
          top: el.getBoundingClientRect().top,
          height: el.getBoundingClientRect().height,
        })),
      );
      assert.ok(
        Math.max(...before.map((r) => r.top)) -
          Math.min(...before.map((r) => r.top)) <=
          1,
        "suggestion pills form one horizontal row",
      );
      await pills.nth(0).focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      assert.equal(
        await pills.nth(2).evaluate((el) => document.activeElement === el),
        true,
      );
      const geometry = await pills.nth(2).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        };
      });
      assert.ok(
        geometry.left >= 0 && geometry.right <= geometry.width + 1,
        "focused final suggestion is inside viewport",
      );
      assert.ok(
        geometry.scrollWidth <= geometry.width + 1,
        "no horizontal document overflow",
      );
      assert.equal(answerCount(f), 0);
      assert.equal(readerPostCount(f), 0);
    },
  );

  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  report.diffAfterSha256 = fingerprint();
  report.sourceUnchanged = report.diffAfterSha256 === report.diffSha256;
  save();
  await ctx.close();
  await browser.close();
  await pool.end();
}
console.log(
  JSON.stringify({ out, result: report.result, cases: report.cases }),
);
