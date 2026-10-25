/** Replay S2/S3 assertions on the combined, isolated application.
 * Adaptations are limited to runtime bindings, import resolution, evidence paths,
 * and the new R03 fixture identity. Original source/assertions remain untouched;
 * one additional settled-alert wait makes the unavailable-state image meaningful.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const output = "acceptance/student-integration/history-review";
const setup = ".setup/student-integration/history-review";
const mode = process.argv[2];
const modes = new Set([
  "backend",
  "setup",
  "setup-exact",
  "recorded",
  "fallback",
  "s2-visual",
  "r03",
  "s3-workflow",
  "s3-visual",
]);
assert.ok(modes.has(mode), "Select a known combined verification mode");
assert.equal(process.env.PGHOST, "127.0.0.1");
assert.equal(process.env.PGPORT, "5931");
assert.equal(process.env.PGDATABASE, "student_notebook_final_01a17503");
assert.ok(
  ["http://127.0.0.1:3431", "http://127.0.0.1:3432"].includes(
    process.env.AUTH_URL,
  ),
);
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
assert.equal(process.env.DATABASE_URL, undefined);
fs.mkdirSync(path.join(setup, "s2"), { recursive: true });
fs.mkdirSync(path.join(output, "adaptations"), { recursive: true });
process.env.NOTEBOOK_CHECK_SYNTHETIC = "1";
process.env.NOTEBOOK_CHECK_STATE = path.resolve(setup, "s2/backend-state.json");
process.env.N7_R03_RUNTIME = "production";
process.env.S2_PROTOTYPE_DIR ||=
  "C:/Users/sb128/.codex/worktrees/student-notebook-integration/LearningPlatform/.setup/prototype";
process.env.S3_PROTOTYPE_DIR ||= process.env.S2_PROTOTYPE_DIR;
process.env.S2_PROTOTYPE_ARCHIVE ||=
  "C:/Users/sb128/Downloads/Student-Notebook-Final-Prototype-fa69c2d0.zip";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const receipt = {
  mode,
  assertionsChanged: false,
  additionalReadinessChecks: [],
  adaptations: [],
  files: [],
};
const r03State = path.join(setup, "r03-report-path.json");

function adapt(relative, label, extra = []) {
  const originalPath = path.resolve(relative);
  const original = fs.readFileSync(originalPath, "utf8");
  let source = original;
  const replacements = [
    ["reader_visibility_n7_01a1742c", process.env.PGDATABASE],
    ["lp_s3_review_01a1749b", process.env.PGDATABASE],
    ["notebook_s2", process.env.PGDATABASE],
    ['"5907"', JSON.stringify(process.env.PGPORT)],
    ['"5912"', JSON.stringify(process.env.PGPORT)],
    ["http://127.0.0.1:3407", process.env.AUTH_URL],
    ["http://127.0.0.1:3413", process.env.AUTH_URL],
    [".setup/s2", setup + "/s2"],
    [".setup/workflow-fixtures.json", setup + "/workflow-fixtures.json"],
    [".setup/s3-fixture-kit.mjs", setup + "/s3-fixture-kit.mjs"],
    [".setup/selected.json", setup + "/selected.json"],
    ['path.resolve(".setup",', "path.resolve(" + JSON.stringify(setup) + ","],
    ["acceptance/notebook-s2/evidence", output + "/s2"],
    [
      '"app/study/notebook/reviews/verification/s3"',
      JSON.stringify(output + "/s3"),
    ],
    [
      '"app/study/notebook/reviews/verification/s3/"',
      JSON.stringify(output + "/s3/"),
    ],
    ["acceptance/notebook/evidence", output + "/r03"],
    ...extra,
  ];
  for (const [from, to] of replacements) {
    if (!source.includes(from)) continue;
    const count = source.split(from).length - 1;
    source = source.replaceAll(from, to);
    receipt.adaptations.push({ file: relative, from, to, count });
  }
  source = source.replace(/from "(\.[^"]+)"/g, (_match, specifier) => {
    const target =
      relative.endsWith("/workflow.mjs") && specifier === "./replay-r03.mjs"
        ? path.resolve(setup, "s3-helper.mjs")
        : path.resolve(path.dirname(originalPath), specifier);
    return `from ${JSON.stringify(pathToFileURL(target).href)}`;
  });
  source = source.replaceAll(
    "import.meta.url",
    JSON.stringify(pathToFileURL(originalPath).href),
  );
  const destination = path.resolve(setup, label + ".mjs");
  fs.writeFileSync(destination, source);
  receipt.files.push({
    original: relative,
    originalSha256: hash(original),
    adapted: path.relative(root, destination),
    adaptedSha256: hash(source),
  });
  return destination;
}

let target;
if (mode === "backend")
  target = path.resolve("scripts/check-student-notebook.ts");
else if (["setup", "setup-exact", "recorded", "fallback"].includes(mode)) {
  target = adapt("acceptance/notebook-s2/verify.mjs", "s2-verify");
  process.argv[2] = mode;
} else if (mode === "s2-visual") {
  target = adapt("acceptance/notebook-s2/visual.mjs", "s2-visual");
} else if (mode === "r03") {
  process.env.N7_R03_RUN = `r03-combined-${Date.now()}`;
  const extra = [];
  if (fs.existsSync(r03State)) {
    const previous = JSON.parse(fs.readFileSync(r03State, "utf8"));
    const previousReport = JSON.parse(fs.readFileSync(previous.report, "utf8"));
    assert.equal(previousReport.result, "PASS");
    receipt.fixtureReuse = {
      report: previous.report,
      identities: previousReport.identities,
      method:
        "Copy authored synthetic draft, then actual teacher approval and delivery; no new generation",
    };
    const helper = pathToFileURL(
      path.resolve(output, "clone-review-fixture.mjs"),
    ).href;
    extra.push([
      "fixture = await makeFixture(studentActor.access, teacherActor.access);",
      `fixture = await (await import(${JSON.stringify(helper)})).cloneReviewFixture(teacherActor.access, ${JSON.stringify(previousReport.identities)});`,
    ]);
    extra.push([
      "New uploaded synthetic water-state lesson with digit-leading UUID concepts",
      "Reused approved synthetic water-state lesson with UUID concepts; copied authored draft receives fresh actual approval/delivery without generation",
    ]);
  }
  target = adapt("acceptance/notebook/r03-fresh-check.mjs", "r03", extra);
} else if (mode === "s3-workflow") {
  const r03 = JSON.parse(fs.readFileSync(r03State, "utf8"));
  const report = JSON.parse(fs.readFileSync(r03.report, "utf8"));
  assert.equal(report.result, "PASS");
  fs.writeFileSync(
    path.join(setup, "workflow-fixtures.json"),
    JSON.stringify({ source: report.identities }, null, 2),
  );
  adapt(
    "app/study/notebook/reviews/verification/s3/replay-r03.mjs",
    "s3-helper",
  );
  receipt.additionalReadinessChecks.push(
    "Before unavailable capture, wait for the actual idle fresh-check controller, exact saved-response error and refresh button, then scroll the error into view and wait two paint frames. Original alert/zero-composer assertions remain.",
  );
  target = adapt(
    "app/study/notebook/reviews/verification/s3/workflow.mjs",
    "s3-workflow",
    [
      [
        'await capture(page, "unavailable-saved-status");',
        `await page.locator('.lp-followup-response[aria-busy="false"]').waitFor();
  const settledUnavailableAlert = page.locator('.lp-followup-response [role="alert"]').filter({ hasText: "We couldn’t load your saved response. Try refreshing its status." });
  await settledUnavailableAlert.waitFor();
  await page.getByRole("button", { name: "Refresh saved status", exact: true }).waitFor();
  await settledUnavailableAlert.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator("#intervention-response").count(), 0);
  await capture(page, "unavailable-saved-status");`,
      ],
    ],
  );
} else {
  const r03 = JSON.parse(fs.readFileSync(r03State, "utf8"));
  target = adapt(
    "app/study/notebook/reviews/verification/s3/visual.mjs",
    "s3-visual",
    [
      [
        'const env = JSON.parse(fs.readFileSync(".setup/env.json", "utf8"));',
        "const env = { ...process.env };",
      ],
      [
        output + "/r03/r03-fresh-check-1792955650134/r03-fresh-check.json",
        r03.report.replaceAll("\\", "/"),
      ],
    ],
  );
  process.argv[2] = `visual-${Date.now()}`;
}
fs.writeFileSync(
  path.join(output, "adaptations", `${mode}-${Date.now()}.json`),
  JSON.stringify(receipt, null, 2),
);
await import(pathToFileURL(target).href);
if (mode === "r03" && !process.exitCode) {
  const report = path.join(
    output,
    "r03",
    process.env.N7_R03_RUN,
    "r03-fresh-check.json",
  );
  fs.writeFileSync(r03State, JSON.stringify({ report }, null, 2));
}
