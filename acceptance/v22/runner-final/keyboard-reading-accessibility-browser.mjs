// Keyboard/native200 reading follow-up only. Raw runs 01 and 02 remain unchanged.
// Usage: node keyboard-reading-accessibility-browser.mjs <state> <fresh-out> <playwright-package> <reviewed-safety.mjs> <authoring-report.json>
// private-profile-* folders contain browser authentication and MUST NOT be published.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [stateArg, outArg, playwrightArg, safetyArg, authoringArg] =
  process.argv.slice(2);
const focused = true;
const allowedCases = new Set([
  "desktop-scope-keyboard",
  "mobile-scope-390",
  "mobile-scope-320",
  "native200-scope-and-reading",
]);
assert.ok(
  authoringArg,
  "Native200 source reading requires the completed authoring receipt.",
);
for (const value of [stateArg, outArg, playwrightArg, safetyArg])
  assert.ok(value);
const state = resolve(stateArg),
  out = resolve(outArg);
assert.equal(basename(state), "runtime-final");
assert.equal(existsSync(out), false, "Use a fresh evidence directory.");
const manifest = JSON.parse(readFileSync(join(state, "manifest.json")));
const sha = "462cfb1b31d9108cec70d18b6553bd45048d2eed";
const tree = "03cca1fed3900a122e689c4a512afadd9052e5af";
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
const sourceChanges = spawnSync(
  "git",
  ["-C", manifest.source, "status", "--porcelain=v1", "--untracked-files=all"],
  { encoding: "utf8", windowsHide: true },
);
assert.equal(sourceChanges.status, 0);
assert.equal(
  sourceChanges.stdout.trim(),
  "",
  "Pinned source must remain clean.",
);
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
    "Filtered follow-up only: desktop/390/320 keyboard scope and native200 scope/reading. Ready means exactly one visible course-scoped destination shell, excluding the temporary unscoped loading shell. Already completed Evidence, assignment routing and authored recovery cases are unrun-filtered and their callbacks never execute. Raw runs 01/02 are unchanged. GET/HEAD only after demo login.",
  prior_run: "final-accessibility-02/report.json",
  prior_harness_sha256:
    "d200de27bb64ccf74672e58a4667574b8a19680f416991f82c6ef549cb395b64",
  native_200_percent_verified: false,
  actual_model_verification: "unrun",
  screen_reader: "unrun",
  unrun: [
    "Comprehensive keyboard/WCAG audit",
    "Student composer long-response stress",
    "Unsaved work on browser close or loss of browser storage",
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
    const bounds = element.getBoundingClientRect();
    const listBounds = element
      .closest(".wb-response-list")
      ?.getBoundingClientRect();
    return {
      tag: element.tagName,
      id: element.id,
      className: element.className,
      text: (element.getAttribute("aria-label") || element.textContent || "")
        .trim()
        .slice(0, 180),
      href: element.getAttribute("href"),
      controls: element.getAttribute("aria-controls"),
      name: element.getAttribute("name"),
      inDialog: Boolean(element.closest("dialog[open]")),
      rendered: element.getClientRects().length > 0,
      visible:
        element.getClientRects().length > 0 &&
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.bottom > 0 &&
        bounds.top < innerHeight &&
        bounds.right > 0 &&
        bounds.left < innerWidth &&
        (!listBounds ||
          (bounds.bottom > listBounds.top && bounds.top < listBounds.bottom)),
      outline: getComputedStyle(element).outline,
      scrollY,
    };
  });
