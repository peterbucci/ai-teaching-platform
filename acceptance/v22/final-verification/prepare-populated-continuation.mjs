import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

// Offline files only. The explicit allowlist excludes API bodies and browser state.
const [rootArg, prototypeArg, outputArg] = process.argv.slice(2);
assert(
  rootArg && prototypeArg && outputArg,
  "Usage: node prepare-populated-continuation.mjs CAPTURE_PARENT PROTOTYPE_SCREENSHOTS FRESH_OUTPUT",
);
const root = path.resolve(rootArg);
const prototype = path.resolve(prototypeArg);
const output = path.resolve(outputArg);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const runs = [];
for (const number of ["03", "04", "05"]) {
  const folder = `final-authoring-${number}`;
  const bytes = await fs.readFile(path.join(root, folder, "report.json"));
  const report = JSON.parse(bytes);
  assert.equal(report.sourceSha, "462cfb1b31d9108cec70d18b6553bd45048d2eed");
  assert.equal(report.sourceTree, "03cca1fed3900a122e689c4a512afadd9052e5af");
  assert.equal(report.paid_calls, 0);
  runs.push({ folder, sha256: hash(bytes), report });
}
assert.equal(runs[1].report.resumed_from.sha256, runs[0].sha256);
assert.equal(runs[2].report.resumed_from.sha256, runs[1].sha256);
for (const field of [
  "run_id",
  "source_id",
  "source_version",
  "lesson_id",
  "published_version",
]) {
  for (const run of runs)
    assert.equal(run.report[field], runs[0].report[field]);
}
for (const field of [
  "assignment_id",
  "student_session_id",
  "presented_attempt_id",
])
  assert.equal(runs[1].report[field], runs[2].report[field]);
const sizes = [
  [1440, 1000],
  [1024, 768],
  [390, 844],
  [320, 844],
];
const captures = [];
const add = async (folder, name, width, height, reference = null) => {
  const bytes = await fs.readFile(path.join(root, folder, name));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const actualWidth = bytes.readUInt32BE(16),
    actualHeight = bytes.readUInt32BE(20);
  if (width) assert.equal(actualWidth, width);
  if (height) assert.equal(actualHeight, height);
  captures.push({
    source_folder: folder,
    name,
    width: actualWidth,
    height: actualHeight,
    sha256: hash(bytes),
    bytes,
    reference,
  });
};
for (const [width, height] of sizes) {
  for (const [stage, ref] of [
    ["07-resumed-published-v1", "lesson-published"],
    ["09-active-assignment", "assignment-section-a"],
    ["13-new-version-requires-review", "lesson-published"],
  ]) {
    await add(
      "final-authoring-04",
      `${stage}-${width}x${height}.png`,
      width,
      height,
      `${ref}-${width}x${height}.png`,
    );
  }
  await add("final-authoring-04", `11-reading-${width}.png`, width, height);
  await add(
    "final-authoring-05",
    `17-teacher-original-evidence-${width}x${height}.png`,
    width,
    height,
    `evidence-original-answer-${width}x${height}.png`,
  );
}
for (const stage of [
  "08-inactive-hidden-student",
  "10-student-assignment",
  "12-student-session",
  "14-session-preserved-after-v2",
  "15-help-clarified-not-graded",
])
  await add("final-authoring-04", `${stage}.png`);
await add(
  "final-authoring-05",
  "16-original-answer-saved-provider-disabled.png",
);
const references = [];
for (const name of [
  ...new Set(captures.map((x) => x.reference).filter(Boolean)),
]) {
  const bytes = await fs.readFile(path.join(prototype, name));
  references.push({
    name,
    sha256: hash(bytes),
    path: path
      .relative(output, path.join(prototype, name))
      .replaceAll("\\", "/"),
  });
}
await fs.mkdir(output);
for (const capture of captures)
  await fs.writeFile(path.join(output, capture.name), capture.bytes, {
    flag: "wx",
  });
