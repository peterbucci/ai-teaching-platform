import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import http from "node:http";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);
const here = fs.mkdtempSync(path.join(os.tmpdir(), "learning-pulse-n2-"));
const req = createRequire(path.join(repo, "package.json"));
const out = path.join(here, "browser");
fs.mkdirSync(out, { recursive: true });
const pkg = path.join(repo, "app/study/notebook/learning");
const proof = path.join(pkg, "verification");
const playwright = req(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const webpack = req("next/dist/compiled/webpack/webpack").webpack;
fs.writeFileSync(
  path.join(out, "loader.cjs"),
  `const ts=require(${JSON.stringify(req.resolve("typescript"))});module.exports=function(s){return ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText}`,
);
const css = fs.readFileSync(path.join(pkg, "learning.module.css"), "utf8");
const cssMap = Object.fromEntries(
  [...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => [m[1], m[1]]),
);
fs.writeFileSync(
  path.join(out, "css.cjs"),
  `module.exports=${JSON.stringify(cssMap)}`,
);
fs.writeFileSync(
  path.join(out, "navigation.js"),
  `exports.useRouter=()=>({push:(href)=>{history.pushState({},'',href);dispatchEvent(new PopStateEvent('popstate'))},refresh:()=>{}});`,
);
fs.writeFileSync(
  path.join(out, "link.js"),
  `const React=require(${JSON.stringify(req.resolve("react"))});module.exports=function Link({href,prefetch,children,...props}){return React.createElement('a',{...props,href,onClick:e=>{if(!e.ctrlKey&&!e.metaKey){e.preventDefault();history.pushState({},'',href);dispatchEvent(new PopStateEvent('popstate'))}}},children)}`,
);
async function main() {
  await new Promise((resolve, reject) =>
    webpack(
      {
        mode: "development",
        entry: path.join(proof, "fixture.tsx"),
        output: { path: out, filename: "fixture.js" },
        devtool: false,
        resolve: {
          extensions: [".tsx", ".ts", ".js"],
          modules: [path.join(repo, "node_modules"), "node_modules"],
          alias: {
            "next/link": path.join(out, "link.js"),
            "next/navigation": path.join(out, "navigation.js"),
            [path.join(pkg, "learning.module.css")]: path.join(out, "css.cjs"),
          },
        },
        module: {
          rules: [
            {
              test: /\.tsx?$/,
              exclude: /node_modules/,
              use: path.join(out, "loader.cjs"),
            },
          ],
        },
      },
      (err, stats) =>
        err || stats.hasErrors()
          ? reject(
              err || new Error(stats.toString({ all: false, errors: true })),
            )
          : resolve(),
    ),
  );
  let writes = [];
  const prototype = process.env.N2_PROTOTYPE_DIR;
  const hash = (name) =>
    createHash("sha256")
      .update(fs.readFileSync(path.join(prototype, name)))
      .digest("hex");
  const design = prototype
    ? {
        archiveSha256:
          "fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570",
        mainSha256: hash("Main.dc.html"),
        helpSha256: hash("V1440-HelpMsg.dc.html"),
      }
    : { status: "not-supplied" };
  if (prototype)
    assert.equal(
      design.mainSha256,
      "70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4",
      "authoritative final Main hash",
    );
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (request.method !== "GET") {
      writes.push({ method: request.method, url: request.url });
      response.writeHead(401, { "content-type": "application/json" });
      response.end("{}");
      return;
    }
    if (prototype && url.pathname.startsWith("/prototype/")) {
      const name = path.resolve(prototype, url.pathname.slice(11));
      if (!name.startsWith(path.resolve(prototype) + path.sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      if (fs.existsSync(name)) {
        response.setHeader(
          "content-type",
          name.endsWith(".html") ? "text/html" : "application/javascript",
        );
        const bytes = fs.readFileSync(name);
        response.end(
          name.endsWith("Main.dc.html") &&
            url.searchParams.get("scenario") === "owen-overview"
            ? bytes
                .toString("utf8")
                .replace('"default":"maya-home"', '"default":"owen-overview"')
            : bytes,
        );
        return;
      }
    }
    if (url.pathname === "/fixture.js") {
      response.setHeader("content-type", "application/javascript");
      response.end(fs.readFileSync(path.join(out, "fixture.js")));
      return;
    }
    response.setHeader("content-type", "text/html");
    response.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>N2 fixture</title><style>body{margin:0;background:#f6f8f7} ${css.replace(/:global\(([^)]+)\)/g, "$1")}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`,
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await playwright.chromium.launch({ headless: true });
  const report = {
    design,
    mode: "Fictional React component fixture; real N2/AssignmentAction, native anchor/router seams, denied start endpoint; no application/database/provider integration.",
    checks: [],
    screenshots: [],
    writes,
  };
  const check = (name, ok = true) => {
    assert.ok(ok, name);
    report.checks.push(name);
  };
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) =>
      route.request().url().startsWith(base) ? route.continue() : route.abort(),
    );
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [width, height] of [
      [1440, 1000],
      [1024, 768],
      [390, 844],
      [320, 844],
    ]) {
      await page.setViewportSize({ width, height });
      for (const scenario of [
        "multiple",
        "empty",
        "active",
        "completed",
        "pending",
        "support",
        "new",
        "unavailable",
        "loading",
        "review-slot",
      ]) {
        await page.goto(`${base}/study/assignments?fixture=${scenario}`);
        await page
          .getByRole("heading", { name: "My learning", exact: true })
          .waitFor();
        check(
          `${width} ${scenario}: no horizontal overflow`,
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        if (scenario === "pending")
          check(
            `${width} pending stays pending`,
            (await page
              .getByText("Evaluation pending", { exact: true })
              .count()) > 0,
          );
        if (scenario === "completed")
          check(
            `${width} complete has no continuation`,
            (await page
              .getByRole("heading", { name: "Pick up where you left off" })
              .count()) === 0,
          );
        if (["multiple", "empty", "unavailable"].includes(scenario)) {
          const name = `learning-${scenario}-${width}.png`;
          await page.screenshot({
            path: path.join(proof, name),
            fullPage: true,
          });
          report.screenshots.push(name);
        }
      }
      await page.goto(`${base}/study/assignments?fixture=multiple`);
      if (width <= 390) {
        const classBox = await page
          .getByRole("combobox", { name: "Class", exact: true })
          .boundingBox();
        const sourceBox = await page
          .getByRole("combobox", { name: "Source", exact: true })
          .boundingBox();
        check(
          `${width} class/source controls share a compact row`,
          classBox && sourceBox && classBox.y === sourceBox.y,
        );
      }
      await page
        .getByRole("button", { name: "Needs attention", exact: true })
        .click();
      check(
        `${width} attention filter has two rows`,
        (await page.locator("li[data-assignment-id]").count()) === 2,
      );
      await page.getByRole("button", { name: "All", exact: true }).click();
      await page.getByRole("searchbox").fill("no-match");
      check(
        `${width} no-match empty state`,
        await page.getByText("No assignments match these filters.").isVisible(),
      );
      await page.getByRole("button", { name: "Clear filters" }).click();
      await page
        .getByRole("combobox", { name: "Class", exact: true })
        .selectOption("class-b");
      check(
        `${width} real class filter`,
        (await page.locator("li[data-assignment-id]").count()) === 1,
      );
      await page
        .getByRole("combobox", { name: "Class", exact: true })
        .selectOption("");
      const row = page.locator("li[data-assignment-id]").first();
      await page.keyboard.press("Tab");
      await row
        .getByRole("link", { name: "Bandwidth and latency", exact: true })
        .focus();
      check(
        `${width} visible keyboard focus`,
        await row
          .getByRole("link", { name: "Bandwidth and latency", exact: true })
          .evaluate(
            (el) =>
              getComputedStyle(el).outlineStyle === "solid" &&
              getComputedStyle(el).outlineWidth === "3px",
          ),
      );
      await page.keyboard.press("Enter");
      await page
        .getByRole("heading", { name: "Bandwidth and latency", exact: true })
        .waitFor();
      check(`${width} overview navigation has no write`, writes.length === 0);
      check(
        `${width} exact saved session link`,
        (await page
          .locator('a[href*="session=10000000-0000-4000-8000-000000000001"]')
          .count()) === 1,
      );
      check(
        `${width} earlier completed session has its own exact deep link`,
        (await page
          .locator('a[href*="session=20000000-0000-4000-8000-000000000001"]')
          .count()) === 1,
      );
      await page.goBack();
      await page
        .getByRole("heading", { name: "My learning", exact: true })
        .waitFor();
      await page.goForward();
      await page
        .getByRole("heading", { name: "Bandwidth and latency", exact: true })
        .waitFor();
      check(
        `${width} Back/Forward retains assignment identity`,
        (await page
          .locator(
            'div[data-assignment-id="00000000-0000-4000-8000-000000000001"]',
          )
          .count()) === 1,
      );
      check(
        `${width} overview no horizontal overflow`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const overview = `overview-${width}.png`;
      await page.screenshot({
        path: path.join(proof, overview),
        fullPage: true,
      });
      report.screenshots.push(overview);
      await page.goto(
        `${base}/study/assignments/00000000-0000-4000-8000-000000000001?tab=overview#topic-topic-1`,
      );
      check(
        `${width} objective fragment exists`,
        (await page.locator("#topic-topic-1").count()) === 1,
      );
      await page.goto(`${base}/study/assignments/foreign?tab=overview`);
      check(
        `${width} foreign overview stays unavailable`,
        (await page
          .getByRole("heading", { name: "This assignment is unavailable" })
          .count()) === 1,
      );
      await page.goto(
        `${base}/study/assignments/00000000-0000-4000-8000-000000000001?fixture=mismatch`,
      );
      check(
        `${width} stale saved-work rejected`,
        await page
          .getByText("Saved work for this assignment is unavailable.")
          .isVisible(),
      );
      check(
        `${width} foreign history absent`,
        (await page.locator("li[data-session-id]").count()) === 0,
      );
      await page.goto(
        `${base}/study/assignments/00000000-0000-4000-8000-000000000001?fixture=reader`,
      );
      check(
        `${width} exact authorized reader version shown`,
        await page.getByText(/fictional-approved-version-7/).isVisible(),
      );
      const reading = page.getByRole("link", {
        name: "Open reading",
        exact: false,
      });
      check(
        `${width} reading targets same authorized assignment`,
        (await reading.getAttribute("href")) ===
          "/study/reading?assignment=00000000-0000-4000-8000-000000000001",
      );
      await page.goto(
        `${base}/study/assignments/00000000-0000-4000-8000-000000000001?fixture=source-mismatch`,
      );
      check(
        `${width} foreign reading withheld`,
        (await page
          .getByText("The reading context does not match this assignment")
          .isVisible()) &&
          (await page
            .getByRole("link", { name: "Open reading", exact: false })
            .count()) === 0,
      );
      await page.goto(
        `${base}/study/assignments/00000000-0000-4000-8000-000000000001?fixture=work-unavailable`,
      );
      check(
        `${width} missing work stays unavailable`,
        await page
          .getByText("Saved work for this assignment is unavailable.")
          .isVisible(),
      );
      await page.goto(
        `${base}/study/assignments/00000000-0000-4000-8000-000000000001?fixture=work-loading`,
      );
      check(
        `${width} work loading explicit`,
        await page.getByText("Loading saved sessions…").isVisible(),
      );
      await page.goto(`${base}/study/assignments?fixture=slots`);
      check(
        `${width} injected existing home actions render once per position`,
        (await page.locator('[data-injected-action="list"]').count()) === 6 &&
          (await page
            .getByRole("button", { name: "Start assignment", exact: true })
            .count()) === 1,
      );
      await page.goto(
        `${base}/study/assignments/00000000-0000-4000-8000-000000000001?fixture=slots`,
      );
      check(
        `${width} injected existing overview actions replace defaults`,
        (await page.locator("[data-injected-action]").count()) === 2 &&
          (await page
            .getByRole("link", { name: "Open reading", exact: false })
            .count()) === 1 &&
          (await page
            .getByRole("link", { name: "Continue learning", exact: false })
            .count()) === 1,
      );
    }
    check("all browsing and filtering write-free", writes.length === 0);
    await page.goto(`${base}/study/assignments?fixture=new`);
    await page
      .getByRole("button", { name: "Start assignment", exact: true })
      .click();
    await page
      .getByRole("alert")
      .getByText("Please sign in again before starting.")
      .waitFor();
    check(
      "explicit existing Start makes one tutoring request",
      writes.length === 1 && writes[0].url === "/api/tutoring",
    );
    check("no browser rendering errors", errors.length === 0);
    // Render the actual inspected prototype with its own vendor runtime; do not port its behavior.
    if (prototype)
      for (const [width, height] of [
        [1440, 1000],
        [1024, 768],
        [390, 844],
        [320, 844],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(`${base}/prototype/Main.dc.html`);
        await page.waitForTimeout(700);
        const name = `prototype-home-${width}.png`;
        await page.screenshot({ path: path.join(proof, name), fullPage: true });
        report.screenshots.push(name);
        await page.goto(
          `${base}/prototype/Main.dc.html?scenario=owen-overview`,
        );
        await page
          .getByRole("heading", { name: "Bandwidth and Latency", exact: true })
          .waitFor();
        const overview = `prototype-overview-${width}.png`;
        await page.screenshot({
          path: path.join(proof, overview),
          fullPage: true,
        });
        report.screenshots.push(overview);
      }
    if (prototype) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${base}/prototype/V1440-HelpMsg.dc.html`);
      await page
        .getByText(
          "I am confused about this question and need you to explain the difference between the two delays in simpler words",
          { exact: true },
        )
        .first()
        .waitFor();
      await page.screenshot({
        path: path.join(proof, "prototype-help-1440.png"),
        fullPage: true,
      });
      report.screenshots.push("prototype-help-1440.png");
    }
    fs.writeFileSync(
      path.join(proof, "browser-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        checks: report.checks.length,
        screenshots: report.screenshots.length,
        writes,
      }),
    );
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
