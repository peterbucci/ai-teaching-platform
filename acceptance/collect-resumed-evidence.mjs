import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
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
import { acquireLock } from "./safety.mjs";
import {
  hasUnredactedAuthTrace,
  redactAuthTrace,
} from "./redact-auth-trace.mjs";

const PROJECT = "lp-accept-recovery-01a1714f";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const forbidden =
  /(?:^|\/)(?:storage[^/]*|[^/]*(?:cookie|credential|\.env|endpoint|profile)[^/]*)(?:\/|$)|(?:^|\/)(?:compose|config|configuration)[^/]*\.(?:json|ya?ml)$/i;
const browserJson =
  /^(?:report|api-evidence|student-browser-report(?:-[a-z0-9-]+)?|student-browser-adjudication|student-result-report|accepted-result-fixture|delivered-student-two(?:-after-ui)?|approved-delivery-before|student-public-activity|student-saved-followup|teacher-comparison|synthetic-session)\.json$/i;
const runJson = new Set([
  "results.json",
  "wrapper-results.json",
  "approval-details.json",
]);

export function permittedEvidence(path) {
  const name = path.replaceAll("\\", "/");
  if (forbidden.test(name)) return false;
  if (["manifest.json", "student-fixture-extraction.json"].includes(name))
    return true;
  const parts = name.split("/");
  if (parts[0] === "executed-harness-sources" && parts.length === 2)
    return /^(?:browser-readiness|resume-(?:authoring|assignments|workbench|priority|student|student-result|teacher|followup)-browser)\.mjs$/.test(
      parts[1],
    );
  if (parts[0] === "runs" && parts.length === 3)
    return runJson.has(parts[2]) || /^[a-z0-9_.:-]+\.log$/i.test(parts[2]);
  const browserPath =
    (parts[0] === "runs" && parts.length === 4 && parts[2] === "artifacts") ||
    (parts.length === 2 &&
      /^browser-(?:authoring|assignments|student|teacher|workbench|priority|accessibility|oversized|followup)(?:-[a-z0-9_-]+)?$/i.test(
        parts[0],
      ));
  return (
    browserPath &&
    (browserJson.test(parts.at(-1)) ||
      /^[a-z0-9_.-]+\.(?:png|txt)$/i.test(parts.at(-1)))
  );
}

export function assertPublicText(text, secrets, name) {
  if (secrets.some((secret) => text.includes(secret)))
    throw new Error(
      `Generated secret detected in ${name}; collection stopped without printing its value.`,
    );
  if (
    hasUnredactedAuthTrace(text) ||
    /sk-(?:proj-)?[A-Za-z0-9_-]{20,}|"(?:cookies|localStorage|sessionStorage)"\s*:/i.test(
      text,
    )
  )
    throw new Error(
      `Potential authentication material detected in ${name}; inspect privately before collection.`,
    );
}

export function extractStudentFixture(stdout) {
  const matches = [];
  for (
    let start = stdout.indexOf("{");
    start !== -1;
    start = stdout.indexOf("{", start + 1)
  ) {
    let depth = 0;
    let string = false;
    let escape = false;
    for (let at = start; at < stdout.length; at += 1) {
      const char = stdout[at];
      if (string) {
        if (escape) escape = false;
        else if (char === "\\") escape = true;
        else if (char === '"') string = false;
      } else if (char === '"') string = true;
      else if (char === "{") depth += 1;
      else if (char === "}" && --depth === 0) {
        try {
          const value = JSON.parse(stdout.slice(start, at + 1));
          if (
            value.project === PROJECT &&
            value.fictional_only === true &&
            value.actual_model_calls === 0 &&
            value.status === "completed" &&
            ["session_id", "attempt_id", "evaluation_id"].every((key) =>
              /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
                value[key] ?? "",
              ),
            )
          )
            matches.push(value);
        } catch {
          /* Non-JSON preamble is not a fixture. */
        }
        break;
      }
    }
  }
  if (matches.length !== 1)
    throw new Error(
      "Expected exactly one completed, fictional, zero-model recovery fixture in stdout.",
    );
  return matches[0];
}

