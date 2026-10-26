import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { join } from "node:path";
const load = createRequire(import.meta.url);
const { chromium } = load(process.env.PLAYWRIGHT_MODULE || "playwright");
const [base, output, sha] = process.argv.slice(2);
const expectedSources = {
  "http://localhost:3322": "5d6363d2867a6f0250f8220db0474342b1241d00",
  "http://localhost:3325": "545b880749c757f7502a9bfa7fd127afdf290afd",
};
if (
  !Object.hasOwn(expectedSources, base ?? "") ||
  sha !== expectedSources[base]
)
  throw new Error(
    "This Workbench run requires a pinned isolated PR116 or combined target",
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
  sourceSha: sha,
  harnessSha256: createHash("sha256")
    .update(readFileSync(new URL(import.meta.url)))
    .digest("hex"),
  base,
  category: "provider-disabled browser; synthetic fixture",
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
async function go(path) {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
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
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
}
try {
  await go("/login");
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL("**/teacher");
  await page.waitForLoadState("networkidle");
  await check(
    "W01 exact authorized evidence matches stored response",
    async () => {
      await go(exact);
      const response = await context.request.get(
        `${base}/api/teacher/sessions/${session}`,
      );
      assert.equal(response.status(), 200);
      const original = await response.json();
      assert.equal(
        await page.locator(".wb-original-response").innerText(),
        original.attempts[0].response_text,
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
      await page.waitForLoadState("networkidle");
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
      await page.waitForLoadState("networkidle");
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
      await page.waitForLoadState("networkidle");
      assert.equal(new URL(page.url()).hash, `#evaluation-${evaluation}`);
      const back = page.getByRole("link", {
        name: "Back to Evidence",
        exact: true,
      });
      await back.click();
      await page.waitForURL((url) => url.pathname === "/teacher/evidence");
      await page.waitForLoadState("networkidle");
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
    await go(exact.replace(assignment, "30000000-0000-4000-8000-000000000099"));
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
      await go("/teacher/interventions?" + q);
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
  report.finishedAt = new Date().toISOString();
  report.result = report.cases.some((item) => item.status === "fail")
    ? "fail"
    : "pass";
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.cases));
  await context.close();
  await browser.close();
  if (report.cases.some((c) => c.status === "fail")) process.exitCode = 1;
}
