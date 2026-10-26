import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
const [stateArg, playwrightArg, executablePath] = process.argv.slice(2);
const state = resolve(stateArg);
const manifest = JSON.parse(
  await readFile(resolve(state, "manifest.json"), "utf8"),
);
const authored = JSON.parse(
  await readFile(resolve(state, "browser-authoring/report.json"), "utf8"),
);
assert.match(manifest.origin, /^http:\/\/(localhost|127\.0\.0\.1):/);
assert.equal(manifest.paidModelCallsAuthorized, false);
const { chromium } = createRequire(import.meta.url)(resolve(playwrightArg));
const outputOverride = process.env.ACCEPTANCE_ACCESSIBILITY_OUT;
if (outputOverride !== undefined && !isAbsolute(outputOverride)) {
  throw new Error(
    "ACCEPTANCE_ACCESSIBILITY_OUT must be an absolute directory.",
  );
}
const out = outputOverride ?? resolve(state, "browser-accessibility");
if (existsSync(resolve(out, "report.json"))) {
  throw new Error(
    "Refusing to overwrite an existing accessibility report. Set ACCEPTANCE_ACCESSIBILITY_OUT to a fresh absolute directory.",
  );
}
await mkdir(out, { recursive: true });
const report = {
  target: manifest.target,
  sha: manifest.sourceSha,
  origin: manifest.origin,
  started_at_utc: new Date().toISOString(),
  method:
    "Fresh isolated Edge profiles; native partition.default_zoom_level preference; viewport:null; no CSS zoom, deviceScaleFactor, pinch or emulation",
  measurements: {},
  checks: [],
  keyboard: [],
  unrun: [],
  paid_calls: 0,
};
const profiles = [];
async function profile(label, zoom) {
  const dir = resolve(out, `profile-${label}-${Date.now()}`);
  await mkdir(resolve(dir, "Default"), { recursive: true });
  await writeFile(
    resolve(dir, "Default/Preferences"),
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
    executablePath,
    headless: true,
    viewport: null,
    args: ["--window-size=1440,900"],
  });
  profiles.push(context);
  const page = context.pages()[0];
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  await page.goto(`${manifest.origin}/login`);
  await page
    .getByRole("button", { name: "Demo teacher", exact: true })
    .waitFor();
  return { context, page };
}
async function measure(page) {
  return page.evaluate(() => ({
    devicePixelRatio,
    innerWidth,
    innerHeight,
    outerWidth,
    outerHeight,
    visualViewportScale: visualViewport.scale,
    cssZoom: getComputedStyle(document.documentElement).zoom,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
}
async function shot(page, name) {
  report.measurements[name] = await measure(page);
  const cdp = await page.context().newCDPSession(page);
  const capture = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  await writeFile(
    resolve(out, `${name}.png`),
    Buffer.from(capture.data, "base64"),
  );
  await cdp.detach();
}
async function focused(page) {
  return page.evaluate(() => {
    const e = document.activeElement;
    const s = getComputedStyle(e);
    return {
      tag: e.tagName,
      text: (
        e.getAttribute("aria-label") ||
        e.innerText ||
        e.getAttribute("placeholder") ||
        [...(e.labels || [])].map((l) => l.innerText).join(" ")
      )
        .trim()
        .slice(0, 160),
      href: e.getAttribute("href"),
      outline: s.outline,
      scrollY,
    };
  });
}
async function tabTo(page, match, label, limit = 110) {
  for (let n = 0; n < limit; n++) {
    await page.keyboard.press("Tab");
    const f = await focused(page);
    if (match(f)) {
      report.keyboard.push({ label, tabs: n + 1, focused: f });
      return f;
    }
  }
  report.unrun.push(
    `${label}: no matching reachable control found within ${limit} Tab presses`,
  );
  return null;
}
async function activate(page, match, label) {
  const f = await tabTo(page, match, label);
  if (f) await page.keyboard.press("Enter");
  return f;
}
async function keyboardLogin(page, role) {
  await activate(page, (f) => f.text === `Demo ${role}`, `${role} sign-in`);
  await page.waitForURL(
    role === "teacher" ? "**/teacher" : "**/study/assignments",
  );
}
async function openNavigation(page) {
  const button = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (await button.isVisible()) {
    await activate(
      page,
      (f) => f.text === "Open navigation",
      "open navigation drawer",
    );
  }
}
try {
  const baseline = await profile("baseline", 1);
  report.measurements.baseline = await measure(baseline.page);
  await shot(baseline.page, "01-baseline-login");
  await baseline.context.close();
  const zoomed = await profile("teacher-200", 2);
  const { page } = zoomed;
  report.measurements.zoom200 = await measure(page);
  await shot(page, "02-native-200-login");
  const a = report.measurements.baseline,
    b = report.measurements.zoom200;
  report.native_zoom_verified =
    Math.abs(b.devicePixelRatio / a.devicePixelRatio - 2) < 0.02 &&
    Math.abs(b.innerWidth / a.innerWidth - 0.5) < 0.02 &&
    b.visualViewportScale === 1 &&
    b.cssZoom === "1";
  if (!report.native_zoom_verified)
    throw new Error(
      "Native 200% zoom was not confirmed by DPR and viewport measurements.",
    );
  report.checks.push(
    "Native 200% zoom measured: DPR doubles, CSS viewport halves, visualViewport.scale and CSS zoom remain 1",
  );
  await keyboardLogin(page, "teacher");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await shot(page, "03-teacher-200");
  report.measurements.teacher = await measure(page);
  await openNavigation(page);
  const evidenceLink = await activate(
    page,
    (f) =>
      f.tag === "A" &&
      /\/teacher\/(insights|evidence)(\?|$)/.test(f.href || ""),
    "teacher evidence navigation",
  );
  if (evidenceLink) {
    await page.waitForURL(/\/teacher\/(insights|evidence)/);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await shot(page, "04-evidence-200");
    let visible = [];
    for (const link of await page
      .locator('a[href*="/teacher/sessions/"]')
      .all())
      if (await link.isVisible()) visible.push(await link.getAttribute("href"));
    if (!visible.length) {
      await activate(
        page,
        (f) => f.tag === "SUMMARY" && f.text !== "Account menu",
        "expand evidence details",
      );
      for (const link of await page
        .locator('a[href*="/teacher/sessions/"]')
        .all())
        if (await link.isVisible())
          visible.push(await link.getAttribute("href"));
    }
    if (visible.length) {
      const before = await activate(
        page,
        (f) => f.tag === "A" && f.href === visible[0],
        "open original student evidence",
      );
      if (before) {
        await page.waitForURL(/\/teacher\/sessions\//);
        await shot(page, "05-original-evidence-200");
        await page.goBack();
        await page.waitForURL(/\/teacher\/(insights|evidence)/);
        report.keyboard.push({
          label: "browser Back restoration",
          before,
          after: await focused(page),
        });
        await page.goForward();
        await page.waitForURL(/\/teacher\/sessions\//);
        report.keyboard.push({
          label: "browser Forward",
          after: await focused(page),
        });
        await page.goBack();
        await page.waitForURL(/\/teacher\/(insights|evidence)/);
      }
    } else
      report.unrun.push(
        "No visible original-session link reached in this bounded keyboard evidence pass",
      );
  }
  await openNavigation(page);
  const intervention = await activate(
    page,
    (f) => f.tag === "A" && (f.href || "").startsWith("/teacher/interventions"),
    "intervention review navigation",
  );
  if (intervention) {
    await page.waitForURL(/\/teacher\/interventions/);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await shot(page, "06-interventions-200");
    const saved = await activate(
      page,
      (f) => f.tag === "SUMMARY" && /Saved interventions/.test(f.text),
      "expand saved interventions",
    );
    if (saved) {
      const draft = await activate(
        page,
        (f) => f.tag === "A" && /[?&]draft=/.test(f.href || ""),
        "open saved intervention review",
      );
      if (draft) {
        await page.waitForURL(/[?&]draft=/);
        await shot(page, "07-saved-draft-200");
      }
    }
  } else
    report.unrun.push(
      "Existing saved intervention review was not reached in bounded keyboard pass",
    );
  await zoomed.context.close();
  const learner = await profile("student-200", 2);
  const s = learner.page;
  await keyboardLogin(s, "student");
  const selected = await activate(
    s,
    (f) =>
      f.tag === "A" &&
      f.href === `/study/assignments/${authored.assignment_id}`,
    "student assignment details",
  );
  if (selected) {
    await s.waitForURL(`**/study/assignments/${authored.assignment_id}`);
    const reading = await activate(
      s,
      (f) => f.tag === "A" && f.text === "Open reading",
      "student reading",
    );
    if (reading) {
      await s.waitForURL(/\/study\/reading/);
      await s
        .getByText(
          "Evaporation changes liquid water into water vapor, a gas.",
          { exact: false },
        )
        .first()
        .waitFor();
      await shot(s, "08-reading-200");
      report.measurements.reading = await measure(s);
      await s.keyboard.press("End");
      report.keyboard.push({
        label: "reading End key scroll",
        focused: await focused(s),
      });
      await s.goBack();
      await s.waitForURL(`**/study/assignments/${authored.assignment_id}`);
    }
    const study = await activate(
      s,
      (f) => f.tag === "A" && f.text === "Study session",
      "student study session",
    );
    if (study) {
      await s.waitForURL(/tab=study/);
      await s.locator("textarea").waitFor();
      const compose = await tabTo(
        s,
        (f) =>
          f.tag === "TEXTAREA" &&
          /Message your tutor|Ask a question/.test(f.text),
        "student composer",
      );
      if (compose) {
        await s.keyboard.type(
          "Unsent keyboard accessibility check; no answer is submitted.",
        );
        const text = await s.locator("textarea").inputValue();
        assert.equal(
          text,
          "Unsent keyboard accessibility check; no answer is submitted.",
        );
        await shot(s, "09-composer-keyboard-200");
        report.measurements.composer = await measure(s);
        report.checks.push(
          "Tab/Enter activation reached assignment, source and composer; exact unsent text entered without submitting; return from reading used native browser history API",
        );
        await s.keyboard.press("Control+A");
        await s.keyboard.press("Backspace");
      }
    }
  }
  await learner.context.close();
  report.status = "completed bounded checks";
} catch (error) {
  report.status = "partial";
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  for (const context of profiles) await context.close().catch(() => {});
  report.checked_at_utc = new Date().toISOString();
  report.unrun.push(
    "Screen-reader operation and comprehensive WCAG compliance",
    "Full keyboard-only editing/approval/delivery and all failure states",
    "Complete focus/scroll restoration across every page; PR116 Forward not reached",
  );
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
