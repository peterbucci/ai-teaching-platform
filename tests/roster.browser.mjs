// Run against the isolated, authenticated fictional database; no model calls.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.PLAYWRIGHT_PATH
    ? pathToFileURL(path.join(process.env.PLAYWRIGHT_PATH, "index.mjs")).href
    : "playwright"
);
const base = process.env.ROSTER_BASE_URL || "http://127.0.0.1:3417";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const output = path.resolve(
  process.env.ROSTER_EVIDENCE_DIR ||
    "app/teacher/students/verification/screenshots",
);
fs.mkdirSync(output, { recursive: true });
const root =
  "/teacher/students?assignment=30000000-0000-4000-8000-000000000001&origin=all";
const student = "10000000-0000-4000-8000-000000000002";
const checks = [];
const receiver = process.env.ROSTER_EXPECT_RECEIVER === "true";
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const login = await context.request.post(base + "/api/auth/demo-sign-in", {
      headers: { Origin: base },
      data: { role: "teacher" },
    });
    assert.equal(login.status(), 200);
    async function ready() {
      await page.locator(".roster").waitFor();
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector(".roster"))
            .getPropertyValue("--roster-line")
            .trim() !== "",
      );
      await page.evaluate(() => document.fonts.ready);
      if (new URL(page.url()).searchParams.has("student")) {
        await page.locator(".roster--selected").waitFor();
        const width = page.viewportSize().width;
        await page
          .locator(
            `.tw-panes[data-layout="${width <= 800 ? "compact" : width <= 1240 ? "medium" : "wide"}"]`,
          )
          .waitFor();
        if (width > 1240)
          await page.locator(".tw-panes-context[open]").waitFor();
      }
      assert.equal(
        await page
          .locator("[id^=roster-student-]")
          .evaluateAll(
            (nodes) => new Set(nodes.map((n) => n.id)).size === nodes.length,
          ),
        true,
      );
    }
    async function follow(link) {
      const href = await link.getAttribute("href");
      await link.click();
      await page.waitForURL(new URL(href, base).href);
      await ready();
    }
    async function capture(name) {
      await ready();
      await page.screenshot({
        path: path.join(output, name + ".png"),
        animations: "disabled",
        caret: "initial",
      });
    }
    async function noOverflow() {
      const dims = await page.evaluate(() => ({
        window: window.innerWidth,
        body: document.documentElement.scrollWidth,
      }));
      assert.ok(dims.body <= dims.window + 1, JSON.stringify(dims));
    }
    await page.goto(base + root);
    await ready();
    assert.equal(await page.locator(".roster-table tbody tr").count(), 24);
    checks.push("Authenticated populated 24-student roster");
    await page
      .getByLabel("Find a student", { exact: true })
      .fill("Student One");
    await page
      .getByLabel("Participation", { exact: true })
      .selectOption("submitted");
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await ready();
    assert.equal(await page.locator(".roster-table tbody tr").count(), 1);
    const originRoster = page.url();
    await follow(page.locator(`#roster-student-${student}`));
    await page.getByRole("heading", { name: "Every saved session" }).waitFor();
    assert.ok((await page.locator(".roster-session").count()) > 1);
    assert.ok((await page.locator(".roster-help").count()) > 0);
    assert.ok(
      (await page
        .locator(".roster-summary")
        .getByText("Delivered", { exact: true })
        .count()) > 0,
    );
    const allIdeas = page.url();
    await follow(
      page
        .getByRole("navigation", { name: "Student concepts" })
        .getByRole("link", { name: /^Transmission delay/ }),
    );
    const focused = page.url();
    assert.equal(
      new URL(focused).searchParams.get("concept"),
      "transmission_delay",
    );
    await page.goBack();
    await page.waitForURL(allIdeas);
    await ready();
    assert.equal(page.url(), allIdeas);
    await page.goForward();
    await page.waitForURL(focused);
    await ready();
    assert.equal(page.url(), focused);
    await page.reload();
    await ready();
    assert.equal(page.url(), focused);
    checks.push(
      "Search, participation, student selection, concept, reload and Back/Forward",
    );
    const link = page
      .getByRole("link", { name: "Read exact session →", exact: true })
      .first();
    const target = new URL(await link.getAttribute("href"), base);
    assert.equal(target.searchParams.get("returnTo"), "students");
    assert.equal(target.searchParams.get("participation"), "submitted");
    assert.equal(target.searchParams.get("q"), "Student One");
    assert.ok(target.searchParams.get("attempt"));
    assert.ok(target.searchParams.get("evaluation"));
    await link.click();
    await page
      .locator(`#attempt-${target.searchParams.get("attempt")}`)
      .waitFor();
    const displayedBack = page
      .getByRole("link", { name: /Back to (Roster|Students|student)/i })
      .first();
    const backHref = await displayedBack.getAttribute("href");
    await follow(displayedBack);
    assert.equal(new URL(page.url()).searchParams.get("student"), student);
    if (receiver) {
      assert.equal(
        new URL(page.url()).searchParams.get("participation"),
        "submitted",
      );
      assert.equal(
        new URL(page.url()).hash,
        `#roster-attempt-${target.searchParams.get("attempt")}`,
      );
      await page.waitForFunction(
        (id) => document.activeElement?.id === id,
        `roster-attempt-${target.searchParams.get("attempt")}`,
      );
      checks.push(
        "Exact session → displayed Back restores roster filters, concept, pane and focus",
      );
    } else
      checks.push(
        "Exact-session navigation and baseline Back verified; full return requires Agent K receiver. Baseline Back href: " +
          backHref,
      );
    await follow(
      page.getByRole("link", { name: "← Back to Roster", exact: true }),
    );
    if (receiver) {
      assert.equal(
        new URL(page.url()).searchParams.get("participation"),
        "submitted",
      );
      assert.equal(
        new URL(page.url()).searchParams.get("q"),
        new URL(originRoster).searchParams.get("q"),
      );
    }
    for (const [width, height] of [
      [1440, 1000],
      [1024, 768],
      [390, 844],
      [320, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(base + root);
      await ready();
      await noOverflow();
      await capture(`roster-${width}x${height}`);
      if (width <= 800) {
        await page.locator(".roster-table-scroll").evaluate((e) => {
          e.scrollIntoView({ block: "start" });
          e.scrollLeft = 250;
        });
        await capture(`grid-${width}x${height}`);
      }
      await page.goto(
        base +
          root +
          "&student=" +
          student +
          "&concept=transmission_delay&rosterPane=main&workspacePane=main",
      );
      await ready();
      await noOverflow();
      await capture(`student-${width}x${height}`);
      if (width <= 800) {
        await page.locator(".roster-answer").first().scrollIntoViewIfNeeded();
        await capture(`work-${width}x${height}`);
      }
      if (width <= 800) {
        const tab = page.getByRole("tab", { name: "Work log", exact: true });
        await tab.focus();
        await page.keyboard.press("ArrowLeft");
        assert.equal(
          await page
            .getByRole("tab", { name: "Ideas", exact: true })
            .evaluate((e) => e === document.activeElement),
          true,
        );
        await page.keyboard.press("Enter");
        await page
          .getByRole("navigation", { name: "Student concepts" })
          .waitFor({ state: "visible" });
        await capture(`ideas-${width}x${height}`);
        await page.getByRole("tab", { name: "Summary", exact: true }).click();
        await page.locator(".roster-summary").waitFor({ state: "visible" });
        await noOverflow();
        await capture(`summary-${width}x${height}`);
        await page.goBack();
        await page
          .getByRole("navigation", { name: "Student concepts" })
          .waitFor({ state: "visible" });
      } else if (width === 1024) {
        await page
          .getByRole("button", { name: "Open Summary", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "Summary" })
          .waitFor({ state: "visible" });
        await capture("summary-1024x768");
        await page.keyboard.press("Escape");
        assert.equal(
          await page
            .getByRole("button", { name: "Open Summary", exact: true })
            .evaluate((e) => e === document.activeElement),
          true,
        );
      }
      checks.push(
        `Viewport ${width}×${height}: populated grid, log, no page overflow, pane controls`,
      );
    }
    await page.goto(base + root + "&q=nonexistent-roster-name");
    await page
      .getByRole("heading", { name: "No students match these filters" })
      .waitFor();
    checks.push("Empty filtered roster");
    await page.goto(
      base + root + "&student=10000000-0000-4000-8000-000000000004",
    );
    await page
      .getByRole("heading", { name: "No sessions in this evidence source" })
      .waitFor();
    checks.push("Student with no work");
    await page.goto(
      base + root + "&student=10000000-0000-4000-8000-000000000001",
    );
    assert.equal(await page.locator(".roster").count(), 0);
    checks.push("Non-enrolled profile rejected");
    const foreign = await context.request.get(
      base +
        "/teacher/students?assignment=30000000-0000-4000-8000-000000000099",
    );
    assert.ok(!(await foreign.text()).includes("roster-table"));
    assert.ok(!(await foreign.text()).includes("FOREIGN_ROSTER"));
    checks.push(
      "Existing foreign-owned assignment exposes no class or student data",
    );
    for (const selector of [
      "student=10000000-0000-4000-8000-000000000099",
      "session=40000000-0000-4000-8000-000000000099",
    ]) {
      const response = await context.request.get(base + root + "&" + selector);
      const body = await response.text();
      assert.ok(!body.includes("roster-table"));
      assert.ok(!body.includes("FOREIGN_ROSTER"));
    }
    checks.push(
      "Foreign class student and session rejected within owned assignment",
    );
    const studentContext = await browser.newContext();
    const studentLogin = await studentContext.request.post(
      base + "/api/auth/demo-sign-in",
      { headers: { Origin: base }, data: { role: "student" } },
    );
    assert.equal(studentLogin.status(), 200);
    const denied = await studentContext.request.get(base + root);
    assert.ok(!(await denied.text()).includes("roster-table"));
    checks.push("Student account cannot retrieve teacher roster");
    fs.writeFileSync(
      path.join(output, "browser-results.json"),
      JSON.stringify(
        {
          base,
          receiver,
          checks,
          nativeZoom: "See separate native-zoom.json receipt",
        },
        null,
        2,
      ),
    );
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify(checks, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
