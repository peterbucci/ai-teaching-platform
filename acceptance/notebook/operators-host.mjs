/** Bounded host adapter for the unchanged #113 operator fixtures. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
assert.equal(
  root.replaceAll("\\", "/").toLowerCase(),
  "c:/users/sb128/.codex/worktrees/student-notebook-integration/learningplatform",
);
assert.equal(process.cwd().toLowerCase(), root.toLowerCase());
assert.equal(process.env.PGHOST, "127.0.0.1");
assert.equal(process.env.PGPORT, "5907");
assert.equal(process.env.PGDATABASE, "reader_visibility_n7_01a1742c");
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3407");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
assert.equal(process.env.ALLOW_DISPOSABLE_STUDENT_FIXTURES, "1");
assert.equal(process.env.ACCEPTANCE_PROJECT, "lp-accept-notebook-n7");
assert.match(process.env.ACCEPTANCE_SOURCE_SHA || "", /^[a-f0-9]{40}$/);
assert.equal(process.env.DATABASE_URL, undefined);
const runtime = JSON.parse(
  readFileSync(path.join(root, ".setup/runtime/manifest.json"), "utf8"),
);
assert.equal(runtime.project, "lp-notebook-n7-01a1742c");
assert.equal(runtime.origin, process.env.AUTH_URL);
assert.equal(runtime.database, process.env.PGDATABASE);
assert.equal(runtime.modelProvidersDisabled, true);

const [kind, ...args] = process.argv.slice(2);
const sources = {
  recovery: [
    "recovery-fixture.mjs",
    "ed8d073b29a5e0376e1c324fadb849898a9e51994b3da8b71924906356e1dba2",
  ],
  result: [
    "result-fixture-step.mjs",
    "63ea19bb9ab4053e12befb669aef3d6a315f9c0d520f9f575d5d6335e1947d36",
  ],
};
assert.ok(Object.hasOwn(sources, kind));
const [name, expectedHash] = sources[kind];
const original = readFileSync(
  path.join(root, "acceptance/student-blockers", name),
  "utf8",
);
assert.equal(createHash("sha256").update(original).digest("hex"), expectedHash);
const workspace = path.join(root, ".setup/runtime/recovery");
mkdirSync(workspace, { recursive: true });
function replaceExactly(source, before, after) {
  assert.equal(
    source.split(before).length,
    2,
    `Expected one original guard: ${before}`,
  );
  return source.replace(before, after);
}
let source = replaceExactly(
  original,
  'assert.equal(process.env.PGHOST, "db");',
  'assert.equal(process.env.PGHOST, "127.0.0.1");',
);
source = replaceExactly(
  source,
  'assert.equal(process.cwd(), "/app");',
  `assert.equal(process.cwd().toLowerCase(), ${JSON.stringify(root.toLowerCase())});`,
);
if (kind === "recovery")
  source = replaceExactly(
    source,
    'assert.equal(process.env.ACCEPTANCE_PROJECT, "lp-accept-pr113");',
    'assert.equal(process.env.ACCEPTANCE_PROJECT, "lp-accept-notebook-n7");',
  );
else {
  const fixtureFile = args[0] === "init" ? args[2] : args[1];
  assert.ok(fixtureFile);
  assert.equal(
    path.dirname(path.resolve(fixtureFile)).toLowerCase(),
    workspace.toLowerCase(),
  );
  assert.match(path.basename(fixtureFile), /^result_[a-z0-9_-]+\.json$/);
  source = replaceExactly(
    source,
    'assert.match(file || "", /^\\/tmp\\/[a-z0-9_-]+\\.json$/);',
    `assert.equal(file, ${JSON.stringify(fixtureFile)});`,
  );
}
source = source.replaceAll(
  /import\("\/app\/([^"\n]+)"\)/g,
  (_, file) =>
    `import(${JSON.stringify(pathToFileURL(path.join(root, file)).href)})`,
);
assert.equal(source.includes('"/app/'), false);
// Only the environment/path seams above differ; all domain operations and
// assertions are the pinned originals. Generated copies stay ignored.
const generated = path.join(workspace, `operator-${kind}-${process.pid}.mjs`);
writeFileSync(generated, source, { flag: "wx" });
process.argv = [process.argv[0], generated, ...args];
await import(pathToFileURL(generated).href);
