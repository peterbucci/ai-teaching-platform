// Bounded read-only shell acceptance. No record creation after fictional login.
// Usage: node shell-accessibility-browser.mjs <state> <fresh-out> <playwright-package> <reviewed-safety.mjs> [authoring-report.json]
// private-profile-* folders contain browser authentication and MUST NOT be published.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [stateArg, outArg, playwrightArg, safetyArg, authoringArg] =
  process.argv.slice(2);
for (const value of [stateArg, outArg, playwrightArg, safetyArg])
  assert.ok(value);
const state = resolve(stateArg),
  out = resolve(outArg);
assert.equal(existsSync(out), false, "Use a fresh evidence directory.");
const manifest = JSON.parse(readFileSync(join(state, "manifest.json")));
const sha = "1a9d95b3be3e30d08d9dafc7ec6d1a14208368ac";
const tree = "c2f1c30b3f62391283ced9f798bbcae5cc7ca794";
assert.equal(manifest.sourceSha, sha);
assert.equal(manifest.sourceTree, tree);
assert.equal(manifest.target, "shell");
assert.equal(manifest.project, "lp-v22-shell5");
assert.equal(manifest.origin, "http://localhost:3350");
assert.equal(manifest.paidModelCallsAuthorized, false);
assert.match(manifest.configurationCategory, /provider-disabled/);
const origin = manifest.origin;
const environment = readFileSync(join(state, ".env.acceptance"), "utf8");
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"])
  assert.equal(
    environment.split(/\r?\n/).find((line) => line.startsWith(key + "=")),
    key + "=",
  );
for (const [ref, expected] of [
  ["HEAD", sha],
  ["HEAD^{tree}", tree],
]) {
  const result = spawnSync("git", ["-C", manifest.source, "rev-parse", ref], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), expected);
}
const hash = (value) => createHash("sha256").update(value).digest("hex");
assert.equal(
  hash(readFileSync(resolve(safetyArg))),
  "af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485",
);
const { acquireLock, preflight, MIN_RUNTIME_GIB } = await import(
  pathToFileURL(resolve(safetyArg)).href
);
const { chromium } = createRequire(import.meta.url)(resolve(playwrightArg));
const authoring = authoringArg
  ? JSON.parse(readFileSync(resolve(authoringArg)))
  : null;
if (authoring) {
  assert.equal(authoring.sourceSha ?? authoring.sha, sha);
  assert.equal(authoring.sourceTree ?? authoring.tree, tree);
  assert.equal(authoring.origin, origin);
  assert.equal(
    authoring.functional_completed_through,
    "teacher-original-evidence",
  );
  assert.ok(["passed", "failed-responsive"].includes(authoring.status));
}
await mkdir(out, { recursive: false });
const report = {
  sourceSha: sha,
  sourceTree: tree,
  project: manifest.project,
  origin,
  harness_sha256: hash(readFileSync(new URL(import.meta.url))),
  authoring_report_sha256: authoringArg
    ? hash(readFileSync(resolve(authoringArg)))
    : null,
  started_at: new Date().toISOString(),
  status: "running",
  checks: [],
  observations: [],
  screenshots: [],
  safety: [],
  blocked_requests: [],
  method:
    "Native Edge zoom from isolated Preferences, viewport:null and1440x1000 window; CSS mobile viewport checks separately labelled. GET/HEAD only after demo login. Unsaved objective text is changed locally then restored without saving.",
  native_200_percent_verified: false,
  actual_model_verification: "unrun",
  screen_reader: "unrun",
  unrun: [
    "Comprehensive keyboard/WCAG audit",
    "Student composer long-response stress",
    "Unsaved work across reload or leaving the editor",
    "Pending/failed mutation recovery",
  ],
};
const contexts = [];
let release,
  stage = "guard",
  fatal = false;
const save = () =>
  writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
