/** Read-only screenshot/geometry capture after explicitly permitted demo teacher login. */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.resolve(
  process.env.ACCEPTANCE_STATE_DIR ?? path.resolve(root, "../runtime-final"),
);
const manifest = JSON.parse(
  readFileSync(path.join(runtime, "manifest.json"), "utf8"),
);
const env = readFileSync(path.join(runtime, ".env.acceptance"), "utf8");
const sourceSha = "07efb7f821339538800f150f57b298eb2e606be3";
if (
  manifest.target !== "shell" ||
  manifest.project !== "lp-v22-final-01a173d6" ||
  manifest.sourceSha !== sourceSha ||
  manifest.sourceTree !== "948b9a6005a056c97f10d181c589b5352d6221f3" ||
  manifest.origin !== "http://localhost:3396" ||
  manifest.paidModelCallsAuthorized !== false
)
  throw new Error("Pinned shared-shell manifest mismatch");
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"])
  if (!env.split(/\r?\n/).includes(`${key}=`))
    throw new Error("Provider must be disabled");
const output = path.resolve(process.argv[2] ?? path.join(root, "screenshots"));
if (existsSync(path.join(output, "report.json")))
  throw new Error("Use a fresh output folder");
await mkdir(output, { recursive: true });
const scenarioFile = process.argv[3];
const scenario = scenarioFile
  ? JSON.parse(readFileSync(scenarioFile, "utf8"))
  : null;
if (
  scenario &&
  (scenario.phase !== "populated" ||
    typeof scenario.fixtureLabel !== "string" ||
    !Array.isArray(scenario.states))
)
  throw new Error(
    "Populated scenario must declare phase, fixtureLabel and exact GET states",
  );
