// Native browser zoom and bounded keyboard navigation; no record creation or assessment submissions.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const [stateArg, outArg] = process.argv.slice(2);
assert.ok(stateArg && outArg);
const state = resolve(stateArg),
  out = resolve(outArg);
assert.ok(!existsSync(out), "Use fresh output.");
const m = JSON.parse(readFileSync(join(state, "manifest.json"), "utf8"));
assert.equal(m.paidModelCallsAuthorized, false);
assert.match(m.configurationCategory, /provider-disabled/);
const origin = new URL(m.origin);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const env = readFileSync(join(state, ".env.acceptance"), "utf8");
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"])
  assert.equal(
    env.split(/\r?\n/).find((s) => s.startsWith(key + "=")),
    key + "=",
  );
await mkdir(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE ??
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const report = {
  sourceSha: m.sourceSha,
  sourceTree: m.sourceTree,
  project: m.project,
  origin: m.origin,
  startedAt: new Date().toISOString(),
  method:
    "Isolated Edge profiles with native partition.default_zoom_level; viewport:null and 1440x1000 window. Separate mobile CSS viewport checks marked explicitly.",
  measurements: {},
  checks: [],
  blockedRequests: [],
  unrun: [
    "Screen-reader verification",
    "Comprehensive WCAG audit",
    "All editor keyboard paths, failure/recovery states, and long-response stress fixtures",
    "Student composer and reading at 200% in this bounded teacher-only run",
  ],
};
const contexts = [];
const measure = (page) =>
  page.evaluate(() => ({
    dpr: devicePixelRatio,
    innerWidth,
    innerHeight,
    outerWidth,
    outerHeight,
    visualViewportScale: visualViewport.scale,
    rootZoom: getComputedStyle(document.documentElement).zoom,
    overflow: document.documentElement.scrollWidth > innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollY,
  }));
const focus = (page) =>
  page.evaluate(() => {
    const el = document.activeElement,
      s = getComputedStyle(el);
    return {
      tag: el.tagName,
      id: el.id,
      text: (
        el.getAttribute("aria-label") ||
        el.innerText ||
        el.getAttribute("placeholder") ||
        ""
      )
        .trim()
        .slice(0, 160),
      href: el.getAttribute("href"),
      outline: s.outline,
      scrollY,
    };
  });
async function shot(page, name) {
  report.measurements[name] = await measure(page);
  const c = await page.context().newCDPSession(page);
  const png = await c.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  await writeFile(join(out, name + ".png"), Buffer.from(png.data, "base64"));
  await c.detach();
}
async function tabTo(page, predicate, label, limit = 100) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const f = await focus(page);
    if (predicate(f)) {
      report.checks.push({
        label,
        status: "keyboard-reachable",
        tabs: i + 1,
        focus: f,
      });
      return f;
    }
  }
  report.checks.push({ label, status: "not-reached", limit });
  return null;
}
async function activate(page, predicate, label) {
  const f = await tabTo(page, predicate, label);
  if (f) await page.keyboard.press("Enter");
  return f;
}
async function launch(label, zoom) {
  const dir = join(out, "private-profile-" + label);
  await mkdir(join(dir, "Default"), { recursive: true });
  await writeFile(
    join(dir, "Default", "Preferences"),
    JSON.stringify({
      partition: {
        default_zoom_level: {
          x: Math.log(zoom) / Math.log(1.2),
          0: Math.log(zoom) / Math.log(1.2),
        },
      },
    }),
  );
  const context = await chromium.launchPersistentContext(dir, {
    executablePath:
      process.env.BROWSER_EXECUTABLE ??
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
    viewport: null,
    args: ["--window-size=1440,1000"],
  });
  contexts.push(context);
  let loggedIn = false;
  await context.route("**/*", async (route) => {
    const r = route.request(),
      u = new URL(r.url());
    if (
      u.origin !== origin.origin ||
      (!["GET", "HEAD"].includes(r.method()) &&
        !(u.pathname === "/api/auth/demo-sign-in" && !loggedIn))
    ) {
      report.blockedRequests.push({ method: r.method(), url: r.url() });
      return route.abort();
    }
    return route.continue();
  });
  const page = context.pages()[0];
  page.setDefaultTimeout(12000);
  await page.goto(origin.origin + "/login");
  await page
    .getByRole("button", { name: "Demo teacher", exact: true })
    .waitFor();
  return {
    context,
    page,
    async login() {
      await activate(
        page,
        (f) => f.text === "Demo teacher",
        "keyboard demo teacher login",
      );
      await page.waitForURL("**/teacher");
      loggedIn = true;
      await page.getByRole("heading", { level: 1 }).waitFor();
    },
  };
}
async function drawerEscape(page, label) {
  const trigger = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (!(await trigger.isVisible())) {
    report.checks.push({
      label,
      status: "unrun",
      reason: "Drawer trigger not visible",
    });
    return;
  }
  await activate(page, (f) => f.text === "Open navigation", label + " open");
  await page.locator("dialog[open]").waitFor();
  await page.keyboard.press("Escape");
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  const f = await focus(page);
  report.checks.push({
    label,
    status: f.text === "Open navigation" ? "pass" : "fail",
    focus: f,
  });
}
try {
  const base = await launch("100", 1);
  report.measurements.baseline = await measure(base.page);
  await shot(base.page, "01-native100-login");
  await base.context.close();
  const zoom = await launch("200", 2);
  report.measurements.native200 = await measure(zoom.page);
  await shot(zoom.page, "02-native200-login");
  const a = report.measurements.baseline,
    b = report.measurements.native200;
  report.nativeZoomVerified =
    Math.abs(b.dpr / a.dpr - 2) < 0.02 &&
    Math.abs(b.innerWidth / a.innerWidth - 0.5) < 0.02 &&
    b.visualViewportScale === 1 &&
    b.rootZoom === "1";
  assert.ok(
    report.nativeZoomVerified,
    "Native200 measurement failed; do not claim zoom acceptance.",
  );
  await zoom.login();
  const p = zoom.page;
  await shot(p, "03-native200-desk");
  await drawerEscape(p, "native200 drawer Escape restores focus");
  await activate(
    p,
    (f) => f.text === "Open navigation",
    "native200 reopen drawer",
  );
  await p.locator("dialog[open]").waitFor();
  await activate(
    p,
    (f) => f.tag === "A" && f.text === "Evidence",
    "native200 Evidence navigation",
  );
  await p.waitForURL(/\/teacher\/evidence/);
  await p.getByRole("heading", { name: "Evidence", exact: true }).waitFor();
  await shot(p, "04-native200-evidence");
  const response = await tabTo(
    p,
    (f) => f.tag === "A" && (f.href ?? "").includes("#response-detail-title"),
    "native200 select original response",
  );
  if (response) {
    const target = new URL(response.href, origin).href;
    await Promise.all([p.waitForURL(target), p.keyboard.press("Enter")]);
    report.checks.push({
      label: "native200 selected response focus",
      status: "observed",
      focus: await focus(p),
    });
    await shot(p, "05-native200-original-response");
  }
  const full = await tabTo(
    p,
    (f) => f.tag === "A" && (f.href ?? "").startsWith("/teacher/sessions/"),
    "native200 full session",
  );
  if (full) {
    const before = await focus(p),
      source = p.url();
    await Promise.all([
      p.waitForURL(new URL(full.href, origin).href),
      p.keyboard.press("Enter"),
    ]);
    await p.locator(".lp-evidence-page").first().waitFor();
    await shot(p, "06-native200-full-session");
    await p.goBack();
    await p.waitForURL(source);
    await p.waitForTimeout(200);
    report.checks.push({
      label: "native200 browser Back focus restoration",
      status: "observed",
      before,
      after: await focus(p),
      url: p.url(),
    });
    await p.goForward();
    await p.waitForURL(new URL(full.href, origin).href);
    await p.waitForTimeout(200);
    report.checks.push({
      label: "native200 browser Forward",
      status: "observed",
      focus: await focus(p),
      url: p.url(),
    });
    await p.reload();
    await p.locator(".lp-evidence-page").first().waitFor();
    report.checks.push({
      label: "native200 full-session reload",
      status: "pass",
      url: p.url(),
    });
  }
  await zoom.context.close();
  const mobile = await launch("mobile", 1);
  await mobile.page.setViewportSize({ width: 390, height: 844 });
  await mobile.login();
  await drawerEscape(
    mobile.page,
    "390 CSS viewport drawer Escape restores focus",
  );
  await shot(mobile.page, "07-mobile390-desk");
  await mobile.page.setViewportSize({ width: 320, height: 844 });
  await drawerEscape(
    mobile.page,
    "320 CSS viewport drawer Escape restores focus",
  );
  await shot(mobile.page, "08-mobile320-desk");
  report.status = "bounded-checks-completed";
} catch (error) {
  report.status = "partial";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  for (const c of contexts) await c.close().catch(() => {});
  report.finishedAt = new Date().toISOString();
  await writeFile(
    join(out, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify({
    report: join(out, "report.json"),
    status: report.status,
    nativeZoomVerified: report.nativeZoomVerified,
    error: report.error,
  }),
);
