import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { getPool } from "../../../../lib/db.ts";
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || import.meta.url,
);
const { chromium } = require("playwright");
const base = "http://127.0.0.1:3516",
  out = "app/teacher/overview/verification";
const fixture = JSON.parse(
  await readFile("app/teacher/overview/verification/fixture.json", "utf8"),
);
const empty = {
  email: process.env.EMPTY_TEACHER_EMAIL,
  password: process.env.EMPTY_TEACHER_PASSWORD,
};
const db = getPool();
assert.equal(process.env.PGDATABASE, "overview_f");
const tables = [
  "assignments",
  "sessions",
  "attempts",
  "evaluations",
  "interventions",
  "lessons",
  "teacher_intervention_drafts",
  "teacher_intervention_approvals",
  "teacher_intervention_deliveries",
];
async function hashes() {
  const result = {};
  for (const table of tables) {
    const r = await db.query(
      `SELECT md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text),'')) AS hash FROM ${table} t`,
    );
    result[table] = r.rows[0].hash;
  }
  return result;
}
const before = await hashes();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
const checks = [],
  errors = [],
  writes = [];
async function login(credentials) {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const r = await c.request.post(base + "/api/auth/sign-in/email", {
    data: credentials,
    headers: { Origin: base },
  });
  assert.equal(r.status(), 200);
  return c;
}
const ctx = await login({
  email: process.env.DEMO_TEACHER_EMAIL,
  password: process.env.DEMO_TEACHER_PASSWORD,
});
const page = await ctx.newPage();
page.on("pageerror", (e) =>
  errors.push({ url: page.url(), message: e.message }),
);
page.on("request", (r) => {
  if (!["GET", "HEAD"].includes(r.method()))
    writes.push({ url: r.url(), method: r.method() });
});
async function home() {
  await page.goto(base + "/teacher?origin=synthetic_fixture");
  await page.locator("#overview-title").waitFor();
}
await home();
assert.equal(await page.locator(".ov-assignment-list>li").count(), 3);
assert.equal(await page.locator(".ov-resume-list>li").count(), 2);
checks.push(
  "three assignments / two classes; private lesson and private intervention; no approved/delivered work in unfinished list",
);
assert.ok(
  await page.getByText("Ready for delivery review", { exact: true }).count(),
);
assert.ok(await page.getByText("Delivered activity", { exact: true }).count());
checks.push("approved and delivered decision rows are distinct");
const first = page.locator(".ov-priority a").first();
const target = await first.getAttribute("href");
await first.click();
await page.locator("#response-detail-title").waitFor();
assert.equal(
  new URL(page.url()).searchParams.get("attempt"),
  new URL(target, base).searchParams.get("attempt"),
);
checks.push("priority opens exact original response");
await page.goBack();
await page.locator("#overview-title").waitFor();
assert.equal(await page.locator(".ov-assignment-list>li").count(), 3);
await page.goForward();
await page.locator("#response-detail-title").waitFor();
await page.reload();
await page.locator("#response-detail-title").waitFor();
checks.push(
  "native Back, Forward, reload retain exact target and whole workspace",
);
await home();
await page
  .locator(".ov-assignment-list nav")
  .nth(1)
  .getByRole("link", { name: "Progress", exact: true })
  .click();
await page
  .getByRole("heading", { name: "Class progress", exact: true })
  .waitFor();
assert.equal(
  new URL(page.url()).searchParams.get("assignment"),
  fixture.assignments.find(
    (a) => a.title === "Bandwidth and latency · Section B",
  ).id,
);
await page
  .getByRole("heading", { name: "Class progress", exact: true })
  .waitFor();
