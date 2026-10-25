import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { isAbsolute, join } from "node:path";
import { teacherReady, readinessSha256 } from "./browser-readiness.mjs";
const load = createRequire(import.meta.url);
const { chromium } = load(process.env.PLAYWRIGHT_MODULE || "playwright");
const [base, output, sha] = process.argv.slice(2);
const expectedSources = {
  "http://localhost:3355": "45326e243245c4941e2cefd0eab984bb7ee19765",
};
if (
  !Object.hasOwn(expectedSources, base ?? "") ||
  sha !== expectedSources[base] ||
  !output ||
  !isAbsolute(output)
)
  throw new Error(
    "This Workbench run requires the pinned recovery target and a fresh absolute output directory",
  );
await mkdir(output, { recursive: true });
if (existsSync(join(output, "report.json")))
  throw new Error("Choose a fresh output directory; preserve prior evidence.");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  }),
  page = await context.newPage();
const report = {
  readinessSha256,
  sourceSha: sha,
  harnessSha256: createHash("sha256")
    .update(readFileSync(new URL(import.meta.url)))
    .digest("hex"),
  base,
  category: "provider-disabled browser; synthetic fixture",
  result: "incomplete",
  browser: browser.version(),
  cases: [],
  requests: [],
  screenshots: [],
  startedAt: new Date().toISOString(),
  limitations: [
    "W01 opens a verified evidence URL directly; no priority-card click is claimed",
    "W06 checks a malformed duplicate-ID URL; genuine 61-response narrowing requires the separate oversized fixture",
    "Screen-reader and native 200% zoom unrun",
  ],
};
page.setDefaultTimeout(15000);
page.on("request", (r) => {
  if (r.method() !== "GET" && !r.url().includes("/api/auth/"))
    report.requests.push({ method: r.method(), url: r.url() });
});
const assignment = "30000000-0000-4000-8000-000000000001",
  attempt = "50000000-0000-4000-8000-000000000001",
  session = "40000000-0000-4000-8000-000000000001",
  evaluation = "60000000-0000-4000-8000-000000000001";
