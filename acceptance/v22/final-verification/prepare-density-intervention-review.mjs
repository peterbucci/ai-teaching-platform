// Offline only: derives review data and galleries from preserved actual captures.
// Does not launch a browser, query a database, or modify raw evidence.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const root = path.resolve(process.argv[2] ?? "");
assert(process.argv[2], "Pass the local acceptance artifact root");
const destination = path.join(root, "final-verification");
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const hash = (rel) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, rel)))
    .digest("hex");
const write = (name, value) =>
  fs.writeFileSync(
    path.join(destination, name),
    `${JSON.stringify(value, null, 2)}\n`,
  );
const proto = read("prototype-verification/screenshots/report.json");
const density = read("final-verification/published-density-01/report.json");
const intervention = read("final-intervention-inspect-01/report.json");
const pin = "462cfb1b31d9108cec70d18b6553bd45048d2eed";
const tree = "03cca1fed3900a122e689c4a512afadd9052e5af";
for (const report of [density, intervention]) {
  assert.equal(report.status, "passed");
  assert.equal(report.source_sha, pin);
  assert.equal(report.source_tree, tree);
}
assert.equal(density.states.length, 24);
assert.equal(intervention.screenshots.length, 16);
const sizes = ["1440x1000", "1024x768", "390x844", "320x844"];
const phases = ["prepare", "approve", "publish", "assignment"].map((phase) => {
  const rel = `final-density-${phase}-01/fixture.json`;
  const receipt = read(rel);
  assert.equal(receipt.status, "completed");
  assert.equal(
    receipt.existing_evidence_before,
    receipt.existing_evidence_after,
  );
  assert.equal(receipt.other_content_before, receipt.other_content_after);
  assert.deepEqual(receipt.counts, {
    concepts: 5,
    questions: 19,
    passages: 13,
  });
  assert.equal(receipt.checks.activated, false);
  return {
    phase,
    path: `../evidence/final-browser/${rel}`,
    sha256: hash(rel),
    checks: receipt.checks,
    started_at: receipt.started_at,
    finished_at: receipt.finished_at,
    original_evidence_unchanged: true,
    other_content_unchanged: true,
  };
});
const pickPrototype = (name) =>
  proto.states
    .filter((s) => s.name === name)
    .map((s) => ({
      viewport: s.viewport,
      screenshot: `../prototype-verification/screenshots/${s.screenshot}`,
      metrics: s.metrics,
    }));
const evidenceFile = (rel) => ({
  path: rel,
  sha256: hash(rel),
  bytes: fs.statSync(path.join(root, rel)).size,
});
write("published-density-review.json", {
  status: "all-captures-inspected-visual-acceptance-incomplete",
  source_sha: pin,
  source_tree: tree,
  raw_capture: evidenceFile(
    "final-verification/published-density-01/report.json",
  ),
  prototype_archive_sha256: proto.archiveSha256,
  prototype_html_sha256: proto.htmlSha256,
  phases,
  fixture_limits: [
    "19 required question snapshots vs prototype15; no validator bypass",
    "four inactive empty classes vs three active populated and one inactive",
    "v1 vs prototypev3",
    "service-fixture approvals, not authoring-bank/browser teacher review",
  ],
  prototype: pickPrototype("lesson-published"),
  implementation: density.states.map((s) => ({
    state: s.state,
    viewport: s.viewport,
    screenshot: s.screenshot,
    sha256: hash(`final-verification/published-density-01/${s.screenshot}`),
    counts: s.counts,
    metrics: s.metrics,
  })),
  findings: [
    "V06 P2 #118/#120 inset frame and extra local navigation",
    "V08 P2 #118 assignment context below disclosures/new-version form",
    "V07 P2 #118 source typography mismatch; actual fallback face unidentified",
  ],
  actual_model: "unrun",
  screen_reader: "unrun",
  paid_calls: 0,
});
write("intervention-visual-review.json", {
  status: "all16-final-images-inspected-visual-acceptance-not-passed",
  source_sha: pin,
  source_tree: tree,
  raw_inspection: evidenceFile("final-intervention-inspect-01/report.json"),
  prototype_archive_sha256: proto.archiveSha256,
  prototype_html_sha256: proto.htmlSha256,
  state_limit:
    "Prototype approved-undelivered; final implementation delivered with accepted synthetic evaluation. Historical approved-private image is desktop-only. No student-side prototype screenshot exists in this bundle.",
  prototype: pickPrototype("intervention-approved"),
  implementation: intervention.screenshots.map((s) => ({
    ...s,
    sha256: hash(`final-intervention-inspect-01/${s.file}`),
  })),
  screenshot_estimates_not_dom: [
    { width: 1440, card_y: 600, card_widths: [546, 820], card_x: [28, 592] },
    { width: 1024, card_y: 600, card_widths: [380, 570], card_x: [28, 426] },
    { width: 390, tabs_y: 534, activity_card_y: 596 },
    { width: 320, tabs_y: 615, activity_card_y: 677 },
  ],
  findings: [
    "V09 P1 #116 integration/#120 pane contract; long preamble, missing Steps pane/tab",
    "V10 P2 inherited R2 raw concept UUID; coordinate #116, not introduced by #113",
  ],
  actual_model: "unrun",
  screen_reader: "unrun",
  paid_calls: 0,
});

const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const figure = (src, label) =>
  `<figure><figcaption>${escape(label)}</figcaption><a href="${escape(src)}"><img loading="lazy" src="${escape(src)}" alt="${escape(label)}"></a></figure>`;