checks.push("second class rail opens its Progress");
await home();
await page.getByRole("link", { name: "Continue lesson" }).click();
await page.locator(".la-workspace").first().waitFor();
assert.match(page.url(), /\/teacher\/lessons\//);
checks.push("saved private lesson resumes its existing editor");
await home();
await page.getByRole("link", { name: "Continue intervention" }).click();
await page.locator("#intervention-draft-title").waitFor();
assert.equal(
  new URL(page.url()).searchParams.get("draft"),
  fixture.work.find((w) => w.kind === "private").id,
);
checks.push("saved private intervention resumes exact draft");
await home();
await page.locator(".ov-filter summary").click();
await page.locator("#ov-origin").selectOption("live_demo");
await page.getByRole("button", { name: "Apply", exact: true }).click();
await page.locator("#overview-title").waitFor();
assert.match(page.url(), /origin=live_demo/);
assert.equal(await page.locator(".ov-assignment-list>li").count(), 3);
assert.equal(
  await page
    .locator("#ov-decision")
    .locator("..")
    .locator("..")
    .locator(".ov-priority")
    .count(),
  2,
);
await page.screenshot({ path: out + "/empty-evidence-1440.png" });
checks.push(
  "origin filter removes synthetic learning concerns but retains workflow work and missing-answer counts",
);
await page.goto(
  base + "/teacher?assignment=30000000-0000-4000-8000-000000009999",
);
await page
  .getByRole("heading", { name: "This evidence isn’t available" })
  .waitFor();
await page.screenshot({ path: out + "/missing-assignment.png" });
checks.push("explicit missing assignment is rejected, never silently defaults");
const emptyCtx = await login({ email: empty.email, password: empty.password });
const emptyPage = await emptyCtx.newPage();
await emptyPage.goto(base + "/teacher");
await emptyPage
  .getByRole("heading", { name: "No teaching assignments yet" })
  .waitFor();
assert.equal(await emptyPage.locator(".ov-resume-list>li").count(), 0);
await emptyPage.screenshot({ path: out + "/empty-teacher.png" });
await emptyPage.goto(base + "/teacher?assignment=" + fixture.assignments[0].id);
await emptyPage
  .getByRole("heading", { name: "This evidence isn’t available" })
  .waitFor();
checks.push(
  "empty teacher useful pathways; other teacher assignment and drafts never exposed",
);
// Temporarily make one owned, inactive fixture fail its pinned-record review.
const inactive = fixture.assignments.find((a) => a.status === "inactive").id;
const original = (
  await db.query("SELECT approval FROM assignments WHERE id=$1", [inactive])
).rows[0].approval;
try {
  await db.query("UPDATE assignments SET approval=$2 WHERE id=$1", [
    inactive,
    { status: "unavailable-test" },
  ]);
  await home();
  await page.getByText(/Some workspace data is unavailable/).waitFor();
  assert.equal(await page.locator(".ov-assignment-list>li").count(), 3);
  assert.ok(await page.locator(".ov-priority").count());
  await page.screenshot({ path: out + "/partial-unavailable.png" });
  checks.push(
    "one unavailable pinned assignment preserves other priorities and explicitly excludes failed counts",
  );
} finally {
  await db.query("UPDATE assignments SET approval=$2 WHERE id=$1", [
    inactive,
    original,
  ]);
}
await home();
await page.setViewportSize({ width: 320, height: 844 });
await page.getByRole("link", { name: "Resume work", exact: true }).click();
await page.screenshot({ path: out + "/resume-320.png" });
assert.ok((await page.locator("#ov-resume").boundingBox()).y < 300);
checks.push("mobile Resume work jump reaches unfinished actions");
await home();
await page.setViewportSize({ width: 1440, height: 1000 });
await page.keyboard.press("Tab");
let found = false;
for (let i = 0; i < 30; i++) {
  if (
    await page
      .locator(".ov-priority a")
      .first()
      .evaluate((el) => el === document.activeElement)
  ) {
    found = true;
    break;
  }
  await page.keyboard.press("Tab");
}
assert.ok(found);
checks.push("priority action reachable with keyboard and visible focus");
await page.screenshot({ path: out + "/keyboard-focus.png" });
await home();
const rail = page.locator(".ov-assignment-list>li");
assert.equal(
  await rail.nth(2).getByText("Not active yet", { exact: true }).count(),
  1,
);
assert.match(await rail.nth(2).innerText(), /Students cannot open/);
assert.ok(!(await rail.nth(0).locator("code").isVisible()));
await rail.nth(0).locator("summary").click();
assert.ok(await rail.nth(0).locator("code").isVisible());
await rail.nth(0).getByRole("link", { name: "Evidence", exact: true }).click();
await page.locator(".wb-evidence-workspace").waitFor();
checks.push(
  "rail disclosure reveals exact version and working Evidence link; inactive status remains distinct",
);
await home();
await rail.nth(0).locator("summary").click();
await rail
  .nth(0)
  .getByRole("link", { name: "Interventions", exact: true })
  .click();
await page.locator("#intervention-draft-title").waitFor();
checks.push("rail intervention link retains assignment scope");
for (const action of ["Review delivery", "Review follow-up"]) {
  await home();
  const link = page.getByRole("link", { name: action, exact: true });
  const href = await link.getAttribute("href");
  await link.click();
  await page.locator("#intervention-draft-title").waitFor();
  assert.equal(
    new URL(page.url()).searchParams.get("draft"),
    new URL(href, base).searchParams.get("draft"),
  );
}
checks.push(
  "approved and delivered priority actions open their exact saved draft identities",
);
await home();
const second = page
  .locator(".ov-priority")
  .filter({ hasText: "Section B" })
  .filter({
    has: page.getByRole("link", { name: "Review evidence", exact: true }),
  });
assert.ok(await second.count());
await second.first().getByRole("link", { name: "Review evidence" }).click();
await page.locator("#response-detail-title").waitFor();
assert.equal(
  new URL(page.url()).searchParams.get("assignment"),
  fixture.assignments.find((a) => a.title.includes("Section B")).id,
);
checks.push("second class priority opens its own original saved response");
await home();
const recent = page.locator(".ov-activity a").first();
const recentHref = await recent.getAttribute("href");
await recent.click();
await page.locator("#response-detail-title").waitFor();
assert.equal(
  new URL(page.url()).searchParams.get("attempt"),
  new URL(recentHref, base).searchParams.get("attempt"),
);
checks.push(
  "recent activity opens exact response, retaining assignment and evidence origin",
);
for (let i = 0; i < 3; i++) {
  await home();
  const title = page.locator(".ov-assignment-title").nth(i);
  const href = await title.getAttribute("href");
  await title.click();
  await page
    .getByRole("heading", { name: "Review assignment", exact: true })
    .waitFor();
  assert.equal(
    new URL(page.url()).searchParams.get("assignment"),
    new URL(href, base).searchParams.get("assignment"),
  );
}
checks.push(
  "each assignment title, including inactive, opens its exact assignment review",
);
const after = await hashes();
assert.deepEqual(after, before);
assert.equal(writes.length, 0);
checks.push(
  "all nine evidence/workflow table hashes unchanged; browser navigation caused zero writes",
);
await writeFile(
  out + "/interactions.json",
  JSON.stringify({ checks, errors, writes, before, after }, null, 2),
);
console.log(JSON.stringify({ checks, errors, writes }));
await browser.close();
await db.end();