if (scenario)
  for (const item of scenario.states) {
    if (
      !Array.isArray(item) ||
      item.length !== 2 ||
      !/^[a-z0-9-]+$/.test(item[0]) ||
      !/^\/teacher(?:\/|\?|$)/.test(item[1]) ||
      /REQUIRED|<|>|\s/.test(item[1])
    )
      throw new Error("Invalid or unresolved populated state");
  }
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const report = {
  sourceSha,
  phase: scenario?.phase ?? "default-seed",
  fixtureLabel:
    scenario?.fixtureLabel ?? "Unmodified default fictional db:seed fixture",
  scenarioFileSha256: scenarioFile
    ? createHash("sha256").update(readFileSync(scenarioFile)).digest("hex")
    : null,
  sourceTree: manifest.sourceTree,
  category:
    "provider-disabled synthetic final combined composition; read-only after Demo teacher login",
  origin: manifest.origin,
  browser: browser.version(),
  startedAt: new Date().toISOString(),
  runnerSha256: createHash("sha256")
    .update(readFileSync(fileURLToPath(import.meta.url)))
    .digest("hex"),
  mutatingRequests: [],
  blockedRequests: [],
  states: [],
  limitations: [
    "Fixture has different counts/names/version distribution from prototype",
    "Screen-reader and native200% zoom unrun",
    "No new authored lesson, intervention or assignment created for these captures",
  ],
};
let loginAllowed = true;
await context.route("**/*", async (route) => {
  const r = route.request(),
    u = new URL(r.url());
  if (["GET", "HEAD", "OPTIONS"].includes(r.method())) return route.continue();
  const item = { method: r.method(), url: r.url() };
  if (
    loginAllowed &&
    u.origin === manifest.origin &&
    u.pathname === "/api/auth/demo-sign-in"
  ) {
    report.mutatingRequests.push({
      ...item,
      reason: "authorized fictional teacher login",
    });
    return route.continue();
  }
  report.blockedRequests.push(item);
  return route.abort("blockedbyclient");
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const assignment = "30000000-0000-4000-8000-000000000001",
  session = "40000000-0000-4000-8000-000000000001",
  attempt = "50000000-0000-4000-8000-000000000001",
  evaluation = "60000000-0000-4000-8000-000000000001";
const scope = `assignment=${assignment}&origin=synthetic_fixture&concept=transmission_delay`;
const states = scenario?.states ?? [
  ["desk", "/teacher"],
  ["assignments", "/teacher/assignments"],
  [
    "assignment-selected",
    `/teacher/assignments?assignment=${assignment}&view=progress`,
  ],
  ["lessons", "/teacher/lessons"],
  ["materials", "/teacher/materials"],
  ["evidence-concern", `/teacher/evidence?${scope}`],
  [
    "evidence-original-answer",
    `/teacher/evidence?${scope}&session=${session}&attempt=${attempt}&evaluation=${evaluation}`,
  ],
  ["interventions", `/teacher/interventions?${scope}`],
  ["students", `/teacher/students?assignment=${assignment}`],
];
try {
  await page.goto(manifest.origin + "/login");
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL("**/teacher");
  await page.locator("h1").first().waitFor();
  loginAllowed = false;
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [name, pathname] of states) {
      const result = {
        name,
        path: pathname,
        viewport,
        status: "unrun",
        errors: [],
        failedRequests: [],
      };
      const onError = (e) => result.errors.push(e.message),
        onFailure = (r) =>
          result.failedRequests.push({
            url: r.url(),
            error: r.failure()?.errorText,
          });
      page.on("pageerror", onError);
      page.on("requestfailed", onFailure);
      try {
        const response = await page.goto(manifest.origin + pathname, {
          waitUntil: "domcontentloaded",
        });
        result.httpStatus = response?.status();
        await page.locator("h1").first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(350);
        result.finalUrl = page.url();
        if (
          !response?.ok() ||
          new URL(page.url()).pathname !==
            new URL(manifest.origin + pathname).pathname
        )
          throw new Error(
            `Unexpected response ${response?.status()} or navigation ${page.url()}`,
          );
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
          const geom = (e) => {
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
              display: s.display,
              columns: s.gridTemplateColumns,
              gap: s.gap,
              padding: s.padding,
              fontFamily: s.fontFamily,
              fontSize: s.fontSize,
              fontWeight: s.fontWeight,
              lineHeight: s.lineHeight,
              overflowX: s.overflowX,
              overflowY: s.overflowY,
            };
          };
          return {
            innerWidth,
            innerHeight,
            devicePixelRatio,
            visiblePaneTabs: [
              ...document.querySelectorAll("[role=tab],.aw-pane-switch button"),
            ]
              .filter(visible)
              .map((e) => ({
                text: e.textContent?.trim(),
                selected:
                  e.getAttribute("aria-selected") ??
                  e.getAttribute("aria-pressed"),
              })),
            paneControllers: [
              ...document.querySelectorAll(
                ".tw-panes,.aw-workspace,.ap-workbench",
              ),
            ].map((e) => ({
              class: e.className,
              active:
                e.getAttribute("data-active-pane") ??
                e.getAttribute("data-pane"),
              layout: e.getAttribute("data-layout"),
            })),
            documentWidth: document.documentElement.scrollWidth,
            fonts: [...document.fonts].map((f) => ({
              family: f.family,
              status: f.status,
            })),
            geometry: [
              ...document.querySelectorAll(
                "body,header,nav,main,aside,section,[class*=layout],[class*=workspace],[class*=columns],[class*=pane],[class*=rail],[class*=shell],[class*=frame],[class*=sidebar],[class*=context],[class*=heading]",
              ),
            ]
              .filter(visible)
              .map(geom),
            headings: [...document.querySelectorAll("h1,h2,h3")]
              .filter(visible)
              .map((e) => ({ text: e.innerText, ...geom(e) })),
            navigation: [...document.querySelectorAll("nav")]
              .filter(visible)
              .map((e) => ({
                label: e.getAttribute("aria-label"),
                text: e.innerText,
                ...geom(e),
              })),
            links: [...document.querySelectorAll("a")]
              .filter(visible)
              .map((e) => ({
                text: e.innerText,
                href: e.getAttribute("href"),
              })),
            active: {
              tag: document.activeElement?.tagName,
              text: document.activeElement?.textContent?.trim().slice(0, 140),
            },
          };
        });
        result.screenshot = `${name}-${viewport.width}x${viewport.height}.png`;
        await page.screenshot({ path: path.join(output, result.screenshot) });
        await writeFile(
          path.join(output, `${name}-${viewport.width}x${viewport.height}.txt`),
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
      page.off("pageerror", onError);
      page.off("requestfailed", onFailure);
      console.log(`${viewport.width} ${name}: ${result.status}`);
    }
  }
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await context.close();
  await browser.close();
}
console.log(
  JSON.stringify({
    captured: report.states.filter((s) => s.status === "captured").length,
    total: report.states.length,
    blocked: report.blockedRequests.length,
    output,
  }),
);
