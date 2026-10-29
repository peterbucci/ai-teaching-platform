import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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
(async () => {
  // Use Chromium's native profile zoom preference in a new test-only profile.
  // No CSS zoom, device viewport emulation, or personal browser settings.
  const profile = fs.mkdtempSync(
    path.join(os.tmpdir(), "learning-roster-zoom-"),
  );
  fs.mkdirSync(path.join(profile, "Default"));
  fs.writeFileSync(
    path.join(profile, "Default", "Preferences"),
    JSON.stringify({
      partition: {
        default_zoom_level: {
          0: Math.log(2) / Math.log(1.2),
          x: Math.log(2) / Math.log(1.2),
        },
      },
    }),
  );
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath:
      process.env.BROWSER_EXECUTABLE ||
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    viewport: null,
    args: ["--window-size=1440,1000", "--force-device-scale-factor=1"],
  });
  try {
    await context.request.post(base + "/api/auth/demo-sign-in", {
      headers: { Origin: base },
      data: { role: "teacher" },
    });
    const page = await context.newPage();
    const surface = await context.newCDPSession(page);
    async function capture(name) {
      await page.evaluate(() => document.fonts.ready);
      const { data } = await surface.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      fs.writeFileSync(
        path.join(output, name + ".png"),
        Buffer.from(data, "base64"),
      );
    }
    await page.goto(
      base +
        "/teacher/students?assignment=30000000-0000-4000-8000-000000000001&origin=all&student=10000000-0000-4000-8000-000000000002&workspacePane=main",
    );
    await page.locator(".roster").waitFor();

    await page.waitForFunction(
      () => window.devicePixelRatio >= 1.99 && window.devicePixelRatio <= 2.01,
      {},
      { timeout: 15000 },
    );
    await page
      .getByRole("tab", { name: "Work log", exact: true })
      .waitFor({ state: "visible" });
    await capture("student-native-200");
    const dimensions = await page.evaluate(() => ({
      devicePixelRatio: window.devicePixelRatio,
      innerWidth,
      innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      cssZoom: getComputedStyle(document.documentElement).zoom,
      visualViewportScale: window.visualViewport.scale,
    }));
    assert.ok(["1", "normal"].includes(dimensions.cssZoom));
    assert.equal(dimensions.visualViewportScale, 1);
    if (dimensions.scrollWidth > dimensions.innerWidth + 1)
      throw Error("Page overflow at native 200 percent");
    await page.locator(".roster-answer").first().scrollIntoViewIfNeeded();
    await capture("work-native-200");
    await page.getByRole("tab", { name: "Work log", exact: true }).focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    await page
      .getByRole("navigation", { name: "Student concepts" })
      .waitFor({ state: "visible" });
    await page.getByRole("tab", { name: "Summary", exact: true }).click();
    await page.locator(".roster-summary").waitFor({ state: "visible" });
    await capture("summary-native-200");
    await page.goBack();
    await page
      .getByRole("navigation", { name: "Student concepts" })
      .waitFor({ state: "visible" });
    await page.goto(
      base +
        "/teacher/students?assignment=30000000-0000-4000-8000-000000000001&origin=all",
    );
    await page.locator(".roster-table").waitFor();
    await capture("roster-native-200");
    await page.locator(".roster-table").scrollIntoViewIfNeeded();
    await page.locator(".roster-table-scroll").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => document.querySelector(".roster-table-scroll").scrollLeft > 0,
    );
    await capture("grid-native-200");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    fs.writeFileSync(
      path.join(output, "native-zoom.json"),
      JSON.stringify(
        {
          method:
            "Native Chromium/Edge default_zoom_level profile preference at 200%; fresh test profile, no viewport or CSS zoom emulation",
          dimensions,
          checks: [
            "original work reachable",
            "keyboard Ideas tab",
            "Summary pane",
            "native Back restores Ideas",
            "keyboard horizontal grid scroll",
            "no page overflow",
          ],
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(dimensions));
  } finally {
    await context.close();
    const resolved = path.resolve(profile);
    if (
      path.dirname(resolved) === path.resolve(os.tmpdir()) &&
      path.basename(resolved).startsWith("learning-roster-zoom-")
    )
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3 });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
