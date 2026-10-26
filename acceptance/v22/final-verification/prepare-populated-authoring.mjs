import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

// Offline packaging only: no browser, network, process, database or runtime calls.
const [sourceArg, prototypeArg, outputArg] = process.argv.slice(2);
assert(
  sourceArg && prototypeArg && outputArg,
  "Usage: node prepare-populated-authoring.mjs SOURCE_CAPTURE_DIR PROTOTYPE_SCREENSHOTS_DIR FRESH_OUTPUT_DIR",
);
const source = path.resolve(sourceArg);
const prototype = path.resolve(prototypeArg);
const output = path.resolve(outputArg);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const raw = await fs.readFile(path.join(source, "report.json"));
const report = JSON.parse(raw);
const sha = "462cfb1b31d9108cec70d18b6553bd45048d2eed";
const tree = "03cca1fed3900a122e689c4a512afadd9052e5af";
assert.equal(report.sourceSha, sha);
assert.equal(report.sourceTree, tree);
assert.equal(report.paid_calls, 0);
assert.equal(report.source_version, 1);
assert.equal(report.published_version, "1");
const stages = [
  "01-extraction-review",
  "02-source-saved",
  "03-objectives-approved",
  "04-student-preview",
  "05-bank-approved",
  "06-lesson-approved",
  "07-published-v1",
];
const sizes = [
  [1440, 1000],
  [1024, 768],
  [390, 844],
  [320, 844],
];
const files = [];
const checkPng = (bytes, width, height) => {
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16), width);
  assert.equal(bytes.readUInt32BE(20), height);
};
for (const stage of stages) {
  for (const [width, height] of sizes) {
    const name = `${stage}-${width}x${height}.png`;
    const bytes = await fs.readFile(path.join(source, name));
    checkPng(bytes, width, height);
    files.push({ name, width, height, bytes, sha256: sha256(bytes) });
  }
}
const references = [];
for (const [width, height] of sizes) {
  const name = `lesson-published-${width}x${height}.png`;
  const bytes = await fs.readFile(path.join(prototype, name));
  checkPng(bytes, width, height);
  references.push({
    name,
    width,
    height,
    sha256: sha256(bytes),
    path: path
      .relative(output, path.join(prototype, name))
      .replaceAll("\\", "/"),
  });
}
// mkdir without recursive prevents overwriting an existing publication package.
await fs.mkdir(output);
for (const file of files)
  await fs.writeFile(path.join(output, file.name), file.bytes, { flag: "wx" });
const evidence = {
  category:
    "Offline review of actual authoring screenshots; not a full-journey result",
  source_capture_folder: path.basename(source),
  source_report_sha256: sha256(raw),
  source_sha: sha,
  source_tree: tree,
  started_at_utc: report.started_at_utc,
  checked_at_utc: report.checked_at_utc,
  original_run_status: report.status,
  original_full_journey: report.full_journey,
  original_failure_stage: report.failure_stage,
  original_error: report.error,
  configuration: report.configuration,
  paid_calls: report.paid_calls,
  fixture_scope: report.fixture_scope,
  source_id: report.source_id,
  source_version: report.source_version,
  lesson_id: report.lesson_id,
  prepared_revision: report.prepared_revision,
  published_version: report.published_version,
  capture_harness_sha256: report.harness_sha256,
  reported_checks: report.checks,
  reported_viewports: report.viewports,
  screenshot_geometry_limit:
    "Capture reported viewport/overflow only. Implementation pane coordinates in the visual report are approximate pixel observations, not DOM measurements. Captures preserve their original scroll positions.",
  files: files.map(({ bytes, ...metadata }) => ({
    ...metadata,
    byte_length: bytes.length,
  })),
  prototype_published_references: references,
  unrun_by_this_offline_review: [
    "browser interaction",
    "focus restoration",
    "keyboard journey",
    "actual 200% browser zoom",
    "screen reader",
    "provider calls",
    "assignment activation",
    "student tutoring",
    "intervention delivery and linked follow-up",
  ],
};
await fs.writeFile(
  path.join(output, "visual-evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  { flag: "wx" },
);
const options = stages
  .map(
    (stage) =>
      `<option value="${stage}"${stage === "07-published-v1" ? " selected" : ""}>${stage}</option>`,
  )
  .join("");
const sizeOptions = sizes
  .map(([w, h]) => `<option value="${w}x${h}">${w} × ${h}</option>`)
  .join("");
const gallery = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Populated authoring — actual capture comparison</title>
<style>body{margin:0;padding:20px;font:16px/1.5 system-ui;color:#18332c;background:#f4f7f5}h1{font-size:24px}label{display:inline-block;margin:0 20px 16px 0}select{font:inherit;padding:8px}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}article{min-width:0;background:white;padding:14px;border:1px solid #c8d8d1}img{display:block;max-width:100%;height:auto;border:1px solid #bacbc3}h2{font-size:18px}small{display:block}a{color:#075c47}@media(max-width:800px){main{grid-template-columns:1fr}}</style></head>
<body><h1>Populated authoring: actual screenshots</h1><p>Exact implementation <code>${sha}</code>. The run captured publication, then stopped at assignment preparation. This gallery is not a full-journey pass. Original screenshot pixels and scroll positions are preserved.</p>
<p>The prototype has five objectives, fifteen questions, thirteen passages and four assigned classes; implementation has one objective, four questions and one passage. For stages before publication, the published prototype is a structural reference only, not an equivalent stage.</p>
<label>Implementation stage <select id="stage">${options}</select></label><label>Viewport <select id="size">${sizeOptions}</select></label>
<main><article><h2>Actual Workbench v2.2 prototype — published lesson</h2><small>Structural reference; richer fictional data, lesson v3 / reading v1.</small><a id="prototype-link"><img id="prototype" alt="Actual exported prototype published lesson"></a></article><article><h2 id="implementation-title"></h2><small>Actual manually authored fixture, lesson v1 / source v1. Click for original pixels.</small><a id="implementation-link"><img id="implementation" alt="Actual implementation authoring stage"></a></article></main>
<p><a href="../POPULATED_AUTHORING_VISUAL_REPORT.md">Visual findings and limitations</a> · <a href="visual-evidence.json">Dimensions, hashes and capture provenance</a></p>
<script>const refs=${JSON.stringify(Object.fromEntries(references.map((r) => [`${r.width}x${r.height}`, r.path])))};const stage=document.querySelector('#stage'),size=document.querySelector('#size');function render(){const current=stage.value+'-'+size.value+'.png';document.querySelector('#prototype').src=refs[size.value];document.querySelector('#prototype-link').href=refs[size.value];document.querySelector('#implementation').src=current;document.querySelector('#implementation-link').href=current;document.querySelector('#implementation-title').textContent='Actual implementation — '+stage.value;}stage.addEventListener('change',render);size.addEventListener('change',render);render();</script></body></html>`;
await fs.writeFile(path.join(output, "gallery.html"), gallery, { flag: "wx" });
console.log(
  JSON.stringify({
    source_sha: sha,
    captures: files.length,
    png_bytes: files.reduce((sum, file) => sum + file.bytes.length, 0),
    output,
    source_report_sha256: sha256(raw),
  }),
);
