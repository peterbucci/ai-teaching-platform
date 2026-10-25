import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { DEMO_IDS } from "../../lib/evidence/demo.ts";
import { loadApprovedContent } from "../../lib/evidence/content.ts";
import { checkStandaloneReadingExposure } from "../../tests/browser/notebook-integration/standalone-reading.mjs";
import { checkNotebookHistory } from "../../tests/browser/notebook-integration/history.mjs";

assert.equal(process.env.PGHOST, "127.0.0.1");
assert.equal(process.env.PGPORT, "5907");
assert.equal(process.env.PGDATABASE, "reader_visibility_n7_01a1742c");
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3407");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
const root = process.cwd();
const base = process.env.AUTH_URL;
const run = `visual-${Date.now()}`;
const out = path.join(root, "acceptance/notebook/evidence", run);
const prototype = path.join(root, ".setup/prototype");
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
const journeys = fs
  .readdirSync(path.join(root, "acceptance/notebook/evidence"))
  .filter((name) => name.startsWith("journey-"))
  .map((name) =>
    path.join(root, "acceptance/notebook/evidence", name, "journey.json"),
  )
  .filter((file) => fs.existsSync(file))
  .map((file) => ({ file, data: JSON.parse(fs.readFileSync(file, "utf8")) }))
  .filter(
    ({ data }) =>
      data.session && data.attempt && data.approval && !data.failure,
  )
  .sort((a, b) => b.file.localeCompare(a.file));
assert.ok(journeys.length, "A completed/current N7 journey is required");
const journey = journeys[0].data;
const content = loadApprovedContent();
const version =
  content.contentRef?.content_version ?? content.content_ref?.content_version;
assert.ok(version, "Approved content version is required");
const assignment = DEMO_IDS.assignmentId;
const surfaces = [
  {
    id: "learning",
    title: "My Learning",
    scenario: "maya-home",
    route: "/study/assignments",
    ready: '[data-notebook-slot="teacher-reviews"]',
    note: "Mounted N1/N2/N5; factual assignment/review content differs from prototype fixtures.",
  },
  {
    id: "overview",
    title: "Assignment overview",
    scenario: "owen-overview",
    route: `/study/assignments/${assignment}?tab=overview`,
    ready: "[data-assignment-id]",
    note: "Mounted N1/N2; approved objectives and available current data remain authoritative.",
  },
  {
    id: "notebook",
    title: "Notebook index",
    scenario: "maya-notebook",
    route: "/study/history",
    ready: "[data-n7-notebook-index]",
    note: "Global Notebook index compared with the same prototype destination. Current-data cards and supported session filters only; per-answer results, help and chronology remain unavailable.",
  },
  {
    id: "reading",
    title: "Standalone reading",
    scenario: "owen-reading",
    route: `/study/reading?assignment=${assignment}&version=${encodeURIComponent(version)}&passage=P07`,
    ready: "[data-n7-standalone-reader]",
    note: "Standalone N1/N4 composition with one visibility-aware reader. Facing reading remains disabled. Source wording and passage structure follow the actual approved version.",
  },
  {
    id: "review",
    title: "Teacher-assigned review",
    scenario: "maya-review",
    route: `/study/interventions/${journey.approval}`,
    ready: ".sn-review-detail",
    note: "N5 frame with one unchanged DeliveredActivity and existing Workspace. Teacher-approved synthetic fixture text is authoritative; no full shell parity claim.",
  },
  {
    id: "study",
    title: "Active study",
    scenario: "owen-p1-confused",
    route: `/study/assignments/${assignment}?tab=study&session=${journey.session}`,
    ready: ".lp-turns",
    note: "PR #113 layout/controller retained pending coordinated handoff; no active-Notebook visual parity claim.",
  },
];
const scenarios = new Set(surfaces.map((s) => s.scenario));
fs.mkdirSync(out, { recursive: true });
const sourceFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "app", "lib"],
  { encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/)
  .sort()
  .map((file) => ({ file, sha256: hash(fs.readFileSync(file)) }));
