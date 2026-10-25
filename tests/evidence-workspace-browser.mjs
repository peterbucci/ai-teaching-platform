/** Evidence-only browser regression. Run against a fresh --class seed with providers disabled.
 * node --experimental-strip-types --conditions=react-server tests/evidence-workspace-browser.mjs --origin http://localhost:3360 --out <fresh-private-folder>
 * The coordinator owns the shared storage lock and preflight for this process.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";

const options = {};
for (let i = 2; i < process.argv.length; i += 2)
  options[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const origin = new URL(options.origin);
assert(
  ["localhost", "127.0.0.1"].includes(origin.hostname),
  "Loopback runtime required",
);
assert(options.out, "A fresh private output directory is required");
assert.equal(
  process.env.OPENAI_API_KEY ?? "",
  "",
  "Providers must be disabled",
);
assert.equal(process.env.OPENAI_MODEL ?? "", "", "Providers must be disabled");
const output = path.resolve(options.out);
await mkdir(output);
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE ??
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const executablePath =
  process.env.BROWSER_EXECUTABLE ??
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const fixture = buildClassFixture(loadApprovedContent());
const records = fixture.sessions.flatMap((session) =>
  session.attempts
    .filter((attempt) => attempt.response_text !== null)
    .map((attempt) => ({
      attempt,
      session: session.session,
      interventions: session.interventions,
      evaluations: session.evaluations.filter(
        (item) => item.attempt_id === attempt.id,
      ),
    })),
);
const recordMap = new Map(records.map((record) => [record.attempt.id, record]));
const report = {
  startedAt: new Date().toISOString(),
  status: "running",
  origin: origin.origin,
  sourceSha: options.sha ?? "working-tree",
  harnessSha256: createHash("sha256")
    .update(readFileSync(fileURLToPath(import.meta.url)))
    .digest("hex"),
  category:
    "Fictional class fixture; browser against application; zero model calls",
  seed: "buildClassFixture(loadApprovedContent()), npm run db:seed -- --class",
  checks: [],
  observations: [],
  blockedRequests: [],
  screenshots: [],
  limitations: [],
};
const contexts = [];
function check(label, passed, detail = {}) {
  report.checks.push({ label, status: passed ? "pass" : "fail", ...detail });
}
async function saveReport() {
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
async function run(label, task) {
  try {
    await task();
  } catch (error) {
    check(label, false, { error: String(error) });
  }
  await saveReport();
}
async function settle(page) {
  await page.locator(".tw-panes").waitFor();
  await page.waitForTimeout(550);
}
async function capture(page, name) {
  const filename = name + ".png";
  await page.screenshot({ path: path.join(output, filename), fullPage: false });
  report.screenshots.push(filename);
}
async function observe(page) {
  return page.evaluate(() => {
    const visible = (element) =>
      Boolean(element && element.getClientRects().length);
    const rect = (element) => {
      if (!visible(element)) return null;
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const root = document.querySelector(".tw-panes");
    const list = document.querySelector(".wb-response-list");
    const scroller = list?.closest(".tw-panes-body") ?? list;
    return {
      url: location.href,
      activeId: document.activeElement?.id,
      activeTag: document.activeElement?.tagName,
      activePane: root?.dataset.activePane,
      layout: root?.dataset.layout,
      listScrollTop: scroller?.scrollTop,
      listScrollHeight: scroller?.scrollHeight,
      listClientHeight: scroller?.clientHeight,
      rows: list?.querySelectorAll("[data-evidence-attempt]").length,
      selected: list
        ?.querySelector("a[aria-current='true']")
        ?.closest("[data-evidence-attempt]")?.dataset.evidenceAttempt,
      record: rect(document.querySelector("#response-detail-title")),
      originalAnswerHeading: rect(
        [...document.querySelectorAll("h3")].find(
          (element) => element.textContent === "Original response",
        ),
      ),
      originalAnswer: rect(document.querySelector(".wb-original-response")),
      navigation: rect(document.querySelector(".tw-panes-panel--navigation")),
      main: rect(document.querySelector(".tw-panes-panel--main")),
      context: rect(document.querySelector(".tw-panes-context")),
      answer: document.querySelector(".wb-original-response")?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      scrollY,
      innerWidth,
      innerHeight,
      devicePixelRatio,
      rootZoom: getComputedStyle(document.documentElement).zoom,
      bottomNavigation: [...document.querySelectorAll("nav")]
        .filter(visible)
        .map((element) => ({
          label: element.getAttribute("aria-label"),
          rect: rect(element),
        })),
    };
  });
}
function baseHref(concept = "transmission_delay", query = undefined) {
  const url = new URL("/teacher/evidence", origin);
  url.search = new URLSearchParams({
    assignment: fixture.assignment.id,
    origin: "synthetic_fixture",
    concept,
    ...(query ? { q: query } : {}),
  });
  return url.href;
}
function recordHref(record, evaluation = undefined) {
  const url = new URL(baseHref(record.attempt.question.concept_ids[0]));
  url.searchParams.set("attempt", record.attempt.id);
  url.searchParams.set("session", record.session.id);
  if (evaluation) url.searchParams.set("evaluation", evaluation.id);
  url.hash = "response-detail-title";
  return url.href;
}
async function login(page) {
  await page.goto(new URL("/login", origin).href);
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/teacher"));
}
async function createContext(viewport, zoom = undefined) {
  let context;
  if (zoom) {
    const profile = path.join(output, "private-profile-zoom" + zoom);
    await mkdir(path.join(profile, "Default"), { recursive: true });
    await writeFile(
      path.join(profile, "Default", "Preferences"),
      JSON.stringify({
        partition: {
          default_zoom_level: {
            x: Math.log(zoom) / Math.log(1.2),
            0: Math.log(zoom) / Math.log(1.2),
          },
        },
      }),
    );
    context = await chromium.launchPersistentContext(profile, {
      executablePath,
      headless: true,
      viewport: null,
      args: ["--window-size=1440,1000"],
    });
  } else {
    const browser = await chromium.launch({ executablePath, headless: true });
    context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    context.on("close", () => browser.close());
  }
  contexts.push(context);
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (["data:", "blob:"].includes(url.protocol)) return route.continue();
    if (
      url.origin === origin.origin &&
      (["GET", "HEAD"].includes(request.method()) ||
        (request.method() === "POST" &&
          url.pathname === "/api/auth/demo-sign-in"))
    )
      return route.continue();
    report.blockedRequests.push({ method: request.method(), url: url.href });
    return route.abort("blockedbyclient");
  });
  const page = context.pages()[0] ?? (await context.newPage());
  page.setDefaultTimeout(12000);
  await login(page);
  return { context, page };
}
async function tabToRow(page, rowId) {
  // Actual keyboard navigation; no programmatic focusing of the row under test.
  for (let i = 0; i < 220; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate((id) => document.activeElement?.id === id, rowId))
      return;
  }
  throw new Error("Keyboard did not reach originating row " + rowId);
}
async function expectExact(page, record, label) {
  const text = await page.locator(".wb-original-response").textContent();
  check(
    label + " exact original answer",
    text === record.attempt.response_text,
    {
      attempt: record.attempt.id,
      expectedLength: record.attempt.response_text.length,
      actualLength: text?.length,
    },
  );
  const question = page
    .locator(".wb-original-question, .wb-detail-section > .wb-original")
    .first();
  check(
    label + " exact original question",
    (await question.textContent()) === record.attempt.question.prompt_text,
    { attempt: record.attempt.id },
  );
}
async function showNavigation(page) {
  if (
    (await page.locator(".tw-panes").getAttribute("data-layout")) === "compact"
  ) {
    await page.locator(".tw-panes-tab").first().click();
    await settle(page);
  }
}
async function testViewport(viewport) {
  const suffix = `${viewport.width}x${viewport.height}`;
  const { context, page } = await createContext(viewport);
  await run(suffix + " list and keyboard Back/Forward", async () => {
    const start = baseHref();
    await page.goto(start);
    await settle(page);
    const before = await observe(page);
    check(
      suffix + " initial list pane",
      viewport.width > 800 || before.activePane === "navigation",
      before,
    );
    check(
      suffix + " long response list",
      before.rows >= 20 && before.listScrollHeight > before.listClientHeight,
      {
        rows: before.rows,
        listScrollHeight: before.listScrollHeight,
        listClientHeight: before.listClientHeight,
      },
    );
    check(suffix + " list no horizontal overflow", !before.overflow);
    await capture(page, "list-" + suffix);
    const first = page
      .locator(".wb-response-list [data-evidence-attempt] a[id]")
      .first();
    const id = await first.getAttribute("id");
    const attempt = await first
      .locator("..")
      .getAttribute("data-evidence-attempt");
    const expectedURL = new URL(await first.getAttribute("href"), origin).href;
    await tabToRow(page, id);
    const originState = await observe(page);
    await page.keyboard.press("Enter");
    await page.waitForURL(expectedURL);
    await settle(page);
    const selected = await observe(page);
    check(
      suffix + " keyboard Enter opens actual record",
      selected.activeId === "response-detail-title" &&
        (viewport.width > 800 || selected.activePane === "main"),
      selected,
    );
    check(
      suffix + " selected record appears near page top",
      selected.record?.y >= 0 && selected.record.y < 600,
      { record: selected.record },
    );
    await expectExact(page, recordMap.get(attempt), suffix + " selected");
    await capture(page, "selected-" + suffix);
    report.observations.push({ label: suffix + " geometry", ...selected });
    await page.goBack();
    await page.waitForURL(start);
    await settle(page);
    const back = await observe(page);
    check(
      suffix + " F1 native Back restores originating row focus",
      back.activeId === id,
      { expectedFocus: id, ...back },
    );
    check(
      suffix + " Back restores list position",
      Math.abs(back.listScrollTop - originState.listScrollTop) <= 4,
      { before: originState.listScrollTop, after: back.listScrollTop },
    );
    await capture(page, "back-" + suffix);
    await page.goForward();
    await page.waitForURL(expectedURL);
    await settle(page);
    const forward = await observe(page);
    check(
      suffix + " Forward restores selected record",
      forward.selected === attempt &&
        (viewport.width > 800 || forward.activePane === "main"),
      forward,
    );
    await expectExact(page, recordMap.get(attempt), suffix + " forward");
    await page.reload();
    await settle(page);
    check(
      suffix + " direct selected refresh opens record",
      viewport.width > 800 || (await observe(page)).activePane === "main",
    );
  });
  await run(suffix + " list position and context", async () => {
    await page.goto(baseHref());
    await settle(page);
    const last = page
      .locator(".wb-response-list [data-evidence-attempt] a[id]")
      .last();
    await last.scrollIntoViewIfNeeded();
    const scroll = (await observe(page)).listScrollTop;
    const id = await last.getAttribute("id");
    const target = new URL(await last.getAttribute("href"), origin).href;
    await last.click();
    await page.waitForURL(target);
    await settle(page);
    await showNavigation(page);
    const returned = await observe(page);
    check(
      suffix + " list tab retains selected response and position",
      returned.selected && Math.abs(returned.listScrollTop - scroll) <= 4,
      {
        expectedScroll: scroll,
        actualScroll: returned.listScrollTop,
        rowId: id,
        selected: returned.selected,
      },
    );
    if (viewport.width <= 800) {
      await page.locator(".tw-panes-tab").nth(2).click();
    } else if (viewport.width <= 1240) {
      await page.locator(".tw-panes-context-trigger").click();
    }
    await settle(page);
    const source = page.locator(".tw-panes-context");
    check(
      suffix + " source context separately accessible",
      await source.isVisible(),
    );
    check(
      suffix + " source version preserved",
      (await source.textContent()).includes("Lesson version"),
    );
    check(
      suffix + " source text available",
      (await source.locator(".wb-source-text").count()) > 0,
    );
    await capture(page, "context-" + suffix);
    if (viewport.width > 800 && viewport.width <= 1240) {
      check(
        suffix + " tablet context uses modal drawer",
        await source.evaluate((element) => element.matches(":modal")),
      );
      await page.keyboard.press("Escape");
      await settle(page);
      check(
        suffix + " Escape closes reversible drawer",
        !(await source.isVisible()),
      );
      check(
        suffix + " drawer returns focus to opener",
        await page
          .locator(".tw-panes-context-trigger")
          .evaluate((element) => element === document.activeElement),
      );
    }
  });
  await run(suffix + " search/filter and unavailable selection", async () => {
    await page.goto(baseHref());
    await settle(page);
    await page.locator('input[name="q"]').fill("fictional");
    await page.locator('form[role="search"] button').click();
    await settle(page);
    const searchURL = page.url();
    check(
      suffix + " scoped search preserves concept",
      new URL(searchURL).searchParams.get("q") === "fictional" &&
        new URL(searchURL).searchParams.get("concept") === "transmission_delay",
    );
    const first = page
      .locator(".wb-response-list [data-evidence-attempt] a[id]")
      .first();
    if (await first.count()) {
      await first.click();
      await settle(page);
      await page.goBack();
      await settle(page);
      check(
        suffix + " Back preserves search and concept filters",
        new URL(page.url()).searchParams.get("q") === "fictional" &&
          (await page.locator('input[name="q"]').inputValue()) === "fictional",
      );
    }
    await page.goto(
      baseHref("transmission_delay", "no-matching-fictional-response-7f31"),
    );
    await settle(page);
    check(
      suffix + " unmatched search shows honest empty state",
      (await page.locator(".wb-evidence-results").textContent()).includes(
        "No responses match",
      ),
    );
    if (viewport.width <= 800)
      await page.locator(".tw-panes-tab").nth(1).click();
    await capture(page, "empty-" + suffix);
    check(
      suffix + " unselected has no invented original answer",
      (await page.locator(".wb-original-response").count()) === 0,
    );
  });
  await run(
    suffix + " retained identity outside search and empty context",
    async () => {
      const retained = records[0];
      const url = new URL(recordHref(retained));
      url.searchParams.set("q", "no-matching-fictional-response-7f31");
      await page.goto(url.href);
      await settle(page);
      await expectExact(page, retained, suffix + " retained outside search");
      check(
        suffix + " direct selected response remains despite search",
        (await page.locator(".tw-panes-panel--main").textContent()).includes(
          "outside the current search results",
        ),
      );
      await page.goto(
        baseHref("transmission_delay", "no-matching-fictional-response-7f31"),
      );
      await settle(page);
      if (viewport.width <= 800)
        await page.locator(".tw-panes-tab").nth(2).click();
      else if (viewport.width <= 1240)
        await page.locator(".tw-panes-context-trigger").click();
      await settle(page);
      check(
        suffix + " unselected source/context is honest",
        (await page.locator(".tw-panes-context").textContent()).includes(
          "Select a saved response",
        ) && (await page.locator(".wb-source-text").count()) === 0,
      );
      await capture(page, "empty-context-" + suffix);
    },
  );
  await run(suffix + " recorded evaluation states", async () => {
    for (const status of ["pending_review", "evaluation_failed", "accepted"]) {
      const record = records.find((item) =>
        item.evaluations.some(
          (evaluation) =>
            evaluation.validation_status === status &&
            (status !== "accepted" || evaluation.result?.uncertainty_reason),
        ),
      );
      assert(record, "Class fixture must contain " + status);
      const evaluation = record.evaluations.find(
        (item) => item.validation_status === status,
      );
      await page.goto(recordHref(record, evaluation));
      await settle(page);
      await expectExact(page, record, suffix + " " + status);
      const text = await page.locator(".tw-panes-panel--main").textContent();
      check(
        suffix + " " + status + " state preserved",
        status === "accepted"
          ? text.includes(evaluation.result.uncertainty_reason)
          : text.includes(evaluation.failure_reason),
        { attempt: record.attempt.id, evaluation: evaluation.id },
      );
      if (status !== "accepted")
        check(
          suffix + " " + status + " cannot prepare selected response",
          (await page
            .getByRole("link", { name: /Prepare from this response/ })
            .count()) === 0,
        );
      await capture(page, status + "-" + suffix);
    }
  });
  await run(
    suffix + " hash-only navigation from explicit record pane",
    async () => {
      await page.goto(baseHref());
      await settle(page);
      const row = page
        .locator(".wb-response-list [data-evidence-attempt] a[id]")
        .first();
      const rowId = await row.getAttribute("id");
      await row.click();
      await settle(page);
      const recordURL = page.url();
      check(
        suffix + " hash setup uses explicit record pane",
        new URL(recordURL).searchParams.get("workspacePane") === "main",
        { url: recordURL },
      );
      await page.evaluate((id) => {
        window.location.hash = id;
      }, rowId);
      await settle(page);
      const hashState = await observe(page);
      check(
        suffix + " hash-only row navigation reveals and focuses list",
        hashState.activeId === rowId &&
          (viewport.width > 800 || hashState.activePane === "navigation"),
        hashState,
      );
      await capture(page, "hash-only-list-" + suffix);
      await page.goBack();
      await settle(page);
      const restored = await observe(page);
      check(
        suffix + " Back after hash navigation returns to record",
        new URL(restored.url).hash === new URL(recordURL).hash &&
          (viewport.width > 800 || restored.activePane === "main"),
        restored,
      );
    },
  );
  await run(
    suffix + " assistance and bounded preparation selection",
    async () => {
      const assisted = records.find(
        (record) => record.attempt.assistance?.intervention_ids.length,
      );
      assert(assisted, "The class fixture includes displayed help");
      await page.goto(recordHref(assisted));
      await settle(page);
      const shown = assisted.interventions.filter(
        (item) =>
          item.delivery_status === "displayed" &&
          assisted.attempt.assistance.intervention_ids.includes(item.id),
      );
      if (viewport.width <= 800)
        await page.locator(".tw-panes-tab").nth(2).click();
      else if (viewport.width <= 1240)
        await page.locator(".tw-panes-context-trigger").click();
      await settle(page);
      const contextText = await page.locator(".tw-panes-context").textContent();
      check(
        suffix + " exact recorded help retained",
        shown.length > 0 &&
          shown.every((item) => contextText.includes(item.text_shown)),
        {
          attempt: assisted.attempt.id,
          shownInterventionIds: shown.map((item) => item.id),
        },
      );
      check(
        suffix + " exact lesson version retained",
        contextText.includes(
          assisted.attempt.question.content_ref.content_version,
        ),
      );
      await page.goto(baseHref());
      await settle(page);
      const choices = page.locator(".wb-seed-choice input");
      await choices.nth(0).check();
      await choices.nth(1).check();
      await settle(page);
      const form = await page
        .locator(".wb-evidence-results")
        .evaluate((element) => ({
          action: element.action,
          method: element.method,
          seeds: new FormData(element).getAll("seedAttempt"),
          assignment: new FormData(element).get("assignment"),
          returnTo: new FormData(element).get("returnTo"),
        }));
      check(
        suffix + " preparation is bounded read-only handoff",
        form.method === "get" &&
          new URL(form.action).pathname === "/teacher/interventions" &&
          form.seeds.length === 2 &&
          new Set(form.seeds).size === 2 &&
          form.assignment === fixture.assignment.id &&
          form.returnTo === "evidence",
        form,
      );
    },
  );
  await run(suffix + " longest complete original and direct hash", async () => {
    const longest = records.reduce((best, current) =>
      current.attempt.response_text.length > best.attempt.response_text.length
        ? current
        : best,
    );
    await page.goto(recordHref(longest));
    await settle(page);
    await expectExact(page, longest, suffix + " longest fixture answer");
    const answer = page.locator(".wb-original-response");
    await answer.scrollIntoViewIfNeeded();
    check(
      suffix + " longest answer is not visually clamped",
      await answer.evaluate((element) => {
        const style = getComputedStyle(element);
        return (
          !["hidden", "clip"].includes(style.overflowY) &&
          ["none", "0", ""].includes(style.webkitLineClamp)
        );
      }),
      { answerLength: longest.attempt.response_text.length },
    );
    await capture(page, "longest-original-" + suffix);
    await showNavigation(page);
    const selected = page.locator(".wb-response-list a[aria-current='true']");
    const rowId = await selected.getAttribute("id");
    const target = new URL(page.url());
    target.hash = rowId;
    target.searchParams.delete("workspacePane");
    await page.goto(target.href);
    await settle(page);
    const observation = await observe(page);
    check(
      suffix + " direct row hash opens and focuses response list",
      observation.activeId === rowId &&
        (viewport.width > 800 || observation.activePane === "navigation"),
      observation,
    );
  });
  await context.close();
}
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ]) {
    await run(`${viewport.width}x${viewport.height} setup`, () =>
      testViewport(viewport),
    );
  }
  await run("Actual browser 200% zoom", async () => {
    const observations = [];
    for (const zoom of [1, 2]) {
      const { context, page } = await createContext(undefined, zoom);
      const record = records.find(
        (item) => item.attempt.id === "50000000-0000-4000-8000-000000000001",
      );
      await page.goto(recordHref(record));
      await settle(page);
      const observation = await observe(page);
      observations.push(observation);
      await expectExact(page, record, `native${zoom * 100}`);
      check(
        `native${zoom * 100} selected record reachable`,
        observation.record?.y >= 0 &&
          observation.record?.y < observation.innerHeight &&
          !observation.overflow,
        observation,
      );
      await capture(page, "native" + zoom * 100);
      await context.close();
    }
    const [normal, doubled] = observations;
    check(
      "Native browser zoom is measured at 200 percent",
      Math.abs(doubled.devicePixelRatio / normal.devicePixelRatio - 2) < 0.05 &&
        Math.abs(normal.innerWidth / doubled.innerWidth - 2) < 0.05 &&
        doubled.rootZoom === "1",
      { normal, doubled },
    );
  });
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  check(
    "Read-only browsing sends no unexpected mutation or off-origin request",
    report.blockedRequests.length === 0,
    { blockedRequests: report.blockedRequests },
  );
  report.limitations.push(
    "The class fixture's longest original response is " +
      Math.max(...records.map((item) => item.attempt.response_text.length)) +
      " characters. This does not verify a 10,000-character answer.",
  );
  report.limitations.push(
    "No valid class fixture has missing approved passage content; empty/unselected source context is checked, unavailable passage fallback remains separately reported.",
  );
  report.status = report.checks.some((item) => item.status === "fail")
    ? "completed-with-failures"
    : "passed";
  report.finishedAt = new Date().toISOString();
  await saveReport();
  console.log(
    JSON.stringify(
      {
        status: report.status,
        checks: report.checks.length,
        failed: report.checks
          .filter((item) => item.status === "fail")
          .map((item) => item.label),
        output,
      },
      null,
      2,
    ),
  );
  if (report.status !== "passed") process.exitCode = 1;
}
