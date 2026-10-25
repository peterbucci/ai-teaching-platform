/** Isolated actual React component checks. No live application or paid services. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { workFixture, original, question, manyQuestions } from "./fixtures.ts";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "notebook-records-"));
const evidence = path.join(here, "evidence");
fs.mkdirSync(evidence, { recursive: true });
const { chromium } = require(process.env.N3_PLAYWRIGHT || "playwright");
const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const loader = path.join(out, "loader.cjs");
fs.writeFileSync(
  loader,
  `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;`,
);
const emptyCss = path.join(out, "empty-css.cjs");
fs.writeFileSync(emptyCss, "module.exports = {};");
await new Promise((resolve, reject) =>
  webpack(
    {
      mode: "development",
      entry: path.join(here, "fixture.tsx"),
      output: { path: out, filename: "fixture.js" },
      devtool: false,
      resolve: {
        extensions: [".tsx", ".ts", ".js"],
        modules: [path.join(root, "node_modules"), "node_modules"],
        alias: { [path.join(here, "../records.css")]: emptyCss },
      },
      module: {
        rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: loader }],
      },
    },
    (err, stats) =>
      err || stats.hasErrors()
        ? reject(err || Error(stats.toString({ all: false, errors: true })))
        : resolve(),
  ),
);

const prototype = process.env.N3_PROTOTYPE_DIR;
assert.ok(prototype, "Provide the final extracted prototype directory");
const mainBytes = fs.readFileSync(path.join(prototype, "Main.dc.html"));
const sha = createHash("sha256").update(mainBytes).digest("hex");
assert.equal(
  sha,
  "70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4",
);
const css = fs.readFileSync(path.join(here, "../records.css"), "utf8");
const report = {
  mode: "Isolated fictional N3 React components; no auth/database/controller",
  base: "16c0ed33e02c28be39aa30f4ea6d1eeb23077c27",
  design: {
    archive: "fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570",
    main: sha,
  },
  checks: [],
  screenshots: [],
  requests: [],
  errors: [],
};
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (request.method !== "GET") {
    report.requests.push({ method: request.method, path: url.pathname });
    response.writeHead(405);
    return response.end();
  }
  if (url.pathname === "/fixture.js") {
    response.setHeader("content-type", "text/javascript");
    return response.end(fs.readFileSync(path.join(out, "fixture.js")));
  }
  if (url.pathname.startsWith("/prototype/")) {
    const filename = path.resolve(prototype, url.pathname.slice(11));
    if (
      !filename.startsWith(path.resolve(prototype) + path.sep) ||
      !fs.existsSync(filename)
    ) {
      response.writeHead(404);
      return response.end();
    }
    response.setHeader(
      "content-type",
      filename.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8",
    );
    return response.end(fs.readFileSync(filename));
  }
  if (url.pathname === "/reference") {
    // Wrapper selects the export's own scenario. Main.dc.html bytes remain unchanged.
    const scenario =
      url.searchParams.get("view") === "question"
        ? "owen-p1-result"
        : "maya-notebook";
    response.setHeader("content-type", "text/html; charset=utf-8");
    return response.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/prototype/"><script src="vendor/react.js"></script><script src="vendor/react-dom.js"></script><script src="support.js"></script><title>Final Notebook reference</title></head><body style="margin:0"><x-dc><dc-import name="Main" scenario="${scenario}" start-at="top"></dc-import></x-dc><script type="text/x-dc" data-dc-script>class Component extends DCLogic {renderVals(){return {};}}</script></body></html>`,
    );
  }
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>N3 records fixture</title><style>body{margin:0;background:#f6f8f7;font-family:system-ui}.fixture-label{font-size:12px;padding:6px 12px;margin:0;background:#11372f;color:#fff}.fixture-page{padding:20px;max-width:1000px;margin:auto}${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
function check(name, condition = true) {
  assert.ok(condition, name);
  report.checks.push(name);
}
try {
  const page = await browser.newPage();
  await page.route("**/*", (route) =>
    route.request().url().startsWith(base) ? route.continue() : route.abort(),
  );
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("request", (request) => {
    if (request.resourceType() === "fetch" || request.resourceType() === "xhr")
      report.requests.push({
        method: request.method(),
        path: new URL(request.url()).pathname,
        surface:
          new URL(page.url()).pathname === "/reference"
            ? "prototype"
            : "component",
      });
  });
  async function shot(name) {
    await page.screenshot({ path: path.join(evidence, `${name}.png`) });
    report.screenshots.push(`${name}.png`);
  }
  async function open(scenario) {
    await page.goto(`${base}/?case=${scenario}`);
    await page.locator(".nr").first().waitFor();
  }
  async function noOverflow(name) {
    check(
      name,
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const scenario of [
      "records",
      "detail",
      "empty",
      "no-answers",
      "loading",
      "unavailable",
      "pending",
      "pending-null",
      "foreign",
      "long",
      "active",
      "support",
      "empty-state",
    ]) {
      await open(scenario);
      await noOverflow(`${width} ${scenario}: no horizontal overflow`);
      check(
        `${width} ${scenario}: no composer`,
        (await page.locator("textarea,form").count()) === 0,
      );
      if (scenario === "records" || scenario === "pending") {
        assert.deepEqual(
          await page.locator("[data-original-response]").allTextContents(),
          [original, original, ""],
        );
        check(
          `${width} ${scenario}: exact repeated and empty originals once each`,
        );
        assert.deepEqual(
          await page.locator("[data-original-prompt]").allTextContents(),
          [question, question, ""],
        );
        check(`${width} ${scenario}: exact historical prompts`);
        check(
          `${width} ${scenario}: individual results remain unavailable`,
          (await page
            .getByText("Assessment unavailable in this view", { exact: true })
            .count()) === 3,
        );
      }
      if (scenario === "foreign")
        check(
          `${width}: foreign selection hides originals`,
          (await page.locator("[data-original-response]").count()) === 0,
        );
      if (scenario === "detail")
        check(
          `${width}: detail count describes only the displayed answer`,
          (await page.getByText(/1 submitted answer shown/).count()) === 1,
        );
      if (scenario === "empty")
        check(
          `${width}: empty notebook message visible`,
          await page
            .getByRole("heading", { name: "Your notebook is empty" })
            .isVisible(),
        );
      if (scenario === "active")
        check(
          `${width}: exact active-session resume links`,
          (await page
            .getByRole("link", { name: "Resume this session", exact: true })
            .count()) === 2,
        );
      if (scenario === "support")
        check(
          `${width}: session needs support does not infer failed answers`,
          (await page
            .getByText("Assessment unavailable in this view", { exact: true })
            .count()) === 3,
        );
      if (
        scenario === "pending-null" ||
        scenario === "loading" ||
        scenario === "unavailable"
      )
        check(
          `${width} ${scenario}: no synthetic originals`,
          (await page.locator("[data-original-response]").count()) === 0,
        );
      if (scenario === "long") {
        check(
          `${width}: numerous questions retained`,
          (await page.locator("[data-original-response]").count()) === 46,
        );
        assert.equal(
          await page.locator("[data-original-response]").first().textContent(),
          manyQuestions().sessions[0].questions[0].response.responseText,
        );
        check(
          `${width}: long whitespace and HTML preserved as text`,
          await page.evaluate(() => !window.injected),
        );
        const imageName = `long-original-${width}x${height}.png`;
        await page
          .locator("[data-original-response]")
          .first()
          .screenshot({ path: path.join(evidence, imageName) });
        report.screenshots.push(imageName);
      }
      if (["records", "detail", "empty", "pending", "long"].includes(scenario))
        await shot(`${scenario}-${width}x${height}`);
    }
    await open("records");
    const search = page.getByRole("searchbox");
    await search.fill("PACKET travels");
    check(
      `${width}: local search preserves both equal answers`,
      (await page.locator("[data-original-response]").count()) === 2,
    );
    await search.fill("no such question");
    await page
      .getByRole("heading", { name: "No loaded answers match" })
      .waitFor();
    check(`${width}: empty search state`);
    await page.getByRole("button", { name: "Clear search" }).click();
    check(
      `${width}: clear restores focus`,
      await search.evaluate((el) => el === document.activeElement),
    );
    await page.keyboard.press("Tab");
    check(
      `${width}: keyboard reaches page navigation disclosure`,
      await page.evaluate(
        () => document.activeElement.textContent === "Pages in this saved work",
      ),
    );
    check(
      `${width}: visible focus ring`,
      await page.evaluate(
        () => getComputedStyle(document.activeElement).outlineStyle !== "none",
      ),
    );
    await page.keyboard.press("Space");
    check(
      `${width}: Space collapses pages`,
      (await page.locator(".nr-pages").getAttribute("open")) === null,
    );
    await page.keyboard.press("Enter");
    check(
      `${width}: Enter expands pages`,
      (await page.locator(".nr-pages").getAttribute("open")) !== null,
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    check(
      `${width}: reverse Tab returns to pages control`,
      await page.evaluate(
        () => document.activeElement.textContent === "Pages in this saved work",
      ),
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    const first = workFixture.sessions[0].questions[0];
    check(
      `${width}: page link targets exact attempt`,
      new URL(page.url()).hash === `#question-${first.identity.attemptId}`,
    );
    check(
      `${width}: target has focus`,
      await page
        .locator(`#question-${first.identity.attemptId}`)
        .evaluate((el) => el === document.activeElement),
    );
    await shot(`question-focus-${width}x${height}`);
    await page.goBack();
    check(
      `${width}: native Back returns to index`,
      new URL(page.url()).hash === "",
    );
    await page.goForward();
    check(
      `${width}: native Forward returns to exact record`,
      new URL(page.url()).hash === `#question-${first.identity.attemptId}`,
    );
    await page.locator(".nr-context summary").first().focus();
    await page.keyboard.press("Enter");
    check(
      `${width}: context opens by keyboard`,
      (await page.locator(".nr-context").first().getAttribute("open")) !== null,
    );
    await noOverflow(`${width}: expanded historical identities fit`);
    const target = page
      .getByRole("link", { name: "Open this question in study" })
      .first();
    assert.equal(await target.getAttribute("href"), first.href);
    const popupPromise = page.context().waitForEvent("page");
    await target.click({ modifiers: ["Control"] });
    const popup = await popupPromise;
    await popup.waitForLoadState();
    check(
      `${width}: modified link preserves exact session/attempt`,
      popup.url() === base + first.href,
    );
    await popup.close();
    await page.reload();
    assert.equal(
      await page.locator("[data-original-response]").first().textContent(),
      original,
    );
    check(
      `${width}: fixture reload preserves exact original (not database proof)`,
    );
    await open("scope");
    await page.getByRole("searchbox").fill("old search");
    await page
      .getByRole("button", { name: "Change loaded assignment" })
      .click();
    check(
      `${width}: assignment switch resets local search`,
      (await page.getByRole("searchbox").inputValue()) === "",
    );
    check(
      `${width}: assignment switch hides prior originals`,
      (await page.locator("[data-original-response]").count()) === 0,
    );
    await open("detail");
    await page
      .getByRole("button", { name: "Change selected assignment" })
      .click();
    check(
      `${width}: stale detail selection never substitutes another answer`,
      (await page.locator("[data-original-response]").count()) === 0,
    );
    for (const view of ["index", "question"]) {
      await page.goto(`${base}/reference?view=${view}`);
      await page.locator(".lps").waitFor();
      await page.locator(view === "index" ? ".nb-list" : ".book").waitFor();
      await shot(`prototype-${view}-${width}x${height}`);
      check(`${width}: final prototype ${view} rendered`);
    }
  }
  check(
    "zero component fetch/XHR or mutation requests",
    report.requests.filter((request) => request.surface !== "prototype")
      .length === 0,
  );
  check(
    "prototype source loading performs no writes",
    report.requests.every((request) => request.method === "GET"),
  );
  check("zero browser exceptions", report.errors.length === 0);
} finally {
  fs.writeFileSync(
    path.join(evidence, "browser-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log(
  `${report.checks.length} isolated browser checks passed; ${report.screenshots.length} screenshots.`,
);
