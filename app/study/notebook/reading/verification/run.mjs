import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const proof = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(proof, "../../../../..");
const pkg = path.dirname(proof);
const req = createRequire(path.join(repo, "package.json"));
const out = fs.mkdtempSync(path.join(os.tmpdir(), "learning-pulse-n4-"));
const playwright = req(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const webpack = req("next/dist/compiled/webpack/webpack").webpack;
const prototype = process.env.N4_PROTOTYPE_DIR;
const css = fs.readFileSync(path.join(pkg, "reading.module.css"), "utf8");
const baseCss = fs.readFileSync(
  path.join(repo, "app/study/reading/reader.css"),
  "utf8",
);
const cssMap = Object.fromEntries(
  [...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => [m[1], m[1]]),
);
fs.writeFileSync(
  path.join(out, "css.cjs"),
  `module.exports=${JSON.stringify(cssMap)}`,
);
fs.writeFileSync(
  path.join(out, "loader.cjs"),
  `const ts=require(${JSON.stringify(req.resolve("typescript"))});module.exports=function(s){return ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText}`,
);
fs.writeFileSync(
  path.join(out, "link.cjs"),
  `const React=require(${JSON.stringify(req.resolve("react"))});module.exports=function Link({href,prefetch,scroll,children,onClick,...props}){return React.createElement('a',{...props,href,onClick:e=>{onClick?.(e);if(!e.defaultPrevented&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();history.pushState({},'',href);dispatchEvent(new PopStateEvent('popstate'))}}},children)}`,
);
fs.writeFileSync(
  path.join(out, "navigation.cjs"),
  `const router={push:href=>{history.pushState({},'',href);dispatchEvent(new PopStateEvent('popstate'))},refresh:()=>{}};exports.useRouter=()=>router;`,
);
const dataUrl = pathToFileURL(path.join(proof, "data.ts")).href;
const data = execFileSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--conditions=react-server",
    "--input-type=module",
    "-e",
    `import { readingFixture } from ${JSON.stringify(dataUrl)}; console.log(JSON.stringify(readingFixture()));`,
  ],
  { cwd: repo, encoding: "utf8" },
);
const fixtureData = JSON.parse(data);
const writes = [];
const report = {
  mode: "Isolated N4 component fixture, actual session-free StudentReader and approved public text; native-anchor/router seams; no production routes/database/provider.",
  checks: [],
  screenshots: [],
  writes,
  zoom: "Actual browser 200% zoom not run by this headless harness; viewport resize is not zoom.",
};
const check = (name, result = true) => {
  assert.ok(result, name);
  report.checks.push(name);
};
const sizes = [
  [1440, 1000],
  [1024, 768],
  [390, 844],
  [320, 844],
];
const fixtureCss = `body{margin:0;background:#f6f8f7;color:#17302d;font-family:system-ui}button,textarea{font:inherit}button{min-height:44px;cursor:pointer}button:focus-visible,textarea:focus-visible{outline:3px solid #2f8a6b;outline-offset:2px}.fixture-header{display:flex;flex-wrap:wrap;gap:8px 20px;padding:16px 20px;background:#11372f;color:white}.fixture-header span{font-size:13px}.fixture-actions{padding:12px 20px;display:flex;flex-wrap:wrap;gap:8px}.fixture-layout{max-width:1280px;margin:auto;background:white}.fixture-layout.pane{display:grid;grid-template-columns:minmax(0,1fr) 384px}.fixture-question{padding:24px}.fixture-question label,.fixture-question textarea{display:block;width:100%;box-sizing:border-box}.fixture-question textarea{min-height:150px}.fixture-reading{min-width:0}.fixture-reading[hidden],.fixture-question[hidden]{display:none}.pane-return{margin:14px 20px;background:#176d58;color:#fff;border:0;border-radius:10px;padding:8px 12px}.fixture-reading>nav{padding:12px 20px}@media(max-width:1279px){.fixture-layout.pane{grid-template-columns:minmax(0,1fr) 372px}}@media(max-width:819px){.fixture-layout.pane{display:block}.pane.open .fixture-question{display:none}.fixture-question{padding:14px}.fixture-header,.fixture-actions{padding:12px 14px}}`;

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
            "next/link": path.join(out, "link.cjs"),
            "next/navigation": path.join(out, "navigation.cjs"),
            [path.join(pkg, "reading.module.css")]: path.join(out, "css.cjs"),
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
  if (prototype) {
    const hash = createHash("sha256")
      .update(fs.readFileSync(path.join(prototype, "Main.dc.html")))
      .digest("hex");
    assert.equal(
      hash,
      "70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4",
    );
    report.reference = {
      mainSha256: hash,
      archiveSha256:
        "fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570",
    };
  }
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (request.method !== "GET") {
      writes.push({ method: request.method, url: request.url });
      response.writeHead(401, { "content-type": "application/json" });
      response.end("{}");
      return;
    }
    if (url.pathname === "/fixture-data.json") {
      response.setHeader("content-type", "application/json");
      response.end(data);
      return;
    }
    if (url.pathname === "/fixture.js") {
      response.setHeader("content-type", "application/javascript");
      response.end(fs.readFileSync(path.join(out, "fixture.js")));
      return;
    }
    if (prototype && url.pathname.startsWith("/prototype/")) {
      const filename = path.resolve(prototype, url.pathname.slice(11));
      if (
        !filename.startsWith(path.resolve(prototype) + path.sep) ||
        !fs.existsSync(filename)
      ) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.setHeader(
        "content-type",
        filename.endsWith(".html") ? "text/html" : "application/javascript",
      );
      const source = fs.readFileSync(filename, "utf8");
      response.end(
        filename.endsWith("Main.dc.html")
          ? source.replace(
              '"default":"maya-home"',
              `"default":"${url.searchParams.get("scenario") === "owen-p2-reading" ? "owen-p2-reading" : "owen-reading"}"`,
            )
          : source,
      );
      return;
    }
    response.setHeader("content-type", "text/html");
    response.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>N4 component verification</title><style>${baseCss}\n${css.replace(/:global\(([^)]+)\)/g, "$1")}\n${fixtureCss}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`,
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  if (process.env.N4_SERVE_ONLY === "1") {
    console.log(`N4 isolated fixture: ${base}/study/reading`);
    return;
  }
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) =>
    route.request().url().startsWith(base) ? route.continue() : route.abort(),
  );
  const capture = async (name) => {
    await page.screenshot({ path: path.join(proof, name), fullPage: true });
    report.screenshots.push(name);
  };
  const noOverflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  try {
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const scenario of [
        "ready",
        "loading",
        "empty",
        "unavailable",
        "mismatch",
      ]) {
        await page.goto(`${base}/study/reading?fixture=${scenario}`);
        await page
          .getByRole("heading", {
            name:
              scenario === "ready"
                ? fixtureData.reading.attribution.title
                : "Reading",
            exact: true,
          })
          .first()
          .waitFor();
        check(
          `${width} ${scenario}: no horizontal overflow`,
          await noOverflow(),
        );
        if (scenario !== "ready")
          check(
            `${width} ${scenario}: controller not mounted`,
            (await page.locator(".lp-s-reader-refined").count()) === 0,
          );
        if (["ready", "loading", "unavailable"].includes(scenario))
          await capture(`reading-${scenario}-${width}.png`);
      }
      await page.goto(`${base}/study/reading`);
      await page
        .getByRole("searchbox", { name: "Search this reading" })
        .waitFor();
      check(
        `${width}: selected approved text`,
        (await page.locator(".reading-body").textContent()).includes(
          fixtureData.reading.sections
            .find((s) => s.id === "P07")
            .text.split(/\r?\n/)[0]
            .replace(/<\/?sup>/g, ""),
        ),
      );
      await page.getByText("Source and version", { exact: true }).click();
      check(
        `${width}: exact source commit visible`,
        await page
          .getByText(fixtureData.reading.content_ref.source_commit, {
            exact: true,
          })
          .isVisible(),
      );
      await page.getByText("Source and version", { exact: true }).click();
      const citation = page
        .getByRole("navigation", { name: "Source passages" })
        .getByRole("link")
        .filter({ hasText: "P08" });
      await citation.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(/passage=P08/);
      check(
        `${width}: citation opens exact authorized version`,
        new URL(page.url()).searchParams.get("version") ===
          fixtureData.reading.content_ref.content_version,
      );
      await page.goBack();
      await page
        .getByRole("searchbox", { name: "Search this reading" })
        .waitFor();
      const before = await page
        .locator(".reading-body")
        .evaluate((e) => getComputedStyle(e).fontSize);
      await page.getByRole("button", { name: "Increase text size" }).click();
      check(
        `${width}: existing size control changes text`,
        parseFloat(
          await page
            .locator(".reading-body")
            .evaluate((e) => getComputedStyle(e).fontSize),
        ) > parseFloat(before),
      );
      await page
        .getByRole("searchbox", { name: "Search this reading" })
        .fill("unfindable-phrase-421");
      await page
        .getByText("No passages match your search.", { exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Toggle pending presentation" })
        .click();
      check(
        `${width}: same-scope pending keeps reader/search`,
        (await page
          .getByRole("searchbox", { name: "Search this reading" })
          .inputValue()) === "unfindable-phrase-421",
      );
      await page
        .getByRole("button", { name: "Toggle pending presentation" })
        .click();
      await page.getByRole("button", { name: "Clear search" }).click();
      if (
        await page
          .getByRole("button", { name: "Table of contents" })
          .isVisible()
      ) {
        await page.getByRole("button", { name: "Table of contents" }).click();
        check(
          `${width}: contents disclosure expanded`,
          (await page
            .getByRole("button", { name: "Table of contents" })
            .getAttribute("aria-expanded")) === "true",
        );
      }
      const passage = page.locator(".topic-item").filter({
        hasText: fixtureData.reading.sections.find((s) => s.id === "P08").title,
      });
      await passage.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(/passage=P08/);
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains("reading-article"),
      );
      check(`${width}: keyboard passage navigation focuses article`);
      await page.goBack();
      await page.waitForURL((url) => url.searchParams.get("passage") !== "P08");
      await page.goForward();
      await page.waitForURL(/passage=P08/);
      check(
        `${width}: Back/Forward retains exact passage/version`,
        new URL(page.url()).searchParams.get("version") ===
          fixtureData.reading.content_ref.content_version,
      );
      const longest = fixtureData.reading.sections.toSorted(
        (a, b) => b.text.length - a.text.length,
      )[0];
      await page.goto(`${base}/study/reading?passage=${longest.id}`);
      await page.locator(".reading-body").waitFor();
      await page.locator(".reader-bottom").scrollIntoViewIfNeeded();
      check(
        `${width}: long passage end reachable`,
        (await page.locator(".reader-bottom").isVisible()) &&
          (await noOverflow()),
      );
      await capture(`reading-long-${width}.png`);
      await page.goto(`${base}/study/reading?fixture=pane`);
      await page
        .locator('.fixture-reading[data-fixture-reader-active="false"]')
        .waitFor({ state: "attached" });
      check(`${width}: closed fixture supplies active=false`);
      await page
        .getByLabel("Unsent answer")
        .fill("  My unfinished explanation\nkeeps its exact words.  ");
      const draft = await page.getByLabel("Unsent answer").inputValue();
      await page
        .getByRole("button", { name: "Open contextual reading" })
        .click();
      await page
        .getByRole("button", { name: "Return to question", exact: true })
        .waitFor();
      check(
        `${width}: exposed fixture supplies active=true`,
        (await page
          .locator(".fixture-reading")
          .getAttribute("data-fixture-reader-active")) === "true",
      );
      check(
        `${width}: exactly one composed reader`,
        (await page.locator(".lp-s-reader-refined").count()) === 1,
      );
      check(`${width}: pane no horizontal overflow`, await noOverflow());
      if (width <= 390)
        check(
          `${width}: reading replaces question visually`,
          !(await page.getByLabel("Unsent answer").isVisible()),
        );
      await capture(`reading-pane-${width}.png`);
      await page
        .getByRole("button", { name: "Return to question", exact: true })
        .click();
      check(
        `${width}: return deactivates retained reader`,
        (await page
          .locator(".fixture-reading")
          .getAttribute("data-fixture-reader-active")) === "false",
      );
      check(
        `${width}: exact draft survives pane switch`,
        (await page.getByLabel("Unsent answer").inputValue()) === draft,
      );
      check(
        `${width}: return focus restored`,
        await page
          .getByLabel("Unsent answer")
          .evaluate((e) => e === document.activeElement),
      );
      check(
        `${width}: conversation remains mounted`,
        (await page
          .getByText(
            "Conversation retained: “Can I read the original passage?”",
            { exact: true },
          )
          .count()) === 1,
      );
    }
    check(
      "rendering, hidden standalone fixture and navigation performed zero writes",
      writes.length === 0,
    );
    await page.goto(`${base}/study/reading`);
    await page.getByRole("button", { name: "Save my place" }).click();
    await page
      .getByText("Your bookmark could not be saved. Please try again.", {
        exact: true,
      })
      .waitFor();
    check(
      "explicit bookmark failure preserves text and reports error",
      (await page.locator(".reading-body").isVisible()) &&
        writes.length === 1 &&
        writes[0].method === "PUT",
    );
    if (prototype)
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        for (const scenario of ["owen-reading", "owen-p2-reading"]) {
          await page.goto(
            `${base}/prototype/Main.dc.html?scenario=${scenario}`,
          );
          await page.locator(".rd-text").waitFor();
          await capture(
            `prototype-${scenario === "owen-reading" ? "reading" : "pane"}-${width}.png`,
          );
        }
      }
    check("no browser rendering errors", errors.length === 0);
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
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
