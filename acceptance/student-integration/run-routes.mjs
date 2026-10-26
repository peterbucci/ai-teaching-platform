/** Supplemental My Learning, assignment overview and standalone reading gallery.
 * S1/S2/S3 galleries separately cover study, saved records and teacher review.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const originalPath = path.resolve("acceptance/notebook/visual.mjs");
const original = fs.readFileSync(originalPath, "utf8");
assert.equal(process.env.PGPORT, "5931");
assert.equal(process.env.PGDATABASE, "student_notebook_final_01a17503");
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3431");
process.env.N7_VISUAL_RUNTIME = "production";
const output = "acceptance/student-integration/routes";
fs.mkdirSync(output, { recursive: true });
const replacements = [
  ['"5907"', '"5931"'],
  ["reader_visibility_n7_01a1742c", process.env.PGDATABASE],
  ["http://127.0.0.1:3407", process.env.AUTH_URL],
  [
    'path.join(root, "acceptance/notebook/evidence", run)',
    `path.join(root, ${JSON.stringify(output)}, run)`,
  ],
  ["acceptance/notebook/evidence", "acceptance/student-integration/active"],
  [
    'path.join(root, ".setup/prototype")',
    '"C:/Users/sb128/.codex/worktrees/student-notebook-integration/LearningPlatform/.setup/prototype"',
  ],
  [
    "const scenarios = new Set(surfaces.map((s) => s.scenario));",
    'surfaces.splice(0, surfaces.length, ...surfaces.filter((s) => ["learning", "overview", "reading"].includes(s.id)));\nconst scenarios = new Set(surfaces.map((s) => s.scenario));',
  ],
  [
    "Viewport, overflow and zoom assertions are functional layout checks, not prototype fidelity acceptance. Active-study presentation remains gated and current-data records cannot reproduce the prototype's full chronology.",
    "Supplemental combined My Learning, assignment overview and standalone reading captures. S1/S2/S3 galleries cover other states. Functional checks do not replace visual review. Fictional content differs from prototype examples.",
  ],
];
let source = original;
for (const [from, to] of replacements) {
  assert.ok(source.includes(from), `Expected source binding ${from}`);
  source = source.replaceAll(from, to);
}
source = source.replace(
  /from "(\.[^"]+)"/g,
  (_m, specifier) =>
    `from ${JSON.stringify(pathToFileURL(path.resolve(path.dirname(originalPath), specifier)).href)}`,
);
source = source.replaceAll(
  "import.meta.url",
  JSON.stringify(pathToFileURL(originalPath).href),
);
const target = path.resolve(".setup/route-visual.mjs");
fs.writeFileSync(target, source);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
fs.writeFileSync(
  path.join(output, `adaptation-${Date.now()}.json`),
  JSON.stringify(
    {
      originalSha256: hash(original),
      adaptedSha256: hash(source),
      selectedSurfaces: ["learning", "overview", "reading"],
      replacements,
    },
    null,
    2,
  ),
);
await import(pathToFileURL(target).href);
