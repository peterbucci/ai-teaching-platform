import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const [s2Path, s3Path, workflowPath] = process.argv.slice(2);
assert.ok(
  s2Path && s3Path && workflowPath,
  "Supply exact successful S2 visual, S3 visual and S3 workflow directories",
);
const root = path.resolve("acceptance/student-integration/history-review");
const s2 = JSON.parse(
  fs.readFileSync(path.join(s2Path, "visual-results.json"), "utf8"),
);
const s3 = JSON.parse(
  fs.readFileSync(path.join(s3Path, "visual.json"), "utf8"),
);
const workflow = JSON.parse(
  fs.readFileSync(path.join(workflowPath, "workflow.json"), "utf8"),
);
assert.ok(!s2.failure && !workflow.failure && s2.nativeZoomVerified);
assert.equal(s2.buildId, s3.buildId);
assert.equal(s2.buildId, workflow.buildId);
const esc = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const imagePath = (folder, file) => {
  const absolute = path.resolve(folder, file);
  assert.ok(absolute.startsWith(root + path.sep));
  assert.ok(fs.existsSync(absolute));
  return path.relative(root, absolute).replaceAll("\\", "/");
};
const pairs = s2.pairs.map((pair) => ({
  title: `Saved Notebook: ${pair.surface} · ${pair.size}${pair.surface === "session" ? " · nearest reference only" : ""}`,
  comparison:
    pair.surface === "session"
      ? "nearest-reference-not-equivalent"
      : "equivalent-purpose-state",
  prototype: imagePath(s2Path, pair.prototype),
  application: imagePath(s2Path, pair.application),
  note:
    pair.surface === "session"
      ? "NOT AN EQUIVALENT-STATE PARITY PAIR. The approved prototype has no separate session-index counterpart. This application session overview is shown beside the nearest global Notebook reference for context only; it is excluded from equivalent-state counts."
      : "Real saved evidence. The global index is session-based; individual saved questions omit an active composer and facing reader. No missing historical content is synthesized.",
}));
for (const width of [1440, 1024, 390, 320]) {
  for (const [title, app, prototype] of [
    ["My Learning with assigned reviews", "home", "prototype-home"],
    ["Teacher review with accepted fresh check", "review", "prototype-review"],
    [
      "Unavailable review",
      "review-unavailable",
      "prototype-review-unavailable",
    ],
  ])
    pairs.push({
      title: `${title} · ${width}px`,
      prototype: imagePath(s3Path, `${prototype}-${width}.png`),
      application: imagePath(s3Path, `${app}-${width}.png`),
      note: "Actual fictional lesson, review and accepted evidence; original controller-owned practice/source order is retained. Content and title differences are not filled with prototype data.",
    });
  for (const [title, app, prototype] of [
    ["Review before starting", "unanswered", "prototype-review-open"],
    ["Fresh-check draft", "draft", "prototype-review-check"],
    ["Evaluation pending", "pending", "prototype-review-pending"],
  ])
    pairs.push({
      title: `${title} · ${width}px`,
      prototype: imagePath(s3Path, `${prototype}-${width}.png`),
      application: imagePath(workflowPath, `${app}-${width}.png`),
      note: "State pairing is functional, with differing authored content. Pending is explicitly unresolved; no success or incorrect judgment is inferred.",
    });
}
for (const factor of [100, 200])
  pairs.push({
    title: `Teacher review · native ${factor}% zoom`,
    prototype: imagePath(s3Path, `prototype-native-${factor}.png`),
    application: imagePath(s3Path, `review-native-${factor}.png`),
    note: "Native Edge browser zoom in isolated profiles; CSS zoom and visualViewport scale remain 1. The 200% measurement doubles DPR and halves CSS viewport width.",
  });
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Combined Notebook history and reviews</title><style>body{font:16px/1.55 system-ui;background:#f5f8f7;color:#173e3b;margin:2rem;max-width:1700px}h1,h2{line-height:1.2}section{border-top:1px solid #adc2bd;padding-top:1.2rem;margin-top:3rem}.pair{display:grid;grid-template-columns:1fr 1fr;gap:1.4rem}figure{margin:0}figcaption{font-weight:700;padding:.5rem 0}img{max-width:100%;border:1px solid #d3dfdb}nav{columns:2}a{color:#155b51}p{max-width:100ch}@media(max-width:800px){.pair{display:block}nav{columns:1}}</style><h1>Combined Student Notebook: saved history and teacher reviews</h1><p>Application ${esc(s2.source)} · production build ${esc(s2.buildId)}. Approved prototype SHA-256: ${esc(s2.designSha256)}. Fictional authenticated records, disabled providers and zero paid calls.</p><p>This gallery supports human visual review. Passing geometry and functional assertions do not establish complete prototype parity. Recorded history remains disabled by default. Captures are original browser screenshots without pixel alteration.</p><nav>${pairs.map((pair, index) => `<div><a href="#pair-${index}">${esc(pair.title)}</a></div>`).join("")}</nav>${pairs.map((pair, index) => `<section id="pair-${index}"><h2>${esc(pair.title)}</h2><p>${esc(pair.note)}</p><div class="pair"><figure><figcaption>Approved prototype</figcaption><img loading="lazy" alt="Approved prototype: ${esc(pair.title)}" src="${esc(pair.prototype)}"></figure><figure><figcaption>Authenticated combined application</figcaption><img loading="lazy" alt="Combined application: ${esc(pair.title)}" src="${esc(pair.application)}"></figure></div></section>`).join("")}</html>`;
fs.writeFileSync(path.join(root, "COMPARISON.html"), html);
fs.writeFileSync(
  path.join(root, "gallery.json"),
  JSON.stringify(
    {
      source: s2.source,
      buildId: s2.buildId,
      s2Path,
      s3Path,
      workflowPath,
      pairs,
    },
    null,
    2,
  ),
);
console.log(`Created ${pairs.length} original prototype/application pairs`);
