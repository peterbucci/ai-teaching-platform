/** Read-only inspection of the exact approved exported prototype. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const exportRoot = path.resolve(
  process.env.PROTOTYPE_EXPORT_DIR ??
    "C:/Users/sb128/.codex/visualizations/2026/10/25/01a1713e-abef-7833-aa2a-a0ffa25ec46e/prototype-verification/export",
);
const output = path.resolve(process.argv[2]);
const htmlSha256 = createHash("sha256")
  .update(readFileSync(path.join(exportRoot, "Main.dc.html")))
  .digest("hex");
assert.equal(
  htmlSha256,
  "c853369da1250adf24a741a38c3d94d3c97a976c012c352732cf4dd8d924cb54",
);
await mkdir(output);
const server = createServer((request, response) => {
  const file = path.resolve(
    exportRoot,
    "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname),
  );
  if (
    !file.startsWith(exportRoot + path.sep) ||
    !existsSync(file) ||
    !statSync(file).isFile()
  ) {
    response.writeHead(404).end();
    return;
  }
  const mime =
    {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".json": "application/json",
      ".woff2": "font/woff2",
      ".png": "image/png",
    }[path.extname(file)] ?? "application/octet-stream";
  response.writeHead(200, { "Content-Type": mime });
  response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/Main.dc.html`;
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE ??
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.BROWSER_EXECUTABLE ??
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const report = {
  startedAt: new Date().toISOString(),
  htmlSha256,
  category:
    "Actual unchanged exported prototype; fictional built-in data; no application backend",
  states: [],
};
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(url);
    await page.locator(".lpc").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page
      .getByRole("button", { name: "Look into it", exact: true })
      .nth(1)
      .click();
    for (const state of ["list", "selected"]) {
      if (state === "selected")
        await page
          .getByRole("button", { name: "Read in full", exact: true })
          .filter({ visible: true })
          .first()
          .click();
      const name = `${state}-${viewport.width}x${viewport.height}`;
      await page.screenshot({ path: path.join(output, name + ".png") });
      const metrics = await page.evaluate(() => {
        const visible = (element) =>
          element.getClientRects().length &&
          getComputedStyle(element).visibility !== "hidden";
        return {
          width: innerWidth,
          height: innerHeight,
          overflow: document.documentElement.scrollWidth > innerWidth,
          headings: [...document.querySelectorAll("h1,h2,h3")]
            .filter(visible)
            .map((element) => {
              const r = element.getBoundingClientRect();
              return {
                text: element.textContent,
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
              };
            }),
          panes: [
            ...document.querySelectorAll(
              ".pane,.ctx,.left,.main,.right,[role=tabpanel]",
            ),
          ]
            .filter(visible)
            .map((element) => {
              const r = element.getBoundingClientRect();
              return {
                className: element.className,
                x: r.x,
                y: r.y,
                width: r.width,
                height: r.height,
              };
            }),
        };
      });
      report.states.push({ name, viewport, metrics });
    }
    await context.close();
  }
  report.status = "passed";
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log(
  JSON.stringify({
    status: report.status,
    states: report.states.length,
    output,
  }),
);
