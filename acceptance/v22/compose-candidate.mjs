import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
const [repo, destination, receipt] = process.argv.slice(2);
if (![repo, destination, receipt].every((p) => p && isAbsolute(p)))
  throw new Error(
    "Pass absolute repository, NEW worktree and NEW receipt paths.",
  );
if (existsSync(destination) || existsSync(receipt))
  throw new Error("Destination and receipt must be new.");
const pins = JSON.parse(
  readFileSync(new URL("./baselines.json", import.meta.url), "utf8"),
);
const byTarget = new Map(pins.baselines.map((p) => [p.target, p]));
function git(cwd, ...args) {
  const r = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.error) throw r.error;
  return r;
}
for (const p of pins.baselines) {
  if (git(repo, "cat-file", "-e", p.sha + "^{commit}").status !== 0)
    throw new Error(
      "Missing pinned commit " +
        p.sha +
        "; fetch it explicitly before retrying.",
    );
}
const branch = "codex/verification-combined-" + Date.now();
const added = git(
  repo,
  "worktree",
  "add",
  "-b",
  branch,
  resolve(destination),
  byTarget.get("main").sha,
);
if (added.status !== 0) throw new Error(added.stderr);
const result = {
  createdAt: new Date().toISOString(),
  branch,
  worktree: resolve(destination),
  base: byTarget.get("main").sha,
  merges: [],
  status: "in-progress",
};
for (const target of pins.combination.mergeOrder) {
  const sha = byTarget.get(target).sha;
  const r = git(destination, "merge", "--no-ff", "--no-edit", sha);
  const entry = {
    pr: target,
    sha,
    exitCode: r.status,
    output: r.stdout + r.stderr,
  };
  result.merges.push(entry);
  if (r.status !== 0) {
    result.status = "conflict-or-merge-failure";
    result.conflictedFiles = git(
      destination,
      "diff",
      "--name-only",
      "--diff-filter=U",
    )
      .stdout.trim()
      .split("\n")
      .filter(Boolean);
    writeFileSync(receipt, JSON.stringify(result, null, 2) + "\n");
    throw new Error(
      "Stopped without resolving or discarding conflicts. Inspect receipt and isolated worktree.",
    );
  }
}
result.commit = git(destination, "rev-parse", "HEAD").stdout.trim();
result.tree = git(destination, "rev-parse", "HEAD^{tree}").stdout.trim();
result.expectedTree = pins.combination.tree;
result.status =
  result.tree === result.expectedTree ? "same-pinned-content" : "tree-mismatch";
writeFileSync(receipt, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (result.status !== "same-pinned-content") process.exitCode = 1;
