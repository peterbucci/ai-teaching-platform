// Focused provider-disabled UI verification; run only after the coordinator grants runtime access.
// Usage: node context-browser-checks.mjs <isolated-state-directory> <new-output-directory>
// Only login may send a mutation. All subsequent navigations are GET/HEAD.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const [stateArg, outArg] = process.argv.slice(2);
assert.ok(
  stateArg && outArg,
  "Pass isolated state and fresh output directories.",
);
const state = resolve(stateArg),
  out = resolve(outArg);
assert.ok(!existsSync(out), "Choose a fresh output directory.");
const manifest = JSON.parse(readFileSync(join(state, "manifest.json"), "utf8"));
const origin = new URL(manifest.origin);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
assert.equal(manifest.paidModelCallsAuthorized, false);
assert.match(manifest.configurationCategory, /provider-disabled/);
const env = readFileSync(join(state, ".env.acceptance"), "utf8");
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"]) {
  const value = env.split(/\r?\n/).find((line) => line.startsWith(key + "="));
  assert.equal(
    value,
    key + "=",
    "Model configuration must be explicitly empty.",
  );
}
await mkdir(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE ??
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.BROWSER_EXECUTABLE ??
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const report = {
  startedAt: new Date().toISOString(),
  sourceSha: manifest.sourceSha,
  sourceTree: manifest.sourceTree,
  project: manifest.project,
  origin: origin.origin,
  browser: browser.version(),
  runnerSha256: createHash("sha256")
    .update(readFileSync(new URL(import.meta.url)))
    .digest("hex"),
  category:
    "focused authenticated GET-only context navigation; existing fictional data; provider-disabled",
  checks: [],
  blockedRequests: [],
  pageErrors: [],
  limitations: [
    "No model verification",
    "No screen-reader verification",
    "Focus and keyboard restoration not established by URL checks",
    "No synthetic records created; missing prerequisites are marked unrun",
  ],
};
let loggedIn = false;
await context.route("**/*", async (route) => {
  const req = route.request(),
    url = new URL(req.url());
  if (
    url.origin !== origin.origin &&
    !["data:", "blob:"].includes(url.protocol)
  ) {
    report.blockedRequests.push({
      method: req.method(),
      url: req.url(),
      reason: "external network disallowed",
    });
    return route.abort();
  }
  if (
    !["GET", "HEAD"].includes(req.method()) &&
    !(url.pathname === "/api/auth/demo-sign-in" && !loggedIn)
  ) {
    report.blockedRequests.push({
      method: req.method(),
      url: req.url(),
      reason: "application mutation disallowed",
    });
    return route.abort();
  }
  return route.continue();
});
page.on("pageerror", (error) => report.pageErrors.push(error.message));
const absolute = (path) => new URL(path, origin).href;
const shellLink = (name) =>
  page
    .getByRole("navigation", { name: "Teacher navigation", exact: true })
    .first()
    .getByRole("link", { name, exact: true });
async function screenshot(name) {
  await page.screenshot({ path: join(out, name + ".png"), fullPage: true });
  return name + ".png";
}
async function goto(path) {
  await page.goto(absolute(path), { waitUntil: "networkidle" });
}
async function run(id, operation) {
  const check = { id, status: "unrun", screenshots: [] };
  report.checks.push(check);
  try {
    await operation(check);
  } catch (error) {
    check.status = "test-error";
    check.error = error.message;
    check.url = page.url();
    check.screenshots.push(
      await screenshot(id + "-test-error").catch(() => null),
    );
  }
  await writeFile(
    join(out, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
let assignments = [];
try {
  await goto("/login");
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL("**/teacher");
  loggedIn = true;
  await goto("/teacher/assignments");
  assignments = await page
    .locator(".awa-assignment-row")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({ href: n.getAttribute("href"), text: n.textContent })),
    );

  await run("C1-selected-assignment-shell", async (check) => {
    await goto("/teacher/assignments");
    const first = await page
      .locator('.awa-assignment-row[aria-current="true"]')
      .getAttribute("href");
    const globalFirst = new URL(first, origin).searchParams.get("assignment");
    const classes = await page
      .locator('.awa-filters select[name="class"] option')
      .evaluateAll((nodes) =>
        nodes
          .map((n) => ({ value: n.value, text: n.textContent }))
          .filter((n) => n.value),
      );
    let found = false;
    for (const item of classes) {
      await goto(
        "/teacher/assignments?" +
          new URLSearchParams({ class: item.value, status: "all" }),
      );
      const selected = page.locator('.awa-assignment-row[aria-current="true"]');
      if (!(await selected.count())) continue;
      const selectedId = new URL(
        await selected.getAttribute("href"),
        origin,
      ).searchParams.get("assignment");
      if (selectedId === globalFirst) continue;
      found = true;
      check.filteredClass = item.text;
      check.expectedAssignment = selectedId;
      check.selectedTitle = await page
        .locator("#selected-assignment-heading")
        .innerText();
      check.beforeUrl = page.url();
      check.shellHref = await shellLink("Evidence").getAttribute("href");
      check.screenshots.push(await screenshot("C1-before-filtered-assignment"));
      await shellLink("Evidence").click();
      await page.waitForURL("**/teacher/evidence?**");
      check.afterUrl = page.url();
      check.actualAssignment = await page
        .locator('select[name="assignment"]')
        .inputValue();
      check.status =
        check.actualAssignment === selectedId
          ? "not-reproduced"
          : "defect-confirmed";
      check.screenshots.push(await screenshot("C1-after-shell-evidence"));
      break;
    }
    if (!found)
      check.reason =
        "No second-class non-default selected assignment available; multi-class prerequisite absent.";
  });

  await run("C2-progress-session-return", async (check) => {
    for (const assignment of assignments) {
      const id = new URL(assignment.href, origin).searchParams.get(
        "assignment",
      );
      await goto(
        "/teacher/assignments?" +
          new URLSearchParams({ assignment: id, view: "progress" }),
      );
      const cell = page.locator(".ap-grid a.ap-cell").first();
      if (!(await cell.count())) continue;
      await cell.click();
      await page.locator(".ap-evidence-item").first().waitFor();
      const full = page
        .locator(".ap-evidence-item")
        .getByRole("link", {
          name: "Open full session evidence →",
          exact: true,
        })
        .first();
      if (!(await full.count())) continue;
      check.beforeUrl = page.url();
      check.expectedAssignment = id;
      check.sessionHref = await full.getAttribute("href");
      check.screenshots.push(
        await screenshot("C2-before-selected-progress-cell"),
      );
      await full.click();
      await page.locator(".lp-evidence-page").waitFor();
      const back = page.locator(".lp-evidence-page > a").first();
      check.backText = await back.innerText();
      check.backHref = await back.getAttribute("href");
      check.screenshots.push(await screenshot("C2-session-return-link"));
      await Promise.all([
        page.waitForURL(absolute(check.backHref)),
        back.click(),
      ]);
      check.afterUrl = page.url();
      check.status =
        new URL(page.url()).pathname === "/teacher/assignments"
          ? "not-reproduced"
          : "defect-confirmed";
      return;
    }
    check.reason =
      "No assignment with a recorded progress cell and full-session link available.";
  });

  await run("C3-saved-intervention-shell-context", async (check) => {
    for (const assignment of assignments) {
      const id = new URL(assignment.href, origin).searchParams.get(
        "assignment",
      );
      await goto(
        "/teacher/interventions?" + new URLSearchParams({ assignment: id }),
      );
      const draft = page.locator(".lp-intervention-drafts a").first();
      if (!(await draft.count())) continue;
      const canonical = new URL(await draft.getAttribute("href"), origin);
      check.savedHref = canonical.href;
      check.savedConcept = canonical.searchParams.get("concept");
      check.savedOrigin = canonical.searchParams.get("origin");
      canonical.searchParams.set("concept", "acceptance-stale-concept");
      canonical.searchParams.set(
        "origin",
        check.savedOrigin === "live_demo" ? "synthetic_fixture" : "live_demo",
      );
      await goto(canonical.href);
      await page
        .getByRole("heading", { name: "Interventions", exact: true })
        .waitFor();
      check.openedUrl = page.url();
      check.displayedHeadings = await page
        .getByRole("heading")
        .allTextContents();
      check.shellHref = await shellLink("Evidence").getAttribute("href");
      check.screenshots.push(await screenshot("C3-saved-draft-stale-url"));
      const shell = new URL(check.shellHref, origin);
      check.status =
        shell.searchParams.get("concept") !== check.savedConcept ||
        shell.searchParams.get("origin") !== check.savedOrigin
          ? "defect-confirmed"
          : "not-reproduced";
      await Promise.all([
        page.waitForURL(shell.href),
        shellLink("Evidence").click(),
      ]);
      check.destinationUrl = page.url();
      check.destinationText = (await page.locator("body").innerText()).slice(
        0,
        1000,
      );
      check.screenshots.push(await screenshot("C3-shell-destination"));
      return;
    }
    check.reason =
      "No saved intervention draft is available in the authorized fictional assignments.";
  });

  await run("C4-search-context-leak", async (check) => {
    await goto("/teacher/lessons");
    const title = page.locator(".la-lesson-name").first();
    if (!(await title.count())) {
      check.reason =
        "No authorized lesson title is available to reproduce title-search propagation.";
      return;
    }
    const query = (await title.innerText()).trim().slice(0, 100);
    check.lessonSearch = query;
    await page
      .getByRole("textbox", { name: "Find a lesson", exact: true })
      .fill(query);
    await page
      .locator("form.la-search")
      .getByRole("button", { name: "Search", exact: true })
      .click();
    await page.waitForLoadState("networkidle");
    check.lessonUrl = page.url();
    check.shellHref = await shellLink("Evidence").getAttribute("href");
    check.screenshots.push(await screenshot("C4-lesson-title-search"));
    await shellLink("Evidence").click();
    await page.waitForURL("**/teacher/evidence?**");
    check.evidenceUrl = page.url();
    check.evidenceSearch = await page
      .getByRole("searchbox", { name: "Find a response", exact: true })
      .inputValue();
    check.status =
      check.evidenceSearch === query ? "defect-confirmed" : "not-reproduced";
    check.screenshots.push(await screenshot("C4-title-query-in-evidence"));
  });
} catch (error) {
  report.fatalError = error.message;
  report.status = "failed";
  report.failureUrl = page.url();
  await screenshot("fatal").catch(() => {});
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  report.status ??= report.checks.some((c) => c.status === "test-error")
    ? "test-errors"
    : report.checks.some((c) => c.status === "defect-confirmed")
      ? "defects-confirmed"
      : "completed";
  await writeFile(
    join(out, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
console.log(
  JSON.stringify({
    report: join(out, "report.json"),
    status: report.status,
    checks: report.checks.map(({ id, status, reason }) => ({
      id,
      status,
      reason,
    })),
  }),
);