const page = (title, lead, body) =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:1800px;margin:auto;padding:24px;color:#152d29;background:#f8faf9}h1{font-size:28px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}figure{margin:0;background:white;border:1px solid #b6c9c2;padding:10px}figcaption{font-weight:600;margin-bottom:10px}img{display:block;width:100%;height:auto}section{margin:32px 0}a{color:#086d58}.note{border-left:4px solid #ac7626;padding:10px 16px;background:#fff8e9}@media(max-width:760px){.pair{grid-template-columns:1fr}}</style><h1>${escape(title)}</h1><p class="note">${escape(lead)}</p>${body}</html>`;
let body =
  '<p><a href="PUBLISHED_DENSITY_VISUAL_REPORT.md">Visual report and limits</a></p>';
for (const size of sizes) {
  const protoImage = `../prototype-verification/screenshots/lesson-published-${size}.png`;
  body += `<section><h2>Published top — ${size}</h2><div class="pair">${figure(protoImage, "Prototype: 5 concepts / 15 questions / 13 passages; v3; 3 active + 1 inactive class")}${figure(`published-density-01/published-top-${size}.png`, "Implementation: 5 / 19 / 13; v1; 4 inactive empty classes, initial pane position")}</div></section>`;
  body += `<section><h2>Assignment context — ${size}</h2><div class="pair">${figure(protoImage, "Prototype: assignments precede creation form")}${figure(`published-density-01/published-assignment-context-${size}.png`, "Implementation: editor deliberately scrolled to the four verified assignment rows")}</div></section>`;
  body += `<section><h2>Inactive review — ${size}</h2><div class="pair">${figure(`../prototype-verification/screenshots/assignment-inactive-section-c-${size}.png`, "Prototype: inactive Section C with 12 students")}${figure(`published-density-01/inactive-assignment-review-${size}.png`, "Implementation: inactive Section A density fixture, zero enrollments")}</div></section>`;
  body += `<section><h2>Additional actual implementation panes — ${size}</h2><p>These compare responsive behavior; no additional matching prototype pane state was captured for this run.</p><div class="pair">${["published-outline", "published-question-list", "published-reading"].map((state) => figure(`published-density-01/${state}-${size}.png`, `${state}; actual ${size}`)).join("")}</div></section>`;
}
fs.writeFileSync(
  path.join(destination, "published-density-gallery.html"),
  page(
    "Published lesson density: actual reference and implementation",
    "Capture checks passed; visual acceptance remains incomplete. Preserve all19 required snapshots. Version, activation, enrollment and question counts differ. No model or paid calls.",
    body,
  ),
);
body =
  '<p><a href="INTERVENTION_VISUAL_REPORT.md">Visual report and precise state limits</a></p>';
for (const size of sizes) {
  body += `<section><h2>Teacher frame — ${size}</h2><div class="pair">${figure(`../prototype-verification/screenshots/intervention-approved-${size}.png`, "Prototype: approved-undelivered queuing review; 5 answers / 2 recipients; Steps selected on phone")}${figure(`../evidence/final-browser/final-intervention-inspect-01/08-teacher-followup-page-geometry-${size}.png`, "Implementation: delivered evaporation review; 1 original answer / 1 recipient; Activity selected on phone")}</div></section>`;
  body += `<section><h2>Exact original and linked follow-up — ${size}</h2><p>Both frames deliberately scroll to the exact saved text. They are not initial-page geometry comparisons. Evaluations are explicit synthetic fixtures.</p><div class="pair">${figure(`../evidence/final-browser/final-intervention-inspect-01/09-teacher-original-response-${size}.png`, "Teacher original evidence; exact whitespace/text preserved")}${figure(`../evidence/final-browser/final-intervention-inspect-01/10-teacher-linked-followup-response-${size}.png`, "Teacher linked fresh check; assisted result, not independent mastery")}</div></section>`;
  body += `<section><h2>Student review and saved result — ${size}</h2><p>No matching student-side prototype screenshot exists in this bundle. These actual implementation stages verify responsive reading only.</p><div class="pair">${figure(`../evidence/final-browser/final-intervention-submit-01/04-student-review-${size}.png`, "Actual student delivered review before follow-up")}${figure(`../evidence/final-browser/final-intervention-inspect-01/07-student-accepted-fixture-${size}.png`, "Actual saved response after labeled synthetic evaluation; deliberately scrolled")}</div></section>`;
}
body += `<section><h2>Historical separate approval and delivery — desktop only</h2><p>These actual earlier frames are scrolled to the decision area. Phone approved-private states were not captured or recreated.</p><div class="pair">${figure("../evidence/final-browser/final-intervention-submit-01/02-approved-still-private-1440x1000.png", "Approved revision2, still private; delivery is a separate decision")}${figure("../evidence/final-browser/final-intervention-submit-01/03-delivered-1440x1000.png", "Actual delivery recorded after separate teacher action")}</div></section>`;
fs.writeFileSync(
  path.join(destination, "intervention-gallery.html"),
  page(
    "Intervention: actual reference, delivered review and linked evidence",
    "Prototype is approved-undelivered; final implementation is delivered with accepted synthetic follow-up. Structural comparison is valid; exact content/state parity is not claimed. V09/V10 remain open.",
    body,
  ),
);
console.log(
  JSON.stringify({
    status: "prepared-offline",
    density_images: 24,
    final_intervention_images: 16,
    raw_reports_modified: false,
  }),
);
