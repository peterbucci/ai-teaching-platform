import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { pathToFileURL } from "node:url";
import { redactAuthTrace } from "./redact-auth-trace.mjs";
import {
  acquireLock,
  MIN_RUNTIME_GIB,
  preflight,
  nearestExisting,
  writeReceipt,
} from "./safety.mjs";

const PROJECT = "lp-accept-recovery-01a1714f";
const ORIGIN = "http://localhost:3355";
const environmentOnly = new Set([
  "student-browser.mjs",
  "student-result-browser.mjs",
  "resume-student-browser.mjs",
  "resume-student-result-browser.mjs",
]);
const stateFirst = new Set([
  "authoring-browser.mjs",
  "authoring-workbench-browser.mjs",
  "pr117-authoring-browser.mjs",
  "resume-authoring-browser.mjs",
  "accessibility-browser.mjs",
]);
const assignments = new Set([
  "pr117-assignments-browser.mjs",
  "resume-assignments-browser.mjs",
]);
const originFirst = new Set([
  "teacher-browser.mjs",
  "workbench-browser.mjs",
  "priority-browser.mjs",
  "resume-teacher-browser.mjs",
  "resume-workbench-browser.mjs",
  "resume-priority-browser.mjs",
  "resume-followup-browser.mjs",
]);
const allowed = new Set([
  ...environmentOnly,
  ...stateFirst,
  ...assignments,
  ...originFirst,
  "oversized-browser.mjs",
]);
const within = (parent, child) => {
  const path = relative(parent, child);
  return (
    Boolean(path) &&
    path !== ".." &&
    !path.startsWith(`..${sep}`) &&
    !isAbsolute(path)
  );
};

export function requireAbsentBrowserOutput(output) {
  if (existsSync(output))
    throw new Error(
      "Browser output already exists; the child requires a fresh absent directory.",
    );
}

export function browserHarnessDirectories(source) {
  const directories = [realpathSync(import.meta.dirname)];
  if (existsSync(join(source, "acceptance")))
    directories.push(realpathSync(join(source, "acceptance")));
  return directories;
}

export function browserArguments(
  name,
  args,
  { state, output, sourceSha, origin },
) {
  if (!allowed.has(name))
    throw new Error(
      "Browser script is not in the reviewed acceptance allowlist.",
    );
  const substitutions = {
    "{state}": state,
    "{out}": output,
    "{origin}": origin,
    "{sha}": sourceSha,
  };
  const values = args.map((value) => substitutions[value] ?? value);
  if (environmentOnly.has(name) && values.length !== 0)
    throw new Error(
      "This browser harness takes environment configuration, not positional arguments.",
    );
  if (
    (stateFirst.has(name) || assignments.has(name)) &&
    (values.length !== 3 || resolve(values[0]) !== state)
  )
    throw new Error(
      "Pass the exact recovery state as the first of three harness arguments.",
    );
  if (assignments.has(name) && resolve(values[1]) !== output)
    throw new Error(
      "The positional output must be the new guarded output directory ({out}).",
    );
  if (
    originFirst.has(name) &&
    ((name === "resume-followup-browser.mjs"
      ? values.length !== 6 ||
        !values
          .slice(3)
          .every((value) =>
            /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
              value,
            ),
          )
      : values.length !== 3 &&
        !(name.endsWith("teacher-browser.mjs") && values.length === 4)) ||
      values[0] !== origin ||
      resolve(values[1]) !== output ||
      values[2] !== sourceSha)
  )
    throw new Error(
      "Pass {origin} {out} {sha}; teacher permits one draft UUID, and followup requires exactly three draft/approval/delivery UUIDs.",
    );
  if (
    name === "oversized-browser.mjs" &&
    (values.length !== 2 || resolve(values[1]) !== output)
  )
    throw new Error(
      "Pass an explicit fixture file and {out} for the oversized browser harness.",
    );
  return values;
}

