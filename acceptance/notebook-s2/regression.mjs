/** Run unchanged N7 journey/reader assertions with only isolated-runtime bindings adapted. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const name = process.argv[2];
assert.ok(["journey", "reader-mounted"].includes(name));
assert.equal(process.env.PGDATABASE, "notebook_s2");
assert.equal(process.env.PGPORT, "5912");
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3412");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
const original = path.resolve(`acceptance/notebook/${name}.mjs`);
const before = fs.readFileSync(original, "utf8");
let adapted = before;
const replacements = [
  ["5907", "5912"],
  ["reader_visibility_n7_01a1742c", "notebook_s2"],
  ["http://127.0.0.1:3407", "http://127.0.0.1:3412"],
  ["acceptance/notebook/evidence", "acceptance/notebook-s2/evidence"],
];
for (const [from, to] of replacements) {
  assert.ok(adapted.includes(from), `expected runtime binding ${from}`);
  adapted = adapted.replaceAll(from, to);
}
adapted = adapted
  .replace(
    /from "(\.[^"]+)"/g,
    (_, relative) =>
      `from "${pathToFileURL(path.resolve(path.dirname(original), relative)).href}"`,
  )
  .replaceAll("import.meta.url", JSON.stringify(pathToFileURL(original).href));
process.env.N7_JOURNEY_RUNTIME = "production";
process.env.N7_READER_RUNTIME = "production";
const generated = path.resolve(`.setup/s2/${name}-adapted.mjs`);
fs.writeFileSync(generated, adapted);
const sha = (s) => createHash("sha256").update(s).digest("hex");
const receipt = {
  original: path.relative(process.cwd(), original),
  originalSha256: sha(before),
  adaptedSha256: sha(adapted),
  runtimeReplacements: replacements,
  importResolution:
    "Relative imports and createRequire base resolved to the original source location.",
  assertionsChanged: false,
};
fs.writeFileSync(
  `acceptance/notebook-s2/${name}-adaptation.json`,
  JSON.stringify(receipt, null, 2),
);
await import(pathToFileURL(generated).href);
