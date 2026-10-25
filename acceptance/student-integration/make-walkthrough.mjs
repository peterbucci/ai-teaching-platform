/** Package existing, unedited captures into a source-bound reviewer walkthrough. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("acceptance/student-integration");
const matrix = JSON.parse(
  fs.readFileSync(path.join(root, "SOURCE_MATRIX.json"), "utf8"),
);
const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
function finalReport(folder) {
  const reports = fs
    .readdirSync(path.join(root, folder))
    .filter((name) => name.startsWith("visual-"))
    .map((name) => path.join(root, folder, name, "visual-results.json"))
    .filter((file) => fs.existsSync(file))
    .map((file) => ({ file, data: JSON.parse(fs.readFileSync(file, "utf8")) }))
    .filter(
      ({ data }) =>
        data.source === matrix.application &&
        data.buildId === matrix.productionBuild,
    )
    .sort((a, b) => b.file.localeCompare(a.file));
  assert.ok(reports.length, `Final source capture required for ${folder}`);
  return reports[0];
}
const active = finalReport("active"),
  routes = finalReport("routes");
const history = JSON.parse(
  fs.readFileSync(path.join(root, "history-review/gallery.json"), "utf8"),
);
assert.equal(history.source, matrix.application);
assert.equal(history.buildId, matrix.productionBuild);
const groups = [
  {
    title: "Enter and read",
    description:
      "My Learning, assignment overview and standalone reading. Actual assigned source, reading controls and responsive navigation.",
    file: routes.file,
    pairs: routes.data.pairs,
  },
  {
    title: "Study and ask for help",
    description:
      "One active question/composer, chronological help and facing reading. Additional session metadata and passage-title cards are real application differences; unavailable timestamps are not invented.",
    file: active.file,
    pairs: active.data.pairs,
  },
  {
    title: "Revisit work and complete a review",
    description:
      "Exact originals, recorded results, teacher-review draft and fresh-check states. Five session overviews have no exact prototype counterpart and are labelled nearest-reference only. Review order/source placement and mobile history density remain open visual differences.",
    file: path.join(root, "history-review/gallery.json"),
    pairs: history.pairs,
  },
];
const inventory = [];
for (const group of groups) {
  for (const pair of group.pairs) {
    const files = Object.fromEntries(
      ["prototype", "application"].map((key) => {
        const file = path.resolve(path.dirname(group.file), pair[key]);
        assert.ok(file.startsWith(root + path.sep) && fs.existsSync(file));
        return [key, path.relative(root, file).replaceAll("\\", "/")];
      }),
    );
    inventory.push({
      group: group.title,
      title: pair.title + (pair.size ? " · " + pair.size : ""),
      comparison:
        pair.title === "Assignment overview"
          ? "corresponding-purpose-different-progress-state"
          : pair.comparison || "corresponding-purpose",
      note:
        pair.title === "Assignment overview"
          ? "Purpose comparison only: the authenticated assignment is In progress / Continue, while the approved prototype is Not started / Start. These are different workflow states. Actual progress and teacher content were not changed to imitate the prototype."
          : pair.note || group.description,
      ...files,
    });
  }
}
const nearest = inventory.filter(
  (pair) => pair.comparison === "nearest-reference-not-equivalent",
).length;
const record = {
  source: matrix.application,
  buildId: matrix.productionBuild,
  totalComparisons: inventory.length,
  nearestReferences: nearest,
  differentProgressStateComparisons: inventory.filter(
    (pair) =>
      pair.comparison === "corresponding-purpose-different-progress-state",
  ).length,
  correspondingPurposeComparisons: inventory.length - nearest,
  visualAcceptance: "NOT_ACCEPTED",
  inventory,
};
fs.writeFileSync(
  path.join(root, "walkthrough.json"),
  JSON.stringify(record, null, 2),
);
const sections = groups
  .map(
    (group, i) =>
      `<section id="chapter-${i}"><h2>${esc(group.title)}</h2><p>${esc(group.description)}</p>${inventory
        .filter((pair) => pair.group === group.title)
        .map(
          (pair) =>
            `<details class="comparison" ${/1440/.test(pair.title) ? "open" : ""}><summary>${esc(pair.title)}${pair.comparison === "nearest-reference-not-equivalent" ? " — NOT equivalent" : ""}</summary><p>${esc(pair.note)}</p><div class="pair"><figure><figcaption>Approved prototype</figcaption><a href="${esc(pair.prototype)}"><img loading="lazy" src="${esc(pair.prototype)}" alt="Approved prototype: ${esc(pair.title)}"></a></figure><figure><figcaption>Authenticated combined application</figcaption><a href="${esc(pair.application)}"><img loading="lazy" src="${esc(pair.application)}" alt="Application: ${esc(pair.title)}"></a></figure></div></details>`,
        )
        .join("")}</section>`,
  )
  .join("");
fs.writeFileSync(
  path.join(root, "WALKTHROUGH.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Student Notebook — combined visual walkthrough</title><style>body{margin:0;background:#f4f5f1;color:#183b35;font:16px/1.55 system-ui}header{background:#123c34;color:#fff;padding:36px max(24px,5vw)}main{padding:24px max(20px,4vw)}nav{display:flex;flex-wrap:wrap;gap:20px}a{color:inherit}h1{font:700 34px Georgia,serif;margin:0 0 12px}h2{margin-top:48px}.meta{font-size:13px;overflow-wrap:anywhere}.notice{padding:18px;border-left:5px solid #af812f;background:#fff5d9}details{background:#fff;border:1px solid #cbd7cf;margin:22px 0;padding:16px;border-radius:12px}summary{cursor:pointer;font-weight:700;font-size:19px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0}figcaption{font-weight:650;padding:8px 0}img{max-width:100%;height:auto;border:1px solid #d2ddd5;vertical-align:top}button{background:#fff;border:1px solid #65897b;border-radius:6px;padding:8px 14px;color:#183b35;cursor:pointer}@media(max-width:800px){.pair{grid-template-columns:1fr}h1{font-size:28px}}</style><header><h1>Student Notebook: the combined journey</h1><p>Actual authenticated application · fictional data · disabled providers · unedited screenshots</p><div class="meta">Application ${esc(matrix.application)}<br>Build ${esc(matrix.productionBuild)}<br>Approved prototype ${esc(matrix.prototypeArchiveSha256)}</div></header><main><p class="notice"><strong>Draft for human review. Full prototype parity is not accepted.</strong> ${inventory.length - nearest} corresponding-purpose comparisons and ${nearest} explicitly non-equivalent nearest references. Required widths:1440,1024,390,320px; native200% browser zoom with100% controls. Functional geometry and authentic source identities do not erase the documented design gaps.</p><nav>${groups.map((group, i) => `<a href="#chapter-${i}">${esc(group.title)}</a>`).join("")}<a href="RESULTS.md">Results</a><a href="N6_HANDOFF.md">Independent N6</a><a href="ACTIVATION_DECISION.md">Activation decision</a></nav><p><button id="expand">Expand every comparison</button> <button id="collapse">Collapse comparisons</button></p>${sections}<p>External fonts were blocked; both captures use available local fonts. The application uses actual authorized fictional content rather than copying prototype data. Original captures and source-bound receipts remain adjacent.</p></main><script>document.getElementById('expand').onclick=()=>document.querySelectorAll('details').forEach(x=>x.open=true);document.getElementById('collapse').onclick=()=>document.querySelectorAll('details').forEach(x=>x.open=false);</script></html>`,
);
console.log(
  JSON.stringify({
    source: matrix.application,
    comparisons: inventory.length,
    nearestReferences: nearest,
  }),
);
