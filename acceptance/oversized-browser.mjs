import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { join } from "node:path";
const load = createRequire(import.meta.url);
const { chromium } = load(process.env.PLAYWRIGHT_MODULE || "playwright");
const [fixturePath, output] = process.argv.slice(2);
const f = JSON.parse(await readFile(fixturePath, "utf8"));
assert.equal(f.status, "passed");
assert.ok(
  ["http://localhost:3322/", "http://localhost:3325/"].some((base) =>
    f.browserUrl.startsWith(base),
  ),
);
assert.equal(
  existsSync(join(output, "report.json")),
  false,
  "Choose a fresh output directory; preserve previous oversized evidence reports.",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
const r = {
  sourceSha: f.sourceSha,
  category: "provider-disabled synthetic fixture/browser",
  fixture: f.assignmentId,
  startedAt: new Date().toISOString(),
  mutations: [],
  cases: [],
};
try {
  await page.goto(new URL("/login", f.browserUrl).href);
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL("**/teacher");
  await page.goto(f.browserUrl);
  await page
    .getByText("Choose a smaller starting set", { exact: true })
    .waitFor();
  page.on("request", (q) => {
    if (q.method() !== "GET")
      r.mutations.push({ method: q.method(), url: q.url() });
  });
  assert.equal(await page.getByRole("checkbox").count(), 61);
  assert.equal(
    await page
      .getByRole("button", { name: "Generate private draft", exact: true })
      .count(),
    0,
  );
  await page.screenshot({ path: join(output, "oversized-390.png") });
  r.cases.push({ id: "OV01 refuse61 without truncation", status: "pass" });
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("button", { name: "Review selected evidence", exact: true })
    .click();
  await page.waitForURL("**/*seedAttempt=*");
  await page.waitForLoadState("networkidle");
  await page
    .getByText("Selected starting responses", { exact: true })
    .first()
    .waitFor();
  const body = await page.locator("body").innerText();
  assert.match(body, /1 distinct students · 1 responses/);
  assert.ok(body.includes(f.created[0].response));
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Generate private draft", exact: true })
      .isEnabled(),
    true,
  );
  assert.equal(r.mutations.length, 0);
  await page.screenshot({ path: join(output, "narrowed-390.png") });
  r.cases.push({
    id: "OV02 explicit narrowing preserves exact evidence and makes generation available",
    status: "pass",
    selectedAttempt: f.created[0].attemptId,
    url: page.url(),
    nonGetRequests: 0,
  });
  r.status = "pass";
} catch (e) {
  r.status = "fail";
  r.error = e.message;
  process.exitCode = 1;
  await page.screenshot({ path: join(output, "failure.png") });
} finally {
  r.finishedAt = new Date().toISOString();
  await writeFile(join(output, "report.json"), JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r));
  await context.close();
  await browser.close();
}
