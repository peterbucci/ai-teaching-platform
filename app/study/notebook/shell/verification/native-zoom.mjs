import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Native Chromium zoom in two fresh disposable profiles. No CSS zoom,
 * device-metrics override, user profile, existing window or stopped session.
 * Profile preference is documented in Chromium ChromeZoomLevelPrefs; the
 * observed DPR/viewport ratio must prove 200%, otherwise this check fails.
 */
export async function checkNativeZoom({
  chromium,
  base,
  out,
  executablePath,
  runId,
}) {
  const metrics = [];
  for (const factor of [1, 2]) {
    const profile = path.join(out, `zoom-profile-${factor}-${runId}`);
    fs.mkdirSync(path.join(profile, "Default"), { recursive: true });
    fs.writeFileSync(
      path.join(profile, "Default/Preferences"),
      JSON.stringify({
        partition: {
          default_zoom_level: { x: Math.log(factor) / Math.log(1.2) },
        },
      }),
    );
    const context = await chromium.launchPersistentContext(profile, {
      headless: false,
      executablePath,
      viewport: null,
      args: ["--window-size=1440,1100"],
    });
    try {
      await context.route("**/*", (route) =>
        new URL(route.request().url()).origin === base &&
        route.request().method() === "GET"
          ? route.continue()
          : route.abort(),
      );
      const page = await context.newPage();
      const response = await page.goto(base);
      assert.equal(page.url(), `${base}/`);
      assert.equal(response.headers()["x-n1-test-run"], runId);
      await page.waitForSelector("[data-study-session]");
      const measured = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
        scale: visualViewport.scale,
        cssZoom: getComputedStyle(document.documentElement).zoom,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.equal(measured.overflow, false);
      assert.equal(measured.scale, 1);
      assert.equal(measured.cssZoom, "1");
      metrics.push({ factor, ...measured });
      await page.screenshot({
        path: path.join(out, `native-zoom-${factor * 100}.png`),
      });
      await page.locator("textarea").fill("Native browser zoom draft");
      const token = await page
        .locator("[data-study-session]")
        .getAttribute("data-study-session");
      await page.getByRole("button", { name: "Reading", exact: true }).click();
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => document.activeElement?.textContent === "Reading",
      );
      assert.equal(
        await page
          .locator("[data-study-session]")
          .getAttribute("data-study-session"),
        token,
      );
      assert.equal(
        await page.locator("textarea").inputValue(),
        "Native browser zoom draft",
      );
      await page.locator("textarea").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(out, `native-zoom-${factor * 100}-composer.png`),
      });
    } finally {
      await context.close();
    }
  }
  assert.ok(
    Math.abs(metrics[1].dpr / metrics[0].dpr - 2) < 0.01,
    "Native zoom must double DPR",
  );
  assert.ok(
    Math.abs(metrics[0].width / metrics[1].width - 2) < 0.06,
    "Native zoom must halve the CSS viewport",
  );
  const result = {
    status: "PASS",
    method:
      "Native browser profile zoom; fresh headed Edge profiles, viewport:null",
    metrics,
  };
  fs.writeFileSync(
    path.join(out, "native-zoom-results.json"),
    JSON.stringify(result, null, 2),
  );
  return result;
}