async function main() {
  const options = {};
  const raw = process.argv.slice(2);
  const separator = raw.indexOf("--");
  const optionArgs = separator < 0 ? raw : raw.slice(0, separator);
  const scriptArgs = separator < 0 ? [] : raw.slice(separator + 1);
  for (let index = 0; index < optionArgs.length; index += 2) {
    const key = optionArgs[index];
    const value = optionArgs[index + 1];
    if (
      !["--state", "--script", "--out", "--input"].includes(key) ||
      !value ||
      options[key]
    )
      throw new Error(
        "Use --state <absolute state> --script <acceptance browser script> [--out <new directory>] [--input <prior student directory>] -- <explicit harness arguments>.",
      );
    options[key] = value;
  }
  if (!isAbsolute(options["--state"] ?? "") || !options["--script"])
    throw new Error(
      "An absolute initialized recovery state and explicit browser script are required.",
    );
  const state = realpathSync(options["--state"]);
  const manifest = JSON.parse(
    readFileSync(join(state, "manifest.json"), "utf8"),
  );
  if (
    manifest.project !== PROJECT ||
    manifest.target !== "combined-recovery" ||
    manifest.origin !== ORIGIN ||
    manifest.paidModelCallsAuthorized !== false ||
    !/^[a-f0-9]{40}$/.test(manifest.sourceSha ?? "")
  )
    throw new Error(
      "Only the pinned, provider-disabled recovery project at localhost:3355 is permitted.",
    );
  const source = realpathSync(manifest.source);
  const script = realpathSync(
    isAbsolute(options["--script"])
      ? options["--script"]
      : join(import.meta.dirname, options["--script"]),
  );
  const harnessDirectories = browserHarnessDirectories(source);
  if (
    !harnessDirectories.includes(dirname(script)) ||
    !allowed.has(basename(script))
  )
    throw new Error(
      "Script must be an allowlisted browser harness in the recovery source or this acceptance harness directory.",
    );
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-browser-${randomUUID().slice(0, 8)}`;
  const runDirectory = join(state, "runs", runId);
  const output = options["--out"]
    ? resolve(options["--out"])
    : join(runDirectory, "artifacts");
  if (
    (options["--out"] && !isAbsolute(options["--out"])) ||
    !within(state, output) ||
    existsSync(output)
  )
    throw new Error(
      "Browser output must be a new, unused directory inside the recovery state.",
    );
  const outputAncestor = realpathSync(nearestExisting(output));
  if (outputAncestor !== state && !within(state, outputAncestor))
    throw new Error(
      "Browser output parent resolves outside the recovery state.",
    );
  const input = options["--input"]
    ? realpathSync(options["--input"])
    : undefined;
  if (input && (!isAbsolute(options["--input"]) || !within(state, input)))
    throw new Error(
      "Prior student input must be an existing absolute directory inside the recovery state.",
    );
  if (
    basename(script).includes("student-result") &&
    (!input ||
      ![
        "student-browser-report.json",
        "storage-student.json",
        "accepted-result-fixture.json",
      ].every((name) => existsSync(join(input, name))))
  )
    throw new Error(
      "Supplemental student results require --input with the prior student report, login state and accepted-result fixture.",
    );
  const args = browserArguments(basename(script), scriptArgs, {
    state,
    output,
    sourceSha: manifest.sourceSha,
    origin: manifest.origin,
  });
  if (basename(script).includes("student-result")) {
    const prior = JSON.parse(
      readFileSync(join(input, "student-browser-report.json"), "utf8"),
    );
    if (prior.source_sha !== manifest.sourceSha || prior.base !== ORIGIN)
      throw new Error(
        "Prior student evidence belongs to another source or origin.",
      );
  }
  if (basename(script) === "oversized-browser.mjs") {
    const fixture = JSON.parse(readFileSync(args[0], "utf8"));
    if (
      fixture.sourceSha !== manifest.sourceSha ||
      new URL(fixture.browserUrl).origin !== ORIGIN
    )
      throw new Error("Oversized fixture belongs to another source or origin.");
  }
  const secrets = Object.fromEntries(
    readFileSync(join(state, ".env.acceptance"), "utf8")
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at), line.slice(at + 1)];
      }),
  );
  if (
    secrets.OPENAI_API_KEY ||
    secrets.OPENAI_MODEL ||
    secrets.AUTH_URL !== ORIGIN
  )
    throw new Error(
      "State must have blank model configuration and the recovery origin.",
    );
  mkdirSync(runDirectory, { recursive: true });
  const reportPath = join(runDirectory, "wrapper-results.json");
  const checks = [];
  let release;
  let status = "incomplete";
  let childResult = null;
  const redact = (value) =>
    redactAuthTrace(
      Object.entries(secrets).reduce(
        (text, [key, secret]) =>
          /(PASSWORD|SECRET|KEY)/.test(key) && secret
            ? text.replaceAll(secret, "[REDACTED]")
            : text,
        String(value ?? ""),
      ),
    );
  const save = () =>
    writeReceipt(reportPath, {
      schemaVersion: 1,
      runId,
      project: PROJECT,
      source,
      sourceSha: manifest.sourceSha,
      origin: ORIGIN,
      script,
      scriptSha256: createHash("sha256")
        .update(readFileSync(script))
        .digest("hex"),
      args: args.map(redact),
      output,
      input,
      status,
      checks,
      childResult,
      paidModelCallsAuthorized: false,
      browserCaseResult:
        "not-assessed-by-wrapper; inspect the child browser report",
      limitations: [
        "A zero child exit code does not prove browser cases passed",
        "Wrapper serializes guarded processes only; coordinate other tools with the environment owner",
        "Storage checks bracket the browser process; its case report and screenshots are separate evidence",
      ],
    });
  const safety = (stage) => {
    const observation = preflight({
      source,
      state,
      minimumGiB: MIN_RUNTIME_GIB,
      explicitPath: manifest.dockerDataPath,
      probeContainer: manifest.storageProbeContainer,
    });
    checks.push({
      stage,
      status: observation.pass ? "pass" : "fail",
      observation,
    });
    save();
    if (!observation.pass)
      throw new Error(`Storage/engine gate failed ${stage}.`);
  };
  try {
    release = acquireLock({
      project: PROJECT,
      source,
      sourceSha: manifest.sourceSha,
      state,
      mode: "browser",
      script,
    });
    const head = spawnSync("git", ["-C", source, "rev-parse", "HEAD"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 20_000,
    });
    if (
      head.status !== 0 ||
      head.error ||
      head.stdout.trim() !== manifest.sourceSha
    )
      throw new Error(
        "Current application source HEAD differs from the initialized manifest.",
      );
    checks.push({
      stage: "source-head",
      status: "pass",
      sourceSha: head.stdout.trim(),
    });
    safety("before-browser");
    // The shared lock serializes guarded writers; legacy harnesses own mkdir and
    // require the output path to remain absent until they start.
    requireAbsentBrowserOutput(output);
    const environment = {
      ...process.env,
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      ACCEPTANCE_BASE_URL: ORIGIN,
      ACCEPTANCE_SOURCE_SHA: manifest.sourceSha,
      ACCEPTANCE_SETUP: state,
      ACCEPTANCE_OUT: output,
      ACCEPTANCE_AUTHORING_OUT: output,
      ACCEPTANCE_ACCESSIBILITY_OUT: output,
      ACCEPTANCE_RESULT_OUT: output,
      ACCEPTANCE_STATE_DIR: output,
    };
    delete environment.ACCEPTANCE_INPUT;
    if (input) environment.ACCEPTANCE_INPUT = input;
    delete environment.DATABASE_URL;
    let stdout = "";
    let stderr = "";
    childResult = await new Promise((resolveResult) => {
      const child = spawn(process.execPath, [script, ...args], {
        cwd: source,
        env: environment,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stoppedForLimit = null;
      const timer = setTimeout(() => {
        stoppedForLimit = "20-minute browser-process timeout";
        child.kill();
      }, 1_200_000);
      const capture = (kind, data) => {
        if (kind === "stdout") stdout += data.toString();
        else stderr += data.toString();
        if (stdout.length + stderr.length > 16 * 1024 * 1024) {
          stoppedForLimit = "browser output limit exceeded";
          child.kill();
        }
      };
      child.stdout.on("data", (data) => capture("stdout", data));
      child.stderr.on("data", (data) => capture("stderr", data));
      child.on("error", (error) => {
        stoppedForLimit = error.message;
      });
      child.on("close", (exitCode, signal) => {
        clearTimeout(timer);
        resolveResult({
          exitCode,
          signal,
          error: stoppedForLimit,
          processCompletedSuccessfully: exitCode === 0 && !stoppedForLimit,
        });
      });
    });
    writeFileSync(
      join(runDirectory, "browser-process.log"),
      `${redact(stdout)}${redact(stderr)}`,
      { flag: "wx", flush: true },
    );
    save();
    safety("after-browser");
    if (!childResult.processCompletedSuccessfully)
      throw new Error(
        "Browser process failed or was interrupted; inspect its output and case report before continuing.",
      );
    status = "process-completed; browser-cases-require-report-review";
  } catch (error) {
    status = "failed";
    checks.push({
      stage: "wrapper-stopped",
      status: "fail",
      error: redact(error.message),
    });
    process.exitCode = 1;
  } finally {
    try {
      release?.();
    } catch (error) {
      status = "failed";
      checks.push({
        stage: "lock-release",
        status: "fail",
        error: redact(error.message),
      });
      process.exitCode = 1;
    }
    save();
  }
  console.log(`Browser wrapper ${status}: ${reportPath}`);
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
