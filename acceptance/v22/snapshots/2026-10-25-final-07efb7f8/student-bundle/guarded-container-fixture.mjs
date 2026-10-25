/** Only the fixed fictional fixture phases below may run; no stack startup or cleanup. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const [mode, stateArg, inputArg, outArg, safetyArg] = process.argv.slice(2);
assert.equal(mode, "student-regression", "This copied adapter is restricted to the fresh student fixture");
for (const value of [stateArg, inputArg, outArg, safetyArg]) assert.ok(value);
const state = resolve(stateArg),
  out = resolve(outArg);
const input = mode === "student-regression" ? null : resolve(inputArg);
if (!input) assert.equal(inputArg, "unused");
assert.equal(
  existsSync(out),
  false,
  "Choose a fresh phase directory; retain previous receipts.",
);
const manifest = JSON.parse(readFileSync(resolve(state, "manifest.json")));
const configPath = resolve(state, "compose.json"),
  envPath = resolve(state, ".env.acceptance");
const config = JSON.parse(readFileSync(configPath));
assert.equal(manifest.project, "lp-v22-final-01a173d6");
assert.equal(manifest.origin, "http://localhost:3396");
assert.equal(manifest.sourceSha, "07efb7f821339538800f150f57b298eb2e606be3");
assert.equal(manifest.sourceTree, "948b9a6005a056c97f10d181c589b5352d6221f3");
assert.equal(manifest.paidModelCallsAuthorized, false);
const tag = manifest.project + ":" + manifest.sourceSha;
const container = manifest.project + "-app-1";
assert.equal(config.services.app.image, tag);
assert.equal(config.services.app.build.context, manifest.source);
assert.equal(config.networks.acceptance.internal, true);
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const split = line.indexOf("=");
      return [line.slice(0, split), line.slice(split + 1)];
    }),
);
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"])
  assert.equal(env[key]?.trim() || "", "");
assert.equal(env.AUTH_URL, manifest.origin);
for (const [ref, expected] of [
  ["HEAD", manifest.sourceSha],
  ["HEAD^{tree}", manifest.sourceTree],
]) {
  const actual = spawnSync("git", ["-C", manifest.source, "rev-parse", ref], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(actual.status, 0);
  assert.equal(actual.stdout.trim(), expected);
}
const hash = (value) => createHash("sha256").update(value).digest("hex");
assert.equal(
  hash(readFileSync(resolve(safetyArg))),
  "af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485",
);
const { acquireLock, preflight, MIN_RUNTIME_GIB, LOCK_PATH } = await import(
  pathToFileURL(resolve(safetyArg)).href
);
const fixture = resolve(
  dirname(fileURLToPath(import.meta.url)),
  mode === "student-regression"
    ? "seed-student-regression.mjs"
    : mode.startsWith("density-")
      ? "published-density-fixture.mjs"
      : "intervention-continuation-fixture.mjs",
);
const id = randomUUID();
const paths = {
  script: "/tmp/acceptance-fixture-" + id + ".mjs",
  input: input ? "/tmp/acceptance-input-" + id + ".json" : null,
  output: "/tmp/acceptance-output-" + id + ".json",
};
mkdirSync(out);
const receipt = {
  mode,
  status: "running",
  project: manifest.project,
  container,
  source_sha: manifest.sourceSha,
  source_tree: manifest.sourceTree,
  input_sha256: input ? hash(readFileSync(input)) : null,
  fixture_sha256: hash(readFileSync(fixture)),
  harness_sha256: hash(readFileSync(new URL(import.meta.url))),
  guard_sha256: hash(readFileSync(resolve(safetyArg))),
  started_at: new Date().toISOString(),
  container_paths: paths,
  checks: [],
  actual_model_calls: 0,
};
const save = () =>
  writeFileSync(
    resolve(out, "host-receipt.json"),
    JSON.stringify(receipt, null, 2) + "\n",
    { flush: true },
  );
let release;
let executionUncertain = false;
function run(name, args) {
  const gate = preflight({
    source: manifest.source,
    state,
    minimumGiB: MIN_RUNTIME_GIB,
    explicitPath: manifest.dockerDataPath || undefined,
    probeContainer: manifest.storageProbeContainer || undefined,
  });
  receipt.checks.push({ name: "preflight:" + name, ...gate });
  save();
  assert.equal(
    gate.pass,
    true,
    "Storage preflight stopped; no further Docker command will run.",
  );
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: 120000,
    windowsHide: true,
  });
  if (
    name === "execute-fictional-fixture" &&
    (result.error || result.status !== 0)
  ) {
    // Latch before any I/O: even a failed log write must retain this lock.
    // A timeout or nonzero transport result does not prove the process stopped.
    executionUncertain = true;
    receipt.status = "uncertain";
    receipt.lock_retained = true;
    receipt.lock_path = LOCK_PATH;
    receipt.reconciliation_required =
      "The container fixture may still run. Coordinate reconciliation with the lock owner; do not retry, restart, or remove the lock automatically.";
  }
  const log = name + ".log";
  writeFileSync(
    resolve(out, log),
    (result.stdout ?? "") + (result.stderr ?? ""),
    { flag: "wx" },
  );
  receipt.checks.push({
    name,
    exit_code: result.status,
    error: result.error?.message ?? null,
    log,
    finished_at: new Date().toISOString(),
  });
  if (executionUncertain) {
    save();
    throw new Error(
      "Fixture execution outcome is uncertain; shared lock retained for reconciliation.",
    );
  }
  save();
  assert.equal(result.status, 0, name + " failed; inspect retained log.");
  return result;
}
try {
  release = acquireLock({
    mode: "guarded-fixture-" + mode,
    source: manifest.source,
    state,
    project: manifest.project,
    sourceSha: manifest.sourceSha,
  });
  // These formats intentionally exclude Config.Env and authentication values.
  const identity = run("container-identity", [
    "container",
    "inspect",
    container,
    "--format",
    '{{.Name}}|{{.Config.Image}}|{{.Image}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}',
  ])
    .stdout.trim()
    .split("|");
  assert.equal(identity[0], "/" + container);
  assert.equal(identity[1], tag);
  assert.equal(identity[3], manifest.project);
  assert.equal(identity[4], "app");
  const image = run("pinned-image-identity", [
    "image",
    "inspect",
    tag,
    "--format",
    "{{.Id}}",
  ]);
  assert.equal(identity[2], image.stdout.trim());
  receipt.image_id = identity[2];
  run("copy-fixture", ["cp", fixture, container + ":" + paths.script]);
  if (input) run("copy-input", ["cp", input, container + ":" + paths.input]);
  const command = [
    "exec",
    "-e",
    "OPENAI_API_KEY=",
    "-e",
    "OPENAI_MODEL=",
    "-e",
    "ACCEPTANCE_PROJECT=" + manifest.project,
    "-e",
    "ACCEPTANCE_SOURCE_SHA=" + manifest.sourceSha,
    "-e",
    "ACCEPTANCE_SOURCE_TREE=" + manifest.sourceTree,
    ...(mode === "student-regression"
      ? ["-e", "ACCEPTANCE_FIXTURE_OUTPUT=" + paths.output]
      : []),
    container,
    "node",
    "--experimental-strip-types",
    "--conditions=react-server",
    paths.script,
    ...(input ? [mode, paths.input, paths.output] : []),
  ];
  run("execute-fictional-fixture", command);
  // A successful client exit permits receipt retrieval; never retry or restart.
  run("copy-fixture-receipt", [
    "cp",
    container + ":" + paths.output,
    resolve(out, "fixture.json"),
  ]);
  if (mode !== "student-regression")
    assert.equal(
      JSON.parse(readFileSync(resolve(out, "fixture.json"))).status,
      "completed",
    );
  receipt.status = "completed";
} catch (error) {
  receipt.status = executionUncertain ? "uncertain" : "failed";
  receipt.error = error.message;
  process.exitCode = 1;
} finally {
  try {
    if (!executionUncertain) release?.();
  } catch (error) {
    receipt.status = "failed";
    receipt.lock_release_error = error.message;
    process.exitCode = 1;
  }
  if (executionUncertain) receipt.wrapper_stopped_at = new Date().toISOString();
  else receipt.finished_at = new Date().toISOString();
  save();
  console.log(
    JSON.stringify({
      mode,
      status: receipt.status,
      output: out,
      error: receipt.error,
    }),
  );
}
