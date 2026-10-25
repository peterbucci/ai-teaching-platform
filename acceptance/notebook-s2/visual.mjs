import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

assert.equal(process.env.PGDATABASE, "notebook_s2");
assert.equal(process.env.OPENAI_API_KEY, "");
const root = process.cwd(),
  base = process.env.AUTH_URL,
  require = createRequire(import.meta.url);
const {
  chromium,
} = require("C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const prototype =
  "C:/Users/sb128/.codex/worktrees/student-notebook-integration/LearningPlatform/.setup/prototype";
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
const state = JSON.parse(
  fs.readFileSync(".setup/s2/browser-state.json", "utf8"),
);
const run = `visual-${Date.now()}`,
  out = path.join(root, "acceptance/notebook-s2/evidence", run);
fs.mkdirSync(out, { recursive: true });
const files = [
  ...new Set(
    execFileSync(
      "git",
      [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        "app",
        "lib",
        "package.json",
        "next.config.mjs",
      ],
      { encoding: "utf8" },
    )
      .trim()
      .split(/\r?\n/),
  ),
]
  .filter(Boolean)
  .sort();
const manifest = files.map((file) => ({
  file,
  sha256: hash(fs.readFileSync(file)),
}));
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  applicationManifestSha256: hash(JSON.stringify(manifest)),
  buildId: fs.readFileSync(".next/BUILD_ID", "utf8").trim(),
  designSha256:
    "fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570",
  providersDisabled: true,
  paidCalls: 0,
  pairs: [],
  geometry: [],
  errors: [],
  nativeZoom: [],
  visualParity:
    "NOT_ACCEPTED pending direct visual review; functional geometry is separate",
  limitations: [
    "Global Notebook remains a session index; the public projection is session-scoped, so full cross-session question/result/help search is unavailable.",
    "Saved-question pages omit active composers and facing reading. The source DTO has concept IDs, not historical concept display titles.",
    "Different fictional content is not evidence of exact visual parity. Both surfaces use local available fonts with external requests blocked.",
  ],
};
const save = () =>
  fs.writeFileSync(
    path.join(out, "visual-results.json"),
    JSON.stringify(report, null, 2),
  );
