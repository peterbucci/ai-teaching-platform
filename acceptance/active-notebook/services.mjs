/** Sequential database/HTTP regressions; never invokes --live or a provider. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import { assertIsolated, pool } from "./fixtures.mjs";
assertIsolated();
await pool.end();
assert.equal(process.env.DIALOGUE_CHECK_SYNTHETIC, "1");
const out = path.join(
  "acceptance/active-notebook/evidence",
  `services-${Date.now()}`,
);
fs.mkdirSync(out, { recursive: true });
const source = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  windowsHide: true,
}).trim();
const fingerprint = () =>
  createHash("sha256")
    .update(
      execFileSync("git", ["diff", "HEAD", "--", "app", "lib", "scripts"], {
        windowsHide: true,
      }),
    )
    .digest("hex");
const report = {
  source,
  diffSha256: fingerprint(),
  runtime: process.env.S1_RUNTIME || "development",
  buildId:
    process.env.S1_RUNTIME === "production"
      ? fs.readFileSync(".next/BUILD_ID", "utf8").trim()
      : null,
  providersDisabled: true,
  paidCalls: 0,
  checks: [],
};
const scrub = (s) =>
  String(s).replace(
    /better-auth\.[^=\s]+=[^\s]+/gi,
    "[redacted session cookie]",
  );
for (const [name, file, args] of [
  ["tutor", "check-tutoring.ts", ["--output", path.join(out, "tutor.json")]],
  ["reading", "check-reading.ts", []],
  ["dialogue", "check-dialogue.ts", []],
  ["dialogue-recovery", "check-dialogue-recovery.ts", []],
  ["r7-controller", "check-r7-controller.ts", []],
]) {
  const started = new Date().toISOString();
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--conditions=react-server",
      "scripts/" + file,
      ...args,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
      timeout: 180000,
    },
  );
  fs.writeFileSync(
    path.join(out, name + ".txt"),
    scrub(child.stdout || "") + "\n" + scrub(child.stderr || ""),
  );
  report.checks.push({
    name,
    script: file,
    arguments: args,
    status: child.status === 0 ? "PASS" : "FAIL",
    exitCode: child.status,
    started,
    finished: new Date().toISOString(),
    error: child.error?.message,
  });
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(name + ": " + report.checks.at(-1).status);
}
report.diffAfterSha256 = fingerprint();
report.sourceUnchanged = report.diffAfterSha256 === report.diffSha256;
report.result =
  report.checks.every((x) => x.status === "PASS") && report.sourceUnchanged
    ? "PASS"
    : "FAIL";
fs.writeFileSync(
  path.join(out, "report.json"),
  JSON.stringify(report, null, 2),
);
if (report.result !== "PASS") process.exitCode = 1;
console.log(
  JSON.stringify({ out, result: report.result, checks: report.checks }),
);