function guard(before) {
  const observation = preflight({
    source: manifest.source,
    state,
    minimumGiB: MIN_RUNTIME_GIB,
    explicitPath: manifest.dockerDataPath || undefined,
    probeContainer: manifest.storageProbeContainer || undefined,
  });
  report.safety.push({ before, ...observation });
  if (!observation.pass) {
    fatal = true;
    throw new Error(
      "Shared storage preflight failed; no further browser case may run.",
    );
  }
}
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
const measure = (page) =>
  page.evaluate(() => ({
    dpr: devicePixelRatio,
    innerWidth,
    innerHeight,
    outerWidth,
    outerHeight,
    visualViewportScale: visualViewport?.scale,
    rootZoom: getComputedStyle(document.documentElement).zoom,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
const focus = (page) =>
  page.evaluate(() => {
    const element = document.activeElement;
    return {
      tag: element.tagName,
      id: element.id,
      className: element.className,
      text: (element.getAttribute("aria-label") || element.textContent || "")
        .trim()
        .slice(0, 180),
      href: element.getAttribute("href"),
      controls: element.getAttribute("aria-controls"),
      inDialog: Boolean(element.closest("dialog[open]")),
      visible: element.getClientRects().length > 0,
      outline: getComputedStyle(element).outline,
      scrollY,
    };
  });
function check(label, passed, details = {}, owner) {
  report.checks.push({
    label,
    status: passed ? "pass" : "fail",
    ...(owner ? { owner } : {}),
    ...details,
  });
}
async function screenshot(page, name) {
  await settle(page);
  const metrics = await measure(page);
  const cdp = await page.context().newCDPSession(page);
  try {
    const result = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
    });
    await writeFile(
      join(out, name + ".png"),
      Buffer.from(result.data, "base64"),
    );
  } finally {
    await cdp.detach();
  }
  report.screenshots.push({
    file: name + ".png",
    stage,
    url: page.url(),
    ...metrics,
  });
  await save();
}
async function tabTo(page, predicate, label) {
  for (let tabs = 1; tabs <= 100; tabs++) {
    await page.keyboard.press("Tab");
    const current = await focus(page);
    if (predicate(current)) {
      report.observations.push({ label, tabs, focus: current });
      return current;
    }
  }
  throw new Error("Keyboard target not reached: " + label);
}
async function launch(name, zoom) {
  guard("launch-" + name);
  const profile = join(out, "private-profile-" + name);
  await mkdir(join(profile, "Default"), { recursive: true });
  await writeFile(
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
    executablePath:
      process.env.BROWSER_EXECUTABLE ??
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
    viewport: null,
    args: ["--window-size=1440,1000"],
  });
  contexts.push(context);
  let signedIn = false;
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const local = url.origin === origin;
    const login =
      local &&
      url.pathname === "/api/auth/demo-sign-in" &&
      request.method() === "POST" &&
      !signedIn;
    if (local && (["GET", "HEAD"].includes(request.method()) || login))
      return route.continue();
    if (["data:", "blob:"].includes(url.protocol)) return route.continue();
    report.blocked_requests.push({ method: request.method(), url: url.href });
    return route.abort("blockedbyclient");
  });
  const page = context.pages()[0];
  page.setDefaultTimeout(15000);
  await page.goto(origin + "/login");
  await page
    .getByRole("button", { name: "Demo teacher", exact: true })
    .waitFor();
  return {
    page,
    context,
    login: async () => {
      await tabTo(
        page,
        (current) =>
          current.tag === "BUTTON" && current.text === "Demo teacher",
        name + " keyboard login",
      );
      await page.keyboard.press("Enter");
      await page.waitForURL("**/teacher");
      signedIn = true;
      await page.locator(".tw-shell").waitFor();
      await settle(page);
    },
  };
}
async function scopeDialog(page, label) {
  const before = await tabTo(
    page,
    (current) =>
      current.tag === "BUTTON" &&
      current.controls === "teacher-workspace-switcher",
    label + " trigger",
  );
  await page.keyboard.press("Enter");
  await page.locator("#teacher-workspace-switcher[open]").waitFor();
  const sequence = [];
  for (const key of ["Tab", "Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    sequence.push(await focus(page));
  }
  check(
    label + " keyboard focus remains inside dialog",
    sequence.every((item) => item.inDialog && item.visible),
    { sequence },
    "#120",
  );
  await page.keyboard.press("Escape");
  await page
    .locator("#teacher-workspace-switcher[open]")
    .waitFor({ state: "hidden" });
  await settle(page);
  const after = await focus(page);
  check(
    label + " Escape restores opener",
    after.tag === before.tag &&
      after.className === before.className &&
      after.text === before.text &&
      after.visible,
    { before, after },
    "#120",
  );
}
const assignment = "30000000-0000-4000-8000-000000000001";
const student = "10000000-0000-4000-8000-000000000002";
const progressURL =
  origin +
  "/teacher/assignments?" +
  new URLSearchParams({
    assignment,
    view: "progress",
    origin: "all",
    student,
    concept: "transmission_delay",
    status: "all",
    pane: "details",
  }) +
  "#cell-evidence";
async function openProgress(page) {
  await page.goto(progressURL);
  await page
    .getByRole("heading", { name: "Class progress", exact: true })
    .waitFor();
  await settle(page);
}
async function discoveryCheck(page, mobile) {
  await page.setViewportSize(
    mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
  );
  await openProgress(page);
  const link = mobile
    ? page.getByRole("link", {
        name: "Back to course assignments",
        exact: true,
      })
    : page
        .getByRole("navigation", { name: "Course workspace", exact: true })
        .getByRole("link", { name: "Assignments", exact: true });
  const href = await link.getAttribute("href");
  await link.click();
  await page.waitForURL(
    (url) =>
      url.pathname === "/teacher/assignments" &&
      url.searchParams.get("view") === null,
  );
  await page.locator(".awa-workspace").waitFor();
  await settle(page);
  const url = new URL(page.url());
  const discoveryHeading = await page
    .getByRole("heading", { name: "Assignments", exact: true })
    .count();
  check(
    "S1 " +
      (mobile ? "mobile Back" : "course Assignments") +
      " returns to discovery",
    !url.searchParams.has("assignment") && discoveryHeading === 1,
    {
      href,
      actual_url: url.href,
      discovery_heading_count: discoveryHeading,
      focus: await focus(page),
    },
    "#120 / #117",
  );
  await screenshot(page, mobile ? "S1-mobile-back" : "S1-course-assignments");
}
async function sessionReturnAndHistory(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openProgress(page);
  const link = page
    .getByRole("link", { name: "Read in full", exact: true })
    .first();
  await link.waitFor();
  const href = await link.getAttribute("href");
  await link.focus();
  const before = await focus(page),
    sourceURL = page.url();
  await page.keyboard.press("Enter");
  await page.waitForURL(new URL(href, origin).href);
  await page.locator(".lp-evidence-page").first().waitFor();
  const fullURL = page.url();
  await screenshot(page, "C2-full-session");
  const backLink = page
    .locator(".lp-evidence-page")
    .first()
    .getByRole("link", { name: /^Back to / })
    .first();
  const rendered = {
    text: await backLink.innerText(),
    href: await backLink.getAttribute("href"),
  };
  await page.goBack();
  await page.waitForURL(sourceURL);
  await page
    .getByRole("heading", { name: "Class progress", exact: true })
    .waitFor();
  await page.waitForTimeout(200);
  check(
    "Browser Back restores assignment selection URL",
    page.url() === sourceURL,
    { url: page.url() },
  );
  report.observations.push({
    label: "Browser Back focus (inspect separately from route pass)",
    before,
    after: await focus(page),
  });
  await page.goForward();
  await page.waitForURL(fullURL);
  await page.locator(".lp-evidence-page").first().waitFor();
  await page.waitForTimeout(200);
  check("Browser Forward restores exact session URL", page.url() === fullURL, {
    url: page.url(),
  });
  report.observations.push({
    label: "Browser Forward focus",
    focus: await focus(page),
  });
  await page.reload();
  await page.locator(".lp-evidence-page").first().waitFor();
  check("Session reload preserves exact selected URL", page.url() === fullURL, {
    url: page.url(),
  });
  await page
    .locator(".lp-evidence-page")
    .first()
    .getByRole("link", { name: /^Back to / })
    .first()
    .click();
  await page.waitForURL(new URL(rendered.href, origin).href);
  await settle(page);
  const returned = new URL(page.url());
  check(
    "C2 displayed session return restores progress selection",
    returned.pathname === "/teacher/assignments" &&
      returned.searchParams.get("view") === "progress" &&
      returned.searchParams.get("assignment") === assignment &&
      returned.searchParams.get("student") === student &&
      returned.searchParams.get("concept") === "transmission_delay",
    {
      source_url: sourceURL,
      full_session_url: fullURL,
      rendered_back: rendered,
      actual_return: returned.href,
    },
    "#117 / #116 / #120",
  );
  await screenshot(page, "C2-actual-return");
}
async function authoredPaneCheck(page) {
  if (!authoring) {
    report.checks.push({
      label: "Authored source reading and unsaved objective pane retention",
      status: "unrun",
      reason: "No completed authored fixture report supplied.",
    });
    return;
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    origin + "/teacher/objectives/" + encodeURIComponent(authoring.lesson_id),
  );
  const panes = page.getByRole("navigation", {
    name: "Authoring panes",
    exact: true,
  });
  await panes.getByRole("button", { name: "Editor", exact: true }).click();
  const input = page.getByLabel("Learning objective", { exact: true }).first();
  await input.waitFor();
  const original = await input.inputValue();
  const localText = original + " Local unsaved pane-retention verification.";
  try {
    await input.fill(localText);
    await panes.getByRole("button", { name: "Reading", exact: true }).click();
    const reading = page.locator(".aw-reading-pane");
    await reading.waitFor({ state: "visible" });
    const readingText = await reading.innerText();
    check(
      "Mobile authored reading shows pinned source words",
      readingText.includes("Evaporation") &&
        readingText.includes("water vapor"),
      {
        source_id: authoring.source_id,
        source_version: authoring.source_version,
      },
    );
    await screenshot(page, "authored-mobile-reading-with-unsaved-work");
    await panes.getByRole("button", { name: "Outline", exact: true }).click();
    await panes.getByRole("button", { name: "Editor", exact: true }).click();
    check(
      "Unsaved objective survives Reading/Outline/Editor pane changes",
      (await input.inputValue()) === localText,
      { lesson_id: authoring.lesson_id, server_save_attempted: false },
      "#118",
    );
    await screenshot(page, "authored-mobile-unsaved-restored");
  } finally {
    await panes.getByRole("button", { name: "Editor", exact: true }).click();
    await input.fill(original);
    check(
      "Local verification edit restored without saving",
      (await input.inputValue()) === original,
    );
  }
}
async function caseRun(label, callback, page) {
  if (fatal) return;
  stage = label;
  try {
    guard(label);
    await callback();
  } catch (error) {
    report.checks.push({
      label,
      status: "harness-or-runtime-error",
      error: error.message,
    });
    if (page)
      await screenshot(
        page,
        "failure-" + label.replace(/[^a-z0-9]+/gi, "-"),
      ).catch(() => {});
  }
  await save();
}
try {
  release = acquireLock({
    mode: "shell-accessibility",
    source: manifest.source,
    state,
    project: manifest.project,
    sourceSha: sha,
  });
  guard("initial");
  const base = await launch("native100", 1);
  report.native100 = await measure(base.page);
  await screenshot(base.page, "native100-login");
  await base.login();
  await caseRun(
    "desktop-scope-keyboard",
    () => scopeDialog(base.page, "Desktop scope dialog"),
    base.page,
  );
  await caseRun(
    "S1-desktop",
    () => discoveryCheck(base.page, false),
    base.page,
  );
  await caseRun(
    "C2-and-history",
    () => sessionReturnAndHistory(base.page),
    base.page,
  );
  await caseRun("S1-mobile", () => discoveryCheck(base.page, true), base.page);
  for (const width of [390, 320])
    await caseRun(
      "mobile-scope-" + width,
      async () => {
        await base.page.setViewportSize({ width, height: 844 });
        await openProgress(base.page);
        await scopeDialog(base.page, width + " CSS viewport scope dialog");
        await screenshot(base.page, "mobile" + width + "-scope");
      },
      base.page,
    );
  await caseRun(
    "authored-pane-retention",
    () => authoredPaneCheck(base.page),
    base.page,
  );
  await base.context.close();
  if (!fatal) {
    const zoom = await launch("native200", 2);
    report.native200 = await measure(zoom.page);
    const a = report.native100,
      b = report.native200;
    report.native_200_percent_verified =
      Math.abs(b.dpr / a.dpr - 2) < 0.02 &&
      Math.abs(b.innerWidth / a.innerWidth - 0.5) < 0.02 &&
      b.visualViewportScale === 1 &&
      b.rootZoom === "1" &&
      b.outerWidth === a.outerWidth;
    check(
      "Actual native200 browser zoom measurement",
      report.native_200_percent_verified,
      { baseline: a, zoom: b },
    );
    await screenshot(zoom.page, "native200-login");
    if (report.native_200_percent_verified) {
      await zoom.login();
      await caseRun(
        "native200-scope-and-reading",
        async () => {
          await scopeDialog(zoom.page, "Native200 scope dialog");
          await openProgress(zoom.page);
          await screenshot(zoom.page, "native200-progress");
          const full = await tabTo(
            zoom.page,
            (current) =>
              current.tag === "A" &&
              current.text === "Read in full" &&
              current.href?.startsWith("/teacher/sessions/"),
            "Native200 original full-session link",
          );
          await zoom.page.keyboard.press("Enter");
          await zoom.page.waitForURL(new URL(full.href, origin).href);
          await zoom.page.locator(".lp-evidence-page").first().waitFor();
          await screenshot(zoom.page, "native200-original-session");
          if (authoring) {
            await zoom.page.goto(
              origin +
                "/teacher/materials/" +
                encodeURIComponent(authoring.source_id) +
                "?version=" +
                authoring.source_version +
                "&passage=p001",
            );
            await zoom.page.locator(".lm-source-main-reading").waitFor();
            const text = await zoom.page
              .locator(".lm-source-main-reading")
              .innerText();
            check(
              "Native200 authored source reading",
              text.includes(
                "Evaporation changes liquid water into water vapor, a gas.",
              ),
              {
                source_id: authoring.source_id,
                source_version: authoring.source_version,
              },
            );
            await screenshot(zoom.page, "native200-authored-source");
          }
        },
        zoom.page,
      );
    }
  }
  report.status =
    report.checks.some((item) =>
      ["fail", "harness-or-runtime-error"].includes(item.status),
    ) || fatal
      ? "completed-with-failures"
      : "bounded-checks-completed";
} catch (error) {
  report.status = "partial";
  report.error = error.message;
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  try {
    release?.();
  } catch (error) {
    report.status = "failed";
    report.lock_release_error = error.message;
  }
  report.finished_at = new Date().toISOString();
  report.horizontal_overflow_observations = report.screenshots
    .filter((item) => item.overflow)
    .map((item) => item.file);
  if (
    report.horizontal_overflow_observations.length &&
    report.status === "bounded-checks-completed"
  )
    report.status = "completed-with-failures";
  await save();
  if (report.status !== "bounded-checks-completed") process.exitCode = 1;
  console.log(
    JSON.stringify({
      status: report.status,
      report: join(out, "report.json"),
      native_200_percent_verified: report.native_200_percent_verified,
    }),
  );
}