fs.writeFileSync(
  path.join(out, "application-manifest.json"),
  JSON.stringify(manifest, null, 2),
);
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");
  if (u.pathname === "/reference") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    return res.end(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/prototype/"><script src="vendor/react.js"></script><script src="vendor/react-dom.js"></script><script src="support.js"></script></head><body style="margin:0"><x-dc><dc-import name="Main" scenario="maya-notebook" start-at="top"></dc-import></x-dc><script type="text/x-dc" data-dc-script>class Component extends DCLogic {renderVals(){return {};}}</script></body></html>',
    );
  }
  const filename = path.resolve(
    prototype,
    u.pathname.replace(/^\/prototype\//, ""),
  );
  if (
    !filename.startsWith(path.resolve(prototype) + path.sep) ||
    !fs.existsSync(filename)
  ) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader(
    "content-type",
    filename.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8",
  );
  res.end(fs.readFileSync(filename));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const ref = `http://127.0.0.1:${server.address().port}`;
const surfaces = [
  {
    id: "index",
    url: "/study/history",
    selector: "[data-n7-notebook-index]",
    reference: "index",
  },
  {
    id: "session",
    url: `/study/history/${state.session}`,
    selector: "[data-recorded-history]",
    reference: "index",
  },
  {
    id: "question",
    url: `/study/history/${state.session}?attempt=${state.ids[0]}`,
    selector: "[data-recorded-question]",
    reference: "question",
  },
];
async function configure(context) {
  await context.route("**/*", (route) =>
    [base, ref].includes(new URL(route.request().url()).origin)
      ? route.continue()
      : route.abort(),
  );
  const login = await context.request.post(base + "/api/auth/sign-in/email", {
    headers: { Origin: base },
    data: {
      email: process.env.DEMO_STUDENT_ONE_EMAIL,
      password: process.env.DEMO_STUDENT_ONE_PASSWORD,
    },
  });
  assert.equal(login.status(), 200);
}
async function open(page, surface, variant) {
  await page.goto(
    variant === "application" ? base + surface.url : ref + "/reference",
  );
  if (variant === "application") await page.locator(surface.selector).waitFor();
  else {
    await page.locator(".nb-g").first().waitFor();
    if (surface.reference === "question") {
      await page.locator(".nb-g").nth(1).locator(".nb-r").first().click();
      await page.locator(".nbcol").waitFor();
    }
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.evaluate(() => scrollTo(0, 0));
}
async function geometry(page, surface, variant, size) {
  const m = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    dpr: devicePixelRatio,
    scale: visualViewport.scale,
    cssZoom: getComputedStyle(document.documentElement).zoom,
  }));
  report.geometry.push({ surface: surface.id, variant, size, ...m });
  if (variant === "application")
    assert.ok(m.scrollWidth <= m.width + 1, `${surface.id}/${size} overflow`);
  return m;
}
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await configure(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ])
    for (const surface of surfaces) {
      const pair = { surface: surface.id, size: `${width}×${height}` };
      await page.setViewportSize({ width, height });
      for (const variant of ["application", "prototype"]) {
        await open(page, surface, variant);
        await geometry(page, surface, variant, pair.size);
        const filename = `${variant}-${surface.id}-${width}.png`;
        await page.screenshot({ path: path.join(out, filename) });
        pair[variant] = filename;
      }
      report.pairs.push(pair);
      save();
      console.log(`CAPTURE ${surface.id} ${width}`);
    }
  await browser.close();
  browser = null;
  for (const factor of [1, 2]) {
    const profile = path.join(root, ".setup/s2", `${run}-native-${factor}`);
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
      executablePath:
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      viewport: null,
      args: ["--window-size=1440,1100"],
    });
    try {
      await configure(native);
      const page = await native.newPage();
      const cdp = await native.newCDPSession(page);
      for (const surface of factor === 1 ? surfaces.slice(0, 1) : surfaces) {
        const pair = { surface: surface.id, size: `Native ${factor * 100}%` };
        for (const variant of ["application", "prototype"]) {
          await open(page, surface, variant);
          const m = await geometry(page, surface, variant, pair.size);
          assert.equal(m.scale, 1);
          assert.equal(m.cssZoom, "1");
          if (surface.id === "index" && variant === "application")
            report.nativeZoom.push({ factor, ...m });
          const filename = `${variant}-${surface.id}-native-${factor * 100}.png`;
          const capture = await cdp.send("Page.captureScreenshot", {
            format: "png",
            fromSurface: false,
          });
          fs.writeFileSync(
            path.join(out, filename),
            Buffer.from(capture.data, "base64"),
          );
          pair[variant] = filename;
        }
        report.pairs.push(pair);
        save();
        console.log(`CAPTURE ${surface.id} native ${factor * 100}`);
      }
    } finally {
      await native.close();
    }
  }
  assert.equal(report.nativeZoom.length, 2);
  const [normal, zoomed] = report.nativeZoom;
  assert.ok(Math.abs(zoomed.dpr / normal.dpr - 2) < 0.01);
  assert.ok(Math.abs(normal.width / zoomed.width - 2) < 0.06);
  assert.deepEqual(report.errors, []);
  report.nativeZoomVerified = true;
} catch (error) {
  report.failure = String(error.stack || error);
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.close();
  save();
  const esc = (x) =>
    String(x)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  fs.writeFileSync(
    path.join(out, "COMPARISON.html"),
    `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>S2 recorded history comparison</title><style>body{font:16px system-ui;background:#f5f8f7;color:#173e3b;margin:24px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}img{max-width:100%}figure{margin:0}section{margin:36px 0}@media(max-width:800px){.pair{display:block}}</style><h1>S2 · real prototype and authenticated application</h1><p>${esc(report.visualParity)}</p><p>${report.limitations.map(esc).join(" ")}</p><p>Build ${esc(report.buildId)} · source manifest ${esc(report.applicationManifestSha256)}</p>${report.pairs.map((p) => `<section><h2>${esc(p.surface)} · ${esc(p.size)}</h2><div class="pair"><figure><figcaption>Approved prototype</figcaption><img src="${esc(p.prototype)}"></figure><figure><figcaption>Authenticated application</figcaption><img src="${esc(p.application)}"></figure></div></section>`).join("")}</html>`,
  );
  console.log("REPORT " + path.relative(root, out));
}
