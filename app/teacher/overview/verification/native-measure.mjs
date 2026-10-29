import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || import.meta.url,
);
const { chromium } = require("playwright");
const browser = await chromium.connectOverCDP("http://127.0.0.1:9516");
const pages = browser
  .contexts()
  .flatMap((c) => c.pages())
  .filter((p) => p.url() === "http://127.0.0.1:3516/teacher");
assert.equal(pages.length, 1);
const page = pages[0];
const out = "app/teacher/overview/verification";
const initial = JSON.parse(
  await readFile(out + "/native-origin.json", "utf8"),
).initial;
const state = await page.evaluate(() => ({
  url: location.href,
  width: innerWidth,
  height: innerHeight,
  dpr: devicePixelRatio,
  scrollWidth: document.documentElement.scrollWidth,
  firstAction: document
    .querySelector(".ov-priority a")
    .getBoundingClientRect()
    .toJSON(),
  navs: [...document.querySelectorAll("nav")]
    .filter((n) => getComputedStyle(n).position === "fixed")
    .map((n) => ({
      label: n.getAttribute("aria-label"),
      rect: n.getBoundingClientRect().toJSON(),
    })),
}));
await page.screenshot({ path: out + "/native-200.png" });
await page.screenshot({ path: out + "/native-200-full.png", fullPage: true });
assert.equal(state.dpr / initial.dpr, 2);
assert.ok(state.scrollWidth <= state.width);
assert.ok(state.navs.every((n) => state.firstAction.bottom < n.rect.top));
await writeFile(
  out + "/native-200.json",
  JSON.stringify(
    {
      method:
        "Native Chrome Ctrl+numpad-plus (5 presses after Ctrl+0), visible browser zoom control confirmed 200%. No CSS zoom, page scale or device emulation.",
      initial,
      state,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(state));
await browser.close();
