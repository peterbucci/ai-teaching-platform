// Verification only: one allowlisted offline command per invocation.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url));
const source = "C:/Users/sb128/.codex/worktrees/workbench-final-verification/LearningPlatform";
const sourceSha = "462cfb1b31d9108cec70d18b6553bd45048d2eed";
const sourceTree = "03cca1fed3900a122e689c4a512afadd9052e5af";
const mode = process.argv[2];
const launcher = "C:/Users/sb128/.codex/worktrees/workbench-verification-report/LearningPlatform/acceptance/v22/authoring-tests.mjs";
const commands = {
  unit: [process.execPath, "--experimental-strip-types", "--conditions=react-server", "--test", "tests/*.test.ts"],
  "authoring-all": [process.execPath, "--experimental-strip-types", "--conditions=react-server", "--test", launcher],
  lint: [process.execPath, "node_modules/eslint/bin/eslint.js", ".", "--max-warnings=0"],
  typegen: [process.execPath, "node_modules/next/dist/bin/next", "typegen"],
  typecheck: [process.execPath, "node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false"],
  format: [process.execPath, "node_modules/prettier/bin/prettier.cjs", "--check", "."],
  content: ["C:/Python313/python.exe", "content/network-performance-v1/verify_package.py"],
};
assert.ok(Object.hasOwn(commands, mode));
const hash = value => createHash("sha256").update(value).digest("hex");
function git(...args) {
  const r = spawnSync("git", ["-C", source, ...args], { encoding: "utf8", windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function identity() {
  assert.equal(git("rev-parse", "HEAD"), sourceSha);
  assert.equal(git("rev-parse", "HEAD^{tree}"), sourceTree);
  assert.equal(git("status", "--porcelain=v1", "--untracked-files=all"), "", "Pinned source must stay clean.");
}
identity();
const log = join(root, `final-${mode}.log`);
const receiptPath = join(root, `final-${mode}-receipt.json`);
assert.equal(existsSync(log) || existsSync(receiptPath), false, "Retain earlier evidence; choose new paths.");
const [command, ...args] = commands[mode];
const startedAt = new Date().toISOString();
const result = spawnSync(command, args, {
  cwd: source, encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024,
  env: { ...process.env, OPENAI_API_KEY: "", OPENAI_MODEL: "" },
});
writeFileSync(log, (result.stdout ?? "") + (result.stderr ?? ""), { flag: "wx" });
let identityAfter = true;
let identityError;
try { identity(); } catch (error) { identityAfter = false; identityError = error.message; }
const receipt = {
  source, sourceSha, sourceTree, mode, command: [command, ...args], startedAt,
  finishedAt: new Date().toISOString(), exitCode: result.status,
  error: result.error?.message, sourceCleanBefore: true, sourceCleanAfter: identityAfter,
  identityError, log, logSha256: hash(readFileSync(log)),
  harnessSha256: hash(readFileSync(new URL(import.meta.url))),
  launcherSha256: mode === "authoring-all" ? hash(readFileSync(launcher)) : undefined,
  packageLockSha256: hash(readFileSync(join(source, "package-lock.json"))),
  scope: "Offline command only; existing dependency junction; no build, browser, Docker or database command.",
};
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(receipt, null, 2));
console.log((result.stdout ?? "").split(/\r?\n/).slice(-15).join("\n"));
if (result.error || result.status !== 0 || !identityAfter) process.exitCode = 1;