function main() {
  const [mode, ...args] = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (
      !["--state", "--composition", "--stdout"].includes(args[index]) ||
      !args[index + 1] ||
      options[args[index]]
    )
      throw new Error(
        "Usage: collect --state <absolute recovery state> --composition <resume-composition.json>; or student-fixture --state <state> --stdout <saved seed log>.",
      );
    options[args[index]] = args[index + 1];
  }
  if (
    !["collect", "student-fixture"].includes(mode) ||
    !isAbsolute(options["--state"] ?? "")
  )
    throw new Error(
      "Choose collect or student-fixture and provide the absolute recovery state.",
    );
  const state = realpathSync(options["--state"]);
  const manifest = JSON.parse(
    readFileSync(join(state, "manifest.json"), "utf8"),
  );
  if (
    manifest.project !== PROJECT ||
    manifest.target !== "combined-recovery" ||
    manifest.origin !== "http://localhost:3355" ||
    manifest.paidModelCallsAuthorized !== false ||
    !/^[a-f0-9]{40}$/.test(manifest.sourceSha ?? "")
  )
    throw new Error(
      "Only this provider-disabled recovery target may be collected.",
    );
  const secrets = readFileSync(join(state, ".env.acceptance"), "utf8")
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]*(?:SECRET|PASSWORD|KEY)=/.test(line))
    .map((line) =>
      line.slice(line.indexOf("=") + 1).replace(/^["']|["']$/g, ""),
    )
    .filter((value) => value.length >= 10);
  if (secrets.length < 3)
    throw new Error(
      "Generated credentials could not be loaded for a private leakage scan.",
    );
  const release = acquireLock({
    project: PROJECT,
    state,
    sourceSha: manifest.sourceSha,
    mode: `evidence-${mode}`,
  });
  try {
    if (mode === "student-fixture") {
      if (!isAbsolute(options["--stdout"] ?? ""))
        throw new Error(
          "Pass an absolute path to the successful saved fixture stdout/log.",
        );
      const stdout = readFileSync(options["--stdout"], "utf8");
      assertPublicText(stdout, secrets, "student fixture stdout");
      const fixture = extractStudentFixture(stdout);
      const studentDirectory = join(state, "browser-student");
      const prior = JSON.parse(
        readFileSync(
          join(studentDirectory, "student-browser-report.json"),
          "utf8",
        ),
      );
      if (
        prior.source_sha !== manifest.sourceSha ||
        prior.base !== manifest.origin
      )
        throw new Error(
          "Prior student report is for another source or origin.",
        );
      const path = join(studentDirectory, "accepted-result-fixture.json");
      const bytes = Buffer.from(`${JSON.stringify(fixture, null, 2)}\n`);
      assertPublicText(
        bytes.toString("utf8"),
        secrets,
        "accepted-result fixture",
      );
      writeFileSync(path, bytes, { flag: "wx", flush: true });
      writeFileSync(
        join(state, "student-fixture-extraction.json"),
        `${JSON.stringify({ sourceSha: manifest.sourceSha, project: PROJECT, stdoutSha256: digest(stdout), fixtureSha256: digest(bytes), transformation: "Extracted one JSON fixture; all parsed values preserved", recordedAt: new Date().toISOString() }, null, 2)}\n`,
        { flag: "wx", flush: true },
      );
      console.log(
        "Extracted the synthetic result fixture without changing its source log.",
      );
      return;
    }
    if (
      !isAbsolute(options["--composition"] ?? "") ||
      basename(options["--composition"]) !== "resume-composition.json"
    )
      throw new Error(
        "Pass the absolute resume-composition.json provenance file.",
      );
    const compositionBytes = readFileSync(options["--composition"]);
    if (
      JSON.parse(compositionBytes.toString("utf8")).sourceSha !==
      manifest.sourceSha
    )
      throw new Error(
        "Resumed composition does not match the initialized source.",
      );
    const destination = join(
      import.meta.dirname,
      "evidence",
      "recovery-resumed",
    );
    if (existsSync(destination))
      throw new Error(
        "Recovery-resumed evidence already exists; no prior collection will be overwritten.",
      );
    const files = [
      { path: "resume-composition.json", bytes: compositionBytes },
    ];
    function visit(directory, depth = 0) {
      if (depth > 4) return;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const path = join(directory, entry.name);
        const name = relative(state, path).split(sep).join("/");
        if (forbidden.test(name)) continue;
        if (entry.isDirectory()) {
          if (
            depth === 0 &&
            entry.name !== "runs" &&
            entry.name !== "executed-harness-sources" &&
            !entry.name.startsWith("browser-")
          )
            continue;
          if (
            depth === 2 &&
            name.startsWith("runs/") &&
            entry.name !== "artifacts"
          )
            continue;
          visit(path, depth + 1);
        } else if (entry.isFile() && permittedEvidence(name))
          files.push({ path: name, bytes: readFileSync(path) });
      }
    }
    visit(state);
    if (
      !files.some((file) => file.path === "manifest.json") ||
      !files.some((file) =>
        /^runs\/.+\/(?:results|wrapper-results)\.json$/.test(file.path),
      )
    )
      throw new Error(
        "No manifest/runtime receipts were found; refusing an empty acceptance collection.",
      );
    // Validate the entire snapshot before creating any public destination.
    // Private originals are never rewritten. Raw authentication traces are
    // replaced in this publication list by distinctly named derivatives only.
    const redactions = [];
    for (const file of files) {
      if (!file.path.endsWith(".png")) {
        let text = file.bytes.toString("utf8");
        if (secrets.some((secret) => text.includes(secret)))
          throw new Error(
            `Generated secret detected in ${file.path}; collection stopped without printing its value.`,
          );
        if (file.path.endsWith(".log") && hasUnredactedAuthTrace(text)) {
          const originalPath = file.path;
          const sourceSha256 = digest(file.bytes);
          text = redactAuthTrace(text);
          file.path = file.path.replace(/\.log$/, ".redacted.log");
          file.bytes = Buffer.from(text);
          file.derivative = {
            originalPath,
            sourceSha256,
            outputSha256: digest(file.bytes),
            transformation:
              "Authentication header/cookie/token values redacted from diagnostic trace",
            originalPrivateFilePreserved: true,
          };
          redactions.push({ path: file.path, ...file.derivative });
        }
        assertPublicText(text, secrets, file.path);
        if (file.path.endsWith(".json")) JSON.parse(text);
      }
    }
    if (new Set(files.map((file) => file.path)).size !== files.length)
      throw new Error(
        "Derivative destination conflicts with another evidence file; nothing copied.",
      );
    const inventory = {
      schemaVersion: 1,
      collectedAt: new Date().toISOString(),
      project: PROJECT,
      sourceSha: manifest.sourceSha,
      category:
        "Resumed fictional acceptance artifacts; collection does not infer acceptance outcome",
      copiedValuesAndBytesUnchanged: redactions.length === 0,
      originalPrivateArtifactsPreserved: true,
      redactedDerivatives: redactions,
      exclusions: [
        "environment and compose configuration",
        "storage states, cookies, browser profiles and endpoints",
        "credentials",
        "unallowlisted files",
      ],
      artifacts: files
        .map(({ path, bytes, derivative }) => ({
          path,
          bytes: bytes.length,
          sha256: digest(bytes),
          ...(derivative
            ? { derivative }
            : { transformation: "none; exact source bytes" }),
        }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    };
    const inventoryText = `${JSON.stringify(inventory, null, 2)}\n`;
    assertPublicText(inventoryText, secrets, "inventory");
    mkdirSync(destination);
    for (const file of files) {
      const path = join(destination, file.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.bytes, { flag: "wx", flush: true });
    }
    writeFileSync(join(destination, "inventory.json"), inventoryText, {
      flag: "wx",
      flush: true,
    });
    console.log(
      JSON.stringify({
        files: files.length,
        bytes: files.reduce((sum, file) => sum + file.bytes.length, 0),
        destination,
      }),
    );
  } finally {
    release();
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
