/** Offline analysis of saved capture receipts and unchanged PNG files. No browser. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const readJson = (relative) =>
  JSON.parse(readFileSync(resolve(directory, relative), "utf8"));
const final = readJson("screenshots-default/report.json");
const prototype = readJson("../prototype-verification/screenshots/report.json");
const first = readJson(
  "../implementation-verification/screenshots-completed/report.json",
);
const main = readJson(
  "../implementation-verification/screenshots-main/report.json",
);
const guard = readJson("screenshots-default.guard.json");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const round = (number) => Math.round(number * 100) / 100;
const rect = (value) =>
  value
    ? Object.fromEntries(
        Object.entries(value)
          .filter(([key]) =>
            [
              "class",
              "text",
              "label",
              "x",
              "y",
              "width",
              "height",
              "columns",
              "fontSize",
              "fontFamily",
              "padding",
            ].includes(key),
          )
          .map(([key, value]) => [
            key,
            typeof value === "number" ? round(value) : value,
          ]),
      )
    : null;
assert.equal(final.sourceSha, "462cfb1b31d9108cec70d18b6553bd45048d2eed");
assert.equal(final.sourceTree, "03cca1fed3900a122e689c4a512afadd9052e5af");
assert.equal(guard.status, "passed");
assert.equal(final.states.length, 36);
const surfaces = new Set([
  "desk",
  "assignments",
  "assignment-selected",
  "lessons",
  "materials",
  "evidence-concern",
  "evidence-original-answer",
  "interventions",
  "students",
]);
const sizes = new Set(["1440x1000", "1024x768", "390x844", "320x844"]);
const unique = new Set();
const states = final.states.map((state) => {
  const size = `${state.viewport.width}x${state.viewport.height}`;
  assert.ok(surfaces.has(state.name) && sizes.has(size));
  assert.ok(!unique.has(`${state.name}:${size}`));
  unique.add(`${state.name}:${size}`);
  const png = readFileSync(
    join(directory, "screenshots-default", state.screenshot),
  );
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), state.viewport.width);
  assert.equal(png.readUInt32BE(20), state.viewport.height);
  return {
    name: state.name,
    viewport: state.viewport,
    path: state.path,
    status: state.status,
    httpStatus: state.httpStatus,
    screenshot: `screenshots-default/${state.screenshot}`,
    sha256: sha256(png),
    bytes: png.length,
    scriptErrors: state.errors,
    documentHorizontalOverflow:
      state.metrics.documentWidth > state.viewport.width,
    navigation: state.metrics.navigation.map((nav) => ({
      label: nav.label,
      text: nav.text,
      ...rect(nav),
    })),
    headings: state.metrics.headings.map(rect),
    visiblePaneTabs: state.metrics.visiblePaneTabs,
    paneControllers: state.metrics.paneControllers,
    fontsDeclaredByDocument: state.metrics.fonts,
  };
});
const evidence = (report, width) => {
  const state = report.states.find(
    (state) =>
      state.name === "evidence-original-answer" &&
      state.viewport.width === width,
  );
  return {
    selectedTitle: rect(
      state.metrics.headings.find((heading) =>
        /Student One|Maya Chen/.test(heading.text),
      ),
    ),
    originalResponseHeading: rect(
      state.metrics.headings.find(
        (heading) => heading.text === "Original response",
      ),
    ),
    approvedSourceHeading: rect(
      state.metrics.headings.find(
        (heading) => heading.text === "Approved source",
      ),
    ),
    workbench: rect(
      state.metrics.geometry.find(
        (item) => item.class === "wb-evidence-layout",
      ),
    ),
    prototypePanes: state.metrics.geometry
      .filter((item) => item.class.startsWith("pane "))
      .map(rect),
    header: rect(
      state.metrics.geometry.find(
        (item) => item.class === "tw-header" || item.class === "top",
      ),
    ),
    bottomNavigation: rect(
      state.metrics.geometry.find((item) => item.class === "tw-bottom-nav"),
    ),
    visiblePaneTabs: state.metrics.visiblePaneTabs ?? null,
  };
};
const failures = final.states.flatMap((state) => state.failedRequests);
const comparison = {
  category:
    "Offline measured comparison; visual adjudication is in FINAL_ACCEPTANCE_REPORT.md",
  sourceSha: final.sourceSha,
  sourceTree: final.sourceTree,
  browser: final.browser,
  capturedAt: { startedAt: final.startedAt, finishedAt: final.finishedAt },
  provenance: {
    prototypeArchiveSha256: prototype.archiveSha256,
    prototypeHtmlSha256: prototype.htmlSha256,
    mainSha: main.sourceSha,
    firstCombinedSha: first.sourceSha,
    captureUtilitySha256: final.runnerSha256,
    guardWrapperSha256: guard.wrapperSha256,
    reviewedSafetySha256: guard.safetySha256,
  },
  captureHealth: {
    expected: 36,
    captured: states.filter((state) => state.status === "captured").length,
    successfulPageResponses: states.filter((state) => state.httpStatus === 200)
      .length,
    pageScriptErrors: states.flatMap((state) => state.scriptErrors).length,
    documentHorizontalOverflows: states.filter(
      (state) => state.documentHorizontalOverflow,
    ).length,
    authorizedMutatingRequests: final.mutatingRequests,
    blockedMutations: final.blockedRequests.length,
    abortedPrefetchRequests: failures.filter(
      (request) =>
        request.error === "net::ERR_ABORTED" &&
        new URL(request.url).searchParams.has("_rsc"),
    ).length,
    otherFailedRequests: failures.filter(
      (request) =>
        request.error !== "net::ERR_ABORTED" ||
        !new URL(request.url).searchParams.has("_rsc"),
    ),
    pngDimensionsMatchAllRequestedViewports: true,
    totalScreenshotBytes: states.reduce((sum, state) => sum + state.bytes, 0),
  },
  evidenceGeometry: [1440, 1024, 390, 320].map((width) => ({
    width,
    prototype: evidence(prototype, width),
    firstCombined: evidence(first, width),
    final: evidence(final, width),
  })),
  states,
  limitations: [
    "Different prototype fixture counts, identities and content distribution; no pixel-difference pass claimed.",
    "The final selected assignment captures use explicit progress, while the earlier snapshots default to review.",
    "No interactions, keyboard focus restoration, native 200% zoom or screen reader were tested by this screenshot pass.",
    "No provider/model call or populated authoring/intervention acceptance is established.",
    "A capture-health pass is not a visual acceptance pass.",
  ],
};
writeFileSync(
  join(directory, "visual-comparison.json"),
  `${JSON.stringify(comparison, null, 2)}\n`,
);
console.log(JSON.stringify(comparison.captureHealth, null, 2));
