import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url)),
  output = path.join(root, "interaction-checks");
await mkdir(output, { recursive: true });
const { chromium } = createRequire(import.meta.url)(
  "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const report = {
  startedAt: new Date().toISOString(),
  url: "http://127.0.0.1:3352/Main.dc.html",
  checks: [],
  limitations: [
    "Prototype interaction evidence only",
    "Screen-reader and native200% zoom unrun",
  ],
};
const active = (p) =>
  p.evaluate(() => {
    const e = document.activeElement;
    return {
      tag: e?.tagName,
      text: e?.textContent?.trim().slice(0, 180),
      aria: e?.getAttribute("aria-label"),
      tabindex: e?.getAttribute("tabindex"),
    };
  });
async function run(width, height, fn) {
  const c = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    }),
    p = await c.newPage();
  p.setDefaultTimeout(6000);
  try {
    await p.goto(report.url);
    await p.locator(".lpc").waitFor();
    await p.evaluate(() => document.fonts.ready);
    await fn(p);
  } catch (e) {
    report.checks.push({ width, status: "error", error: e.message });
  } finally {
    await c.close();
  }
}
try {
  await run(1440, 1000, async (p) => {
    const sequence = [];
    for (let i = 0; i < 9; i++) {
      await p.keyboard.press("Tab");
      sequence.push(await active(p));
    }
    report.checks.push({
      name: "desktop-tab-sequence",
      width: 1440,
      status: "observed",
      sequence,
    });
    const assignments = p
      .locator("nav.ctabs")
      .getByRole("button", { name: "Assignments", exact: true });
    await assignments.focus();
    await p.keyboard.press("Enter");
    await p.waitForTimeout(100);
    report.checks.push({
      name: "keyboard-course-navigation-focus",
      width: 1440,
      status: "observed",
      active: await active(p),
    });
    await p
      .locator("nav.path")
      .getByRole("button", { name: "Back to Overview", exact: true })
      .click();
    await p.waitForTimeout(100);
    report.checks.push({
      name: "internal-back-focus",
      width: 1440,
      status: "observed",
      active: await active(p),
    });
  });
  for (const [width, height] of [
    [1024, 768],
    [390, 844],
    [320, 844],
  ])
    await run(width, height, async (p) => {
      await p
        .getByRole("button", { name: "Look into it", exact: true })
        .nth(1)
        .click();
      await p.waitForTimeout(100);
      const button = p
        .getByRole("button", { name: "Context", exact: true })
        .filter({ visible: true })
        .first();
      await button.focus();
      await p.keyboard.press("Enter");
      await p.waitForTimeout(100);
      await p.screenshot({
        path: path.join(output, `evidence-context-${width}x${height}.png`),
      });
      report.checks.push({
        name: "context-keyboard-open-focus",
        width,
        status: "observed",
        active: await active(p),
        visiblePanes: await p
          .locator(".pane")
          .filter({ visible: true })
          .evaluateAll((es) =>
            es.map((e) => ({
              class: e.className,
              rect: e.getBoundingClientRect().toJSON(),
            })),
          ),
      });
      if (width === 1024) {
        await p
          .getByRole("button", { name: "Close", exact: true })
          .filter({ visible: true })
          .click();
        await p.waitForTimeout(100);
        report.checks.push({
          name: "context-close-focus",
          width,
          status: "observed",
          active: await active(p),
        });
      } else {
        await p
          .locator(".msw")
          .getByRole("button", { name: "Details", exact: true })
          .click();
        await p.waitForTimeout(100);
        report.checks.push({
          name: "mobile-details-pane-focus",
          width,
          status: "observed",
          active: await active(p),
        });
        await p.getByRole("button", { name: "Menu", exact: true }).click();
        await p.waitForTimeout(100);
        await p.screenshot({
          path: path.join(output, `assignment-menu-${width}x${height}.png`),
        });
        const menuOpen = await p
          .getByRole("dialog", { name: "Menu", exact: true })
          .isVisible();
        await p.keyboard.press("Escape");
        await p.waitForTimeout(100);
        report.checks.push({
          name: "mobile-menu-escape-focus",
          width,
          status: "observed",
          menuWasOpen: menuOpen,
          menuRemainsOpen: await p
            .getByRole("dialog", { name: "Menu", exact: true })
            .isVisible(),
          active: await active(p),
        });
      }
    });
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
