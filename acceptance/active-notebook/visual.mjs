/** Exact viewport and native-zoom comparison. Synthetic app content is disclosed. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fresh, help, pool, base } from "./fixtures.mjs";
const root = process.cwd(),
  prototype =
    process.env.S1_PROTOTYPE ||
    "C:/Users/sb128/.codex/visualizations/2026/10/25/01a173cd-9758-7573-97b5-526f33e52157/final-prototype";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(
  hash(fs.readFileSync(path.join(prototype, "Main.dc.html"))),
  "70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4",
);
assert.equal(
  hash(
    fs.readFileSync(
      "C:/Users/sb128/Downloads/Student-Notebook-Final-Prototype-fa69c2d0.zip",
    ),
  ),
  "fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570",
);
const first = await fresh(),
  helped = await help(await fresh({ runtime: true }), { long: true }),
  run = `visual-${Date.now()}`,
  out = path.join(root, "acceptance/active-notebook/evidence", run);
fs.mkdirSync(out, { recursive: true });
const sourceFiles = () =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "app", "lib"],
    { encoding: "utf8", windowsHide: true },
  )
    .trim()
    .split(/\r?\n/)
    .sort()
    .map((file) => ({ file, sha256: hash(fs.readFileSync(file)) }));
const files = sourceFiles();
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim(),
  appSourceSha256: hash(JSON.stringify(files)),
  runtime: process.env.S1_RUNTIME || "development",
  buildId:
    process.env.S1_RUNTIME === "production"
      ? fs.readFileSync(".next/BUILD_ID", "utf8").trim()
      : null,
  providersDisabled: true,
  paidCalls: 0,
  firstSession: first.sessionId,
  helpSession: helped.sessionId,
  prototypeZipSha256:
    "fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570",
  prototypeMainSha256: hash(
    fs.readFileSync(path.join(prototype, "Main.dc.html")),
  ),
  correctedHelpSha256: hash(
    fs.readFileSync(path.join(prototype, "V1440-HelpMsg.dc.html")),
  ),
  pairs: [],
  nativeZoom: { status: "UNRUN", metrics: [] },
  errors: [],
  blockedExternal: [],
  result: "RUNNING",
  note: "Structural comparison only. Fictional names, wording, session clocks, and source metadata differ. Application help is an authored service fixture, never a model judgment. External fonts are blocked. Visual fidelity requires independent inspection.",
};
fs.writeFileSync(
  path.join(out, "source-files.json"),
  JSON.stringify(files, null, 2),
);
const save = () =>
  fs.writeFileSync(
    path.join(out, "visual-results.json"),
    JSON.stringify(report, null, 2),
  );
const surfaces = [
  {
    id: "first",
    scenario: "owen-p1",
    route: first.url,
    title: "First question",
  },
  {
    id: "help",
    scenario: "owen-p1-confused",
    route: helped.url,
    title: "Corrected long help",
  },
];
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  response.setHeader("x-s1-visual-run", run);
  if (request.method !== "GET") {
    response.writeHead(405);
    return response.end();
  }
  if (url.pathname === "/reference") {
    const scenario = url.searchParams.get("scenario");
    if (!surfaces.some((x) => x.scenario === scenario)) {
      response.writeHead(404);
      return response.end();
    }
    response.setHeader("content-type", "text/html; charset=utf-8");
    return response.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/prototype/"><script src="vendor/react.js"></script><script src="vendor/react-dom.js"></script><script src="support.js"></script><title>Approved active Notebook</title></head><body style="margin:0"><x-dc><dc-import name="Main" scenario="${scenario}" start-at="${scenario === "owen-p1-confused" ? "help" : "top"}" labels="false"></dc-import></x-dc><script type="text/x-dc" data-dc-script>class Component extends DCLogic {renderVals(){return {};}}</script></body></html>`,
    );
  }
  if (url.pathname.startsWith("/prototype/")) {
    const file = path.resolve(
      prototype,
      decodeURIComponent(url.pathname.slice(11)),
    );
    if (
      !file.startsWith(path.resolve(prototype) + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      response.writeHead(404);
      return response.end();
    }
    response.setHeader(
      "content-type",
      file.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8",
    );
    return response.end(fs.readFileSync(file));
  }
  response.writeHead(404);
  response.end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const referenceBase = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.READER_BROWSER_PATH,
});
const allowed = new Set([base, referenceBase]);
async function configure(ctx) {
  ctx.setDefaultTimeout(20000);
  ctx.setDefaultNavigationTimeout(60000);
  await ctx.route("**/*", (route) => {
    const origin = new URL(route.request().url()).origin;
    if (allowed.has(origin)) return route.continue();
    report.blockedExternal.push(origin);
    return route.abort();
  });
}
const ctx = await browser.newContext();
await configure(ctx);
const login = await ctx.request.post(base + "/api/auth/sign-in/email", {
  headers: { Origin: base },
  data: {
    email: process.env.DEMO_STUDENT_ONE_EMAIL,
    password: process.env.DEMO_STUDENT_ONE_PASSWORD,
  },
});
assert.equal(login.status(), 200);
const state = await ctx.storageState();
async function app(page, surface) {
  await page.goto(base + surface.route);
  await page.locator("[data-active-notebook]").waitFor();
  await page
    .getByRole("textbox", { name: "Message your tutor", exact: true })
    .waitFor();
  await page.waitForFunction(() => {
    const e = document.querySelector('textarea[id^="tutor-message-"]');
    return (
      e && !e.disabled && !document.body.innerText.includes("Please wait…")
    );
  });

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  if (surface.id === "help")
    await page.locator(`#dialogue-${helped.requestId}`).evaluate((element) => {
      const turn = element.closest(".lp-dialogue-turn") ?? element;
      turn.scrollIntoView({ block: "start" });
      const header = document.querySelector("[data-active-study] > header");
      scrollBy(0, -((header?.getBoundingClientRect().height ?? 56) + 14));
    });
  if (surface.id === "help") {
    await page.waitForTimeout(180);
    await page.locator(`#dialogue-${helped.requestId}`).evaluate((element) => {
      const turn = element.closest(".lp-dialogue-turn") ?? element;
      const header = document.querySelector("[data-active-study] > header");
      const offset = (header?.getBoundingClientRect().height ?? 56) + 14;
      if (Math.abs(turn.getBoundingClientRect().top - offset) > 1)
        scrollBy(0, turn.getBoundingClientRect().top - offset);
    });
    await page.waitForTimeout(180);
  }
}
async function reference(page, surface) {
  await page.goto(referenceBase + "/reference?scenario=" + surface.scenario);
  await page.locator("#lps-root").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
}
async function geometry(page) {
  return page.evaluate(() => {
    const event = document.querySelector(
      "[data-active-notebook] .lp-dialogue-turn",
    );
    const header = document.querySelector("[data-active-study] > header");
    const requestedHeaderOffset =
      (header?.getBoundingClientRect().height ?? 56) + 14;
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - innerHeight,
    );
    return {
      width: innerWidth,
      height: innerHeight,
      dpr: devicePixelRatio,
      scale: visualViewport.scale,
      cssZoom: getComputedStyle(document.documentElement).zoom,
      scrollWidth: document.documentElement.scrollWidth,
      helpAlignment: event
        ? {
            eventTop: event.getBoundingClientRect().top,
            requestedHeaderOffset,
            scrollY,
            maxScroll,
            clampedAtDocumentEnd:
              Math.abs(scrollY - maxScroll) <= 1 &&
              event.getBoundingClientRect().top > requestedHeaderOffset + 1,
          }
        : null,
    };
  });
}
async function capture(page, surface, size, captureFn) {
  await app(page, surface);
  const application = `application-${surface.id}-${size}.png`,
    a = await geometry(page);
  assert.ok(a.scrollWidth <= a.width + 1, "Application horizontal overflow");
  await captureFn(application);
  await reference(page, surface);
  const prototypeName = `prototype-${surface.id}-${size}.png`,
    p = await geometry(page);
  await captureFn(prototypeName);
  report.pairs.push({
    surface: surface.id,
    title: surface.title,
    size,
    application,
    prototype: prototypeName,
    applicationGeometry: a,
    prototypeGeometry: p,
  });
  save();
  console.log("CAPTURE " + surface.id + " " + size);
  return a;
}
try {
  const page = await ctx.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const surface of surfaces)
      await capture(page, surface, `${width}x${height}`, (name) =>
        page.screenshot({ path: path.join(out, name), fullPage: false }),
      );
  }
  await ctx.close();
  await browser.close();
  for (const factor of [1, 2]) {
    const profile = path.join(root, ".setup", run + "-native-" + factor);
    fs.mkdirSync(path.join(profile, "Default"), { recursive: true });
    fs.writeFileSync(
      path.join(profile, "Default/Preferences"),
      JSON.stringify({
        partition: {
          default_zoom_level: { x: Math.log(factor) / Math.log(1.2) },
        },
      }),
    );
    const native = await chromium.launchPersistentContext(profile, {
      headless: false,
      executablePath: process.env.READER_BROWSER_PATH,
      viewport: null,
      args: ["--window-size=1440,1100"],
    });
    try {
      await configure(native);
      await native.addCookies(state.cookies);
      const p = await native.newPage(),
        cdp = await native.newCDPSession(p);
      for (const surface of factor === 1 ? surfaces.slice(0, 1) : surfaces) {
        const m = await capture(
          p,
          surface,
          `native-${factor * 100}`,
          async (name) => {
            const { data } = await cdp.send("Page.captureScreenshot", {
              format: "png",
              fromSurface: false,
            });
            fs.writeFileSync(path.join(out, name), Buffer.from(data, "base64"));
          },
        );
        assert.equal(m.scale, 1);
        assert.equal(m.cssZoom, "1");
        if (surface.id === "first")
          report.nativeZoom.metrics.push({ factor, ...m });
        if (factor === 2 && surface.id === "first") {
          await app(p, surface);
          const nativeWrites = [];
          const recordNativeWrite = (request) => {
            if (
              request.method() === "POST" &&
              new URL(request.url()).origin === base
            )
              nativeWrites.push(new URL(request.url()).pathname);
          };
          p.on("request", recordNativeWrite);
          const input = p.getByRole("textbox", {
            name: "Message your tutor",
            exact: true,
          });
          await input.fill("Native 200% exact café 🌱 draft.");
          await p
            .locator("[data-active-study] > header")
            .getByRole("button", { name: "Reading", exact: true })
            .click();
          await p.locator('[data-active-study][data-pane="context"]').waitFor();
          await p.keyboard.press("Escape");
          await input.waitFor();
          assert.equal(
            await input.inputValue(),
            "Native 200% exact café 🌱 draft.",
          );
          assert.equal(
            nativeWrites.length,
            0,
            "Native zoom pane changes never write reading or answers",
          );
          p.off("request", recordNativeWrite);
          await input.fill("");
          report.nativeZoom.interaction = {
            status: "PASS",
            case: "draft -> Reading summary -> Escape",
            writes: 0,
          };
        }
      }
    } finally {
      await native.close();
    }
  }
  const [normal, zoomed] = report.nativeZoom.metrics;
  assert.ok(
    Math.abs(zoomed.dpr / normal.dpr - 2) < 0.01,
    "Native zoom doubles DPR",
  );
  assert.ok(
    Math.abs(normal.width / zoomed.width - 2) < 0.06,
    "Native zoom halves CSS viewport",
  );
  report.nativeZoom.status = "PASS";
  report.nativeZoom.method =
    "Fresh headed Edge profiles with native default_zoom_level; DPR and CSS viewport ratio verified, CSS zoom and visualViewport.scale remain 1.";
  report.result = "CAPTURED_REQUIRES_INDEPENDENT_VISUAL_REVIEW";
} catch (error) {
  report.result = "FAIL";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  report.appSourceAfterSha256 = hash(JSON.stringify(sourceFiles()));
  report.sourceUnchanged =
    report.appSourceAfterSha256 === report.appSourceSha256;
  save();
  const escape = (text) =>
    String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  fs.writeFileSync(
    path.join(out, "COMPARISON.html"),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>S1 active Notebook comparison</title><style>body{font:16px system-ui;background:#f5f3ed;color:#17302d;margin:24px}section{margin:30px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0}img{max-width:100%;border:1px solid #b8c9bf}figcaption{font-weight:bold;padding:8px}.note{max-width:1000px}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style><h1>S1 active Notebook comparison</h1><p class="note">${escape(report.note)}</p><p>Source ${escape(report.source)} · ${escape(report.runtime)} · capture ${escape(report.result)} · native zoom ${report.nativeZoom.status}. <a href="visual-results.json">Capture record</a></p>${report.pairs.map((pair) => `<section><h2>${escape(pair.title)} · ${escape(pair.size)}</h2><div class="pair"><figure><figcaption>Approved prototype</figcaption><img src="${escape(pair.prototype)}" alt="Approved ${escape(pair.title)}"></figure><figure><figcaption>Authenticated application</figcaption><img src="${escape(pair.application)}" alt="Application ${escape(pair.title)}"></figure></div></section>`).join("")}</html>`,
  );
  await browser.close().catch(() => {});
  server.close();
  await pool.end();
}
console.log(
  JSON.stringify({ out, result: report.result, nativeZoom: report.nativeZoom }),
);
