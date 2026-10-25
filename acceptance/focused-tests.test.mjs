import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { discoverFocusedTests, focusedTestCounts } from "./focused-tests.mjs";

test("a dynamic route test runs from its literal parent instead of an expanded bracket path", () => {
  const prefix = resolve(import.meta.dirname, ".focused-test-");
  const source = mkdtempSync(prefix);
  try {
    const directory = join(source, "app", "lessons", "[lessonId]", "questions");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "question.test.ts"),
      "import test from 'node:test'; import assert from 'node:assert/strict'; test('literal dynamic route sentinel', () => assert.equal(2 + 2, 4));\n",
    );
    const plans = discoverFocusedTests(source);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].cwd, directory);
    assert.equal(plans[0].argv.at(-1), "question.test.ts");
    assert.equal(
      plans[0].argv.some((arg) => arg.includes("[lessonId]")),
      false,
    );
    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, plans[0].argv, {
      cwd: plans[0].cwd,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
      timeout: 20_000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /literal dynamic route sentinel/);
    assert.deepEqual(focusedTestCounts(result.stdout), {
      tests: 1,
      passed: 1,
      failed: 0,
      cancelled: 0,
      skipped: 0,
      verified: true,
    });
  } finally {
    assert.ok(source.startsWith(prefix));
    rmSync(source, { recursive: true, force: true });
  }
});

test("a zero-test or missing-test summary cannot complete a planned focused file", () => {
  assert.equal(
    focusedTestCounts(
      "# tests 0\n# pass 0\n# fail 0\n# cancelled 0\n# skipped 0\n",
    ).verified,
    false,
  );
  assert.equal(
    focusedTestCounts("Command exited successfully without a test summary")
      .verified,
    false,
  );
  assert.equal(
    focusedTestCounts(
      "# tests 2\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 1\n",
    ).verified,
    false,
  );
});
