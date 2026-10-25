/** Local verification wrapper. Imports the reviewed storage/lock policy unchanged.
 * node guarded-browser.mjs --target shell --helper capture-shell --out <fresh absolute directory>
 * Optional: --state <absolute runtime directory or manifest.json>,
 * --safety <absolute reviewed safety.mjs>, --fixture <JSON>,
 * --docker-data-path <owner-verified path>,
 * --storage-probe-container <owner-selected existing container>.
 * No shell strings, arbitrary script paths, runtime creation, or output-directory creation.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const wrapperDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(wrapperDirectory, "..");
const hash = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const reviewedSafetySha256 =
  "af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485";
const targets = {
  shell: {
    state: "runtime-final",
    project: "lp-v22-shell5",
    origin: "http://localhost:3350",
    sha: "462cfb1b31d9108cec70d18b6553bd45048d2eed",
    tree: "03cca1fed3900a122e689c4a512afadd9052e5af",
  },
};
const helpers = {
  "capture-shell": {
    script: "../final-verification/capture-shell.mjs",
    targets: ["shell"],
  },
  "capture-original-answer": {
    script: "../final-verification/capture-original-answer.mjs",
    targets: ["shell"],
  },
  "shell-authoring-browser": {
    script: "shell-authoring-browser.mjs",
    targets: ["shell"],
  },
  "student-regression-browser": {
    script: "student-regression-browser.mjs",
    targets: ["shell"],
  },
};
const options = {};
const permitted = new Set([
  "target",
  "helper",
  "out",
  "fixture",
  "state",
  "safety",
  "docker-data-path",
  "storage-probe-container",
]);
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]?.replace(/^--/, "");
  const value = process.argv[index + 1];
  if (
    !process.argv[index].startsWith("--") ||
    !permitted.has(key) ||
    !value ||
    value.startsWith("--") ||
    Object.hasOwn(options, key)
  )
    throw new Error(
      "Use unique allowlisted --name value options; arbitrary child argv is not accepted.",
    );
  options[key] = value;
}
const target =
  Object.hasOwn(targets, options.target) && targets[options.target];
const helper =
  Object.hasOwn(helpers, options.helper) && helpers[options.helper];
if (!target || !helper || !helper.targets.includes(options.target))
  throw new Error("Choose an allowlisted helper and compatible pinned target.");
if (!options.out || !isAbsolute(options.out))
  throw new Error(
    "--out must be a fresh absolute directory outside the source checkout.",
  );
if (options.helper === "student-regression-browser" && !options.fixture)
  throw new Error(
    "Student regression requires its existing synthetic --fixture JSON.",
  );
if (options.helper === "capture-original-answer" && !options.fixture)
  throw new Error(
    "Original-answer capture requires its hash-pinned run05 report as --fixture.",
  );
if (options.helper === "shell-authoring-browser" && options.fixture)
  throw new Error("Shell authoring does not accept a fixture argument.");
for (const key of ["state", "safety"])
  if (options[key] && !isAbsolute(options[key]))
    throw new Error(`--${key} must be an absolute path.`);
const safetyPath = realpathSync(
  options.safety ??
    join(
      homedir(),
      ".codex/worktrees/workbench-verification-report/LearningPlatform/acceptance/v22/safety.mjs",
    ),
);
if (hash(safetyPath) !== reviewedSafetySha256)
  throw new Error(
    "Safety module does not match the reviewed SHA256; it was not imported.",
  );
const { acquireLock, preflight, writeReceipt, MIN_RUNTIME_GIB } = await import(
  pathToFileURL(safetyPath).href
);
const stateInput = realpathSync(options.state ?? join(root, target.state));
const manifestPath = statSync(stateInput).isDirectory()
  ? join(stateInput, "manifest.json")
  : stateInput;
if (basename(manifestPath) !== "manifest.json")
  throw new Error(
    "--state must name a runtime directory or its manifest.json.",
  );
const state = realpathSync(dirname(manifestPath));
function readVerifiedManifest() {
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""),
  );
  if (
    manifest.target !== options.target ||
    manifest.project !== target.project ||
    manifest.origin !== target.origin ||
    manifest.sourceSha !== target.sha ||
    manifest.sourceTree !== target.tree ||
    typeof manifest.source !== "string" ||
    !isAbsolute(manifest.source) ||
    manifest.paidModelCallsAuthorized !== false ||
    typeof manifest.configurationCategory !== "string" ||
    !/provider-disabled/.test(manifest.configurationCategory)
  )
    throw new Error(
      "State manifest does not match the pinned provider-disabled runtime.",
    );
  return manifest;
}
const source = realpathSync(readVerifiedManifest().source);
// Resolve the existing parent, so junctions cannot disguise an output inside source.
const outParent = realpathSync(dirname(resolve(options.out)));
const out = join(outParent, basename(resolve(options.out)));
const within = (parent, child) => {
  const path = relative(parent, child);
  return (
    path === "" ||
    (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
  );
};
if (
  !statSync(outParent).isDirectory() ||
  within(source, out) ||
  within(source, state) ||
  existsSync(out)
)
  throw new Error(
    "OUT must not exist, its parent must exist, and OUT/state must be outside source.",
  );
const fixture = options.fixture ? realpathSync(options.fixture) : null;
if (
  fixture &&
  (!isAbsolute(options.fixture) ||
    !statSync(fixture).isFile() ||
    !fixture.endsWith(".json"))
)
  throw new Error("--fixture must name an existing absolute JSON file.");
const script = realpathSync(resolve(wrapperDirectory, helper.script));
const receiptPath = join(outParent, `${basename(out)}.guard.json`);
if (existsSync(receiptPath))
  throw new Error("Choose a fresh OUT and guard receipt name.");
const playwright = realpathSync(
  process.env.PLAYWRIGHT_MODULE ??
    join(
      homedir(),
      ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    ),
);
const browserExecutable =
  process.env.BROWSER_EXECUTABLE ??
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
if (!isAbsolute(browserExecutable) || !statSync(browserExecutable).isFile())
  throw new Error(
    "BROWSER_EXECUTABLE must identify an existing absolute browser executable.",
  );
const childArgs = ["capture-shell", "capture-original-answer"].includes(
  options.helper,
)
  ? [out, ...(fixture ? [fixture] : [])]
  : options.helper === "shell-authoring-browser"
    ? [state, join(state, "unused-browser-endpoint.txt"), playwright]
    : [state, fixture, out, playwright];
const receipt = {
  status: "pending",
  startedAt: new Date().toISOString(),
  target: options.target,
  helper: options.helper,
  source,
  state,
  manifestPath,
  out,
  origin: target.origin,
  project: target.project,
  sourceSha: target.sha,
  sourceTree: target.tree,
  wrapperSha256: hash(fileURLToPath(import.meta.url)),
  safetyPath,
  safetySha256: hash(safetyPath),
  script,
  scriptSha256: hash(script),
  fixtureSha256: fixture ? hash(fixture) : null,
  minimumGiB: MIN_RUNTIME_GIB,
  paidModelCallsAuthorized: false,
};
let release;
try {
  release = acquireLock({
    action: "guarded-browser",
    target: options.target,
    helper: options.helper,
    source,
    state,
    out,
  });
  writeReceipt(receiptPath, receipt);
  const manifest = readVerifiedManifest();
  if (realpathSync(manifest.source) !== source)
    throw new Error(
      "Manifest source path changed before the shared lock was acquired.",
    );
  const git = (argv) => {
    const result = spawnSync("git", ["-C", source, ...argv], {
      encoding: "utf8",
      windowsHide: true,
      shell: false,
    });
    if (result.error || result.status !== 0)
      throw new Error("Could not verify the pinned local Git source.");
    return result.stdout.trim();
  };
  if (
    git(["rev-parse", "HEAD"]) !== target.sha ||
    git(["rev-parse", "HEAD^{tree}"]) !== target.tree
  )
    throw new Error("Source HEAD/tree changed since the runtime snapshot.");
  for (const argv of [
    ["diff", "--name-only", "HEAD"],
    ["ls-files", "--others", "--exclude-standard"],
  ])
    if (
      git(argv)
        .split(/\r?\n/)
        .some((path) => path && !path.startsWith("acceptance/"))
    )
      throw new Error("Application source differs from the pinned snapshot.");
  const lines = readFileSync(join(state, ".env.acceptance"), "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);
  // Require exactly one explicit blank declaration; never print file contents or values.
  for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"])
    if (
      lines
        .filter((line) =>
          new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line),
        )
        .join("\n") !== `${key}=`
    )
      throw new Error(
        `Runtime ${key} must have exactly one explicit empty declaration.`,
      );
  if (
    lines
      .filter((line) => /^\s*(?:export\s+)?AUTH_URL\s*=/.test(line))
      .join("\n") !== `AUTH_URL=${target.origin}`
  )
    throw new Error(
      "Runtime authentication origin does not match the manifest.",
    );
  receipt.preflight = preflight({
    source,
    state,
    minimumGiB: MIN_RUNTIME_GIB,
    explicitPath: options["docker-data-path"],
    probeContainer: options["storage-probe-container"],
  });
  writeReceipt(receiptPath, receipt);
  if (!receipt.preflight.pass)
    throw new Error(
      "Reviewed 10 GiB storage/engine preflight did not pass; no child was started.",
    );
  if (existsSync(out))
    throw new Error("OUT appeared before launch; refusing to overwrite it.");
  const env = {
    ...process.env,
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "",
    ACCEPTANCE_STATE_DIR: state,
    ACCEPTANCE_AUTHORING_OUT: out,
    PLAYWRIGHT_MODULE: playwright,
    BROWSER_EXECUTABLE: browserExecutable,
  };
  for (const key of [
    "DATABASE_URL",
    "COMPOSE_FILE",
    "COMPOSE_PROJECT_NAME",
    "NODE_OPTIONS",
  ])
    delete env[key];
  receipt.status = "running";
  writeReceipt(receiptPath, receipt);
  const child = spawnSync(process.execPath, [script, ...childArgs], {
    cwd: dirname(script),
    env,
    shell: false,
    windowsHide: true,
    stdio: "inherit",
  });
  receipt.childExitCode = child.status;
  receipt.childSignal = child.signal;
  if (child.error || child.status !== 0)
    throw new Error(
      "Allowed browser utility failed; inspect its retained output/report.",
    );
  const report = JSON.parse(readFileSync(join(out, "report.json"), "utf8"));
  if (options.helper === "capture-shell") {
    const expected = fixture
      ? JSON.parse(readFileSync(fixture, "utf8")).states.length * 4
      : 36;
    if (
      report.states?.length !== expected ||
      report.states.some((item) => item.status !== "captured")
    )
      throw new Error("Capture did not complete every expected state.");
  } else if (!["pass", "passed"].includes(report.status)) {
    throw new Error(
      "Browser utility report contains a failed or incomplete outcome.",
    );
  }
  receipt.status = "passed";
} catch (error) {
  receipt.status = "failed";
  receipt.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  if (release) {
    receipt.finishedAt = new Date().toISOString();
    try {
      writeReceipt(receiptPath, receipt);
    } catch {
      process.exitCode = 1;
      console.error("Could not write final guard receipt.");
    }
    // Published release checks this process's token; never clear another owner's lock.
    try {
      release();
    } catch {
      process.exitCode = 1;
      console.error(
        "Own lock release failed; coordinate with its owner before any retry.",
      );
    }
    console.log(
      JSON.stringify({
        status: receipt.status,
        receipt: receiptPath,
        output: out,
      }),
    );
  }
}
