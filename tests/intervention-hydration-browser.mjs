/** Production regression. Existing delivered fictional record; no domain writes.
 * node tests/intervention-hydration-browser.mjs <origin> <draft-id> <new-output> [baseline]
 * Optional INTERVENTION_TEST_ENV points to a private fictional login env file.
 * PLAYWRIGHT_MODULE / BROWSER_EXECUTABLE select installed browser tooling.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
const [origin, draftId, output, mode = "fixed"] = process.argv.slice(2);
assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.match(draftId, /^[a-f0-9-]{36}$/);
assert.ok(["fixed", "baseline"].includes(mode));
const out = resolve(output);
assert.equal(
  existsSync(out),
  false,
  "Use a new output; preserve prior receipts.",
);
mkdirSync(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const executablePath =
  process.env.BROWSER_EXECUTABLE ||
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const env = process.env.INTERVENTION_TEST_ENV
  ? Object.fromEntries(
      readFileSync(process.env.INTERVENTION_TEST_ENV, "utf8")
        .trim()
        .split(/\r?\n/)
        .map((line) => {
          const i = line.indexOf("=");
          return [line.slice(0, i), line.slice(i + 1)];
        }),
    )
  : null;
if (env) {
  assert.equal(env.OPENAI_API_KEY, "");
  assert.equal(env.OPENAI_MODEL, "");
}
const report = {
  origin,
  draftId,
  mode,
  paidCalls: 0,
  states: [],
  blocked: [],
  status: "running",
};
const route = `/teacher/interventions?draft=${draftId}&workspacePane=context`;
const endpoint = `${origin}/api/teacher/interventions/${draftId}`;
let browser;
const contexts = [];
const metric = (page) =>
  page.evaluate(() => ({
    outerWidth,
    innerWidth,
    innerHeight,
    dpr: devicePixelRatio,
    zoom: getComputedStyle(document.documentElement).zoom,
    scale: visualViewport.scale,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
async function login(context) {
  if (env) {
    const r = await context.request.post(origin + "/api/auth/sign-in/email", {
      data: {
        email: env.DEMO_TEACHER_EMAIL,
        password: env.DEMO_TEACHER_PASSWORD,
      },
      headers: { Origin: origin },
    });
    assert.equal(
      r.status(),
      200,
      "Fictional login failed; credentials are never logged.",
    );
  }
  const page = context.pages()[0] || (await context.newPage());
  page.setDefaultTimeout(20000);
  await context.route("**/*", (r) => {
    const req = r.request(),
      u = new URL(req.url());
    if (
      u.origin === origin &&
      (["GET", "HEAD", "OPTIONS"].includes(req.method()) ||
        (!env && u.pathname === "/api/auth/demo-sign-in"))
    )
      return r.continue();
    report.blocked.push({ path: u.pathname, method: req.method() });
    return r.abort();
  });
  if (!env) {
    await page.goto(origin + "/login");
    await page
      .getByRole("button", { name: "Demo teacher", exact: true })
      .click();
    await page.waitForURL("**/teacher");
  }
  return page;
}
async function inspect(page, name, expectError) {
  const before = await (await page.context().request.get(endpoint)).json();
  assert.ok(
    before.approval && before.delivery,
    "Requires a real saved delivered intervention.",
  );
  const errors = [],
    consoleErrors = [];
  const onError = (e) => errors.push(e.message),
    onConsole = (e) => {
      if (e.type() === "error") consoleErrors.push(e.text());
    };
  page.on("pageerror", onError);
  page.on("console", onConsole);
  const response = await page.goto(origin + route);
  assert.equal(response.status(), 200);
  const html = await response.text();
  await page.waitForFunction(() => {
    const e = document.querySelector(".lp-intervention-steps button");
    return e && Object.keys(e).some((k) => k.startsWith("__reactProps$"));
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () =>
      document
        .querySelector(".lp-intervention-followup")
        ?.getAttribute("aria-busy") === "false",
  );
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  const geometry = await metric(page);
  const state = {
    name,
    errors,
    consoleErrors,
    geometry,
    serverDates: html.match(
      /(?:approved on|Approved on|Delivered on)[\s\S]{0,150}/g,
    ),
    clientDates: (
      await page.locator(".lp-intervention-steps").textContent()
    ).match(/(?:approved on|Approved on|Delivered on).{0,65}/g),
  };
  report.states.push(state);
  await page.screenshot({ path: join(out, name + ".png") });
  if (name.startsWith("native")) {
    const cdp = await page.context().newCDPSession(page);
    const shot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    writeFileSync(
      join(out, name + "-surface.png"),
      Buffer.from(shot.data, "base64"),
    );
    await cdp.detach();
  }
  if (mode === "fixed") {
    assert.deepEqual(
      errors,
      [],
      "Any production page error, including React #418, fails this regression.",
    );
    assert.deepEqual(consoleErrors, []);
    for (const instant of [
      before.approval.approved_at,
      before.delivery.delivered_at,
    ]) {
      const time = page
        .locator(`.lp-intervention-steps time[datetime="${instant}"]`)
        .first();
      const iso = new Date(instant).toISOString(),
        label = `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
      assert.equal(await time.textContent(), label);
      assert.ok(
        html.includes(label),
        "Exact timestamp meaning must already be in server HTML.",
      );
    }
  } else if (expectError)
    assert.ok(
      errors.some((x) => x.includes("#418")),
      "Baseline must reproduce hydration error.",
    );
  else
    assert.deepEqual(
      errors,
      [],
      "Matching UTC/en-US control must hydrate cleanly.",
    );
  assert.equal(geometry.overflow, false);
  const after = await (await page.context().request.get(endpoint)).json();
  assert.deepEqual(
    after,
    before,
    "Browsing must not change the saved lifecycle, evidence or identities.",
  );
  page.off("pageerror", onError);
  page.off("console", onConsole);
}
try {
  browser = await chromium.launch({ executablePath, headless: true });
  for (const [locale, timezoneId] of [
    ["en-US", "UTC"],
    ["en-US", "America/New_York"],
    ["en-GB", "America/New_York"],
  ]) {
    const context = await browser.newContext({ locale, timezoneId });
    contexts.push(context);
    const page = await login(context);
    for (const width of [1440, 1024, 390, 320]) {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 1000 : width === 1024 ? 768 : 844,
      });
      await inspect(
        page,
        `${locale}-${timezoneId === "UTC" ? "UTC" : "NY"}-${width}`,
        timezoneId !== "UTC",
      );
    }
    await context.close();
  }
  await browser.close();
  browser = null;
  const metrics = [];
  for (const zoom of [1, 2]) {
    const profile = join(out, `private-profile-${zoom}`);
    mkdirSync(join(profile, "Default"), { recursive: true });
    writeFileSync(
      join(profile, "Default", "Preferences"),
      JSON.stringify({
        partition: {
          default_zoom_level: {
            x: Math.log(zoom) / Math.log(1.2),
            0: Math.log(zoom) / Math.log(1.2),
          },
        },
      }),
    );
    const context = await chromium.launchPersistentContext(profile, {
      executablePath,
      headless: true,
      viewport: null,
      locale: "en-US",
      timezoneId: "America/New_York",
      args: ["--window-size=1440,1000"],
    });
    contexts.push(context);
    const page = await login(context);
    await inspect(page, `native${zoom * 100}`, true);
    metrics.push(await metric(page));
    await context.close();
  }
  assert.equal(metrics[1].outerWidth, metrics[0].outerWidth);
  assert.equal(metrics[1].dpr / metrics[0].dpr, 2);
  assert.equal(metrics[1].innerWidth / metrics[0].innerWidth, 0.5);
  assert.equal(metrics[1].zoom, "1");
  assert.equal(metrics[1].scale, 1);
  report.nativeZoom = metrics;
  assert.deepEqual(report.blocked, []);
  report.status = "passed";
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  for (const c of contexts) await c.close().catch(() => {});
  if (browser) await browser.close();
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      status: report.status,
      states: report.states.length,
      failure: report.failure,
    }),
  );
}
