import assert from "node:assert/strict";
import { resolve } from "node:path";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import test from "node:test";
import {
  browserArguments,
  browserHarnessDirectories,
  requireAbsentBrowserOutput,
} from "./browser-run.mjs";

const scope = {
  state: resolve("state"),
  output: resolve("state/new-output"),
  sourceSha: "a".repeat(40),
  origin: "http://localhost:3355",
};
test("positional browser invocation pins output, origin and SHA", () => {
  assert.deepEqual(
    browserArguments(
      "teacher-browser.mjs",
      ["{origin}", "{out}", "{sha}"],
      scope,
    ),
    [scope.origin, scope.output, scope.sourceSha],
  );
  assert.throws(
    () =>
      browserArguments(
        "teacher-browser.mjs",
        ["http://localhost:3325", "{out}", "{sha}"],
        scope,
      ),
    /Pass \{origin\}/,
  );
  assert.throws(
    () =>
      browserArguments(
        "workbench-browser.mjs",
        ["{origin}", resolve("old-output"), "{sha}"],
        scope,
      ),
    /Pass \{origin\}/,
  );
});
test("state-based browser invocation cannot point to an incident environment", () => {
  assert.deepEqual(
    browserArguments(
      "resume-assignments-browser.mjs",
      ["{state}", "{out}", "playwright"],
      scope,
    ),
    [scope.state, scope.output, "playwright"],
  );
  assert.throws(
    () =>
      browserArguments(
        "resume-authoring-browser.mjs",
        [resolve("incident"), "endpoint", "playwright"],
        scope,
      ),
    /exact recovery state/,
  );
  assert.throws(
    () =>
      browserArguments(
        "resume-assignments-browser.mjs",
        ["{state}", resolve("old-output"), "playwright"],
        scope,
      ),
    /new guarded output/,
  );
});
test("only explicit browser harnesses and their known arguments are permitted", () => {
  assert.deepEqual(
    browserArguments("resume-student-result-browser.mjs", [], scope),
    [],
  );
  assert.throws(() => browserArguments("runner.mjs", [], scope), /allowlist/);
  assert.throws(
    () =>
      browserArguments(
        "resume-student-browser.mjs",
        ["--eval", "arbitrary"],
        scope,
      ),
    /environment configuration/,
  );
});

test("guard leaves output absent for harnesses that create their own folder", () => {
  const prefix = resolve(import.meta.dirname, ".browser-wrapper-test-");
  const temporary = mkdtempSync(prefix);
  try {
    const output = resolve(temporary, "child-output");
    requireAbsentBrowserOutput(output);
    assert.equal(existsSync(output), false);
    // The existing authoring/assignments harnesses make this same assertion.
    assert.equal(
      existsSync(output),
      false,
      "child receives a fresh absent path",
    );
    mkdirSync(output);
    assert.throws(() => requireAbsentBrowserOutput(output), /already exists/);
  } finally {
    assert.ok(temporary.startsWith(prefix));
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("followup journey requires all three explicit UUID identities", () => {
  const id = "11111111-2222-4333-8444-555555555555";
  const args = ["{origin}", "{out}", "{sha}", id, id, id];
  assert.equal(
    browserArguments("resume-followup-browser.mjs", args, scope).length,
    6,
  );
  assert.throws(
    () =>
      browserArguments("resume-followup-browser.mjs", args.slice(0, 3), scope),
    /exactly three/,
  );
  assert.throws(
    () =>
      browserArguments(
        "resume-followup-browser.mjs",
        [...args.slice(0, 5), "unknown"],
        scope,
      ),
    /exactly three/,
  );
});

test("application-only source snapshots do not need an acceptance directory", () => {
  const prefix = resolve(import.meta.dirname, ".browser-source-test-");
  const temporary = mkdtempSync(prefix);
  try {
    const initial = browserHarnessDirectories(temporary);
    assert.equal(initial.length, 1);
    assert.equal(initial[0], import.meta.dirname);
    mkdirSync(resolve(temporary, "acceptance"));
    const withHarness = browserHarnessDirectories(temporary);
    assert.equal(withHarness.length, 2);
    assert.equal(withHarness[1], resolve(temporary, "acceptance"));
  } finally {
    assert.ok(temporary.startsWith(prefix));
    rmSync(temporary, { recursive: true, force: true });
  }
});