const exact = `/teacher/evidence?assignment=${assignment}&origin=synthetic_fixture&concept=transmission_delay&session=${session}&attempt=${attempt}&evaluation=${evaluation}`;
const plannedCases = [
  "W01 exact authorized evidence matches stored response",
  "W02 selected response persists to evidence preparation and back",
  "W03 exact evaluation return after full-session detour",
  ...[1440, 1024, 390, 320].map(
    (width) => `W04 selected detail usable ${width}`,
  ),
  "W05 cross-assignment evidence rejected",
  "W06 malformed over-limit URL returns explicit scope error",
  "W07 browsing does not mutate",
];
function summarize() {
  report.passed = report.cases
    .filter((item) => item.status === "pass")
    .map((item) => item.id);
  report.failed = report.cases
    .filter((item) => item.status === "fail")
    .map((item) => item.id);
  report.unrun = plannedCases.filter(
    (id) => !report.cases.some((item) => item.id === id),
  );
}
async function go(path, allowError = false) {
  let response = await page.goto(base + path);
  if (!response) {
    const expected = new URL(base + path);
    const landed = new URL(page.url());
    assert.equal(
      landed.origin + landed.pathname + landed.search,
      expected.origin + expected.pathname + expected.search,
    );
    // Same-document fragment navigation has no HTTP response; verify a fresh read.
    response = await page.reload();
  }
  if (!allowError)
    assert.ok(
      response?.ok(),
      `Unexpected HTTP ${response?.status()} for ${path}`,
    );
  await teacherReady(page, path, { allowError });
}
async function shot(name) {
  await page.screenshot({ path: join(output, `${name}.png`) });
  report.screenshots.push(`${name}.png`);
}
async function check(id, fn) {
  const startedAt = new Date().toISOString();
  try {
    const details = await fn();
    report.cases.push({
      id,
      status: "pass",
      startedAt,
      finishedAt: new Date().toISOString(),
      details,
    });
  } catch (e) {
    const name = id.replace(/[^a-zA-Z0-9-]/g, "-");
    const failure = {
      id,
      status: "fail",
      startedAt,
      finishedAt: new Date().toISOString(),
      error: e.message,
      url: page.url(),
    };
    try {
      await shot(`${name}-failed`);
      await writeFile(
        join(output, `${name}-failed.txt`),
        await page.locator("body").innerText(),
      );
      failure.bodyArtifact = `${name}-failed.txt`;
    } catch (artifactError) {
      failure.artifactError = artifactError.message;
    }
    report.cases.push(failure);
  }
  summarize();
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
}
try {
  await go("/login");
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL("**/teacher");
  await teacherReady(page, "/teacher");
  await check(
    "W01 exact authorized evidence matches stored response",
    async () => {
      await go(exact);
      const response = await context.request.get(
        `${base}/api/teacher/sessions/${session}`,
      );
      assert.equal(response.status(), 200);
      const original = await response.json();
      const storedAttempt = original.attempts.find(
        (item) => item.id === attempt,
      );
      assert.ok(
        storedAttempt,
        "Expected synthetic original attempt is missing",
      );
      assert.equal(original.session.assignment_id, assignment);
      assert.equal(storedAttempt.current_evaluation_id, evaluation);
      assert.equal(
        original.evaluations.find((item) => item.id === evaluation)
          ?.validation_status,
        "accepted",
      );
      assert.equal(
        await page.locator(".wb-original-response").innerText(),
        storedAttempt.response_text,
      );
      const sessionHref = await page
        .getByRole("link", { name: "Inspect full session and assistance" })
        .getAttribute("href");
      assert.ok(sessionHref.endsWith(`#evaluation-${evaluation}`));
      await shot("exact-original");
      return {
        entry: "Direct verified evidence URL",
        originalAttempt: attempt,
        evaluation,
        sessionHref,
      };
    },
  );
  await check(
    "W02 selected response persists to evidence preparation and back",
    async () => {
      await page
        .locator(".wb-response-item")
        .filter({
          has: page.locator(
            "a[href*=" + JSON.stringify("attempt=" + attempt) + "]",
          ),
        })
        .getByRole("checkbox")
        .check();
      assert.deepEqual(new URL(page.url()).searchParams.getAll("seedAttempt"), [
        attempt,
      ]);
      await page
        .getByRole("button", { name: "Prepare intervention", exact: true })
        .click();
      await teacherReady(page, "/teacher/interventions");
      const url = new URL(page.url());
      assert.equal(url.pathname, "/teacher/interventions");
      assert.deepEqual(url.searchParams.getAll("seedAttempt"), [attempt]);
      await page
        .getByText("Selected starting responses", { exact: true })
        .waitFor();
      await shot("prepared-selected-evidence");
      await page
        .getByRole("link", { name: "Back to your investigation", exact: true })
        .click();
      await teacherReady(page, "/teacher/evidence");
      assert.equal(new URL(page.url()).searchParams.get("attempt"), attempt);
      assert.deepEqual(new URL(page.url()).searchParams.getAll("seedAttempt"), [
        attempt,
      ]);
      return { selection: [attempt] };
    },
  );
  await check(
    "W03 exact evaluation return after full-session detour",
    async () => {
      await go(exact);
      await page
        .getByRole("link", { name: "Inspect full session and assistance" })
        .click();
      await page.waitForURL(
        (url) => url.pathname === `/teacher/sessions/${session}`,
      );
      await teacherReady(page, `/teacher/sessions/${session}`);
      assert.equal(new URL(page.url()).hash, `#evaluation-${evaluation}`);
      const back = page.getByRole("link", {
        name: "Back to Evidence",
        exact: true,
      });
      await back.click();
      await page.waitForURL((url) => url.pathname === "/teacher/evidence");
      await teacherReady(page, "/teacher/evidence");
      assert.equal(
        new URL(page.url()).searchParams.get("evaluation"),
        evaluation,
      );
      return { evaluation };
    },
  );
  for (const width of [1440, 1024, 390, 320])
    await check(`W04 selected detail usable ${width}`, async () => {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 900 : width === 1024 ? 768 : 844,
      });
      await go(exact + "#response-detail-title");
      await page
        .getByRole("heading", { name: "Original response", exact: true })
        .scrollIntoViewIfNeeded();
      const geometry = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(geometry.scroll <= width + 1);
      assert.ok(await page.locator(".wb-original-response").isVisible());
      await shot(`selected-response-${width}`);
      return geometry;
    });
  await check("W05 cross-assignment evidence rejected", async () => {
    await go(
      exact.replace(assignment, "30000000-0000-4000-8000-000000000099"),
      true,
    );
    const t = await page.locator("body").innerText();
    assert.match(t, /isn.t available|not found|404/i);
    assert.ok(!t.includes("Both double."));
    return "Unavailable; no original response disclosed";
  });
  await check(
    "W06 malformed over-limit URL returns explicit scope error",
    async () => {
      const q = new URLSearchParams({
        assignment,
        origin: "synthetic_fixture",
        concept: "transmission_delay",
      });
      for (let i = 0; i < 61; i++) q.append("seedAttempt", attempt);
      await go("/teacher/interventions?" + q, true);
      const t = await page.locator("body").innerText();
      await shot("oversized-selection");
      assert.match(
        t,
        /narrow|too many|60/i,
        "Malformed duplicate-ID URL is denied but has no actionable scope hint (post-submission UX; not the genuine >60 accepted-evidence case)",
      );
      return { text: t };
    },
  );
  await check("W07 browsing does not mutate", async () => {
    assert.equal(report.requests.length, 0);
    return { nonAuthMutations: report.requests };
  });
} catch (error) {
  report.cases.push({
    id: "harness-execution",
    status: "fail",
    error: error.message,
  });
} finally {
  summarize();
  report.finishedAt = new Date().toISOString();
  report.result = report.cases.some((item) => item.status === "fail")
    ? "fail"
    : report.unrun.length
      ? "incomplete"
      : "pass";
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.cases));
  await context.close();
  await browser.close();
  if (report.cases.some((c) => c.status === "fail")) process.exitCode = 1;
}
