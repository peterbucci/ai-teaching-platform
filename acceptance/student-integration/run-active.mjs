/** Rebind the unchanged S1/#113 checks to the isolated combined runtime. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const mode = process.argv[2];
const names = [
  "fixtures",
  "operators-host",
  "run-recovery",
  "journey",
  "reader-mounted",
  "panes",
  "facing-layouts",
  "visual",
  "services",
];
assert.ok(
  names.includes(mode) && !["fixtures", "operators-host"].includes(mode),
);
assert.equal(process.env.PGHOST, "127.0.0.1");
assert.equal(process.env.PGPORT, "5931");
assert.equal(process.env.PGDATABASE, "student_notebook_final_01a17503");
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3431");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
assert.equal(process.env.DATABASE_URL, undefined);
const setup = path.join(root, ".setup/active-checks");
const output = "acceptance/student-integration/active";
fs.mkdirSync(setup, { recursive: true });
fs.mkdirSync(output, { recursive: true });
process.env.S1_RUNTIME = "production";
process.env.S1_PROTOTYPE =
  "C:/Users/sb128/.codex/worktrees/student-notebook-integration/LearningPlatform/.setup/prototype";
process.env.DIALOGUE_CHECK_SYNTHETIC = "1";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const receipt = { mode, assertionsChanged: false, files: [], adaptations: [] };
for (const name of names) {
  const originalPath = path.join(
    root,
    "acceptance/active-notebook",
    name + ".mjs",
  );
  const original = fs.readFileSync(originalPath, "utf8");
  let source = original;
  for (const [from, to] of [
    [
      "c:/users/sb128/.codex/worktrees/student-notebook-active/learningplatform",
      root.replaceAll("\\", "/").toLowerCase(),
    ],
    ["active_notebook_s1_01a17497", process.env.PGDATABASE],
    ['"5927"', JSON.stringify(process.env.PGPORT)],
    ["http://127.0.0.1:3427", process.env.AUTH_URL],
    ["lp-notebook-s1-01a17497", "lp-notebook-final-01a17503"],
    ["lp-accept-notebook-s1", "lp-accept-notebook-final"],
    ["acceptance-active-notebook-", "acceptance-final-notebook-"],
    ["acceptance/active-notebook/evidence", output],
    [
      "acceptance/active-notebook/operators-host.mjs",
      ".setup/active-checks/operators-host.mjs",
    ],
    [
      'path.join(root, "acceptance/active-notebook", file)',
      'path.join(root, ".setup/active-checks", file)',
    ],
  ]) {
    const count = source.split(from).length - 1;
    if (count) {
      source = source.replaceAll(from, to);
      receipt.adaptations.push({ name, from, to, count });
    }
  }
  source = source.replace(/from "(\.[^"]+)"/g, (_m, specifier) => {
    const local =
      specifier.startsWith("./") && names.includes(specifier.slice(2, -4));
    const target = local
      ? path.join(setup, specifier)
      : path.resolve(path.dirname(originalPath), specifier);
    return `from ${JSON.stringify(pathToFileURL(target).href)}`;
  });
  source = source.replaceAll(
    "import.meta.url",
    JSON.stringify(pathToFileURL(originalPath).href),
  );
  if (name === "panes") {
    // Drain held route callbacks before navigating to the next fixture. The
    // context-level external-request blocker is retained. Assertions are intact.
    const count = (source.match(/await page\.unroute\([^)]*\);/g) || []).length;
    assert.equal(count, 12);
    source = source.replace(
      /await page\.unroute\([^)]*\);/g,
      'await page.unrouteAll({ behavior: "wait" });',
    );
    receipt.routeTeardown = {
      original: "page.unroute",
      replacement: "page.unrouteAll({ behavior: 'wait' })",
      count,
      reason:
        "Drain in-flight handlers before leaving each fixture; retain original assertions",
    };
  }
  if (name === "panes" && process.env.FINAL_PANE_TRACE === "1") {
    if (process.env.FINAL_PANE_STRESS === "1") {
      source = source.replace(
        'for (const outcome of ["failed", "unknown"])',
        'for (const outcome of ["failed", ...Array(20).fill("unknown")])',
      );
      receipt.stress =
        "Repeat the unchanged unknown-receipt assertions twenty times";
    }
    source = source.replace(
      'page.on("request", (r) => {',
      `
report.requests = writes;
await page.addInitScript(() => {
  window.__receiptFetches = [];
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = String(args[0]);
    const entry = { url, method: args[1]?.method || "GET", start: performance.now(), stack: new Error().stack };
    if (url.includes("/interventions/")) window.__receiptFetches.push(entry);
    try {
      const response = await originalFetch.apply(this, args);
      entry.status = response.status;
      entry.end = performance.now();
      return response;
    } catch (error) {
      entry.error = String(error);
      entry.end = performance.now();
      throw error;
    }
  };
});
page.on("request", (r) => {`,
    );
    source = source.replace(
      "writes.push({ url: r.url(), body: r.postDataJSON() });",
      "writes.push({ url: r.url(), body: r.postDataJSON(), at: Date.now() });",
    );
    source = source.replace(
      "report.cases.push({\n      name,",
      "report.receiptFetches = await page.evaluate(() => window.__receiptFetches);\n    report.cases.push({\n      name,",
    );
    receipt.diagnostic =
      "Additional fetch/request timing only; all original assertions retained";
  }
  const target = path.join(setup, name + ".mjs");
  fs.writeFileSync(target, source);
  receipt.files.push({
    original: path.relative(root, originalPath),
    originalSha256: hash(original),
    adaptedSha256: hash(source),
  });
}
fs.writeFileSync(
  path.join(output, `adaptation-${mode}-${Date.now()}.json`),
  JSON.stringify(receipt, null, 2),
);
process.argv.splice(2, 1);
await import(pathToFileURL(path.join(setup, mode + ".mjs")).href);
