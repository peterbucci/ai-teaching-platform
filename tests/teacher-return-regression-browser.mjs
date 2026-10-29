// Original S1/C2 acceptance fixture against the real production app.
// node tests/teacher-return-regression-browser.mjs <origin> <fresh-output>
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const [origin, outArg] = process.argv.slice(2);
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
const nativeZoom = process.env.K_NATIVE_ZOOM === "2";
const profile = resolve(out, "private-profile-native200");
if (nativeZoom) {
  mkdirSync(resolve(profile, "Default"), { recursive: true });
  writeFileSync(
    resolve(profile, "Default/Preferences"),
    JSON.stringify({
      partition: {
        default_zoom_level: {
          x: Math.log(2) / Math.log(1.2),
          0: Math.log(2) / Math.log(1.2),
        },
      },
    }),
  );
}
const context = nativeZoom
    ? await chromium.launchPersistentContext(profile, {
        executablePath:
          process.env.BROWSER_EXECUTABLE ??
          "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        headless: true,
        viewport: null,
        timezoneId: "UTC",
        args: ["--window-size=1440,1000"],
      })
    : await browser.newContext({ timezoneId: "UTC", locale: "en-US" }),
  page = await context.newPage();
page.setDefaultTimeout(15000);
const report = { origin, checks: [], errors: [], blocked: [] };
page.on("pageerror", (e) => report.errors.push(String(e)));
await context.route("**/*", (r) => {
  const q = r.request(),
    u = new URL(q.url());
  if (
    u.origin !== origin ||
    (!["GET", "HEAD"].includes(q.method()) &&
      u.pathname !== "/api/auth/demo-sign-in")
  ) {
    report.blocked.push(u.pathname);
    return r.abort();
  }
  return r.continue();
});
const expected = {
  assignment: "30000000-0000-4000-8000-000000000001",
  student: "10000000-0000-4000-8000-000000000002",
  concept: "transmission_delay",
  view: "progress",
  progressView: "grid",
  pane: "details",
  origin: "all",
  status: "all",
};
const start =
  origin +
  "/teacher/assignments?" +
  new URLSearchParams(expected) +
  "#cell-evidence";
async function details() {
  await page
    .locator('.ap-workbench[data-pane="details"] #cell-evidence')
    .waitFor();
  await page.waitForTimeout(300);
}
try {
  await page.goto(origin + "/login");
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/teacher"));
  const sizes = nativeZoom
    ? [await page.evaluate(() => [innerWidth, innerHeight])]
    : [
        [1440, 1000],
        [1024, 768],
        [390, 844],
        [320, 844],
      ];
  if (nativeZoom) {
    report.nativeZoom = await page.evaluate(() => ({
      dpr: devicePixelRatio,
      width: innerWidth,
      zoom: getComputedStyle(document.documentElement).zoom,
      scale: visualViewport.scale,
    }));
    assert(
      report.nativeZoom.dpr === 2 &&
        report.nativeZoom.width < 800 &&
        ["1", "normal"].includes(report.nativeZoom.zoom) &&
        report.nativeZoom.scale === 1,
    );
  }
  for (const [width, height] of sizes) {
    if (!nativeZoom) await page.setViewportSize({ width, height });
    await page.goto(start);
    await details();
    const discovery =
      width <= 800
        ? page.getByRole("link", {
            name: "Back to course assignments",
            exact: true,
          })
        : page
            .getByRole("navigation", { name: "Course workspace", exact: true })
            .getByRole("link", { name: "Assignments", exact: true });
    assert.equal(await discovery.getAttribute("href"), "/teacher/assignments");
    await discovery.click();
    await page.waitForURL(origin + "/teacher/assignments");
    await page
      .getByRole("heading", { name: "Assignments", exact: true })
      .waitFor();
    report.checks.push({ case: "S1 discovery", width, status: "passed" });
    await page.goto(start);
    await details();
    const entry = page
      .locator("#cell-evidence")
      .getByRole("link", { name: "Read in full", exact: true })
      .first();
    await entry.focus();
    await page.keyboard.press("Enter");
    const back = page
      .locator(".lp-evidence-page")
      .getByRole("link", { name: "Back to Class Progress", exact: true });
    await back.waitFor();
    const href = await back.getAttribute("href");
    await page.reload();
    await back.waitFor();
    assert.equal(await back.getAttribute("href"), href);
    await page.goBack();
    await details();
    assert.equal(page.url(), start);
    await page.goForward();
    await back.waitFor();
    await back.focus();
    await page.keyboard.press("Enter");
    await details();
    const returned = new URL(page.url());
    for (const [key, value] of Object.entries(expected))
      assert.equal(returned.searchParams.get(key), value);
    assert.equal(returned.hash, "#cell-evidence");
    await page.waitForFunction(
      () => document.activeElement?.id === "cell-evidence",
    );
    const focus = await page.locator("#cell-evidence").boundingBox();
    assert(focus.height > 0 && focus.y >= 0 && focus.y < height);
    const after = page.url();
    await page.reload();
    await details();
    assert.equal(page.url(), after);
    await page.screenshot({ path: resolve(out, `C2-${width}.png`) });
    report.checks.push({
      case: "C2 displayed return + native history + reload + keyboard focus",
      width,
      status: "passed",
      href,
    });
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.blocked, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
}
console.log(JSON.stringify(report));
