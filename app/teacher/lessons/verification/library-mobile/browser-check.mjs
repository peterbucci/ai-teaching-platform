// Opt-in, read-only browser regression against an isolated provider-disabled app.
// Requires pre-created fictional fixtures; does not create, edit or publish work.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i], process.argv[i + 1]);
for (const key of [
  "--origin",
  "--output",
  "--modules",
  "--browser",
  "--fixture",
  "--env",
  "--baseline",
])
  assert.ok(args.get(key), key + " required");
const origin = new URL(args.get("--origin")).origin;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const out = resolve(args.get("--output"));
assert.equal(existsSync(out), false, "Fresh evidence directory required");
mkdirSync(out, { recursive: true });
const fixture = JSON.parse(readFileSync(args.get("--fixture"), "utf8"));
const baseline = JSON.parse(readFileSync(args.get("--baseline"), "utf8"))
  .captures[0];
const env = parseEnv(readFileSync(args.get("--env"), "utf8"));
assert.equal(env.OPENAI_API_KEY, "");
assert.equal(env.AUTH_URL, origin);
const { chromium } = createRequire(import.meta.url)(
  join(args.get("--modules"), "playwright"),
);
const report = {
  origin,
  cases: [],
  pageErrors: [],
  blocked: [],
  screenshots: [],
  fixtures: "fictional; isolated database",
  paidCalls: 0,
};
const browser = await chromium.launch({
  headless: true,
  executablePath: args.get("--browser"),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const contexts = [context];
async function guard(c) {
  await c.route("**/*", (route) => {
    const r = route.request(),
      u = new URL(r.url());
    if (["data:", "blob:"].includes(u.protocol)) return route.continue();
    if (
      u.origin === origin &&
      (["GET", "HEAD", "OPTIONS"].includes(r.method()) ||
        ["/api/auth/demo-sign-in", "/api/auth/sign-in/email"].includes(
          u.pathname,
        ))
    )
      return route.continue();
    report.blocked.push({ url: r.url(), method: r.method() });
    return route.abort();
  });
}
await guard(context);
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on("pageerror", (e) => report.pageErrors.push(e.message));
async function check(name, fn) {
  try {
    const detail = await fn();
    report.cases.push({ name, status: "passed", detail });
  } catch (e) {
    report.cases.push({ name, status: "failed", error: e.message });
    await page
      .screenshot({
        path: join(out, "failure-" + report.cases.length + ".png"),
      })
      .catch(() => {});
  }
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
}
async function library(p = page, query = "") {
  await p.goto(origin + "/teacher/lessons" + query);
  await p.locator(".ll-workspace").waitFor();
  await p.evaluate(() => document.fonts.ready);
}
const row = (lesson) =>
  page.locator(".ll-row").filter({
    has: page.getByRole("link", { name: lesson.title, exact: true }),
  });
async function shot(p, name, fullPage = false) {
  await p.screenshot({ path: join(out, name + ".png"), fullPage });
  report.screenshots.push(name + ".png");
}
const noOverflow = (p) =>
  p.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
async function fits(p) {
  const m = await noOverflow(p);
  assert.ok(m.scrollWidth <= m.width + 1, JSON.stringify(m));
  return m;
}
async function focusVisible(p) {
  return p.evaluate(() => {
    const e = document.activeElement,
      r = e.getBoundingClientRect(),
      s = getComputedStyle(e);
    const nav = document.querySelector(".tw-bottom-nav"),
      n = nav?.getBoundingClientRect();
    const top =
      document.querySelector(".tw-section-nav")?.getBoundingClientRect()
        .bottom ?? 0;
    return {
      tag: e.tagName,
      text: e.innerText ?? e.getAttribute("aria-label"),
      outline: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      y: r.y,
      bottom: r.bottom,
      topLimit: top,
      bottomLimit: n && n.height > 0 ? n.top : innerHeight,
    };
  });
}
try {
  await page.goto(origin + "/login");
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL("**/teacher");
  await library();
  await check(
    "Original resume and immutable publication hrefs match the base",
    async () => {
      const links = await page.locator(".ll-row a").evaluateAll((es) =>
        es.map((e) => ({
          text: e.textContent.trim(),
          href: e.getAttribute("href"),
        })),
      );
      for (const link of baseline.links.filter(
        (x) => !["Class assignments", "1 classes"].includes(x.text),
      )) {
        if (link.text.startsWith("Continue ")) continue;
        assert.ok(
          links.some((x) => x.href === link.href),
          "Missing exact base href " + link.href,
        );
      }
      for (const lesson of fixture.lessons) {
        const a = row(lesson);
        assert.equal(await a.count(), 1);
        for (const version of lesson.versions) {
          assert.equal(
            await a
              .locator(".ll-details a")
              .filter({ hasText: new RegExp("^Version " + version + "$") })
              .getAttribute("href"),
            "/teacher/lessons/" +
              encodeURIComponent(lesson.id) +
              "?version=" +
              encodeURIComponent(version),
          );
        }
      }
      return "All original lesson/source identities retained; every history link pins its own version.";
    },
  );
  const original = fixture.lessons.find((x) =>
    x.title.startsWith("Water changing state · verification"),
  );
  const multiple = fixture.lessons.find((x) => x.versions.length > 1);
  assert.ok(original && multiple);
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ]) {
    const label = width + "x" + height;
    await page.setViewportSize({ width, height });
    await library();
    await check(label + " long title remains complete and wraps", async () => {
      const a = row(fixture.longLesson);
      const title = a.getByRole("link", {
        name: fixture.longLesson.title,
        exact: true,
      });
      assert.equal((await title.textContent()).length, 300);
      await title.scrollIntoViewIfNeeded();
      await fits(page);
      await shot(page, "long-title-" + label);
      return { characters: 300, href: await title.getAttribute("href") };
    });
    await check(
      label + " keyboard disclosure, complete source and revision",
      async () => {
        const a = row(original),
          s = a.locator("summary");
        await s.focus();
        await page.keyboard.press("Enter");
        assert.equal(await a.locator("details").getAttribute("open"), "");
        assert.ok(
          await a
            .locator("dd")
            .filter({ hasText: original.sourceTitle })
            .isVisible(),
        );
        assert.ok(
          (await a.locator("details").innerText()).includes(
            "source v" + original.source.source_version,
          ),
        );
        assert.ok(
          (await a.locator("details").innerText()).includes(
            "Revision " + original.revision,
          ),
        );
        const focus = await focusVisible(page);
        assert.equal(focus.outline, "solid");
        assert.equal(focus.outlineWidth, "2px");
        await fits(page);
        await a.locator("details dl").scrollIntoViewIfNeeded();
        await shot(page, "details-" + label);
        await page.keyboard.press("Space");
        assert.equal(await a.locator("details").getAttribute("open"), null);
        return focus;
      },
    );
    await check(
      label + " every published version opens its exact immutable view",
      async () => {
        for (const version of multiple.versions) {
          await library();
          const a = row(multiple);
          await a.locator("summary").click();
          const link = a.getByRole("link", {
            name: "Version " + version,
            exact: true,
          });
          const expected = await link.getAttribute("href");
          await link.click();
          await page.waitForURL(origin + expected);
          await page.locator(".aw-workspace").waitFor();
          assert.equal(
            new URL(page.url()).searchParams.get("version"),
            version,
          );
          await fits(page);
        }
        return multiple.versions;
      },
    );
    await check(
      label + " resume action opens the existing question bank",
      async () => {
        await library();
        const a = row(original),
          link = a.locator(".ll-resume");
        const expected = await link.getAttribute("href");
        assert.equal(
          expected,
          "/teacher/lessons/" + original.id + "/questions",
        );
        await link.click();
        await page.waitForURL(origin + expected);
        await page
          .getByRole("heading", { name: /^[0-9]+ questions$/ })
          .waitFor();
        await fits(page);
        return expected;
      },
    );
    await check(label + " search, no results, and clear", async () => {
      await library();
      const input = page.getByRole("textbox", { name: "Find a lesson" });
      await input.fill(original.title);
      await input.press("Enter");
      await page.waitForURL((u) => u.searchParams.get("q") === original.title);
      await row(original).waitFor();
      assert.equal(await page.locator(".ll-row").count(), 1);
      assert.equal(await row(original).count(), 1);
      await page.getByRole("link", { name: "Clear", exact: true }).click();
      await page.waitForURL(origin + "/teacher/lessons");
      await page
        .getByRole("textbox", { name: "Find a lesson" })
        .fill("no-library-title-matches-7f51");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await page
        .getByRole("heading", { name: "No lessons match this search" })
        .waitFor();
      await fits(page);
      await shot(page, "no-results-" + label);
      await page
        .getByRole("link", { name: "Show all lessons", exact: true })
        .click();
      await page.waitForURL(origin + "/teacher/lessons");
      await page.locator(".ll-row").first().waitFor();
      assert.equal(
        await page.locator(".ll-row").count(),
        fixture.lessons.length,
      );
      return "GET search only; no grading, model or authoring request.";
    });
    await check(
      label +
        " teaching material and exact source version reachable below fold",
      async () => {
        await library();
        const material = page.locator(".la-source-list a").first();
        const expected = await material.getAttribute("href");
        assert.ok(/\?version=\d+$/.test(expected));
        await material.scrollIntoViewIfNeeded();
        await shot(page, "below-fold-" + label);
        await material.click();
        await page.waitForURL(origin + expected);
        assert.ok(new URL(page.url()).searchParams.get("version"));
        await fits(page);
        return expected;
      },
    );
    await check(
      label + " keyboard order and unobscured focus through the library",
      async () => {
        await library();
        await page
          .getByRole("link", { name: "New lesson", exact: true })
          .focus();
        const seen = [];
        let reachedMaterial = false;
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press("Tab");
          const f = await focusVisible(page);
          if (f.tag === "BODY") break;
          seen.push(f);
          if (
            await page
              .locator(".ll-workspace")
              .evaluate((e) => e.contains(document.activeElement))
          ) {
            assert.equal(f.outline, "solid");
            assert.ok(
              f.y >= f.topLimit - 1 && f.bottom <= f.bottomLimit + 1,
              "Obscured focus: " + JSON.stringify(f),
            );
          }
          if (
            await page
              .locator(".la-source-list")
              .evaluate((e) => e.contains(document.activeElement))
          ) {
            reachedMaterial = true;
            break;
          }
        }
        assert.ok(reachedMaterial, "Keyboard must reach source records");
        await shot(page, "keyboard-" + label);
        return seen;
      },
    );
  }
  await check(
    "New lesson and secondary library actions remain reachable",
    async () => {
      await library();
      await page.getByRole("link", { name: "New lesson", exact: true }).click();
      await page.waitForURL("**/teacher/lessons?new=true");
      await page
        .getByRole("heading", { name: "New lesson", exact: true })
        .waitFor();
      await page.getByRole("link", { name: "Cancel", exact: true }).click();
      await page.waitForURL(origin + "/teacher/lessons");
      return "New form and cancel work without a write.";
    },
  );
  const empty = await browser.newContext({
    viewport: { width: 320, height: 844 },
  });
  contexts.push(empty);
  await guard(empty);
  const ep = await empty.newPage();
  ep.on("pageerror", (e) => report.pageErrors.push(e.message));
  const signIn = await empty.request.post(origin + "/api/auth/sign-in/email", {
    headers: { Origin: origin },
    data: { email: fixture.emptyEmail, password: env.DEMO_TEACHER_PASSWORD },
  });
  assert.ok(signIn.ok());
  for (const [width, height] of [
    [1440, 1000],
    [320, 844],
  ])
    await check("Empty library " + width + "x" + height, async () => {
      await ep.setViewportSize({ width, height });
      await library(ep);
      await ep
        .getByRole("heading", {
          name: "Your first lesson starts with teaching material",
        })
        .waitFor();
      assert.equal(await ep.locator(".ll-row").count(), 0);
      assert.ok(
        await ep
          .getByRole("link", { name: "New lesson", exact: true })
          .isVisible(),
      );
      await fits(ep);
      await shot(ep, "empty-" + width + "x" + height);
      return "Real fictional teacher with zero saved lessons or material.";
    });

  const nativeMetrics = [];
  for (const factor of [1, 2]) {
    const profile = join(out, "private-profile-" + factor);
    mkdirSync(join(profile, "Default"), { recursive: true });
    const level = Math.log(factor) / Math.log(1.2);
    writeFileSync(
      join(profile, "Default", "Preferences"),
      JSON.stringify({
        partition: { default_zoom_level: { x: level, 0: level } },
      }),
    );
    const nc = await chromium.launchPersistentContext(profile, {
      headless: true,
      executablePath: args.get("--browser"),
      viewport: null,
      args: ["--window-size=1440,1000"],
    });
    contexts.push(nc);
    await guard(nc);
    const np = nc.pages()[0] ?? (await nc.newPage());
    await np.goto(origin + "/login");
    await np.getByRole("button", { name: "Demo teacher", exact: true }).click();
    await np.waitForURL("**/teacher");
    await library(np, "?q=" + encodeURIComponent(original.title));
    await np.locator(".ll-row").waitFor();
    nativeMetrics.push(
      await np.evaluate(() => ({
        dpr: devicePixelRatio,
        innerWidth,
        outerWidth,
        scale: visualViewport.scale,
        rootZoom: getComputedStyle(document.documentElement).zoom,
      })),
    );
    if (factor === 2)
      await check(
        "Native 200% mouse, keyboard, details and exact publication",
        async () => {
          await fits(np);
          const a = np.locator(".ll-row"),
            summary = a.locator("summary");
          await summary.focus();
          await np.keyboard.press("Enter");
          assert.equal(await a.locator("details").getAttribute("open"), "");
          assert.ok(
            (await a.locator("details").innerText()).includes(
              "Revision " + original.revision,
            ),
          );
          const focus = await focusVisible(np);
          assert.equal(focus.outline, "solid");
          assert.ok(
            focus.y >= focus.topLimit - 1 &&
              focus.bottom <= focus.bottomLimit + 1,
            "Native zoom obscured summary: " + JSON.stringify(focus),
          );
          await fits(np);
          await a.locator("details dl").scrollIntoViewIfNeeded();
          const cdp = await nc.newCDPSession(np);
          const image = await cdp.send("Page.captureScreenshot", {
            format: "png",
            fromSurface: true,
            captureBeyondViewport: false,
          });
          writeFileSync(
            join(out, "native200-details-surface.png"),
            Buffer.from(image.data, "base64"),
          );
          await cdp.detach();
          report.screenshots.push("native200-details-surface.png");
          await np.keyboard.press("Space");
          assert.equal(await a.locator("details").getAttribute("open"), null);
          const link = a.getByRole("link", {
            name: "Published v1",
            exact: true,
          });
          const expected = await link.getAttribute("href");
          await link.click();
          await np.waitForURL(origin + expected);
          return { url: np.url(), zoom: nativeMetrics[1] };
        },
      );
    await nc.close();
    contexts.pop();
  }
  await check(
    "Native zoom is actual browser 200%, with no CSS or pinch emulation",
    async () => {
      const [a, b] = nativeMetrics;
      assert.ok(Math.abs(b.dpr / a.dpr - 2) < 0.02);
      assert.ok(Math.abs(b.innerWidth / a.innerWidth - 0.5) < 0.02);
      assert.equal(a.outerWidth, b.outerWidth);
      assert.equal(b.scale, 1);
      assert.equal(b.rootZoom, "1");
      return nativeMetrics;
    },
  );
  await check(
    "No page errors or unintended external/mutating requests",
    async () => {
      assert.deepEqual(report.pageErrors, []);
      assert.deepEqual(report.blocked, []);
    },
  );
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
  report.status = report.cases.some((x) => x.status === "failed")
    ? "failed"
    : "passed";
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log(
  JSON.stringify({
    status: report.status,
    passed: report.cases.filter((x) => x.status === "passed").length,
    failed: report.cases.filter((x) => x.status === "failed"),
  }),
);
if (report.status !== "passed") process.exitCode = 1;
