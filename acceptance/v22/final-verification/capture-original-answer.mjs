/** Run only under reviewed guarded-browser.mjs after the coordinator grants runtime GO. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [outArg, fixtureArg] = process.argv.slice(2);
assert(
  outArg && fixtureArg && process.env.ACCEPTANCE_STATE_DIR,
  "Use guarded-browser with a fresh output and exact run05 fixture receipt.",
);
const output = path.resolve(outArg);
const bytes = readFileSync(fixtureArg);
const hash = (value) => createHash("sha256").update(value).digest("hex");
assert.equal(
  hash(bytes),
  "7e99672e7cf7e6689d1bcc53d57a68f1a052eecd6b09ee77ea7a8d9de3970051",
);
const fixture = JSON.parse(bytes);
const manifest = JSON.parse(
  readFileSync(
    path.join(process.env.ACCEPTANCE_STATE_DIR, "manifest.json"),
    "utf8",
  ),
);
assert.equal(manifest.sourceSha, "462cfb1b31d9108cec70d18b6553bd45048d2eed");
assert.equal(manifest.sourceTree, "03cca1fed3900a122e689c4a512afadd9052e5af");
assert.equal(manifest.project, "lp-v22-shell5");
assert.equal(manifest.target, "shell");
assert.equal(manifest.origin, "http://localhost:3350");
assert.equal(manifest.paidModelCallsAuthorized, false);
assert.equal(
  fixture.student_session_id,
  "07c3336c-108a-4e79-bca3-02c382b3756a",
);
assert.equal(
  fixture.presented_attempt_id,
  "280d524b-0b14-41df-a287-3e29bfdd5646",
);
assert.equal(fixture.assignment_id, "ebc4eb03-22ba-409b-b1c4-10bc54a86967");
await mkdir(output); // Refuse any existing folder; guard never creates it for us.
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE,
);
const report = {
  status: "running",
  startedAt: new Date().toISOString(),
  sourceSha: manifest.sourceSha,
  sourceTree: manifest.sourceTree,
  origin: manifest.origin,
  project: manifest.project,
  category:
    "Read-only teacher original-answer viewport capture after authorized demo login",
  fixture_report_sha256: hash(bytes),
  script_sha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  identity: {
    assignment: fixture.assignment_id,
    session: fixture.student_session_id,
    attempt: fixture.presented_attempt_id,
    source: fixture.source_id,
    source_version: fixture.source_version,
    lesson: fixture.lesson_id,
    published_version: fixture.published_version,
  },
  provenance_limit:
    "Source/lesson identity comes from the pinned run05 reconciliation receipt; this capture independently verifies route, attempt element and exact rendered response text.",
  paid_calls: 0,
  mutating_requests: [],
  blocked_requests: [],
  page_errors: [],
  states: [],
};
let browser;
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
    if (url.origin !== manifest.origin) {
      report.blocked_requests.push({
        method: request.method(),
        url: request.url(),
        reason: "off-origin",
      });
      return route.abort("blockedbyclient");
    }
    if (["GET", "HEAD", "OPTIONS"].includes(request.method()))
      return route.continue();
    if (
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
      reason: "read-only capture",
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
  const pathname = `/teacher/sessions/${fixture.student_session_id}?assignment=${fixture.assignment_id}&origin=all`;
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    const response = await page.goto(manifest.origin + pathname);
    assert.equal(response.status(), 200);
    const answer = page.locator(
      `#attempt-${fixture.presented_attempt_id} .lp-evidence-answer`,
    );
    await answer.waitFor({ state: "visible" });
    assert.equal(await answer.count(), 1);
    assert.equal(await answer.textContent(), fixture.original_response);
    await answer.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "nearest" }),
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const metrics = await answer.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      const fixedVisible = [...document.querySelectorAll("header, nav")]
        .filter((node) => {
          const box = node.getBoundingClientRect(),
            style = getComputedStyle(node);
          return (
            ["fixed", "sticky"].includes(style.position) &&
            box.width > 0 &&
            box.height > 0 &&
            box.bottom > 0 &&
            box.top < innerHeight
          );
        })
        .map((node) => {
          const box = node.getBoundingClientRect();
          return {
            tag: node.tagName,
            label: node.getAttribute("aria-label"),
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          };
        });
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        viewport: { width: innerWidth, height: innerHeight },
        scrollY,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        lineHeight: styles.lineHeight,
        fixedVisible,
      };
    });
    assert(
      metrics.y >= 110 && metrics.bottom <= height - 85,
      "Original answer must fit between navigation regions",
    );
    assert.equal(metrics.horizontalOverflow, false);
    const screenshot = `teacher-original-answer-selected-${width}x${height}.png`;
    await page.screenshot({
      path: path.join(output, screenshot),
      fullPage: false,
    });
    await writeFile(
      path.join(output, screenshot.replace(/\.png$/, ".txt")),
      await page.locator("body").innerText(),
    );
    report.states.push({
      status: "captured",
      pathname,
      selector: `#attempt-${fixture.presented_attempt_id} .lp-evidence-answer`,
      viewport: { width, height },
      exact_original_response_matched: true,
      response_text_sha256: hash(await answer.textContent()),
      metrics,
      screenshot,
    });
  }
  assert.equal(report.states.length, 4);
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
  report.finishedAt = new Date().toISOString();
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify({
    status: report.status,
    captures: report.states.length,
    output,
  }),
);