const blockedMutationAttempts = () =>
  report.blocked_requests.filter(
    (request) =>
      new URL(request.url).origin === origin &&
      !["GET", "HEAD"].includes(request.method),
  );
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
async function tabTo(page, predicate, label, key = "Tab") {
  for (let tabs = 1; tabs <= 100; tabs++) {
    await page.keyboard.press(key);
    const current = await focus(page);
    if (predicate(current)) {
      report.observations.push({ label, key, tabs, focus: current });
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
      await page.locator('.tw-shell[data-scope="course"]:visible').waitFor();
      assert.equal(
        await page.locator('.tw-shell[data-scope="course"]:visible').count(),
        1,
      );
      await settle(page);
    },
  };
}
async function scopeDialog(page, label) {
  // New document starts from a compact course page, so forward Tab does not
  // walk backward through the full class grid before reaching the header.
  await page.goto(origin + "/teacher/lessons");
  await page.locator('.tw-shell[data-scope="course"]:visible').waitFor();
  assert.equal(
    await page.locator('.tw-shell[data-scope="course"]:visible').count(),
    1,
  );
  await settle(page);
  const before = await tabTo(
    page,
    (current) =>
      current.tag === "BUTTON" &&
      current.controls === "teacher-workspace-switcher",
    label + " trigger",
    "Tab",
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
  // The selected details pane intentionally hides the Class progress heading
  // at narrow widths; wait for the actual selected pane, without changing it.
  await page.locator('.ap-workbench[data-pane="details"]').waitFor();
  await page.locator("#cell-evidence").waitFor();
  assert.equal(new URL(page.url()).searchParams.get("view"), "progress");
  assert.equal(new URL(page.url()).searchParams.get("assignment"), assignment);
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
async function evidenceHistory(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const baseURL =
    origin +
    "/teacher/evidence?" +
    new URLSearchParams({
      assignment,
      origin: "synthetic_fixture",
      concept: "transmission_delay",
    });
  await page.goto(baseURL);
  const list = page.locator(".wb-response-list:visible");
  await list.waitFor();
  await settle(page);
  const ids = await list
    .locator("[data-evidence-attempt]")
    .evaluateAll((rows) => rows.map((row) => row.dataset.evidenceAttempt));
  assert.ok(
    ids.length >= 2,
    "Two seeded original responses are required for history checks.",
  );
  const first = ids[0],
    last = ids.at(-1);
  const overflowing = await list.evaluate(
    (element) => element.scrollHeight > element.clientHeight + 1,
  );
  report.observations.push({
    label: "Evidence history fixture",
    rows: ids.length,
    first,
    last,
    overflowing,
  });
  async function inspect(label, expectedURL, attempt, focusId, expectedRecord) {
    await page.waitForURL(expectedURL);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll(".wb-response-list")].filter(
          (element) => element.getClientRects().length,
        ).length === 1,
    );
    await list
      .locator(`[data-evidence-attempt="${attempt}"] a[aria-current="true"]`)
      .waitFor();
    await page.locator("#response-detail-title").waitFor();
    await settle(page);
    // Sample after router/effect placement, without manually setting focus or scroll.
    await page.waitForTimeout(180);
    const observed = await page.evaluate(() => {
      const list = [...document.querySelectorAll(".wb-response-list")].find(
        (element) => element.getClientRects().length,
      );
      const current = list.querySelector("a[aria-current='true']");
      const row = current.closest("[data-evidence-attempt]");
      const listBounds = list.getBoundingClientRect(),
        rowBounds = row.getBoundingClientRect();
      const active = document.activeElement,
        activeBounds = active.getBoundingClientRect();
      const state = history.state;
      return {
        url: location.href,
        selectedAttempt: row.dataset.evidenceAttempt,
        originalResponse: [
          ...document.querySelectorAll(".wb-original-response"),
        ].find((element) => element.getClientRects().length)?.textContent,
        activeId: active.id,
        activeTag: active.tagName,
        focusVisible:
          activeBounds.width > 0 &&
          activeBounds.height > 0 &&
          activeBounds.bottom > 0 &&
          activeBounds.top < innerHeight,
        selectedRowVisibleInList:
          rowBounds.bottom > listBounds.top &&
          rowBounds.top < listBounds.bottom,
        listScrollTop: list.scrollTop,
        listClientHeight: list.clientHeight,
        listScrollHeight: list.scrollHeight,
        windowScrollY: scrollY,
        entryToken:
          state && typeof state === "object"
            ? state.__learningPulseWorkspaceEntry
            : undefined,
      };
    });
    check(
      label + " preserves exact selected record",
      observed.url === expectedURL &&
        observed.selectedAttempt === attempt &&
        typeof observed.originalResponse === "string" &&
        observed.originalResponse.trim().length > 0,
      observed,
      "#116 / #120",
    );
    check(
      label + " restores page-owned focus",
      observed.activeId === focusId && observed.focusVisible,
      { expectedFocus: focusId, ...observed },
      "#116 / #120",
    );
    check(
      label + " keeps the selected row visible in its scroller",
      observed.selectedRowVisibleInList &&
        (!overflowing || attempt !== last || observed.listScrollTop > 0),
      observed,
      "#116 / #120",
    );
    if (expectedRecord) {
      check(
        label + " preserves original response text",
        observed.originalResponse === expectedRecord.originalResponse,
        { expectedAttempt: attempt, actualAttempt: observed.selectedAttempt },
        "#116 / #120",
      );
      check(
        label + " restores the known list position",
        Math.abs(observed.listScrollTop - expectedRecord.listScrollTop) <= 4,
        {
          expectedScrollTop: expectedRecord.listScrollTop,
          actualScrollTop: observed.listScrollTop,
          tolerancePixels: 4,
        },
        "#116 / #120",
      );
    }
    return observed;
  }
  async function choose(attempt, label) {
    const link = list.locator(`#evidence-response-${attempt}`);
    const expectedURL = new URL(await link.getAttribute("href"), origin).href;
    await link.click();
    return inspect(label, expectedURL, attempt, "response-detail-title");
  }
  const a1 = await choose(first, "Evidence first A entry");
  const b = await choose(last, "Evidence B entry");
  const a2 = await choose(first, "Evidence repeated A entry");
  check("Evidence actual links revisit the identical URL", a1.url === a2.url, {
    first: a1.url,
    repeat: a2.url,
  });
  check(
    "Repeated Evidence URL preserves the exact original response",
    a1.originalResponse === a2.originalResponse,
    { attempt: first },
    "#116 / #120",
  );
  report.observations.push({
    label: "Repeated-URL entry identities (opaque diagnostics only)",
    first: a1.entryToken,
    repeat: a2.entryToken,
  });
  await screenshot(page, "evidence-repeated-A-entry");
  await page.goBack();
  await inspect("Evidence Back to B", b.url, last, "response-detail-title", b);
  await page.goBack();
  await inspect(
    "Evidence Back to first A",
    a1.url,
    first,
    "response-detail-title",
    a1,
  );
  await page.goBack();
  await inspect(
    "Evidence Back to originating row",
    baseURL,
    first,
    `evidence-response-${first}`,
    a1,
  );
  await screenshot(page, "evidence-originating-row-restored");
  await page.goForward();
  await inspect(
    "Evidence Forward to first A",
    a1.url,
    first,
    "response-detail-title",
    a1,
  );
  await page.goForward();
  await inspect(
    "Evidence Forward to B",
    b.url,
    last,
    "response-detail-title",
    b,
  );
  await page.goForward();
  await inspect(
    "Evidence Forward to repeated A",
    a2.url,
    first,
    "response-detail-title",
    a2,
  );
  await page.reload();
  await inspect(
    "Evidence repeated-URL reload selection/hash",
    a2.url,
    first,
    "response-detail-title",
  );

  // Anonymous filters must not resurrect a formerly focused response row.
  await page.goto(baseURL);
  await list.waitFor();
  await list.locator(`#evidence-response-${first}`).focus();
  await page.getByLabel("Find a response", { exact: true }).click();
  await settle(page);
  const before = await focus(page);
  await page
    .getByRole("navigation", { name: "Course workspace", exact: true })
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === "/teacher");
  await page.locator('.tw-shell[data-scope="course"]:visible').waitFor();
  assert.equal(
    await page.locator('.tw-shell[data-scope="course"]:visible').count(),
    1,
  );
  await page.goBack();
  await page.waitForURL(baseURL);
  await list.waitFor();
  await settle(page);
  await page.waitForTimeout(180);
  const after = await focus(page);
  check(
    "Anonymous Evidence filter does not restore stale response-row focus",
    !after.id.startsWith("evidence-response-") &&
      Math.abs(after.scrollY - before.scrollY) <= 4,
    { before, after, exactAnonymousControlRestorationRequired: false },
    "#120",
  );
  await screenshot(page, "evidence-anonymous-filter-history");
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
  const input = page
    .getByPlaceholder("Students will be able to explain…", { exact: true })
    .first();
  await input.waitFor();
  const original = await input.inputValue();
  const before = await readObjectiveDraft(page);
  const initialRecovery = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    "objective-edits:" + authoring.lesson_id,
  );
  if (initialRecovery !== null) {
    report.checks.push({
      label: "Authored pane retention",
      status: "unrun",
      reason:
        "An existing recovery copy was preserved without editing or discarding it.",
    });
    return;
  }
  const localText = original + " Local unsaved pane-retention verification.";
  const mutationsBefore = blockedMutationAttempts().length;
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
      (await input.inputValue()) === localText &&
        blockedMutationAttempts().length === mutationsBefore,
      {
        lesson_id: authoring.lesson_id,
        server_save_attempted:
          blockedMutationAttempts().length > mutationsBefore,
        blocked_mutation_attempts:
          blockedMutationAttempts().slice(mutationsBefore),
      },
      "#118",
    );
    await screenshot(page, "authored-mobile-unsaved-restored");
  } finally {
    await panes.getByRole("button", { name: "Editor", exact: true }).click();
    await restoreSavedObjectiveDraft(page, before, original);
    check(
      "Original objective and saved review state restored through reload without saving",
      (await input.inputValue()) === original,
    );
  }
}
async function readObjectiveDraft(page) {
  const response = await page
    .context()
    .request.get(origin + "/api/teacher/objectives/" + authoring.lesson_id);
  assert.equal(response.status(), 200);
  const value = await response.json();
  assert.equal(value.lesson.id, authoring.lesson_id);
  assert.equal(value.lesson.revision, authoring.new_draft_revision);
  assert.equal(value.source.document_id, authoring.source_id);
  assert.equal(value.source.version, authoring.source_version);
  return value;
}
async function restoreSavedObjectiveDraft(page, before, original) {
  const dialogs = [];
  const answer = async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    if (
      dialog.type() === "confirm" &&
      dialog.message() ===
        "Discard your unsaved edits and load the saved version?"
    )
      await dialog.accept();
    else await dialog.dismiss();
  };
  page.on("dialog", answer);
  try {
    const refreshed = page.waitForResponse(
      (response) =>
        response.url() ===
          origin + "/api/teacher/objectives/" + authoring.lesson_id &&
        response.request().method() === "GET",
    );
    await page
      .getByRole("button", {
        name: /^(Discard edits and reload|Reload saved draft)$/,
        exact: true,
      })
      .click();
    const response = await refreshed;
    assert.equal(response.status(), 200);
    assert.deepEqual(await response.json(), before);
    await page
      .getByText("The saved version is loaded.", { exact: true })
      .waitFor();
    const input = page
      .getByPlaceholder("Students will be able to explain…", { exact: true })
      .first();
    assert.equal(await input.inputValue(), original);
    await page.waitForFunction(
      (key) => sessionStorage.getItem(key) === null,
      "objective-edits:" + authoring.lesson_id,
    );
    assert.deepEqual(await readObjectiveDraft(page), before);
    report.observations.push({
      label: "Local-only objective cleanup",
      dialogs,
      original_text_restored: true,
      original_server_snapshot_unchanged: true,
      application_save_invoked: false,
    });
  } finally {
    page.off("dialog", answer);
  }
}
async function authoredReloadRecovery(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  const editorURL = origin + "/teacher/objectives/" + authoring.lesson_id;
  await page.goto(editorURL);
  const panes = page.getByRole("navigation", {
    name: "Authoring panes",
    exact: true,
  });
  await panes.getByRole("button", { name: "Editor", exact: true }).click();
  const input = page
    .getByPlaceholder("Students will be able to explain…", { exact: true })
    .first();
  await input.waitFor();
  const key = "objective-edits:" + authoring.lesson_id;
  const initialRecovery = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    key,
  );
  if (initialRecovery !== null) {
    report.checks.push({
      label: "Unsaved objective reload/navigation recovery",
      status: "unrun",
      reason:
        "A pre-existing recovery copy was preserved; no test edit or discard occurred.",
    });
    return;
  }
  const before = await readObjectiveDraft(page);
  const original = await input.inputValue();
  const text = original + "\n  Local-only reload recovery verification.  ";
  const mutationsBefore = blockedMutationAttempts().length;
  let ownedEdit = false;
  const beforeUnload = async (dialog) => {
    if (dialog.type() === "beforeunload") await dialog.accept();
    else await dialog.dismiss();
  };
  try {
    await input.fill(text);
    ownedEdit = true;
    await page.waitForFunction(
      ({ key, text }) => {
        try {
          return JSON.parse(sessionStorage.getItem(key))?.items.some(
            (item) => item.objective === text,
          );
        } catch {
          return false;
        }
      },
      { key, text },
    );
    const copy = await page.evaluate(
      (key) => JSON.parse(sessionStorage.getItem(key)),
      key,
    );
    assert.equal(copy.lessonId, authoring.lesson_id);
    assert.equal(copy.sourceId, authoring.source_id);
    assert.equal(copy.sourceVersion, authoring.source_version);
    assert.equal(copy.revision, before.lesson.revision);
    await screenshot(page, "unsaved-objective-before-reload");
    page.on("dialog", beforeUnload);
    try {
      await page.reload();
    } finally {
      page.off("dialog", beforeUnload);
    }
    await panes.getByRole("button", { name: "Editor", exact: true }).click();
    const recovery = page.getByRole("region", {
      name: "Recover unsaved objectives",
      exact: true,
    });
    await recovery.waitFor();
    assert.deepEqual(await readObjectiveDraft(page), before);
    await screenshot(page, "unsaved-reload-recovery-offered");
    await recovery
      .getByRole("button", { name: "Restore unfinished edits", exact: true })
      .click();
    check(
      "Actual reload offers and restores exact unsaved objective text",
      (await input.inputValue()) === text &&
        blockedMutationAttempts().length === mutationsBefore,
      {
        lesson_id: authoring.lesson_id,
        draft_revision: before.lesson.revision,
        original_server_snapshot_unchanged: true,
        blocked_mutation_attempts:
          blockedMutationAttempts().slice(mutationsBefore),
      },
      "#118",
    );
    // Navigate using the application's own course link, then native Back.
    await page
      .getByRole("navigation", { name: "Course workspace mobile", exact: true })
      .getByRole("link", { name: "Lessons", exact: true })
      .click();
    await page.waitForURL((url) => url.pathname === "/teacher/lessons");
    await page.goBack();
    await page.waitForURL(editorURL);
    await panes.getByRole("button", { name: "Editor", exact: true }).click();
    await page.waitForFunction((text) => {
      const input = document.querySelector(
        'textarea[placeholder="Students will be able to explain…"]',
      );
      return (
        input?.value === text ||
        document.querySelector('[aria-label="Recover unsaved objectives"]')
      );
    }, text);
    const offeredAfterBack = await recovery.isVisible();
    if (offeredAfterBack)
      await recovery
        .getByRole("button", { name: "Restore unfinished edits", exact: true })
        .click();
    check(
      "Actual navigation away and Back preserve recoverable unsaved objective text",
      (await input.inputValue()) === text &&
        blockedMutationAttempts().length === mutationsBefore,
      {
        lesson_id: authoring.lesson_id,
        exact_url: page.url(),
        recovery_mode: offeredAfterBack
          ? "offered-recovery"
          : "retained-editor-state",
        blocked_mutation_attempts:
          blockedMutationAttempts().slice(mutationsBefore),
      },
      "#118",
    );
    await screenshot(page, "unsaved-objective-restored-after-back");
  } finally {
    page.off("dialog", beforeUnload);
    if (
      ownedEdit &&
      new URL(page.url()).pathname === new URL(editorURL).pathname
    ) {
      await panes.getByRole("button", { name: "Editor", exact: true }).click();
      const recovery = page.getByRole("region", {
        name: "Recover unsaved objectives",
        exact: true,
      });
      if (await recovery.isVisible()) {
        const copy = await page.evaluate(
          (key) => JSON.parse(sessionStorage.getItem(key)),
          key,
        );
        assert.ok(
          copy?.items.some((item) => item.objective === text),
          "Preserve any recovery copy other than this test's known edit.",
        );
        await recovery
          .getByRole("button", {
            name: "Restore unfinished edits",
            exact: true,
          })
          .click();
      }
      await restoreSavedObjectiveDraft(page, before, original);
    } else if (ownedEdit) {
      report.observations.push({
        label: "Recovery retained in private profile",
        reason:
          "Test stopped away from editor; the browser recovery copy was preserved without forced navigation or save.",
      });
    }
  }
}
async function originatingRowConfirmation(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const baseURL =
    origin +
    "/teacher/evidence?" +
    new URLSearchParams({
      assignment,
      origin: "synthetic_fixture",
      concept: "transmission_delay",
    });
  await page.goto(baseURL);
  const list = page.locator(".wb-response-list:visible");
  await list.waitFor();
  const row = list.locator("[data-evidence-attempt]").first();
  const attempt = await row.getAttribute("data-evidence-attempt");
  const targetId = "evidence-response-" + attempt;
  const link = row.locator("a").first();
  const detailURL = new URL(await link.getAttribute("href"), origin).href;
  // Reach the response using actual Tab from the preceding filter control.
  await page.locator('input[name="q"]').click();
  await tabTo(
    page,
    (current) => current.id === targetId,
    "Evidence originating response reached with Tab",
  );
  const before = await focus(page);
  assert.equal(before.id, targetId);
  const beforeMemory = await page.evaluate(
    () => history.state?.learningPulseEvidenceList,
  );
  await page.keyboard.press("Enter");
  await page.waitForURL(detailURL);
  await page.locator("#response-detail-title:visible").waitFor();
  await settle(page);
  await page.waitForTimeout(180);
  const detailFocus = await focus(page);
  check(
    "Focused Evidence Enter reaches the selected detail heading",
    detailFocus.id === "response-detail-title" && detailFocus.visible,
    { attempt, before, detailFocus, detailURL },
    "#116 / #120",
  );
  await screenshot(page, "focused-evidence-before-back");
  await page.goBack();
  await page.waitForURL(baseURL);
  await list.locator(`#${targetId}[aria-current="true"]`).waitFor();
  await settle(page);
  await page.waitForTimeout(500);
  const after = await focus(page);
  const afterMemory = await page.evaluate(
    () => history.state?.learningPulseEvidenceList,
  );
  check(
    "Confirmed Evidence Back returns focus to the keyboard-activated originating row",
    after.id === targetId && after.visible,
    {
      expectedFocus: targetId,
      attempt,
      baseURL,
      detailURL,
      before,
      after,
      beforeMemory,
      afterMemory,
      routeSettledDelayMs: 500,
      manualFocusOrScrollAfterBack: false,
    },
    "#116 / #120",
  );
  await screenshot(page, "focused-evidence-originating-row-after-back");
}
async function caseRun(label, callback, page) {
  if (!allowedCases.has(label)) {
    report.checks.push({
      label,
      status: "unrun-filtered",
      reason:
        "Preserved completed coverage from prior runs; callback not executed.",
    });
    return;
  }
  if (fatal) {
    report.checks.push({
      label,
      status: "unrun",
      reason: "Prior storage preflight failure stopped browser cases.",
    });
    return;
  }
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
  if (!focused) {
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
    await caseRun(
      "evidence-page-owned-history",
      () => evidenceHistory(base.page),
      base.page,
    );
  } else {
    await caseRun(
      "focused-originating-row-confirmation",
      () => originatingRowConfirmation(base.page),
      base.page,
    );
  }
  await caseRun("S1-mobile", () => discoveryCheck(base.page, true), base.page);
  for (const width of [390, 320])
    await caseRun(
      "mobile-scope-" + width,
      async () => {
        await base.page.setViewportSize({ width, height: 844 });
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
  await caseRun(
    "authored-reload-and-navigation-recovery",
    () => authoredReloadRecovery(base.page),
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
  report.blocked_mutation_attempts = blockedMutationAttempts();
  check(
    "No application mutation was attempted after fictional login",
    report.blocked_mutation_attempts.length === 0,
    { blocked_mutation_attempts: report.blocked_mutation_attempts },
  );
  if (
    report.blocked_mutation_attempts.length &&
    report.status === "bounded-checks-completed"
  )
    report.status = "completed-with-failures";
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