fs.writeFileSync(
  path.join(out, "production-source-files.json"),
  JSON.stringify(sourceFiles, null, 2),
);
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  diffSha256: hash(execFileSync("git", ["diff", "HEAD"])),
  productionSourceManifestSha256: hash(JSON.stringify(sourceFiles)),
  productionSourceManifestEncoding:
    "UTF-8 JSON.stringify of ordered file/hash entries; formatting-independent",
  base,
  runtime: process.env.N7_VISUAL_RUNTIME || "development",
  journey: path.relative(root, journeys[0].file),
  session: journey.session,
  approval: journey.approval,
  prototypeZipSha256:
    "fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570",
  prototypeMainSha256:
    "70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4",
  providersDisabled: true,
  paidCalls: 0,
  fontNote:
    "External prototype fonts blocked; screenshots use available local fallback fonts.",
  visualAcceptance: {
    status: "NOT_ACCEPTED",
    reason:
      "Viewport, overflow and zoom assertions are functional layout checks, not prototype fidelity acceptance. Active-study presentation remains gated and current-data records cannot reproduce the prototype's full chronology.",
  },
  checks: [],
  pairs: [],
  geometry: [],
  defects: [],
  visualDifferences: [],
  errors: [],
  blockedExternalRequests: [],
  nativeZoom: { status: "UNRUN", metrics: [] },
};
const save = () =>
  fs.writeFileSync(
    path.join(out, "visual-results.json"),
    JSON.stringify(report, null, 2),
  );
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  response.setHeader("x-n7-visual-run", run);
  if (request.method !== "GET") {
    response.writeHead(405);
    return response.end();
  }
  if (url.pathname === "/reference") {
    const scenario = url.searchParams.get("scenario");
    if (!scenarios.has(scenario)) {
      response.writeHead(404);
      return response.end();
    }
    response.setHeader("content-type", "text/html; charset=utf-8");
    return response.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/prototype/"><script src="vendor/react.js"></script><script src="vendor/react-dom.js"></script><script src="support.js"></script><title>N7 approved Notebook reference</title></head><body style="margin:0"><x-dc><dc-import name="Main" scenario="${scenario}" start-at="top" labels="false"></dc-import></x-dc><script type="text/x-dc" data-dc-script>class Component extends DCLogic {renderVals(){return {};}}</script></body></html>`,
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
const verify = await fetch(`${referenceBase}/reference?scenario=maya-home`);
assert.equal(verify.headers.get("x-n7-visual-run"), run);
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const browser = await chromium.launch({ headless: true });
const allowed = new Set([base, referenceBase]);
const configure = async (context) => {
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(45000);
  await context.route("**/*", (route) => {
    if (allowed.has(new URL(route.request().url()).origin))
      return route.continue();
    report.blockedExternalRequests.push(new URL(route.request().url()).origin);
    return route.abort();
  });
};
async function readyApp(page, surface) {
  await page.goto(base + surface.route, { waitUntil: "domcontentloaded" });
  await page.locator(surface.ready).first().waitFor();
  if (surface.id === "reading")
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-n7-standalone-reader]")
          ?.getAttribute("data-reader-active") === "true",
    );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.evaluate(() => scrollTo(0, 0));
}
async function readyReference(page, surface) {
  await page.goto(`${referenceBase}/reference?scenario=${surface.scenario}`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#lps-root").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}
async function geometry(page, surface, variant, size) {
  const measured = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    dpr: devicePixelRatio,
    scale: visualViewport?.scale,
    cssZoom: getComputedStyle(document.documentElement).zoom,
    overflowElements: [...document.querySelectorAll("body *")]
      .filter((e) => {
        const rect = e.getBoundingClientRect();
        return (
          rect.width > 0 &&
          (rect.right > innerWidth + 2 || rect.left < -2) &&
          getComputedStyle(e).visibility !== "hidden"
        );
      })
      .slice(0, 8)
      .map((e) => ({
        tag: e.tagName,
        class: typeof e.className === "string" ? e.className : "svg",
        width: Math.round(e.getBoundingClientRect().width),
      })),
  }));
  report.geometry.push({ surface: surface.id, variant, size, ...measured });
  if (variant === "application" && surface.id === "learning") {
    const cards = await page
      .locator('[data-notebook-slot="teacher-reviews"] .sn-review-card')
      .evaluateAll((elements) =>
        elements.map((card) => {
          const text = card.querySelector(".sn-review-row > .sn-review-stack");
          const action = card.querySelector(".sn-review-actions");
          const textBox = text.getBoundingClientRect();
          const actionBox = action.getBoundingClientRect();
          return {
            width: card.getBoundingClientRect().width,
            actionBesideText:
              actionBox.left >= textBox.right - 1 &&
              Math.abs(actionBox.top - textBox.top) < 2,
          };
        }),
      );
    for (const card of cards.filter((card) => card.width >= 560))
      assert.equal(
        card.actionBesideText,
        true,
        "Review action stays beside text when its actual column has room",
      );
    report.checks.push({
      check: "Review summary action follows actual column width",
      size,
      cards,
    });
  }
  if (variant === "application" && measured.scrollWidth > measured.width + 1)
    report.defects.push({
      severity: "P2",
      surface: surface.id,
      size,
      issue: `Horizontal page overflow ${measured.scrollWidth}px at ${measured.width}px viewport`,
      elements: measured.overflowElements,
    });
  return measured;
}
let context;
try {
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await configure(context);
  const login = await context.request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: base },
    data: {
      email: process.env.DEMO_STUDENT_ONE_EMAIL,
      password: process.env.DEMO_STUDENT_ONE_PASSWORD,
    },
  });
  assert.equal(login.status(), 200, "Fictional student login");
  const state = await context.storageState();
  const application = await context.newPage();
  const reference = await context.newPage();
  application.on("pageerror", (error) =>
    report.errors.push({ source: "application", error: error.message }),
  );
  reference.on("pageerror", (error) =>
    report.errors.push({ source: "prototype", error: error.message }),
  );
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ]) {
    const size = `${width}x${height}`;
    await application.setViewportSize({ width, height });
    await reference.setViewportSize({ width, height });
    for (const surface of surfaces) {
      await readyApp(application, surface);
      const appName = `application-${surface.id}-${size}.png`;
      await application.screenshot({ path: path.join(out, appName) });
      await geometry(application, surface, "application", size);
      if (surface.id === "reading") {
        const exposure = await checkStandaloneReadingExposure(application);
        report.checks.push({
          check: "Standalone reader bootstrap / keyboard overlay / one mount",
          size,
          ...exposure,
        });
      }
      if (surface.id === "notebook")
        report.checks.push({
          check: "Notebook history filters / exact links / no writes",
          size,
          ...(await checkNotebookHistory(application)),
        });
      await readyReference(reference, surface);
      const referenceName = `prototype-${surface.id}-${size}.png`;
      await reference.screenshot({ path: path.join(out, referenceName) });
      await geometry(reference, surface, "prototype", size);
      report.pairs.push({
        surface: surface.id,
        title: surface.title,
        size,
        application: appName,
        prototype: referenceName,
        note: surface.note,
      });
      save();
      console.log(`CAPTURE ${surface.id} ${size}`);
    }
  }
  await context.close();
  context = null;
  await browser.close();
  const executablePath =
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  assert.ok(
    fs.existsSync(executablePath),
    "Native Edge is required for real browser zoom",
  );
  for (const factor of [1, 2]) {
    const profile = path.join(root, ".setup", `${run}-native-${factor}`);
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
      executablePath,
      viewport: null,
      args: ["--window-size=1440,1100"],
    });
    try {
      await configure(native);
      await native.addCookies(state.cookies);
      const page = await native.newPage();
      const cdp = await native.newCDPSession(page);
      for (const surface of factor === 1 ? surfaces.slice(0, 1) : surfaces) {
        await readyApp(page, surface);
        const measured = await geometry(
          page,
          surface,
          "application",
          `native-${factor * 100}`,
        );
        assert.equal(measured.scale, 1, "No pinch emulation");
        assert.equal(measured.cssZoom, "1", "No CSS zoom");
        if (surface.id === "learning")
          report.nativeZoom.metrics.push({ factor, ...measured });
        const appName = `application-${surface.id}-native-${factor * 100}.png`;
        const { data } = await cdp.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: false,
        });
        fs.writeFileSync(path.join(out, appName), Buffer.from(data, "base64"));
        if (surface.id === "study") {
          const composer = page.getByRole("textbox", {
            name: "Message your tutor",
            exact: true,
          });
          await composer.scrollIntoViewIfNeeded();
          assert.equal(await composer.isVisible(), true);
          const capture = await cdp.send("Page.captureScreenshot", {
            format: "png",
            fromSurface: false,
          });
          fs.writeFileSync(
            path.join(out, "application-study-native-200-composer.png"),
            Buffer.from(capture.data, "base64"),
          );
          report.checks.push({
            check: "Native 200% existing composer reachable",
            passed: true,
          });
        }
        await readyReference(page, surface);
        const referenceName = `prototype-${surface.id}-native-${factor * 100}.png`;
        const captured = await cdp.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: false,
        });
        fs.writeFileSync(
          path.join(out, referenceName),
          Buffer.from(captured.data, "base64"),
        );
        report.pairs.push({
          surface: surface.id,
          title: surface.title,
          size: `Native ${factor * 100}%`,
          application: appName,
          prototype: referenceName,
          note: surface.note,
        });
        save();
        console.log(`CAPTURE native${factor * 100} ${surface.id}`);
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
    "Fresh headed Edge profiles, native default_zoom_level preference, viewport:null; verified DPR and viewport ratio; CDP fromSurface:false captures.";
} catch (error) {
  report.failure = String(error.stack || error);
  if (report.nativeZoom.metrics.length) report.nativeZoom.status = "FAILED";
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (context) await context.close();
  await browser.close();
  server.close();
  report.blockedExternalRequests = [...new Set(report.blockedExternalRequests)];
  save();
  const escape = (text) =>
    String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  fs.writeFileSync(
    path.join(out, "COMPARISON.html"),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>N7 application and approved prototype</title><style>body{font:16px system-ui;background:#f5f3ed;color:#183a31;margin:24px}section{margin:30px 0}figure{margin:0}img{max-width:100%;border:1px solid #bccac1}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figcaption{font-weight:700;padding:10px}p{max-width:1000px}.acceptance{padding:16px;border:2px solid #a85c22;background:#fff4e1}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style><h1>N7: application versus approved prototype</h1><p class="acceptance"><strong>Full visual acceptance: not complete.</strong> ${escape(report.visualAcceptance.reason)}</p><p>Exact reference ZIP fa69c2d0. ${escape(report.fontNote)} Authenticated fictional application data; disabled providers and zero paid calls. Each pair compares the same destination. Differences in authorized content and unavailable chronology are identified separately from layout defects.</p><p>Source ${escape(report.source)}; working diff SHA-256 ${escape(report.diffSha256)}. Native zoom mechanics: ${escape(report.nativeZoom.status)}. <a href="visual-results.json">Raw results and defects</a>.</p>${report.pairs.map((pair) => `<section><h2>${escape(pair.title)} · ${escape(pair.size)}</h2><p>${escape(pair.note)}</p><div class="pair"><figure><figcaption>Approved prototype</figcaption><img src="${escape(pair.prototype)}" alt="Prototype ${escape(pair.title)}"></figure><figure><figcaption>Authenticated application</figcaption><img src="${escape(pair.application)}" alt="Application ${escape(pair.title)}"></figure></div></section>`).join("")}</html>`,
  );
  console.log(`REPORT ${path.relative(root, out)}`);
}
