import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

// Node 22 interprets --test paths as globs even when spawn bypasses a shell.
// Keep Next.js [dynamic] route segments in cwd, never in the test argv path.
export function focusedTestInvocation(source, file) {
  const name = basename(file);
  if (!/^[a-z0-9_.-]+\.test\.ts$/i.test(name))
    throw new Error(
      "Focused test filename contains unsupported pattern characters.",
    );
  const relativePath = relative(source, file).replaceAll("\\", "/");
  if (!relativePath.startsWith("app/") || relativePath.includes("../"))
    throw new Error(
      "Focused test must be inside the pinned source app directory.",
    );
  return {
    name: `focused-authoring:${relativePath}`,
    file: relativePath,
    sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
    cwd: dirname(file),
    argv: [
      "--experimental-strip-types",
      "--conditions=react-server",
      "--test-reporter=tap",
      "--test",
      name,
    ],
  };
}

export function discoverFocusedTests(source) {
  const visit = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? visit(path)
        : entry.isFile() && entry.name.endsWith(".test.ts")
          ? [path]
          : [];
    });
  return visit(join(source, "app"))
    .sort()
    .map((file) => focusedTestInvocation(source, file));
}

export function focusedTestCounts(stdout) {
  const count = (label) => {
    const matches = [
      ...String(stdout ?? "").matchAll(
        new RegExp(`^# ${label} (\\d+)\\r?$`, "gm"),
      ),
    ];
    return matches.length === 1 ? Number(matches[0][1]) : null;
  };
  const counts = {
    tests: count("tests"),
    passed: count("pass"),
    failed: count("fail"),
    cancelled: count("cancelled"),
    skipped: count("skipped"),
  };
  return {
    ...counts,
    verified:
      Object.values(counts).every(Number.isSafeInteger) &&
      counts.tests > 0 &&
      counts.passed === counts.tests &&
      counts.failed === 0 &&
      counts.cancelled === 0 &&
      counts.skipped === 0,
  };
}
