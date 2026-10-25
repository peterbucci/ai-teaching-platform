import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { acquireLock, preflight, MIN_BUILD_GIB } from "./safety.mjs";

const [sourceArg, sha, outArg, ...checks] = process.argv.slice(2);
const source = resolve(sourceArg),
  out = resolve(outArg);
assert.match(sha, /^[a-f0-9]{40}$/);
assert.ok(
  checks.length &&
    checks.every((name) =>
      [
        "test",
        "lint",
        "typecheck",
        "format:check",
        "build",
        "content:check",
      ].includes(name),
    ),
);
const head = spawnSync("git", ["-C", source, "rev-parse", "HEAD"], {
  encoding: "utf8",
  windowsHide: true,
});
assert.equal(head.status, 0);
assert.equal(head.stdout.trim(), sha);
const dirty = spawnSync(
  "git",
  [
    "-C",
    source,
    "diff",
    "--name-only",
    "HEAD",
    "--",
    "app",
    "lib",
    "package.json",
    "package-lock.json",
  ],
  { encoding: "utf8", windowsHide: true },
);
assert.equal(dirty.status, 0);
assert.equal(dirty.stdout.trim(), "");
mkdirSync(out, { recursive: true });
const report = {
  source,
  sourceSha: sha,
  category: "Pinned native quality checks; no database or Docker acceptance",
  checks: [],
  status: "running",
  startedAt: new Date().toISOString(),
};
const save = () =>
  writeFileSync(
    join(out, "results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
let release;
try {
  release = acquireLock({
    project: "v22-intervention",
    mode: "native-quality",
    source,
    sourceSha: sha,
    output: out,
  });
  for (const check of checks) {
    const gate = preflight({
      source,
      state: out,
      minimumGiB: MIN_BUILD_GIB,
      dockerRequired: false,
    });
    report.checks.push({ name: "preflight:" + check, ...gate });
    save();
    assert.equal(gate.pass, true);
    const result = spawnSync(
      process.execPath,
      ["C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js", "run", check],
      {
        cwd: source,
        encoding: "utf8",
        timeout: 600000,
        maxBuffer: 16000000,
        windowsHide: true,
        env: {
          ...process.env,
          OPENAI_API_KEY: "",
          OPENAI_MODEL: "",
          NEXT_TELEMETRY_DISABLED: "1",
        },
      },
    );
    writeFileSync(
      join(out, check.replaceAll(":", "-") + ".log"),
      (result.stdout || "") + (result.stderr || ""),
    );
    report.checks.push({
      name: check,
      exitCode: result.status,
      error: result.error?.message ?? null,
    });
    save();
    assert.equal(result.status, 0, check + " failed; see retained log");
  }
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = String(error);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  save();
  if (release) release();
}
console.log(
  JSON.stringify({ status: report.status, report: join(out, "results.json") }),
);
