/** Optional isolated browser verification. No application route or model service. */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { checkNativeZoom } from "./native-zoom.mjs";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../..");
const out = path.resolve(
  process.env.NOTEBOOK_OUTPUT ?? path.join(root, ".setup/notebook-preview"),
);
const { build } = require(
  process.env.NOTEBOOK_ESBUILD ??
    path.join(root, ".setup/verification/node_modules/esbuild"),
);
const { chromium } = require(process.env.NOTEBOOK_PLAYWRIGHT ?? "playwright");
fs.mkdirSync(out, { recursive: true });
const runId = randomUUID();
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
}).trim();
await build({
  entryPoints: [path.join(here, "fixture.tsx")],
  bundle: true,
  outfile: path.join(out, "fixture.js"),
  jsx: "automatic",
  platform: "browser",
  sourcemap: false,
});
fs.writeFileSync(
  path.join(out, "index.html"),
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,interactive-widget=resizes-content"><title>N1 Notebook shell verification</title><link rel="stylesheet" href="/fixture.css"></head><body><main id="fixture-root"></main><script src="/fixture.js"></script></body></html>',
);
const prototype = process.env.NOTEBOOK_PROTOTYPE;
const server = http.createServer((req, res) => {
  res.setHeader("X-N1-Test-Run", runId);
  if (req.method !== "GET") {
    res.writeHead(405);
    res.end();
    return;
  }
  const pathname = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  const prototypeRequest = pathname.startsWith("/prototype/") && prototype;
  const base = prototypeRequest ? path.resolve(prototype) : out;
  const relative = prototypeRequest
    ? pathname.slice(11)
    : pathname === "/"
      ? "index.html"
      : pathname.slice(1);
  const target = path.resolve(base, relative);
  if (
    !target.startsWith(base + path.sep) ||
    !fs.existsSync(target) ||
    !fs.statSync(target).isFile()
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  const mime =
    {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".png": "image/png",
    }[path.extname(target)] ?? "application/octet-stream";
  res.setHeader("Content-Type", mime);
  fs.createReadStream(target).pipe(res);
});
await new Promise((resolve) =>
  server.listen(
    Number(process.env.NOTEBOOK_PORT ?? 4381),
    "127.0.0.1",
    resolve,
  ),
);
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
// Verify this newly created server independently, before opening any browser.
const verification = await fetch(base, { redirect: "error" });
assert.equal(verification.headers.get("X-N1-Test-Run"), runId);
assert.equal(verification.url, `${base}/`);
assert.ok(
  (await verification.text()).includes("N1 Notebook shell verification"),
);
const identity = {
  runId,
  origin: base,
  route: "/",
  sourceSha,
  n0Sha: "8bca4d3554ae02a909b93f1a7b95ed033b62a718",
  freshBrowser: true,
  fixtureOnly: true,
};
fs.writeFileSync(
  path.join(out, "run-identity.json"),
  JSON.stringify(identity, null, 2),
);
if (process.argv.includes("--serve")) {
  console.log(`Fixture available at ${base}; provider-free preview only.`);
} else {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.NOTEBOOK_BROWSER,
  });
  const results = [];
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const nonlocal = [];
    const mutations = [];
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).origin !== base) {
        nonlocal.push(route.request().url());
        return route.abort();
      }
      if (route.request().method() !== "GET") {
        mutations.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    for (const [width, height] of [
      [1440, 1000],
      [1024, 768],
      [390, 844],
      [320, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(base);
      assert.equal(page.url(), `${base}/`);
      await page.waitForSelector("[data-study-session]");
      const token = await page
        .locator("[data-study-session]")
        .getAttribute("data-study-session");
      assert.equal(await page.locator("textarea").count(), 1);
      await page.screenshot({
        path: path.join(out, `shell-${width}x${height}.png`),
      });
      const overflow = () =>
        page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(await overflow(), false, `initial overflow ${width}`);
      await page
        .locator("textarea")
        .fill("Unsent original text — preserved through pane switches.");
      if (width < 1280) {
        await page.getByRole("button", { name: "Pages", exact: true }).click();
        assert.equal(
          await page
            .locator("aside[aria-label='Pages in this session']")
            .evaluate((element) => document.activeElement === element),
          true,
        );
        assert.equal(await page.getByRole("alert").isVisible(), true);
        await page.screenshot({
          path: path.join(out, `pages-${width}x${height}.png`),
        });
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () => document.activeElement?.textContent === "Pages",
        );
        await page.getByRole("button", { name: "Pages", exact: true }).click();
        await page
          .getByRole("link", {
            name: "Saved work Original response · earlier session",
          })
          .click();
        await page.waitForFunction(
          () => document.activeElement?.getAttribute("role") === "region",
        );
      }
      await page.getByRole("button", { name: "Reading", exact: true }).click();
      assert.equal(await page.getByRole("alert").isVisible(), true);
      assert.equal(
        await page
          .locator("aside[aria-label='Reading']")
          .evaluate((element) => document.activeElement === element),
        true,
      );
      if (width < 820)
        assert.equal(
          await page.locator("[data-study-session]").isVisible(),
          false,
        );
      await page.screenshot({
        path: path.join(out, `reading-${width}x${height}.png`),
      });
      await page.locator("#reading-end").scrollIntoViewIfNeeded();
      assert.equal(await overflow(), false, `reading overflow ${width}`);
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => document.activeElement?.textContent === "Reading",
      );
      assert.equal(
        await page.locator("textarea").inputValue(),
        "Unsent original text — preserved through pane switches.",
      );
      assert.equal(
        await page
          .locator("[data-study-session]")
          .getAttribute("data-study-session"),
        token,
      );
      assert.equal(await page.locator("html").getAttribute("data-mounts"), "1");
      assert.equal(
        await page.locator("html").getAttribute("data-unmounts"),
        null,
      );
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      assert.equal(
        await page
          .getByRole("navigation", { name: "Student navigation" })
          .count(),
        1,
      );
      assert.equal(await page.getByRole("alert").isVisible(), true);
      await page.screenshot({
        path: path.join(out, `navigation-${width}x${height}.png`),
      });
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => document.activeElement?.textContent === "Menu",
      );
      await page.getByText("Long original message", { exact: true }).click();
      assert.equal(await overflow(), false, `long message overflow ${width}`);
      await page.locator("textarea").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(out, `long-message-${width}x${height}.png`),
      });
      results.push({
        viewport: `${width}x${height}`,
        overflow: false,
        retainedMount: true,
        retainedDraft: true,
        focusReturn: true,
        noticesAvailable: true,
      });
    }
    // Native HTML navigation: Tab order, Enter/Space, Shift+Tab; no ARIA
    // tablist/menu is claimed, so arrow keys retain ordinary page scrolling.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page.getByRole("button", { name: "Menu", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-label") ===
        "Student navigation menu",
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent),
      "My learning",
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent),
      "Notebook",
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent),
      "My learning",
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.activeElement?.textContent === "Menu",
    );
    await page.keyboard.press("Space");
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-label") ===
        "Student navigation menu",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Pages", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-label") ===
        "Pages in this session",
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent),
      "Back to page",
    );
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () => document.activeElement?.textContent === "Pages",
    );
    await page.screenshot({
      path: path.join(out, "keyboard-focus-390x844.png"),
    });
    results.push({
      check: "Tab / Shift+Tab / Enter / Space / Escape",
      passed: true,
      directionalNavigation:
        "Not a menu/tablist widget; ordinary document scrolling",
    });

    await page.goto(`${base}/?contract=1`);
    await page.locator("textarea").fill("N0 retained draft");
    const contractIdentity = await page
      .locator("[data-study-session]")
      .getAttribute("data-study-session");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("link", { name: "Notebook", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/%2Fstudy%2Fhistory$/);
    await page.waitForFunction(
      () =>
        document.querySelector("[data-pane]")?.getAttribute("data-pane") ===
        "page",
    );
    await page
      .getByRole("heading", { name: "Your notebook", exact: true })
      .waitFor();
    assert.ok(
      (
        await page
          .locator('[role="region"][aria-label="Your notebook"]')
          .boundingBox()
      ).width > 350,
      "Optional index must not leave an empty mobile grid column",
    );
    await page.goBack();
    await page
      .getByRole("heading", { name: "My learning", exact: true })
      .waitFor();
    await page.goForward();
    await page
      .getByRole("heading", { name: "Your notebook", exact: true })
      .waitFor();
    assert.equal(
      await page.locator("textarea").inputValue(),
      "N0 retained draft",
    );
    assert.equal(
      await page
        .locator("[data-study-session]")
        .getAttribute("data-study-session"),
      contractIdentity,
    );
    assert.equal(await page.locator("html").getAttribute("data-mounts"), "1");
    await page.screenshot({
      path: path.join(out, "n0-back-forward-390x844.png"),
    });
    results.push({
      check: "N0 adapter / navigation intent / browser Back and Forward",
      passed: true,
      scope: "Fixture router only; existing app routes are not mounted",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page.locator("textarea").fill("Resizing keeps the same child");
    const resizeIdentity = await page
      .locator("[data-study-session]")
      .getAttribute("data-study-session");
    for (const [width, height] of [
      [1440, 1000],
      [1024, 768],
      [320, 844],
      [390, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await page.locator("textarea").focus();
      await page.locator("textarea").scrollIntoViewIfNeeded();
      assert.equal(
        await page
          .locator("[data-study-session]")
          .getAttribute("data-study-session"),
        resizeIdentity,
      );
      assert.equal(
        await page.locator("textarea").inputValue(),
        "Resizing keeps the same child",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await page.screenshot({
      path: path.join(out, "keyboard-sized-viewport-390x390.png"),
    });
    results.push({
      check: "viewport resizing / keyboard-sized viewport",
      passed: true,
      nativeMobileKeyboard: "not verified",
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator("[data-pane]")
        .evaluate((element) => getComputedStyle(element).scrollBehavior),
      "auto",
    );
    results.push({ check: "reduced motion", passed: true });
    for (const surface of [
      "learning",
      "saved",
      "reading",
      "reviews",
      "empty",
      "pending",
      "unavailable",
    ]) {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto(`${base}?surface=${surface}`);
      await page.waitForSelector("[data-pane]");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({ path: path.join(out, `${surface}-320x844.png`) });
    }
    assert.deepEqual(nonlocal, []);
    assert.deepEqual(errors, []);
    assert.deepEqual(mutations, []);
    results.push({
      check: "external requests / browser errors",
      requests: nonlocal,
      errors,
      mutations,
    });
    if (prototype) {
      const reference = await context.newPage();
      await reference.route("**/*", (route) =>
        new URL(route.request().url()).origin === base
          ? route.continue()
          : route.abort(),
      );
      for (const [width, height] of [
        [1440, 1000],
        [1024, 768],
        [390, 844],
        [320, 844],
      ]) {
        await reference.setViewportSize({ width, height });
        await reference.goto(`${base}/prototype/reference-responsive.html`);
        assert.equal(new URL(reference.url()).origin, base);
        await reference
          .getByRole("heading", { name: "Session 1", exact: true })
          .waitFor({ timeout: 15000 });
        await reference.screenshot({
          path: path.join(out, `prototype-${width}x${height}.png`),
        });
      }
      await reference.setViewportSize({ width: 1440, height: 1000 });
      await reference.goto(`${base}/prototype/V1440-HelpMsg.dc.html`);
      await reference
        .getByText("Help request · not graded", { exact: true })
        .first()
        .waitFor();
      await reference.screenshot({
        path: path.join(out, "prototype-corrected-help-1440x1000.png"),
      });
      await reference.close();
      results.push({
        check: "Prototype screenshots",
        status: "COMPONENT COMPARISON ONLY",
        note: "Authoritative fa69c2d0 export: responsive Main.dc.html wrapper and exact V1440-HelpMsg.dc.html. Full application acceptance remains pending.",
      });
    }
    const nativeZoom = await checkNativeZoom({
      chromium,
      base,
      out,
      executablePath: process.env.NOTEBOOK_BROWSER,
      runId,
    });
    fs.writeFileSync(
      path.join(out, "browser-results.json"),
      JSON.stringify(
        {
          fixtureOnly: true,
          actualStudySessionMounted: false,
          ...identity,
          actual200PercentZoom: nativeZoom,
          results,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
}
