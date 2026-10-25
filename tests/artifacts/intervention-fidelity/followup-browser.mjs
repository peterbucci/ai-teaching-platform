import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
const [origin, draft, outArg] = process.argv.slice(2),
  out = resolve(outArg);
mkdirSync(out);
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
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  locale: "en-GB",
  timezoneId: "America/New_York",
});
const report = {
  status: "running",
  draft,
  checks: [],
  errors: [],
  blocked: [],
};
const api = origin + `/api/teacher/interventions/${draft}/followup`;
async function guard(c) {
  await c.route("**/*", (r) => {
    const u = new URL(r.request().url());
    if (
      u.origin === origin &&
      ["GET", "HEAD", "OPTIONS"].includes(r.request().method())
    )
      return r.continue();
    report.blocked.push({ path: u.pathname, method: r.request().method() });
    return r.abort();
  });
}
async function shot(page, label, native = false) {
  await page.screenshot({ path: join(out, label + ".png") });
  if (native) {
    const c = await page.context().newCDPSession(page);
    const raw = await c.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    writeFileSync(
      join(out, label + "-surface.png"),
      Buffer.from(raw.data, "base64"),
    );
    await c.detach();
  }
}
async function inspect(page, label, comparison, native = false) {
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.setDefaultTimeout(20000);
  await page.goto(
    origin + `/teacher/interventions?draft=${draft}&workspacePane=context`,
  );
  await page
    .getByText("Compare original and follow-up work", { exact: true })
    .click();
  const saved = comparison.recipients.find((r) => r.attempt?.response_text);
  assert.ok(saved);
  const recipient = page.locator(".lp-followup-recipient").filter({
    has: page
      .locator(":scope > summary")
      .getByText(saved.display_name, { exact: true }),
  });
  await recipient.locator(":scope > summary").click();
  const originals = comparison.original_evidence.observations.filter(
    (o) => o.student_id === saved.student_id,
  );
  assert.ok(originals.length);
  await recipient.locator(".lp-followup-original > summary").first().click();
  const original = recipient
    .locator(".lp-followup-original blockquote")
    .first();
  assert.equal(
    await original.textContent(),
    originals[0].attempt.response_text,
  );
  await original.scrollIntoViewIfNeeded();
  await shot(page, label + "-original", native);
  const after = recipient.locator(".lp-followup-after blockquote");
  assert.equal(await after.textContent(), saved.attempt.response_text);
  await after.scrollIntoViewIfNeeded();
  await shot(page, label + "-followup", native);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  report.checks.push({
    label,
    originalExact: true,
    followupExact: true,
    source: comparison.content_ref,
    approval: comparison.approval_id,
    attempt: saved.attempt.id,
  });
}
try {
  assert.equal(
    (
      await context.request.post(origin + "/api/auth/sign-in/email", {
        data: {
          email: env.DEMO_TEACHER_EMAIL,
          password: env.DEMO_TEACHER_PASSWORD,
        },
        headers: { Origin: origin },
      })
    ).status(),
    200,
  );
  await guard(context);
  const r = await context.request.get(api);
  assert.equal(r.status(), 200);
  const comparison = await r.json();
  const page = await context.newPage();
  for (const width of [1440, 1024, 390, 320]) {
    await page.setViewportSize({
      width,
      height: width === 1440 ? 1000 : width === 1024 ? 768 : 844,
    });
    await inspect(page, String(width), comparison);
  }
  const profile = join(out, "private-profile");
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
  const z = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: true,
    viewport: null,
    locale: "en-GB",
    timezoneId: "America/New_York",
    args: ["--window-size=1440,1000"],
  });
  try {
    await z.addCookies(await context.cookies());
    await guard(z);
    await inspect(z.pages()[0], "native200", comparison, true);
  } finally {
    await z.close();
  }
  assert.deepEqual(await (await context.request.get(api)).json(), comparison);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.blocked, []);
  report.status = "passed";
} catch (e) {
  report.failure = e.stack;
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      failure: report.failure,
    }),
  );
}
