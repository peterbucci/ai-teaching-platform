import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || import.meta.url,
);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
const ctx = await browser.newContext();
const login = await ctx.request.post(
  "http://127.0.0.1:3516/api/auth/sign-in/email",
  {
    data: {
      email: process.env.DEMO_TEACHER_EMAIL,
      password: process.env.DEMO_TEACHER_PASSWORD,
    },
    headers: { Origin: "http://127.0.0.1:3516" },
  },
);
if (!login.ok()) throw Error("Fictional sign in failed: " + login.status());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("app/teacher/overview/verification", { recursive: true });
const captures = [];
const assert = (await import("node:assert/strict")).default;
for (const [width, height] of [
  [1440, 1000],
  [1024, 768],
  [390, 844],
  [320, 844],
]) {
  await page.setViewportSize({ width, height });
  await page.goto("http://127.0.0.1:3516/teacher");
  await page.locator("#overview-title").waitFor();
  await page.locator(".ov-priority").first().waitFor();
  await page.screenshot({
    path: `app/teacher/overview/verification/overview-${width}.png`,
  });
  await page.screenshot({
    path: `app/teacher/overview/verification/overview-${width}-full.png`,
    fullPage: true,
  });
  captures.push(
    await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      firstAction: document
        .querySelector(".ov-priority a")
        ?.getBoundingClientRect()
        .toJSON(),
      assignmentCount: document.querySelectorAll(".ov-assignment-list > li")
        .length,
      resumeCount: document.querySelectorAll(".ov-resume-list > li").length,
    })),
  );
}
for (const c of captures) {
  assert.equal(c.scrollWidth, c.width);
  assert.equal(c.assignmentCount, 3);
  assert.equal(c.resumeCount, 2);
  assert.ok(c.firstAction.bottom < c.height - 65);
}
await writeFile(
  "app/teacher/overview/verification/viewports.json",
  JSON.stringify({ captures, errors }, null, 2),
);
console.log(JSON.stringify({ captures, errors }));
await browser.close();
