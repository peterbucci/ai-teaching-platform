/** Reuse all original N7 R03 browser/database assertions on the isolated S3 host.
 * Only host, report path, import paths and requested desktop widths change.
 * The original acceptance operator and application controllers are untouched. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";

assert.equal(process.env.PGDATABASE, "lp_s3_review_01a1749b");
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3413");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
assert.equal(process.env.DATABASE_URL, undefined);
const file = path.resolve("acceptance/notebook/r03-fresh-check.mjs");
const original = fs.readFileSync(file, "utf8");
assert.equal(
  createHash("sha256").update(original).digest("hex"),
  "2561fd8130b4029d4b1ace8642f63f0dfaa9d37822d76f9e5681465c0fdc3300",
);
const rebase = (source) =>
  source.replace(
    /from "(\.\.\/[^"\n]+)"/g,
    (_match, relative) =>
      `from ${JSON.stringify(pathToFileURL(path.resolve(path.dirname(file), relative)).href)}`,
  );
export function fixtureKit() {
  const imports = original.slice(
    0,
    original.indexOf("assert.equal(process.env.PGHOST"),
  );
  const helpers = original.slice(
    original.indexOf("async function actor("),
    original.indexOf("async function snapshot("),
  );
  const generated = path.resolve(".setup/s3-fixture-kit.mjs");
  fs.writeFileSync(
    generated,
    rebase(imports) +
      "\nconst pool = getPool();\n" +
      helpers +
      "\nexport {actor,makeFixture,authoredEvaluation};\n",
  );
  return import(pathToFileURL(generated).href);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let source = rebase(original)
    .replaceAll("reader_visibility_n7_01a1742c", "lp_s3_review_01a1749b")
    .replaceAll("http://127.0.0.1:3407", "http://127.0.0.1:3413")
    .replace(
      'path.join(root, "acceptance/notebook/evidence", run)',
      'path.join(root, "app/study/notebook/reviews/verification/s3", run)',
    )
    .replace(
      "for (const width of [390, 320])",
      "for (const width of [1440, 1024, 390, 320])",
    );
  const generated = path.resolve(".setup/s3-r03.mjs");
  fs.writeFileSync(generated, source);
  process.env.N7_R03_RUNTIME = "production";
  process.env.N7_R03_RUN = "authenticated-" + Date.now();
  await import(pathToFileURL(generated).href);
}
