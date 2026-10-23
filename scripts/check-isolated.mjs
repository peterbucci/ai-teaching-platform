import { spawnSync } from "node:child_process";

// CI's HTTP suites need separate application lifetimes: Better Auth keeps its
// instance-wide login limiter in memory. Preserve PostgreSQL and container files
// so the evidence/session restart checks still exercise durable state.
const check = process.argv.slice(2);
if (!check.length) throw new Error("Pass the docker compose exec arguments.");

for (const args of [
  ["restart", "app"],
  [
    "up",
    "--wait",
    "--wait-timeout",
    "180",
    "--no-build",
    "--no-recreate",
    "app",
  ],
  ["exec", "-T", ...check],
]) {
  const result = spawnSync("docker", ["compose", ...args], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
