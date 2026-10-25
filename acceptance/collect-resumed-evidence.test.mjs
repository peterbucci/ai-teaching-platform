import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPublicText,
  extractStudentFixture,
  permittedEvidence,
} from "./collect-resumed-evidence.mjs";

test("collector allows receipt/browser evidence and rejects private browser/config files", () => {
  for (const path of [
    "manifest.json",
    "runs/new/results.json",
    "runs/final-health/results.json",
    "runs/new/02-db.log",
    "runs/new/artifacts/student-browser-report.json",
    "browser-authoring/01-page.png",
    "browser-student/page.txt",
    "browser-followup/approved-delivery-before.json",
    "browser-followup/student-public-activity.json",
    "browser-followup/student-saved-followup.json",
    "browser-followup/teacher-comparison.json",
    "browser-teacher/synthetic-session.json",
    "executed-harness-sources/resume-workbench-browser.mjs",
    "executed-harness-sources/browser-readiness.mjs",
  ])
    assert.equal(permittedEvidence(path), true, path);
  for (const path of [
    ".env.acceptance",
    "compose.json",
    "browser-student/storage-student.json",
    "runs/new/artifacts/cookies.txt",
    "runs/new/artifacts/storage-state.png",
    "browser-accessibility/profile-x/Preferences",
    "browser-student/arbitrary.json",
    "executed-harness-sources/arbitrary.mjs",
    "executed-harness-sources/subdir/resume-workbench-browser.mjs",
  ])
    assert.equal(permittedEvidence(path), false, path);
});
test("private scan rejects known secrets and authentication state without echoing values", () => {
  const secret = "private-generated-value";
  assert.throws(
    () => assertPublicText(`prefix ${secret}`, [secret], "fixture.log"),
    (error) => !error.message.includes(secret),
  );
  assert.throws(
    () => assertPublicText('{"cookies": []}', [], "state.json"),
    /authentication material/,
  );
  assert.doesNotThrow(() =>
    assertPublicText('{"status":"pass"}', [secret], "report.json"),
  );
});
test("fixture extraction preserves nested JSON and refuses ambiguity/non-recovery output", () => {
  const fixture = {
    project: "lp-accept-recovery-01a1714f",
    fictional_only: true,
    actual_model_calls: 0,
    status: "completed",
    session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    attempt_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    evaluation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    response_text: 'braces { and "quotes" }',
    correctness: [{ score: 1 }],
  };
  const json = JSON.stringify(fixture, null, 2);
  assert.deepEqual(
    extractStudentFixture(`npm preamble\n${json}\nwarning after JSON`),
    fixture,
  );
  assert.throws(() => extractStudentFixture(`${json}\n${json}`), /exactly one/);
  assert.throws(
    () =>
      extractStudentFixture(
        json.replace("lp-accept-recovery-01a1714f", "lp-accept-combined"),
      ),
    /exactly one/,
  );
});
