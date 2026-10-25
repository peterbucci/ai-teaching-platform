/** GET-only density capture. Use reviewed guarded-browser after explicit runtime GO. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [outArg, fixtureArg] = process.argv.slice(2);
assert(outArg && fixtureArg && process.env.ACCEPTANCE_STATE_DIR);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fixtureBytes = readFileSync(fixtureArg);
const fixture = JSON.parse(fixtureBytes);
const manifest = JSON.parse(
  readFileSync(path.join(process.env.ACCEPTANCE_STATE_DIR, "manifest.json")),
);
assert.equal(manifest.sourceSha, "462cfb1b31d9108cec70d18b6553bd45048d2eed");
assert.equal(manifest.sourceTree, "03cca1fed3900a122e689c4a512afadd9052e5af");
assert.equal(manifest.project, "lp-v22-shell5");
assert.equal(manifest.origin, "http://localhost:3350");
assert.equal(manifest.target, "shell");
assert.equal(manifest.paidModelCallsAuthorized, false);
assert.equal(fixture.source_sha, manifest.sourceSha);
assert.equal(fixture.source_tree, manifest.sourceTree);
assert.equal(fixture.project, manifest.project);
assert.equal(fixture.origin, manifest.origin);
assert.equal(fixture.fixture_kind, "separate-published-density");
assert.equal(fixture.mode, "density-assignment");
assert.equal(fixture.status, "completed");
assert.equal(fixture.actual_model_calls, 0);
assert.equal(fixture.injected_evaluation_calls, 0);
assert.deepEqual(fixture.counts, { concepts: 5, questions: 19, passages: 13 });
assert.equal(fixture.curated_provenance.authored_bank_question_ids.length, 15);
assert.equal(fixture.curated_provenance.sequence_added_question_ids.length, 4);
assert.deepEqual(fixture.checks, {
  approved: true,
  published: true,
  assignment_created: true,
  activated: false,
});
assert.equal(fixture.published_version, "1");
assert.equal(fixture.assignments.length, 4);
assert.equal(new Set(fixture.assignments.map((item) => item.class_id)).size, 4);
assert.equal(
  new Set(fixture.assignments.map((item) => item.assignment_id)).size,
  4,
);
assert(
  fixture.assignments.every(
    (item) => item.enrolled === 0 && item.activated === false,
  ),
);
assert.equal(fixture.existing_evidence_before, fixture.existing_evidence_after);
assert.equal(fixture.other_content_before, fixture.other_content_after);
assert.equal(
  fixture.harness_sha256,
  hash(
    readFileSync(
      new URL("../runner-final/published-density-fixture.mjs", import.meta.url),
    ),
  ),
);
for (const id of [fixture.lesson_id, fixture.assignment_id, fixture.source_id])
  assert.match(id, /^[a-f0-9-]{36}$/);
assert.notEqual(fixture.lesson_id, fixture.original_journey.lesson_id);
assert.notEqual(fixture.assignment_id, fixture.original_journey.assignment_id);
const publishedPath = `/teacher/lessons/${fixture.lesson_id}?version=1`;
const assignmentPath = `/teacher/assignments?assignment=${fixture.assignment_id}&view=review`;
assert.equal(fixture.paths.published, publishedPath);
assert.equal(fixture.paths.inactive_assignment, assignmentPath);
const output = path.resolve(outArg);
await mkdir(output);
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE,
);
const report = {
  status: "running",
  started_at: new Date().toISOString(),
  source_sha: manifest.sourceSha,
  source_tree: manifest.sourceTree,
  project: manifest.project,
  origin: manifest.origin,
  fixture_report_sha256: hash(fixtureBytes),
  script_sha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  category:
    "Published attributed-copy density, actual application captures; distinct from the manual R4 journey",
  identity: {
    lesson_id: fixture.lesson_id,
    source_id: fixture.source_id,
    source_version: fixture.source_version,
    published_version: fixture.published_version,
    assignment_id: fixture.assignment_id,
    content_ref: fixture.content_ref,
  },
  paid_calls: 0,
  actual_model_verification: "unrun",
  screen_reader_verification: "unrun",
  viewport_method:
    "CSS viewport at deviceScaleFactor1; not native zoom or device emulation",
  expected_states: 24,
  expected_counts: fixture.counts,
  limits: fixture.limits,
  mutating_requests: [],
  blocked_requests: [],
  page_errors: [],
  states: [],
};
let browser;
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}
async function counts(page) {
  const result = {
    concepts: await page
      .locator(".aw-outline a")
      .filter({ hasText: /^O\d+ · / })
      .count(),
    questions: await page
      .locator(".aw-outline a")
      .filter({ hasText: /^Q\d+ · / })
      .count(),
    passages: await page.locator(".aw-reading-passage").count(),
    immutable_question_articles: await page
      .locator("#lesson-questions > article")
      .count(),
  };
  assert.equal(result.concepts, 5);
  assert.equal(result.questions, 19);
  assert.equal(result.passages, 13);
  assert.equal(result.immutable_question_articles, 19);
  return result;
}
async function geometry(page) {
  return page.evaluate(() => {
    const selectors = [
      ".tw-shell",
      ".tw-header",
      ".tw-course-nav",
      ".tw-mobile-nav",
      ".aw-workspace",
      ".aw-pane-switch",
      "[data-pane]",
      ".aw-editor-content",
      ".aw-reading-content",
      ".aw-outline",
      ".aw-outline h2",
      ".aw-outline-link",
      ".aw-reading-passage",
      "#lesson-questions",
      ".la-section",
      ".awa-page-heading",
    ];
    const elements = [
      ...new Set(
        selectors.flatMap((selector) => [
          ...document.querySelectorAll(selector),
        ]),
      ),
    ];
    return {
      viewport: { width: innerWidth, height: innerHeight },
      horizontal_overflow: document.documentElement.scrollWidth > innerWidth,
      scrollY,
      active_pane: document
        .querySelector(".aw-workspace")
        ?.getAttribute("data-active-pane"),
      focus: {
        tag: document.activeElement?.tagName,
        id: document.activeElement?.id,
        text: document.activeElement?.textContent?.trim().slice(0, 140),
      },
      fonts: [...document.fonts].map((font) => ({
        family: font.family,
        status: font.status,
        weight: font.weight,
      })),
      elements: elements.flatMap((element) => {
        const rect = element.getBoundingClientRect(),
          style = getComputedStyle(element);
        if (
          !rect.width ||
          !rect.height ||
          style.display === "none" ||
          style.visibility === "hidden"
        )
          return [];
        return [
          {
            tag: element.tagName,
            class: element.className,
            pane: element.getAttribute("data-pane"),
            label: element.getAttribute("aria-label"),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            scrollTop: element.scrollTop,
            scrollHeight: element.scrollHeight,
            display: style.display,
            columns: style.gridTemplateColumns,
            padding: style.padding,
            gap: style.gap,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            fontWeight: style.fontWeight,
          },
        ];
      }),
    };
  });
}
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE,
  });
  report.browser = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  let loginAllowed = true;
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (
      url.origin === manifest.origin &&
      ["GET", "HEAD"].includes(request.method())
    )
      return route.continue();
    if (
      url.origin === manifest.origin &&
      loginAllowed &&
      request.method() === "POST" &&
      url.pathname === "/api/auth/demo-sign-in"
    ) {
      loginAllowed = false;
      report.mutating_requests.push({
        method: request.method(),
        path: url.pathname,
        reason: "authorized fictional teacher login",
      });
      return route.continue();
    }
    report.blocked_requests.push({
      method: request.method(),
      url: request.url(),
      reason: "capture allows same-origin reads and one demo login only",
    });
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => report.page_errors.push(error.message));
  await page.goto(manifest.origin + "/login");
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL("**/teacher");
  loginAllowed = false;
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const state of [
      "published-top",
      "published-outline",
      "published-question-list",
      "published-reading",
      "published-assignment-context",
      "inactive-assignment-review",
    ]) {
      const entry = { state, viewport: { width, height }, status: "unrun" };
      try {
        const pathname =
          state === "inactive-assignment-review"
            ? assignmentPath
            : publishedPath;
        const response = await page.goto(manifest.origin + pathname);
        assert.equal(response.status(), 200);
        await page.waitForURL(manifest.origin + pathname);
        entry.path = pathname;
        entry.http_status = response.status();
        if (state !== "inactive-assignment-review") {
          await page.locator(".aw-workspace").waitFor();
          await page
            .getByRole("heading", { name: "Published version 1", exact: true })
            .waitFor();
          assert.equal(
            await page.locator(".aw-lesson-identity h1").textContent(),
            fixture.title,
          );
          entry.counts = await counts(page);
          if (state === "published-outline") {
            if (width <= 800)
              await page
                .getByRole("navigation", { name: "Authoring panes" })
                .getByRole("button", { name: "Outline", exact: true })
                .click();
            await page
              .locator('[data-pane="outline"]')
              .waitFor({ state: "visible" });
          } else if (state === "published-question-list") {
            await page.locator("#review-questions > summary").click();
            await page
              .locator("#lesson-questions")
              .waitFor({ state: "visible" });
            await page.locator("#lesson-questions").scrollIntoViewIfNeeded();
          } else if (state === "published-reading") {
            if (width <= 800)
              await page
                .getByRole("navigation", { name: "Authoring panes" })
                .getByRole("button", { name: "Reading", exact: true })
                .click();
            else if (width <= 1240)
              await page
                .getByRole("button", { name: "Reading ↗", exact: true })
                .click();
            await page
              .locator('[data-pane="reading"]')
              .waitFor({ state: "visible" });
          } else if (state === "published-assignment-context") {
            const section = page.locator(".la-section").filter({
              has: page.getByRole("heading", {
                name: "Class assignments",
                exact: true,
              }),
            });
            await section.scrollIntoViewIfNeeded();
            assert.equal(await section.getByRole("link").count(), 4);
            const hrefs = await section
              .getByRole("link")
              .evaluateAll((links) =>
                links.map((link) => link.getAttribute("href")).sort(),
              );
            assert.deepEqual(
              hrefs,
              fixture.assignments
                .map(
                  (item) =>
                    `/teacher/assignments?assignment=${item.assignment_id}`,
                )
                .sort(),
            );
            assert((await section.innerText()).includes("Awaiting activation"));
          }
        } else {
          await page
            .getByRole("heading", { name: "Review assignment", exact: true })
            .waitFor();
          assert(
            (await page.locator(".awa-page-heading").innerText()).includes(
              fixture.title,
            ),
          );
          assert.equal(
            await page.locator(".awa-page-heading .awa-status").innerText(),
            "Not active yet",
          );
          entry.counts = {
            assignment_rows_in_new_lesson: 4,
            activation: "inactive",
          };
        }
        await settle(page);
        entry.metrics = await geometry(page);
        entry.screenshot = `${state}-${width}x${height}.png`;
        await page.screenshot({
          path: path.join(output, entry.screenshot),
          fullPage: false,
        });
        await writeFile(
          path.join(output, entry.screenshot.replace(/\.png$/, ".txt")),
          await page.locator("body").innerText(),
        );
        entry.status = entry.metrics.horizontal_overflow
          ? "captured-with-overflow"
          : "captured";
      } catch (error) {
        entry.status = "failed";
        entry.error = error.message;
        entry.diagnostic_screenshot = `${state}-${width}x${height}-failed.png`;
        await page
          .screenshot({ path: path.join(output, entry.diagnostic_screenshot) })
          .catch(() => {});
      }
      report.states.push(entry);
    }
  }
  assert.equal(report.states.length, report.expected_states);
  assert(report.states.every((entry) => entry.status === "captured"));
  assert.equal(report.mutating_requests.length, 1);
  assert.equal(report.blocked_requests.length, 0);
  assert.equal(report.page_errors.length, 0);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  report.finished_at = new Date().toISOString();
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify({
    status: report.status,
    output,
    states: report.states.length,
  }),
);
