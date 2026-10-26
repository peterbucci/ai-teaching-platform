// F1 from the original final-acceptance six-blocker-browser.mjs, adapted only
// to configurable local origin/output and current authorized saved records.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
const [origin, outArg] = process.argv.slice(2);
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const out = resolve(outArg);
mkdirSync(out);
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE ??
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const executablePath =
  process.env.BROWSER_EXECUTABLE ??
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const browser = await chromium.launch({ headless: true, executablePath });
const report = {
  origin,
  fixture: "original07efb7f final-acceptance clone",
  checks: [],
  blocked: [],
};
const fixture = buildClassFixture(loadApprovedContent());
const freshIds = fixture.sessions
  .flatMap((s) =>
    s.attempts
      .filter(
        (a) =>
          a.response_text !== null &&
          a.question.concept_ids.includes("transmission_delay"),
      )
      .map((a) => a.id),
  )
  .sort();
const start =
  origin +
  "/teacher/evidence?assignment=30000000-0000-4000-8000-000000000001&origin=synthetic_fixture&concept=transmission_delay";
async function waitEvidence(page) {
  await page.locator(".tw-panes").waitFor();
  await page.waitForFunction(() => {
    const root = document.querySelector(".tw-panes");
    const id = new URL(location.href).searchParams.get("attempt");
    return (
      root?.dataset.layout ===
        (innerWidth <= 800
          ? "compact"
          : innerWidth <= 1240
            ? "medium"
            : "wide") &&
      document.querySelectorAll(".wb-response-list").length === 1 &&
      (!id ||
        document.querySelector(
          '.wb-response-list [data-evidence-attempt="' +
            id +
            '"] a[aria-current="true"]',
        ))
    );
  });
  await page.waitForTimeout(550);
}
async function observe(page) {
  return page.evaluate(() => {
    const el = document.activeElement,
      r = el?.getBoundingClientRect(),
      body = document
        .querySelector(".wb-response-list")
        ?.closest(".tw-panes-body");
    return {
      focus: el?.id,
      visible:
        !!r &&
        r.width > 0 &&
        r.height > 0 &&
        r.bottom > 0 &&
        r.top < innerHeight,
      scroll: body?.scrollTop,
      scrollHeight: body?.scrollHeight,
      clientHeight: body?.clientHeight,
      answer: document.querySelector(".wb-original-response")?.textContent,
    };
  });
}
async function run(context, label) {
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
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(origin + "/login");
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/teacher"));
  if (label === "native200") {
    const zoom = await page.evaluate(() => ({
      dpr: devicePixelRatio,
      width: innerWidth,
      zoom: getComputedStyle(document.documentElement).zoom,
      scale: visualViewport.scale,
    }));
    assert(
      zoom.dpr === 2 &&
        zoom.width < 800 &&
        ["1", "normal"].includes(zoom.zoom) &&
        zoom.scale === 1,
    );
    report.nativeZoom = zoom;
  }
  for (const which of ["first", "last"]) {
    await page.goto(start);
    await waitEvidence(page);
    const ids = await page
      .locator(".wb-response-list [data-evidence-attempt]")
      .evaluateAll((els) => els.map((el) => el.dataset.evidenceAttempt).sort());
    if (!report.fixtureComparison)
      report.fixtureComparison = {
        actual: ids.length,
        fresh: freshIds.length,
        extra: ids.filter((id) => !freshIds.includes(id)),
        missing: freshIds.filter((id) => !ids.includes(id)),
      };
    const links = page.locator(
      ".wb-response-list [data-evidence-attempt] a[id]",
    );
    const row = which === "first" ? links.first() : links.last();
    const id = await row.getAttribute("id"),
      href = new URL(await row.getAttribute("href"), origin).href;
    let reached = false;
    for (let i = 0; i < 250; i++) {
      if (await page.evaluate((id) => document.activeElement?.id === id, id)) {
        reached = true;
        break;
      }
      await page.keyboard.press("Tab");
    }
    assert(reached, "Keyboard row reachable");
    const before = await observe(page);
    await page.keyboard.press("Enter");
    await page.waitForURL(href);
    await waitEvidence(page);
    const selected = await observe(page);
    assert.equal(selected.focus, "response-detail-title");
    assert(selected.visible);
    const u = new URL(href),
      r = await context.request.get(
        origin + "/api/teacher/sessions/" + u.searchParams.get("session"),
      );
    assert.equal(r.status(), 200);
    const saved = await r.json();
    assert.equal(
      selected.answer,
      saved.attempts.find((a) => a.id === u.searchParams.get("attempt"))
        .response_text,
    );
    await page.goBack();
    await page.waitForURL(start);
    await waitEvidence(page);
    const back = await observe(page);
    assert.equal(back.focus, id);
    assert(back.visible);
    assert(Math.abs(back.scroll - before.scroll) <= 4);
    if (which === "last")
      assert(before.scroll > 0 && before.scrollHeight > before.clientHeight);
    await page.screenshot({ path: resolve(out, `F1-${label}-${which}.png`) });
    await page.goForward();
    await page.waitForURL(href);
    await waitEvidence(page);
    const forward = await observe(page);
    assert.equal(forward.answer, selected.answer);
    assert.equal(forward.focus, "response-detail-title");
    await page.reload();
    await waitEvidence(page);
    assert.equal((await observe(page)).answer, selected.answer);
    report.checks.push({
      label,
      which,
      status: "passed",
      row: id,
      scrollBefore: before.scroll,
      scrollAfter: back.scroll,
      originalMatchesAPI: true,
      focusVisible: true,
      nativeBackForward: true,
      reload: true,
    });
  }
  await context.close();
}
try {
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ])
    await run(
      await browser.newContext({
        viewport: { width, height },
        timezoneId: "UTC",
      }),
      `${width}x${height}`,
    );
  const profile = resolve(out, "private-profile-native200");
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
  await run(
    await chromium.launchPersistentContext(profile, {
      executablePath,
      headless: true,
      viewport: null,
      timezoneId: "UTC",
      args: ["--window-size=1440,1000"],
    }),
    "native200",
  );
  assert.deepEqual(report.blocked, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(resolve(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
