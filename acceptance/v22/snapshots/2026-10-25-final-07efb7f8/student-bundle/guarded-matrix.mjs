/** New verification-only wrapper for preserved PR113 result/recovery assertions. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [mode, stateArg, fixtureArg, outArg, safetyArg] = process.argv.slice(2);
assert.ok(["results", "recovery"].includes(mode));
for (const value of [stateArg, fixtureArg, outArg, safetyArg]) assert.ok(isAbsolute(value || ""));
const state = realpathSync(stateArg), fixture = realpathSync(fixtureArg), safety = realpathSync(safetyArg);
const manifest = JSON.parse(readFileSync(join(state, "manifest.json"), "utf8"));
assert.equal(manifest.project, "lp-v22-final-01a173d6");
assert.equal(manifest.origin, "http://localhost:3396");
assert.equal(manifest.sourceSha, "07efb7f821339538800f150f57b298eb2e606be3");
assert.equal(manifest.sourceTree, "948b9a6005a056c97f10d181c589b5352d6221f3");
assert.equal(manifest.paidModelCallsAuthorized, false);
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
assert.equal(hash(safety), "af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485");
const out = join(realpathSync(dirname(outArg)), resolve(outArg).split(/[\\/]/).at(-1));
assert.equal(existsSync(out), false, "Preserve earlier output; choose fresh directory");
const inside = relative(realpathSync(manifest.source), out);
assert.ok(isAbsolute(inside) || inside === ".." || inside.startsWith(`..${sep}`), "Output must be outside application source");
const { acquireLock, preflight, MIN_RUNTIME_GIB, writeReceipt } = await import(pathToFileURL(safety).href);
const source = manifest.source;
const here = dirname(fileURLToPath(import.meta.url));
const receipt = { mode, status: "prepared", sourceSha: manifest.sourceSha, sourceTree: manifest.sourceTree, origin: manifest.origin, project: manifest.project, fixtureSha256: hash(fixture), wrapperSha256: hash(fileURLToPath(import.meta.url)), runnerSha256: hash(join(here, "run-browser.mjs")), paidModelCalls: 0, startedAt: new Date().toISOString(), out };
mkdirSync(out);
const receiptPath = join(out, "guard-receipt.json");
let release, childStarted = false, confirmedCompleted = false;
try {
  release = acquireLock({ action: "student-matrix", mode, source, state, out, sourceSha: manifest.sourceSha });
  receipt.preflight = preflight({ source, state, minimumGiB: MIN_RUNTIME_GIB, explicitPath: manifest.dockerDataPath, probeContainer: manifest.storageProbeContainer });
  assert.equal(receipt.preflight.pass, true);
  writeReceipt(receiptPath, receipt);
  const env = { ...process.env,
    OPENAI_API_KEY: "", OPENAI_MODEL: "",
    ACCEPTANCE_BASE_URL: manifest.origin, ACCEPTANCE_SETUP: state,
    ACCEPTANCE_SOURCE: source, ACCEPTANCE_SOURCE_SHA: manifest.sourceSha,
    ACCEPTANCE_OUT: out, ACCEPTANCE_MATRIX: mode,
    ACCEPTANCE_STUDENT_FIXTURE: fixture, ACCEPTANCE_GUARDED_MATRIX: "1",
    ACCEPTANCE_SAFETY: safety,
    ACCEPTANCE_DOCKER_DATA_PATH: manifest.dockerDataPath || "",
    ACCEPTANCE_STORAGE_PROBE: manifest.storageProbeContainer || "",
    ACCEPTANCE_PLAYWRIGHT: process.env.ACCEPTANCE_PLAYWRIGHT || "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
    BROWSER_EXECUTABLE: process.env.BROWSER_EXECUTABLE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  };
  for (const key of ["NODE_OPTIONS", "DATABASE_URL", "COMPOSE_FILE", "COMPOSE_PROJECT_NAME", "ACCEPTANCE_WS_FILE"]) delete env[key];
  childStarted = true;
  receipt.status = "running";
  writeReceipt(receiptPath, receipt);
  const child = spawnSync(process.execPath, [join(here, "run-browser.mjs")], { cwd: here, env, shell: false, windowsHide: true, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 1200000 });
  writeFileSync(join(out, "execution.log"), `${child.stdout || ""}\n${child.stderr || ""}`, { flag: "wx" });
  receipt.childExitCode = child.status;
  if (child.error) throw child.error;
  if (child.status === 0) {
    confirmedCompleted = true;
    receipt.status = "passed";
  } else if (mode === "recovery" && existsSync(join(out, "independent-recovery-report.json"))) {
    const report = JSON.parse(readFileSync(join(out, "independent-recovery-report.json"), "utf8"));
    const unrun = report.cases.filter((item) => item.status === "UNRUN");
    confirmedCompleted = Boolean(report.finished_at) && report.cases.length === 6 && unrun.length === 1 && unrun[0].id === "R5-real-auth-expiry-safe-return" && report.cases.every((item) => item.status === "PASS" || item === unrun[0]);
    assert.ok(confirmedCompleted, "Recovery did not reach a reconciled completed state; inspect before any retry");
    receipt.status = "completed-with-unrun";
    receipt.unrun = [{ id: unrun[0].id, reason: "No saved timestamp alteration authorized" }];
    process.exitCode = 2;
  } else throw new Error("Student matrix failed; inspect retained records before any retry");
} catch (error) {
  receipt.status = childStarted ? "failed-or-uncertain" : "blocked-before-child";
  receipt.error = error.message;
  process.exitCode = 1;
} finally {
  receipt.finishedAt = new Date().toISOString();
  receipt.lockRetained = Boolean(release && childStarted && !confirmedCompleted);
  writeReceipt(receiptPath, receipt);
  if (release && !receipt.lockRetained) release();
  console.log(JSON.stringify({ status: receipt.status, out, lockRetained: receipt.lockRetained }));
}