const latest = runs[2].report;
const metadata = {
  category:
    "Offline visual review; three linked executions, not an uninterrupted or actual-model journey",
  source_sha: latest.sourceSha,
  source_tree: latest.sourceTree,
  identity: Object.fromEntries(
    [
      "run_id",
      "source_id",
      "source_version",
      "lesson_id",
      "published_version",
      "assignment_id",
      "class_id",
      "student_session_id",
      "presented_attempt_id",
      "student_id",
      "new_draft_version",
      "new_draft_revision",
    ].map((key) => [key, latest[key]]),
  ),
  content_ref: latest.content_ref,
  assignment_handoff: latest.assignment_handoff,
  executions: runs.map(({ folder, sha256, report }) => ({
    folder,
    report_sha256: sha256,
    harness_sha256: report.harness_sha256,
    started_at_utc: report.started_at_utc,
    checked_at_utc: report.checked_at_utc,
    status: report.status,
    full_journey: report.full_journey,
    failure_stage: report.failure_stage ?? null,
    error: report.error ?? null,
    checks: report.checks,
    viewports: report.viewports,
    paid_calls: report.paid_calls,
  })),
  visual_review_limit:
    "No runtime actions; current PNGs preserve original scroll/pending states. The teacher session screenshots do not show the assessed original answer text in the initial viewport. Student conversation stages are desktop-only; student reading and teacher stages have all four sizes.",
  captures: captures.map(({ bytes, ...record }) => ({
    ...record,
    byte_length: bytes.length,
  })),
  prototype_references: references,
};
await fs.writeFile(
  path.join(output, "visual-evidence.json"),
  JSON.stringify(metadata, null, 2) + "\n",
  { flag: "wx" },
);
const refs = Object.fromEntries(references.map((x) => [x.name, x.path]));
const rows = captures.map((item) =>
  Object.fromEntries(Object.entries(item).filter(([key]) => key !== "bytes")),
);
const gallery = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authoring continuation — actual captures</title><style>body{font:16px/1.5 system-ui;margin:20px;color:#18332c;background:#f4f7f5}select{max-width:100%;font:inherit;padding:8px}main{display:grid;grid-template-columns:1fr 1fr;gap:20px}article{min-width:0;background:white;padding:14px;border:1px solid #c8d8d1}img{max-width:100%;height:auto;border:1px solid #bacbc3}a{color:#075c47}h1{font-size:24px}h2{font-size:18px}@media(max-width:800px){main{grid-template-columns:1fr}}</style></head><body><h1>Same-record continuation: actual saved images</h1><p>Three executions retain their own results and hashes. Provider disabled; no accepted model evaluation. Teacher evidence at page top shows the help conversation; assessed answer is below this captured viewport.</p><p>Prototype is structural reference only where the task/route differs. Student screens have no corresponding captured Workbench teacher prototype; no reference image is invented. Some student conversation captures are desktop-only.</p><label>Capture <select id="capture">${captures.map((x, index) => `<option value="${index}">${x.source_folder} / ${x.name}</option>`).join("")}</select></label><main><article><h2>Actual prototype reference</h2><p id="reference-note"></p><a id="reference-link"><img id="reference" alt="Actual exported prototype structural reference"></a></article><article><h2 id="title"></h2><p>Original pixels and scroll position. Click for full-size image.</p><a id="image-link"><img id="image" alt="Actual same-record implementation capture"></a></article></main><p><a href="../POPULATED_CONTINUATION_VISUAL_REPORT.md">Findings and execution limits</a> · <a href="visual-evidence.json">Exact identities and screenshot hashes</a></p><script>const rows=${JSON.stringify(rows)},refs=${JSON.stringify(refs)};const select=document.querySelector('#capture');function render(){const item=rows[Number(select.value)],ref=document.querySelector('#reference');document.querySelector('#image').src=item.name;document.querySelector('#image-link').href=item.name;document.querySelector('#title').textContent=item.name;ref.hidden=!item.reference;document.querySelector('#reference-note').textContent=item.reference?'Different fictional density and, for assignment/session routes, a different task state. Compare structure with this limitation.':'No equivalent student prototype capture is available.';if(item.reference){ref.src=refs[item.reference];document.querySelector('#reference-link').href=refs[item.reference];}else{ref.removeAttribute('src');document.querySelector('#reference-link').removeAttribute('href');}}select.addEventListener('change',render);render();</script></body></html>`;
await fs.writeFile(path.join(output, "gallery.html"), gallery, { flag: "wx" });
console.log(
  JSON.stringify({
    captures: captures.length,
    png_bytes: captures.reduce((sum, x) => sum + x.bytes.length, 0),
    chain: runs.map((r) => ({
      folder: r.folder,
      sha256: r.sha256,
      status: r.report.status,
    })),
    output,
  }),
);
