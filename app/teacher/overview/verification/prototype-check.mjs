import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || import.meta.url,
);
const { chromium } = require("playwright");
const proto = resolve(process.env.PROTOTYPE_DIR || "../prototype"),
  out = "app/teacher/overview/verification";
const server = createServer(async (req, res) => {
  try {
    const path = resolve(
      proto,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (!path.startsWith(proto + sep)) throw Error();
    const b = await readFile(path);
    res.setHeader(
      "Content-Type",
      path.endsWith(".js") ? "text/javascript" : "text/html",
    );
    res.end(b);
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((r) => server.listen(3517, "127.0.0.1", r));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
const captures = [];
for (const [width, height] of [
  [1440, 1000],
  [1024, 768],
  [390, 844],
  [320, 844],
]) {
  await page.setViewportSize({ width, height });
  await page.goto("http://127.0.0.1:3517/Main.dc.html");
  await page.locator("#ov-h").waitFor();
  await page.screenshot({ path: out + `/prototype-${width}.png` });
  captures.push(
    await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      summary: document.querySelector(".phead .meta")?.textContent,
      groups: [...document.querySelectorAll(".pq h2")].map(
        (x) => x.textContent,
      ),
      assignments: document.querySelectorAll(".rail-i").length,
      resume: document.querySelectorAll(".rail-r").length,
      firstAction: document
        .querySelector(".pq-a button")
        ?.getBoundingClientRect()
        .toJSON(),
    })),
  );
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto("http://127.0.0.1:3517/Main.dc.html");
await page.locator("#ov-h").waitFor();
console.log((await page.locator(".pg-split").innerText()).slice(0, 10000));
const actions = [];
for (const [selector, index] of [
  [".pq-a button", 0],
  [".pq-a button", 2],
  [".pq-a button", 4],
  [".pq-a button", 5],
  [".pq-a button", 6],
  [".pq-a button", 9],
  [".rail-i", 0],
  [".rail-i", 3],
  [".rail-r button", 0],
  [".rail-r button", 1],
]) {
  await page.goto("http://127.0.0.1:3517/Main.dc.html");
  await page.locator("#ov-h").waitFor();
  const button = page.locator(selector).nth(index);
  const label = await button.innerText();
  await button.click();
  await page.waitForTimeout(150);
  actions.push({
    selector,
    index,
    label,
    heading: await page.locator("h1").allTextContents(),
    text: (await page.locator(".lpc").innerText()).slice(0, 2200),
  });
  assert.equal(await page.locator("#ov-h").count(), 0);
}
await writeFile(
  out + "/prototype.json",
  JSON.stringify(
    {
      source: "User-supplied Workbench v2.2 HTML ZIP",
      sha256: createHash("sha256")
        .update(await readFile(resolve(proto, "Main.dc.html")))
        .digest("hex"),
      externalFonts: "blocked; local system fallback used",
      captures,
      actions,
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
server.close();
