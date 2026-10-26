/** Independent PR117 probe wrapper: preserves authored assertions; adapts only isolated runtime guards. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { pathToFileURL } from "node:url";
assert.equal(process.env.ACCEPTANCE_PROJECT, "lp-accept-pr117");
assert.equal(process.env.PGHOST, "db");
assert.equal(process.env.PGDATABASE, "learning_platform");
assert.equal(process.env.AUTH_URL, "http://localhost:3323");
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"])
  assert.equal(process.env[key]?.trim() || "", "");
const source = readFileSync("/tmp/pr117-teacher-assignment-http.ts", "utf8");
assert.equal(
  createHash("sha256").update(source).digest("hex"),
  "1eb9d3dd16498ca7d7c94da9bcc7ee945b207b81261d6e888f86bb69aed8510e",
  "Require exact PR117 probe source",
);
const model = readFileSync("/tmp/pr117-progress-model.ts", "utf8");
assert.equal(
  createHash("sha256").update(model).digest("hex"),
  "2899b1d50fe76acbc14f54f038874ec208e93aa53115cb329738b23eb085f527",
  "Require exact PR117 progress model",
);
const modelOutput = "/tmp/pr117-progress-model-adapted.mjs";
assert.equal(existsSync(modelOutput), false, "Preserve previous model probe");
writeFileSync(
  modelOutput,
  stripTypeScriptTypes(model.replaceAll('"../../../lib/', '"/app/lib/'), {
    mode: "strip",
  }),
  { flag: "wx" },
);
const output = "/tmp/pr117-assignment-http-adapted.mjs";
assert.equal(
  existsSync(output),
  false,
  "Retain prior probe file; inspect before rerun",
);
const adapted = source
  .replaceAll('"../lib/', '"/app/lib/')
  .replace(
    '"../app/teacher/assignments/progress-model.ts"',
    '"/tmp/pr117-progress-model-adapted.mjs"',
  )
  .replace('from "zod"', 'from "/app/node_modules/zod/index.js"')
  .replaceAll("http://127.0.0.1:3317", "http://localhost:3323")
  .replaceAll("assignment_workbench_test", "learning_platform");
writeFileSync(output, stripTypeScriptTypes(adapted, { mode: "strip" }), {
  flag: "wx",
});
console.log(
  "Independent PR117 existing-probe execution: SHA6f9dd8991abef5efa8108e50b2274dc3bdc13ce6, dedicated provider-disabled database; authored assertions unchanged.",
);
await import(pathToFileURL(output).href);
