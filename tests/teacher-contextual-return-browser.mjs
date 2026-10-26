// Original R01/R02 fixture. receiver mode supplies the agreed outgoing contract
// in browser DOM only: it does NOT certify G/H's not-yet-integrated page links.
// node --experimental-strip-types tests/teacher-contextual-return-browser.mjs <origin> <fresh-out> before|receiver|integrated
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { teacherWorkspaceHref } from "../lib/teacher/workspace-contracts.ts";
const [origin, outArg, mode] = process.argv.slice(2);
assert(["before", "receiver", "integrated"].includes(mode));
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const out = resolve(outArg);
mkdirSync(out);
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
  timezoneId: "UTC",
  locale: "en-US",
});
const report = {
  mode,
  origin,
  sourceSha: process.env.K_SOURCE_SHA ?? "see verification manifest",
  harnessSha256: createHash("sha256")
    .update(readFileSync(new URL(import.meta.url)))
    .digest("hex"),
  fixture: "original R01/R02 teacher-recovery-02, application07efb7f",
  checks: [],
  errors: [],
  blocked: [],
};
await context.route("**/*", async (route) => {
  const req = route.request();
  const u = new URL(req.url());
  if (
    u.origin !== origin ||
    (!["GET", "HEAD"].includes(req.method()) &&
      u.pathname !== "/api/auth/demo-sign-in")
  ) {
    report.blocked.push({ method: req.method(), path: u.pathname });
    return route.abort();
  }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", (error) => report.errors.push(String(error)));
page.setDefaultTimeout(15000);
const assignment = "382f0724-3800-4e6c-8a15-40b4813cb4ab";
const sessionId = "c619a811-af67-4aeb-9348-686fe439db98";
const concept = "d1edb362-fa58-4e34-b8af-08c1f685e583";
const name = "Student One (fictional)";
const backLink = () =>
  page.locator(".lp-evidence-page").getByRole("link", { name: /^Back to / });
async function shot(label) {
  await page.screenshot({ path: resolve(out, label + ".png") });
}
async function settle() {
  await page.waitForTimeout(250);
}
try {
  await page.goto(origin + "/login");
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/teacher"));
  const response = await context.request.get(
    origin + "/api/teacher/sessions/" + sessionId,
  );
  assert.equal(response.status(), 200);
  const evidence = await response.json();
  const student = evidence.session.student_id;
  assert.equal(evidence.session.assignment_id, assignment);
  const original = {
    assignment,
    origin: "live_demo",
    concept,
    student,
    session: sessionId,
  };
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const kind of ["students", "insights"]) {
      const params = {
        assignment,
        origin: "live_demo",
        ...(kind === "students" ? { q: name } : { concept }),
        ...(mode === "integrated"
          ? kind === "students"
            ? {
                student,
                participation: "submitted",
                workspacePane: "main",
                rosterPane: "main",
                concept,
              }
            : { returnTo: "insights" }
          : {}),
      };
      let start =
        origin +
        "/teacher/" +
        kind +
        "?" +
        new URLSearchParams(params) +
        (kind === "insights"
          ? mode === "integrated"
            ? `#concept-${concept}`
            : "#responses"
          : "");
      await page.goto(start);
      await settle();
      if (mode === "integrated" && kind === "insights")
        await page.waitForURL(
          (url) => url.searchParams.get("view") === "ideas",
        );
      start = page.url();
      const link = page
        .locator(
          mode === "integrated" &&
            kind === "insights" &&
            process.env.K_LATEST_ONLY === "true"
            ? 'a.ci-session-link[href^="/teacher/sessions/"]'
            : `a[href^="/teacher/sessions/${sessionId}"]`,
        )
        .first();
      await link.evaluate((el) => {
        let p = el.parentElement;
        while (p) {
          if (p instanceof HTMLDetailsElement) p.open = true;
          p = p.parentElement;
        }
      });
      const unmodifiedHref = await link.getAttribute("href");
      if (mode === "receiver")
        await link.evaluate(
          (el, href) => {
            // A real Next Link keeps its old href in React props. This explicit
            // test adapter must be a plain anchor, not a mutated React Link.
            const replacement = el.cloneNode(true);
            replacement.setAttribute("href", href);
            el.replaceWith(replacement);
          },
          teacherWorkspaceHref("/teacher/sessions/" + sessionId, {
            ...original,
            student: kind === "students" ? student : undefined,
            returnTo: kind === "students" ? "students" : "insights",
            ...(kind === "students"
              ? { q: name, participation: "submitted", rosterPane: "main" }
              : {}),
          }),
        );
      await link.focus();
      await page.keyboard.press("Enter");
      await backLink().waitFor();
      const opened = page.url(),
        back = await backLink().getAttribute("href"),
        text = await backLink().innerText();
      await page.reload();
      await backLink().waitFor();
      assert.equal(await backLink().getAttribute("href"), back);
      await page.goBack();
      assert.equal(page.url(), start);
      await page.goForward();
      await backLink().waitFor();
      assert.equal(page.url(), opened);
      await shot(`${kind}-${width}-session`);
      await backLink().focus();
      await page.keyboard.press("Enter");
      await settle();
      const returned = new URL(page.url());
      const preserves =
        returned.pathname === "/teacher/" + kind &&
        Object.entries(params).every(
          ([k, v]) => k === "rosterPane" || returned.searchParams.get(k) === v,
        );
      if (mode === "before")
        assert.equal(
          preserves,
          false,
          "Original confirmed defect must reproduce",
        );
      else assert.equal(preserves, true);
      if (mode !== "before") {
        assert.equal(
          returned.hash,
          kind === "students"
            ? mode === "integrated" &&
              new URL(opened).searchParams.get("attempt")
              ? `#roster-attempt-${new URL(opened).searchParams.get("attempt")}`
              : `#roster-student-${student}`
            : `#concept-${concept}`,
        );
        for (const field of [
          "session",
          "attempt",
          "evaluation",
          "seedAttempt",
          "request",
          "draft",
        ])
          assert.equal(returned.searchParams.has(field), false);
      }
      if (mode === "integrated") {
        await page.waitForFunction(
          (id) => document.activeElement?.id === id,
          decodeURIComponent(returned.hash.slice(1)),
        );
        const focus = await page.evaluate(() => {
          const r = document.activeElement?.getBoundingClientRect();
          return (
            !!r &&
            r.width > 0 &&
            r.height > 0 &&
            r.bottom > 0 &&
            r.top < innerHeight
          );
        });
        assert(focus, "Displayed return restores visible destination focus");
      }
      await page.locator("#main-content h1").first().waitFor();
      await settle();
      await shot(`${kind}-${width}-returned`);
      const after = page.url();
      await page.reload();
      assert.equal(page.url(), after);
      report.checks.push({
        kind,
        width,
        status: mode === "before" ? "defect reproduced" : "passed",
        start,
        unmodifiedHref,
        opened,
        back,
        text,
        returned: after,
        nativeBackForward: "passed",
        reload: "passed",
        destinationFocus:
          mode === "receiver" ? "G/H integration pending" : undefined,
      });
    }
  }
  if (mode !== "before") {
    if (mode === "integrated") {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const named of [true, false]) {
          await page.goto(
            origin +
              "/teacher/insights?assignment=30000000-0000-4000-8000-000000000001&origin=synthetic_fixture&returnTo=patterns&view=concerns#patterns",
          );
          await page
            .locator(".ci-list a")
            .first()
            .waitFor({ state: "attached" });
          const selections = await page
            .locator(".ci-list a")
            .evaluateAll((links) =>
              links.map((link) => link.getAttribute("href")),
            );
          const selected = selections.find(
            (href) =>
              new URL(href, origin).searchParams.has("misconception") === named,
          );
          assert(
            selected,
            named
              ? "Named concern fixture exists"
              : "Uncategorized concern fixture exists",
          );
          await page.goto(new URL(selected, origin).href);
          await page.locator("#patterns").waitFor();
          const original = page.url();
          const entry = page.locator("a.ci-session-link").first();
          await entry.evaluate((el) => {
            let p = el.parentElement;
            while (p) {
              if (p instanceof HTMLDetailsElement) p.open = true;
              p = p.parentElement;
            }
          });
          await entry.focus();
          await page.keyboard.press("Enter");
          await backLink().waitFor();
          const href = await backLink().getAttribute("href");
          const returned = new URL(href, origin),
            expected = new URL(original);
          for (const field of [
            "assignment",
            "origin",
            "concept",
            "misconception",
            "returnTo",
          ])
            assert.equal(
              returned.searchParams.get(field),
              expected.searchParams.get(field),
            );
          assert.equal(returned.hash, "#patterns");
          await page.reload();
          await backLink().waitFor();
          assert.equal(await backLink().getAttribute("href"), href);
          await backLink().click();
          await page.locator("#patterns").waitFor();
          await page.waitForFunction(
            () => document.activeElement?.id === "patterns",
          );
          await shot(`concern-${named ? "named" : "uncategorized"}-${width}`);
          report.checks.push({
            case: named
              ? "named concern return"
              : "uncategorized concern return",
            width,
            status: "passed",
            original,
            href,
            destinationFocus: "patterns",
          });
        }
      }
    }
    const good = teacherWorkspaceHref("/teacher/sessions/" + sessionId, {
      ...original,
      returnTo: "insights",
    });
    if (mode === "integrated") {
      const changed = new URL("/teacher/students", origin);
      changed.search = new URLSearchParams({
        assignment,
        origin: "all",
        student,
        q: "Student One",
        participation: "all",
        workspacePane: "main",
        concept,
      });
      await page.goto(changed.href);
      const entry = page
        .locator(`a[href^="/teacher/sessions/${sessionId}"]`)
        .first();
      await entry.click();
      await backLink().waitFor();
      const href = await backLink().getAttribute("href"),
        returned = new URL(href, origin);
      for (const [key, value] of changed.searchParams)
        assert.equal(returned.searchParams.get(key), value);
      await backLink().click();
      await page.locator("#roster-main").waitFor();
      report.checks.push({
        case: "changed Roster origin/search/participation",
        status: "passed",
        href,
      });
    }
    await page.goto(new URL(good, origin).href);
    await backLink().waitFor();
    await page
      .locator('button[aria-controls="teacher-workspace-switcher"]:visible')
      .first()
      .click();
    const switched = page
      .locator(
        '#teacher-workspace-switcher .tw-switcher-assignments a[href*="assignment=30000000-0000-4000-8000-000000000001"]',
      )
      .first();
    await switched.click();
    await page.waitForURL((url) => url.pathname === "/teacher/assignments");
    const switchURL = new URL(page.url());
    assert.equal(
      switchURL.searchParams.get("assignment"),
      "30000000-0000-4000-8000-000000000001",
    );
    for (const field of [
      "concept",
      "student",
      "misconception",
      "session",
      "attempt",
      "evaluation",
      "q",
      "participation",
      "rosterPane",
      "workspacePane",
    ])
      assert.equal(switchURL.searchParams.has(field), false);
    report.checks.push({
      case: "actual cross-assignment switch clears stale context",
      status: "passed",
      url: page.url(),
    });
    for (const [key, value] of [
      ["assignment", "30000000-0000-4000-8000-000000000001"],
      ["student", "10000000-0000-4000-8000-000000000003"],
      ["concept", "removed-concept"],
      ["misconception", "removed-category"],
      ["attempt", "50000000-0000-4000-8000-000000000001"],
      ["origin", "synthetic_fixture"],
    ]) {
      const invalid = new URL(good, origin);
      invalid.searchParams.set(key, value);
      await page.goto(invalid.href);
      await page
        .getByRole("heading", { name: "This evidence isn’t available" })
        .waitFor();
      assert.equal(await backLink().count(), 0);
      report.checks.push({ case: "invalid " + key, status: "passed" });
    }
    await page.goto(origin + "/teacher/sessions/" + sessionId);
    await backLink().waitFor();
    const direct = new URL(await backLink().getAttribute("href"), origin);
    assert.equal(direct.searchParams.get("assignment"), assignment);
    assert.equal(direct.hash, "#responses");
    report.checks.push({ case: "legacy direct deep link", status: "passed" });
  }
  assert.deepEqual(report.blocked, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(
  JSON.stringify({
    status: report.status,
    checks: report.checks.length,
    error: report.error,
    errors: report.errors,
  }),
);
