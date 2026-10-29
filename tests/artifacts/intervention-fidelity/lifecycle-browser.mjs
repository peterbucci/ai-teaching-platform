import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
const [origin, draftId, outArg] = process.argv.slice(2);
const out = resolve(outArg);
assert.ok(!existsSync(out));
mkdirSync(out, { recursive: true });
const env = Object.fromEntries(
  readFileSync(process.env.INTERVENTION_TEST_ENV, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i), x.slice(i + 1)];
    }),
);
assert.equal(env.OPENAI_API_KEY, "");
assert.equal(env.OPENAI_MODEL, "");
const { chromium } = createRequire(import.meta.url)(
  "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const executablePath =
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const report = {
  status: "running",
  origin,
  draftId,
  paidCalls: 0,
  actions: [],
  checks: [],
  images: [],
  errors: [],
  blocked: [],
};
const save = () =>
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
const api = `/api/teacher/interventions/${draftId}`;
const path = `/teacher/interventions?draft=${draftId}&workspacePane=context`;
let allow = null;
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "en-GB",
  timezoneId: "America/New_York",
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", (e) => report.errors.push(e.message));
async function guard(ctx) {
  await ctx.route("**/*", (r) => {
    const req = r.request(),
      u = new URL(req.url());
    if (
      u.origin === origin &&
      (["GET", "HEAD", "OPTIONS"].includes(req.method()) ||
        (u.pathname === api &&
          req.method() === "POST" &&
          req.postDataJSON().action === allow))
    )
      return r.continue();
    report.blocked.push({ path: u.pathname, method: req.method() });
    return r.abort();
  });
}
const read = async () => {
  const r = await context.request.get(origin + api);
  assert.equal(r.status(), 200);
  return r.json();
};
async function pane(p, label) {
  const tab = p.getByRole("tab", { name: label, exact: true });
  if (await tab.isVisible()) {
    await tab.click();
    return;
  }
  const dialog = p.getByRole("dialog", { name: "Evidence", exact: true });
  if (
    (await dialog.isVisible()) &&
    (await dialog.evaluate((e) => e.matches(":modal"))) &&
    label !== "Evidence"
  )
    await p.keyboard.press("Escape");
  const trigger = p.getByRole("button", { name: `Open ${label}`, exact: true });
  if (await trigger.isVisible()) await trigger.click();
}
async function capture(p, name, native = false) {
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => {
    document.querySelector(
      ".tw-panes-panel--context .tw-panes-body",
    ).scrollTop = 0;
  });
  const m = await p.evaluate(() => {
    const b = document
      .querySelector(".tw-panes-panel--context .tw-panes-body")
      .getBoundingClientRect();
    return {
      width: innerWidth,
      height: innerHeight,
      dpr: devicePixelRatio,
      outerWidth,
      zoom: getComputedStyle(document.documentElement).zoom,
      scale: visualViewport.scale,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      completedRowsVisible: [
        ...document.querySelectorAll(
          ".lp-intervention-completed-stage > summary",
        ),
      ].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.top >= b.top && r.bottom <= b.bottom;
      }).length,
    };
  });
  assert.equal(m.overflow, false);
  await p.screenshot({ path: join(out, name + ".png") });
  if (native) {
    const cdp = await p.context().newCDPSession(p);
    const s = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    writeFileSync(
      join(out, name + "-surface.png"),
      Buffer.from(s.data, "base64"),
    );
    await cdp.detach();
  }
  report.images.push({ name, ...m });
  save();
}
async function matrix(name) {
  const before = await read();
  for (const width of [1440, 1024, 390, 320]) {
    await page.setViewportSize({
      width,
      height: width === 1440 ? 1000 : width === 1024 ? 768 : 844,
    });
    await pane(page, "Steps");
    await capture(page, `${name}-${width}`);
    if (width === 1024) {
      assert.equal(
        await page
          .getByRole("region", { name: "Activity", exact: true })
          .isVisible(),
        true,
      );
      assert.equal(
        await page
          .getByRole("region", { name: "Steps", exact: true })
          .isVisible(),
        true,
      );
      const trigger = page.getByRole("button", {
        name: "Open Evidence",
        exact: true,
      });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", {
        name: "Evidence",
        exact: true,
      });
      assert.equal(await dialog.evaluate((e) => e.matches(":modal")), true);
      for (let n = 0; n < 5; n++) {
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(
            () =>
              document.activeElement === document.body ||
              document
                .querySelector("dialog:modal")
                .contains(document.activeElement),
          ),
          true,
        );
      }
      await page.keyboard.press("Escape");
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains("tw-panes-context-trigger"),
      );
    }
  }
  const profile = join(out, name + "-private-profile");
  mkdirSync(join(profile, "Default"), { recursive: true });
  writeFileSync(
    join(profile, "Default", "Preferences"),
    JSON.stringify({
      partition: {
        default_zoom_level: {
          x: Math.log(2) / Math.log(1.2),
          0: Math.log(2) / Math.log(1.2),
        },
      },
    }),
  );
  const zoom = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: true,
    viewport: null,
    locale: "en-GB",
    timezoneId: "America/New_York",
    args: ["--window-size=1440,1000"],
  });
  try {
    await zoom.addCookies(await context.cookies());
    await guard(zoom);
    const zp = zoom.pages()[0];
    zp.on("pageerror", (e) => report.errors.push(e.message));
    await zp.goto(origin + path);
    await zp.locator(".lp-intervention-steps").waitFor();
    await pane(zp, "Steps");
    await capture(zp, name + "-native200", true);
    const m = report.images.at(-1);
    assert.equal(m.dpr, 2);
    assert.equal(m.width, 708);
    assert.equal(m.zoom, "1");
    assert.equal(m.scale, 1);
    if (name === "approved-undelivered" || name === "delivered")
      assert.ok(
        m.completedRowsVisible >= 4,
        "At least four completed stages must fit at native 200%.",
      );
  } finally {
    await zoom.close();
  }
  assert.deepEqual(
    await read(),
    before,
    "Pane/viewport changes do not mutate saved state",
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.blocked, []);
  report.checks.push({
    name: name + "-five-layouts-and-no-mutations",
    pass: true,
  });
  save();
}
async function action(kind, button) {
  const prior = await read();
  allow = kind;
  const item = {
    action: kind,
    status: "intent",
    priorRevision: prior.draft.revision,
  };
  report.actions.push(item);
  save();
  const wait = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === api &&
      r.request().method() === "POST" &&
      r.request().postDataJSON().action === kind,
  );
  await button.click();
  const response = await wait;
  item.httpStatus = response.status();
  if (response.status() !== 200)
    item.errorBody = await response.json().catch(() => null);
  item.request = response.request().postDataJSON();
  save();
  assert.equal(
    response.status(),
    200,
    "Reconcile saved result; never blindly replay",
  );
  allow = null;
  const next = await read();
  assert.equal(
    next.draft.revision,
    prior.draft.revision + (kind === "deliver" ? 0 : 1),
  );
  assert.deepEqual(next.draft.evidence, prior.draft.evidence);
  item.status = "acknowledged";
  item.savedRevision = next.draft.revision;
  item.approval = next.approval?.id;
  item.delivery = next.delivery?.id;
  save();
  return next;
}
try {
  const login = await context.request.post(origin + "/api/auth/sign-in/email", {
    data: {
      email: env.DEMO_TEACHER_EMAIL,
      password: env.DEMO_TEACHER_PASSWORD,
    },
    headers: { Origin: origin },
  });
  assert.equal(login.status(), 200);
  await guard(context);
  const initial = await read();
  assert.equal(initial.draft.status, "private_draft");
  assert.equal(initial.approval, null);
  assert.equal(initial.delivery, null);
  await page.goto(origin + path);
  await page.locator(".lp-intervention-steps").waitFor();
  await matrix("private");
  await page.setViewportSize({ width: 390, height: 844 });
  await pane(page, "Activity");
  await page
    .getByRole("button", { name: "Edit activity", exact: true })
    .click();
  const title = page.getByLabel("Activity title", { exact: true });
  const edited = initial.draft.activity.title + " · fidelity review";
  await title.fill(edited);
  await page.evaluate(
    () =>
      (window.__editorNode = document.querySelector("#intervention-edit-form")),
  );
  for (const width of [390, 320, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await pane(page, "Evidence");
    await pane(page, "Steps");
    await pane(page, "Activity");
    assert.equal(await title.inputValue(), edited);
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector("#intervention-edit-form") ===
          window.__editorNode,
      ),
      true,
    );
    assert.equal(await page.locator("#intervention-edit-form").count(), 1);
  }
  assert.deepEqual(await read(), initial);
  report.checks.push({
    name: "one-mounted-editor-and-unsaved-work-across-panes",
    pass: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await pane(page, "Steps");
  await page
    .locator(".tw-bottom-nav")
    .getByRole("link", { name: "Student work", exact: true })
    .click();
  await page.locator("#intervention-navigation-notice").waitFor();
  assert.equal(new URL(page.url()).pathname, "/teacher/interventions");
  page.once("dialog", (d) => d.accept());
  await page.reload();
  await page.waitForFunction(
    () =>
      document.querySelector(".lp-intervention-editor") &&
      !document.querySelector(".lp-intervention-editor").disabled,
  );
  await pane(page, "Activity");
  await page
    .getByRole("button", { name: "Edit activity", exact: true })
    .click();
  assert.equal(await title.inputValue(), edited);
  report.checks.push({
    name: "unsaved-navigation-guard-and-reload-recovery",
    pass: true,
  });
  await pane(page, "Steps");
  let saved = await action(
    "save",
    page.getByRole("button", { name: "Save private revision", exact: true }),
  );
  assert.equal(saved.draft.activity.title, edited);
  assert.equal(saved.approval, null);
  assert.equal(saved.delivery, null);
  await matrix("edited-saved");
  await page.setViewportSize({ width: 390, height: 844 });
  await pane(page, "Steps");
  await page.locator(".lp-intervention-recipient-selection > summary").click();
  await page.locator(".lp-intervention-recipient input").first().check();
  saved = await action(
    "approve",
    page.getByRole("button", { name: /^Approve revision .* for 1 student$/ }),
  );
  assert.equal(saved.approval.recipient_ids.length, 1);
  assert.ok(
    initial.eligible_recipients.some(
      (x) => x.student_id === saved.approval.recipient_ids[0],
    ),
  );
  assert.equal(saved.delivery, null);
  await matrix("approved-undelivered");
  await page.setViewportSize({ width: 390, height: 844 });
  await pane(page, "Steps");
  saved = await action(
    "deliver",
    page.getByRole("button", {
      name: /^Deliver approved activity to 1 students$/,
    }),
  );
  assert.equal(saved.delivery.approval_id, saved.approval.id);
  await matrix("delivered");
  await page.reload();
  assert.deepEqual(await read(), saved);
  assert.equal(report.actions.length, 3);
  assert.equal(
    new Set(report.actions.map((a) => a.request.request_id)).size,
    3,
  );
  report.status = "passed";
} catch (e) {
  report.failure = e.stack;
  process.exitCode = 1;
  await page.screenshot({ path: join(out, "failure.png") }).catch(() => {});
} finally {
  save();
  await context.close();
  await browser.close();
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      actions: report.actions.length,
      failure: report.failure,
    }),
  );
}
