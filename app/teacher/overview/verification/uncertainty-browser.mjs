import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";

// Run after lessons:uncertainty:check, passing its logged category-free assignment
// ID and probe UUID. Uses only the fictional teacher account in a local origin.
const [assignment, probe] = process.argv.slice(2);
assert.match(assignment ?? "", /^[0-9a-f-]{36}$/);
assert.match(probe ?? "", /^[0-9a-f-]{36}$/);
const base = process.env.AUTH_URL;
assert.ok(base && ["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || import.meta.url,
);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const login = await context.request.post(`${base}/api/auth/sign-in/email`, {
  headers: { Origin: base },
  data: {
    email: process.env.DEMO_TEACHER_EMAIL,
    password: process.env.DEMO_TEACHER_PASSWORD,
  },
});
assert.equal(login.status(), 200);
const title = `No categories ${probe}`;
const url = `${base}/teacher?assignment=${assignment}&origin=synthetic_fixture`;
const response = await context.request.get(url);
assert.equal(response.status(), 200);
const raw = await response.text();
const page = await context.newPage();
const errors = [],
  writes = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (!["GET", "HEAD"].includes(r.method())) writes.push(r.method());
});
await page.addInitScript(() => {
  window.overviewStates = [];
  const visible = (element) =>
    Boolean(element && element.getBoundingClientRect().height > 0);
  new MutationObserver(() => {
    const next = {
      loading: visible(document.querySelector('.ov-loading[role="status"]')),
      overview: visible(document.querySelector("#overview-title")),
    };
    if (JSON.stringify(next) !== JSON.stringify(window.overviewStates.at(-1)))
      window.overviewStates.push(next);
  }).observe(document, { childList: true, subtree: true, attributes: true });
});
await page.goto(url, { waitUntil: "commit" });
await page.locator("#overview-title").waitFor({ state: "visible" });
await page
  .locator(".ov-assignment-title")
  .getByText(title, { exact: true })
  .waitFor();
await page
  .locator(".ov-assignment-title")
  .getByText(`Reserved category ${probe}`, { exact: true })
  .waitFor();
await page.locator('.ov-loading[role="status"]').waitFor({ state: "hidden" });
const rows = page.locator(".ov-priority").filter({ hasText: title });
assert.equal(await rows.count(), 3);
const decisions = rows.filter({ hasText: "uncertain latest evaluation" });
assert.equal(await decisions.count(), 2);
for (const text of await decisions.allTextContents())
  assert.match(
    text,
    /1 of 2 enrolled students have an uncertain latest evaluation/,
  );
assert.equal(
  await rows
    .filter({ hasText: "1 of 2 students haven’t answered in this view" })
    .count(),
  1,
);
const links = await decisions
  .getByRole("link", { name: "Review evidence" })
  .evaluateAll((elements) => elements.map((a) => a.href));
const states = await page.evaluate(() => window.overviewStates);
const out = "app/teacher/overview/verification/ci-followup";
await mkdir(out, { recursive: true });
await decisions.first().scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/uploaded-uncertainty.png` });
for (const link of links) {
  const target = new URL(link);
  assert.equal(target.searchParams.get("assignment"), assignment);
  for (const key of ["session", "attempt", "evaluation"])
    assert.ok(target.searchParams.get(key));
  await page.goto(link);
  await page.locator("#response-detail-title").waitFor({ state: "visible" });
  assert.ok(
    await page
      .getByText("I cannot explain these changes yet.", { exact: true })
      .count(),
  );
}
assert.deepEqual(errors, []);
assert.deepEqual(writes, []);
const result = {
  url,
  assignment,
  probe,
  serverResponseContainsFallback: raw.includes(
    "Loading authorized assignments and saved teaching work",
  ),
  serverResponseContainsResolvedTitle: raw.includes('id="overview-title"'),
  observedBrowserStates: states,
  finalOverviewVisible: true,
  finalLoadingVisible: false,
  uploadedPriorityRows: 3,
  uncertainConceptRows: 2,
  missingWorkRows: 1,
  bothOwnedUploadsInRail: true,
  exactEvidenceActionsOpened: links,
  errors,
  writes,
};
await writeFile(`${out}/browser.json`, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
await browser.close();
