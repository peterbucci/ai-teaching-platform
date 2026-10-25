import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { getPool } from "../../../../../../lib/db.ts";
import { DEMO_IDS } from "../../../../../../lib/evidence/demo.ts";

const baseSha = "d486fc029941567f81257d7b8717b1cb3dab09d4";
assert.equal(process.env.PGDATABASE, "lp_s3_review_01a1749b");
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3413");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const files = git("ls-files", "app", "lib")
  .split(/\r?\n/)
  .filter(
    (file) => /\.(ts|tsx|css)$/.test(file) && !file.includes("/verification/"),
  );
const manifest = files.map((file) => ({
  file,
  sha256: sha(fs.readFileSync(file)),
}));
const changed = git("diff", "--name-only", baseSha, "--", "app", "lib")
  .split(/\r?\n/)
  .filter(Boolean);
assert.ok(
  changed.every(
    (file) =>
      file.startsWith("app/study/notebook/reviews/") ||
      [
        "app/study/interventions/[approvalId]/page.tsx",
        "app/study/interventions/[approvalId]/not-found.tsx",
      ].includes(file),
  ),
);
const owners = files
  .filter((file) => !changed.includes(file))
  .map((file) => {
    const original = execFileSync("git", ["show", `${baseSha}:${file}`]);
    const current = fs.readFileSync(file);
    assert.equal(
      sha(current),
      sha(original),
      file + " owner content unchanged",
    );
    return { file, sha256: sha(current) };
  });
assert.equal(
  fs
    .readFileSync("app/study/interventions/[approvalId]/page.tsx", "utf8")
    .match(/<DeliveredActivity\b/g)?.length,
  1,
);
const pool = getPool();
const fixture = JSON.parse(
  fs.readFileSync(
    "acceptance/notebook/evidence/r03-fresh-check-1792955650134/r03-fresh-check.json",
    "utf8",
  ),
);
async function fingerprint() {
  const a = await pool.query(
    "SELECT to_jsonb(t) AS row FROM teacher_intervention_approvals t WHERE id=$1",
    [fixture.identities.approvalId],
  );
  const b = await pool.query(
    "SELECT to_jsonb(t) AS row FROM attempts t WHERE id=$1",
    [fixture.accepted.attemptId],
  );
  const c = await pool.query(
    "SELECT to_jsonb(t) AS row FROM evaluations t WHERE attempt_id=$1 ORDER BY id",
    [fixture.accepted.attemptId],
  );
  return sha(JSON.stringify([a.rows, b.rows, c.rows]));
}
const before = await fingerprint();
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true });
try {
  const student = await browser.newContext(),
    teacher = await browser.newContext();
  for (const [context, kind] of [
    [student, "STUDENT_ONE"],
    [teacher, "TEACHER"],
  ]) {
    const login = await context.request.post(
      process.env.AUTH_URL + "/api/auth/sign-in/email",
      {
        headers: { Origin: process.env.AUTH_URL },
        data: {
          email: process.env[`DEMO_${kind}_EMAIL`],
          password: process.env[`DEMO_${kind}_PASSWORD`],
        },
      },
    );
    assert.equal(login.status(), 200);
  }
  const activity = await (
    await student.request.get(
      process.env.AUTH_URL +
        "/api/student/interventions/" +
        fixture.identities.approvalId,
    )
  ).json();
  assert.deepEqual(activity.content_ref, fixture.identities.contentRef);
  const saved = await (
    await student.request.get(
      process.env.AUTH_URL +
        "/api/student/interventions/" +
        fixture.identities.approvalId +
        "/followup",
    )
  ).json();
  assert.equal(saved.response_text, fixture.accepted.responseText);
  assert.equal(saved.evaluation_id, fixture.accepted.evaluationId);
  const comparison = await (
    await teacher.request.get(
      process.env.AUTH_URL +
        "/api/teacher/interventions/" +
        fixture.identities.draftId +
        "/followup",
    )
  ).json();
  const recipient = comparison.recipients.find(
    (row) => row.student_id === DEMO_IDS.studentOne,
  );
  assert.equal(recipient.evaluation.id, saved.evaluation_id);
  assert.equal(recipient.attempt.id, saved.attempt_id);
  assert.equal(recipient.followup.response_text, saved.response_text);
  assert.deepEqual(recipient.followup.results, saved.results);
  const after = await fingerprint();
  assert.equal(after, before);
  const report = {
    source: git("rev-parse", "HEAD"),
    base: baseSha,
    buildId: fs.readFileSync(".next/BUILD_ID", "utf8").trim(),
    modelProvidersDisabled: true,
    paidCalls: 0,
    applicationManifestSha256: sha(JSON.stringify(manifest)),
    manifest,
    unchangedOwnerFileCount: owners.length,
    unchangedOwnerManifestSha256: sha(JSON.stringify(owners)),
    changedApplicationFiles: changed,
    controllerInstancesInRoute: 1,
    originalAcceptedEvidenceFingerprint: before,
    acceptedEvaluation: saved.evaluation_id,
    checks: [
      "every unowned runtime source file matches pinned N7",
      "one keyed DeliveredActivity; existing activity view, evaluator, receipt and recovery source unchanged",
      "student and teacher read the same accepted evaluation, original response and results",
      "exact assigned uploaded source version remains unchanged",
      "original approval, attempt and all linked evaluations unchanged across reads",
    ],
  };
  fs.writeFileSync(
    path.resolve("app/study/notebook/reviews/verification/s3/INTEGRITY.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    "PASS final source, single-controller, pinned-version and accepted-evidence integrity",
  );
} finally {
  await browser.close();
  await pool.end();
}
