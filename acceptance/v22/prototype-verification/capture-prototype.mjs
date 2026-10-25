/** Capture the unchanged Workbench export through its real controls. No APIs or model calls. */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(process.argv[2] ?? path.join(root, "screenshots"));
if (existsSync(path.join(output, "report.json")))
  throw new Error("Use a fresh output directory to preserve earlier evidence.");
await mkdir(output, { recursive: true });
const url = process.env.PROTOTYPE_URL ?? "http://127.0.0.1:3352/Main.dc.html";
if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
  throw new Error("Only loopback prototype targets permitted.");
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const expectedHtmlSha =
  "c853369da1250adf24a741a38c3d94d3c97a976c012c352732cf4dd8d924cb54";
if (
  sha(
    path.join(
      process.env.PROTOTYPE_EXPORT_DIR ?? path.join(root, "export"),
      "Main.dc.html",
    ),
  ) !== expectedHtmlSha
)
  throw new Error("Export changed: capture requires the pinned original HTML.");
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
  url,
  browser: browser.version(),
  htmlSha256: expectedHtmlSha,
  archiveSha256:
    "74bc909dffba839d6850823b35b8c8fc3c67adf1a64b14d67f245560fb87768f",
  runnerSha256: sha(fileURLToPath(import.meta.url)),
  category:
    "actual exported prototype; fictional built-in data; no application/backend acceptance",
  viewportKind:
    "CSS viewport at device scale 1; mobile-sized desktop context, not device emulation",
  states: [],
  limitations: [
    "Screen-reader verification unrun",
    "Native browser 200% zoom unrun",
    "Prototype simulates paths and data; does not prove live authorization, persistence or model behavior",
  ],
};
const visibleButton = (page, name) =>
  page
    .getByRole("button", { name, exact: true })
    .filter({ visible: true })
    .first();
async function course(page, width, name) {
  await page
    .locator(width <= 800 ? "nav.mbar" : "nav.ctabs")
    .getByRole("button", { name, exact: true })
    .click();
}
async function concern(page) {
  await page
    .getByRole("button", { name: "Look into it", exact: true })
    .nth(1)
    .click();
}
const states = [
  ["overview", async () => {}],
  ["assignments", async (p, w) => course(p, w, "Assignments")],
  [
    "assignment-section-a",
    async (p, w) => {
      await course(p, w, "Assignments");
      await p
        .getByRole("button", {
          name: "Open Section A · Bandwidth and Latency, version 3",
          exact: true,
        })
        .click();
    },
  ],
  [
    "assignment-inactive-section-c",
    async (p, w) => {
      await course(p, w, "Assignments");
      await p
        .getByRole("button", {
          name: "Open Section C · Bandwidth and Latency, version 3",
          exact: true,
        })
        .click();
    },
  ],
  ["lessons", async (p, w) => course(p, w, "Lessons")],
  [
    "lesson-published",
    async (p, w) => {
      await course(p, w, "Lessons");
      await p
        .locator("button.lrow")
        .filter({ hasText: "Bandwidth and Latency" })
        .click();
    },
  ],
  ["evidence-concern", async (p) => concern(p)],
  [
    "evidence-original-answer",
    async (p) => {
      await concern(p);
      await visibleButton(p, "Read in full").click();
    },
  ],
  [
    "intervention-approved",
    async (p) => visibleButton(p, "Review and deliver").click(),
  ],
];
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ]) {
    for (const [name, navigate] of states) {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const result = {
        name,
        viewport,
        requests: [],
        failures: [],
        errors: [],
        status: "unrun",
      };
      page.on("requestfailed", (r) =>
        result.failures.push({ url: r.url(), error: r.failure()?.errorText }),
      );
      page.on("response", (r) => {
        if (!r.url().startsWith("data:"))
          result.requests.push({ url: r.url(), status: r.status() });
      });
      page.on("pageerror", (e) => result.errors.push(e.message));
      try {
        await page.goto(url, { waitUntil: "load" });
        await page.locator(".lpc").waitFor();
        await page.evaluate(() => document.fonts.ready);
        await navigate(page, viewport.width);
        await page.waitForTimeout(120);
        result.metrics = await page.evaluate(() => {
          const visible = (e) => {
            const r = e.getBoundingClientRect(),
              s = getComputedStyle(e);
            return (
              r.width > 0 &&
              r.height > 0 &&
              s.visibility !== "hidden" &&
              s.display !== "none"
            );
          };
          const props = (e) => {
            const r = e.getBoundingClientRect(),
              s = getComputedStyle(e);
            return {
              tag: e.tagName,
              class: e.className,
              label: e.getAttribute("aria-label"),
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              scrollWidth: e.scrollWidth,
              clientWidth: e.clientWidth,
              fontFamily: s.fontFamily,
              fontSize: s.fontSize,
              lineHeight: s.lineHeight,
              fontWeight: s.fontWeight,
              padding: s.padding,
              gap: s.gap,
              display: s.display,
              columns: s.gridTemplateColumns,
              overflowX: s.overflowX,
              overflowY: s.overflowY,
            };
          };
          return {
            innerWidth,
            innerHeight,
            devicePixelRatio,
            fonts: [...document.fonts].map((f) => ({
              family: f.family,
              status: f.status,
              weight: f.weight,
            })),
            documentWidth: document.documentElement.scrollWidth,
            activeElement: document.activeElement
              ? {
                  tag: document.activeElement.tagName,
                  text: document.activeElement.textContent
                    ?.trim()
                    .slice(0, 160),
                  tabindex: document.activeElement.getAttribute("tabindex"),
                }
              : null,
            geometry: [
              ...document.querySelectorAll(
                ".lpc,.lp,.top,.ctabs,.abar,.path,.mbar,.msw,.pg,.pg-split,.pg-main,.pg-rail,.pg-in,.wb,.wb3,.wb2,.pane,.h1,.rec-h,.ph,.phead,.pq-r",
              ),
            ]
              .filter(visible)
              .map(props),
            navigation: [...document.querySelectorAll("nav")]
              .filter(visible)
              .map((e) => ({
                label: e.getAttribute("aria-label"),
                text: e.innerText,
              })),
            headings: [...document.querySelectorAll("h1,h2,h3")]
              .filter(visible)
              .map((e) => ({ text: e.innerText, ...props(e) })),
          };
        });
        const basename = `${name}-${viewport.width}x${viewport.height}`;
        result.screenshot = `${basename}.png`;
        await page.screenshot({ path: path.join(output, result.screenshot) });
        await writeFile(
          path.join(output, `${basename}.txt`),
          await page.locator("body").innerText(),
        );
        result.status = "captured";
      } catch (e) {
        result.status = "failed";
        result.error = e.message;
        await page
          .screenshot({
            path: path.join(
              output,
              `${name}-${viewport.width}x${viewport.height}-failed.png`,
            ),
          })
          .catch(() => {});
      }
      report.states.push(result);
      console.log(`${viewport.width} ${name}: ${result.status}`);
      await context.close();
    }
  }
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(
  JSON.stringify({
    output,
    captured: report.states.filter((s) => s.status === "captured").length,
    total: report.states.length,
  }),
);
