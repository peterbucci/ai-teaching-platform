/** Provider-disabled browser continuation. See INTERVENTION_CONTINUATION.md.
 * Usage: <review-and-submit|inspect-followup> <state> <seam-json> <fresh-output> <playwright-package> <reviewed-safety.mjs>
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const [phase, stateArg, seamArg, outArg, playwrightArg, safetyArg] =
  process.argv.slice(2);
assert.ok(["review-and-submit", "inspect-followup"].includes(phase));
for (const value of [stateArg, seamArg, outArg, playwrightArg, safetyArg])
  assert.ok(value);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const state = resolve(stateArg),
  out = resolve(outArg);
assert.equal(
  existsSync(out),
  false,
  "Use a fresh output directory; earlier evidence is immutable.",
);
const manifest = JSON.parse(readFileSync(resolve(state, "manifest.json")));
const seamBytes = readFileSync(resolve(seamArg));
const seam = JSON.parse(seamBytes);
const preparation = phase === "review-and-submit" ? seam : seam.preparation;
const authoring = preparation.authoring;
assert.equal(manifest.sourceSha, "1a9d95b3be3e30d08d9dafc7ec6d1a14208368ac");
assert.equal(manifest.sourceTree, "c2f1c30b3f62391283ced9f798bbcae5cc7ca794");
assert.equal(manifest.project, "lp-v22-shell5");
assert.equal(manifest.origin, "http://localhost:3350");
assert.equal(manifest.paidModelCallsAuthorized, false);
assert.equal(seam.status, "completed");
assert.equal(seam.source_sha, manifest.sourceSha);
assert.equal(seam.source_tree, manifest.sourceTree);
assert.equal(seam.project, manifest.project);
assert.equal(seam.origin, manifest.origin);
assert.equal(
  authoring.functional_completed_through,
  "teacher-original-evidence",
);
assert.equal(authoring.student_id, "10000000-0000-4000-8000-000000000002");
const environment = Object.fromEntries(
  readFileSync(resolve(state, ".env.acceptance"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const split = line.indexOf("=");
      return [line.slice(0, split), line.slice(split + 1)];
    }),
);
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"])
  assert.equal(environment[key]?.trim() || "", "");
assert.equal(environment.AUTH_URL, manifest.origin);
assert.equal(
  hash(readFileSync(resolve(safetyArg))),
  "af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485",
);
const { acquireLock, preflight, MIN_RUNTIME_GIB } = await import(
  pathToFileURL(resolve(safetyArg)).href
);
assert.ok(
  process.env.BROWSER_EXECUTABLE,
  "Use an isolated installed browser executable.",
);
const { chromium } = createRequire(import.meta.url)(resolve(playwrightArg));
await mkdir(out, { recursive: false });
const report = {
  phase,
  status: "running",
  source_sha: manifest.sourceSha,
  source_tree: manifest.sourceTree,
  project: manifest.project,
  origin: manifest.origin,
  seam_sha256: hash(seamBytes),
  harness_sha256: hash(readFileSync(new URL(import.meta.url))),
  preparation,
  started_at: new Date().toISOString(),
  checks: [],
  screenshots: [],
  safety: [],
  blocked_off_origin_requests: [],
  paid_calls: 0,
  actual_model_verification: "unrun",
  screen_reader: "unrun",
  native_200_percent_zoom: "unrun",
  functional_completed_through: null,
};
let release,
  browser,
  teacher,
  student,
  stage = "guard";
const save = () =>
  writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
function guard(before) {
  const observation = preflight({
    source: manifest.source,
    state,
    minimumGiB: MIN_RUNTIME_GIB,
    explicitPath: manifest.dockerDataPath || undefined,
    probeContainer: manifest.storageProbeContainer || undefined,
  });
  report.safety.push({ before, ...observation });
  assert.equal(
    observation.pass,
    true,
    "Shared storage preflight failed; stop without cleanup or restart.",
  );
}
async function read(context, path, status = 200) {
  const response = await context.request.get(
    new URL(path, manifest.origin).href,
  );
  assert.equal(response.status(), status, path);
  return status === 200 ? response.json() : null;
}
async function action(page, path, expectedAction, click) {
  guard(expectedAction);
  const promise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === path &&
      response.request().method() === "POST" &&
      response.request().postDataJSON()?.action === expectedAction,
  );
  await click();
  const response = await promise;
  assert.equal(
    response.status(),
    200,
    expectedAction + ": " + (await response.text()),
  );
  const body = await response.json();
  report.checks.push({
    action: expectedAction,
    at: new Date().toISOString(),
    http_status: response.status(),
  });
  return body;
}
async function capture(page, name, allSizes = false) {
  const sizes = allSizes
    ? [
        [1440, 1000],
        [1024, 768],
        [390, 844],
        [320, 844],
      ]
    : [[1440, 1000]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    const file = name + "-" + width + "x" + height + ".png";
    await page.screenshot({ path: resolve(out, file), fullPage: false });
    report.screenshots.push({
      file,
      stage,
      width,
      height,
      url: page.url(),
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await save();
}
async function login(page, role) {
  guard("login-" + role);
  await page.goto(new URL("/login", manifest.origin).href);
  await page
    .getByRole("button", {
      name: role === "teacher" ? "Demo teacher" : "Demo student",
      exact: true,
    })
    .click();
  await page.waitForURL(
    role === "teacher" ? "**/teacher" : "**/study/assignments",
  );
}
function sameOriginal(comparison) {
  assert.equal(comparison.assignment_id, authoring.assignment_id);
  assert.deepEqual(comparison.content_ref, authoring.content_ref);
  const observed = comparison.original_evidence.observations.find(
    (value) => value.attempt.id === authoring.presented_attempt_id,
  );
  assert.ok(observed);
  assert.equal(observed.session_id, authoring.student_session_id);
  assert.equal(observed.student_id, authoring.student_id);
  assert.equal(observed.attempt.response_text, authoring.original_response);
  return comparison.recipients.find(
    (value) => value.student_id === authoring.student_id,
  );
}
async function showTeacherComparison() {
  await teacher.reload();
  await teacher
    .getByRole("heading", {
      name: "Before and after the activity",
      exact: true,
    })
    .waitFor();
  const recipient = teacher.locator("details.lp-followup-recipient");
  assert.equal(await recipient.count(), 1);
  await recipient.locator("summary").first().click();
  await recipient.locator("details.lp-followup-original > summary").click();
  const visible = await recipient.innerText();
  assert.ok(visible.includes(authoring.original_response.trim()));
  assert.ok(visible.includes(preparation.followup_response));
  return recipient;
}
try {
  release = acquireLock({
    mode: "browser-intervention-" + phase,
    source: manifest.source,
    state,
    project: manifest.project,
    sourceSha: manifest.sourceSha,
  });
  guard("browser-launch");
  browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE,
    headless: true,
  });
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    browser.newContext({ viewport: { width: 1440, height: 1000 } }),
  ]);
  for (const context of contexts)
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (
        url.origin === manifest.origin ||
        ["data:", "blob:"].includes(url.protocol)
      )
        await route.continue();
      else {
        report.blocked_off_origin_requests.push(url.href);
        await route.abort("blockedbyclient");
      }
    });
  [teacher, student] = await Promise.all(
    contexts.map((context) => context.newPage()),
  );
  for (const page of [teacher, student]) page.setDefaultTimeout(20000);
  await login(teacher, "teacher");
  await login(student, "student");
  const endpoint = "/api/teacher/interventions/" + preparation.draft_id;
  await teacher.goto(new URL(preparation.teacher_url, manifest.origin).href);
  let review = await read(contexts[0], endpoint);
  assert.deepEqual(review.draft.evidence.content_ref, authoring.content_ref);
  assert.equal(
    review.draft.evidence.observations.find(
      (value) => value.attempt.id === authoring.presented_attempt_id,
    )?.attempt.response_text,
    authoring.original_response,
  );
  if (phase === "review-and-submit") {
    assert.equal(
      review.approval,
      null,
      "Approval must happen through the browser in this phase.",
    );
    assert.equal(review.delivery, null);
    stage = "teacher-inspects-original-and-prepares-private-revision";
    const evidence = teacher.locator(
      "#evidence-" + authoring.presented_attempt_id + " details",
    );
    await evidence.locator("summary").click();
    assert.ok(
      (await evidence.innerText()).includes(authoring.original_response.trim()),
    );
    await teacher
      .getByRole("button", { name: "Edit activity", exact: true })
      .click();
    await teacher
      .getByLabel("Activity title", { exact: true })
      .fill("Water changes state and remains matter");
    review = await action(teacher, endpoint, "save", () =>
      teacher
        .getByRole("button", { name: "Save private revision", exact: true })
        .click(),
    );
    assert.equal(review.approval, null);
    await teacher
      .getByRole("button", { name: "Student preview", exact: true })
      .click();
    await teacher
      .getByRole("heading", {
        name: "Water changes state and remains matter",
        exact: true,
      })
      .waitFor();
    await capture(teacher, "01-private-student-preview");
    await teacher
      .getByRole("button", { name: "Teacher-only review", exact: true })
      .click();
    await teacher
      .getByText("Original AI generation provenance", { exact: true })
      .click();
    assert.ok(
      (await teacher.locator("body").innerText()).includes(
        "synthetic-same-browser-journey",
      ),
    );
    const boxes = teacher.locator(
      ".lp-intervention-recipients input[type=checkbox]",
    );
    for (let index = 0; index < (await boxes.count()); index++)
      await boxes.nth(index).uncheck();
    const selected = review.eligible_recipients.find(
      (value) => value.student_id === authoring.student_id,
    );
    assert.ok(selected);
    await teacher
      .locator(".lp-intervention-recipient")
      .filter({ hasText: selected.display_name })
      .getByRole("checkbox")
      .check();
    stage = "teacher-explicit-approval";
    review = await action(teacher, endpoint, "approve", () =>
      teacher
        .getByRole("button", { name: /^Approve revision \d+ for 1 student$/ })
        .click(),
    );
    assert.deepEqual(review.approval.recipient_ids, [authoring.student_id]);
    assert.equal(review.delivery, null);
    report.approval_id = review.approval.id;
    await read(
      contexts[1],
      "/api/student/interventions/" + report.approval_id,
      404,
    );
    await teacher
      .getByRole("heading", {
        name: "Ready for your delivery decision",
        exact: true,
      })
      .waitFor();
    await capture(teacher, "02-approved-still-private");
    stage = "teacher-explicit-delivery";
    const approval = review.approval;
    review = await action(teacher, endpoint, "deliver", () =>
      teacher
        .getByRole("button", {
          name: "Deliver approved activity to 1 students",
          exact: true,
        })
        .click(),
    );
    assert.deepEqual(review.approval, approval);
    assert.ok(review.delivery);
    report.delivery_id = review.delivery.id;
    await teacher
      .getByRole("heading", { name: "Delivery recorded", exact: true })
      .waitFor();
    await capture(teacher, "03-delivered");
    stage = "same-student-opens-assigned-review";
    await student.goto(new URL("/study/assignments", manifest.origin).href);
    const card = student.locator("article.lp-review-card").filter({
      has: student.getByRole("heading", {
        name: "Water changes state and remains matter",
        exact: true,
      }),
    });
    await card.getByRole("link", { name: "Open review", exact: true }).click();
    await student.waitForURL("**/study/interventions/" + report.approval_id);
    await student.locator(".lp-review-explanation").scrollIntoViewIfNeeded();
    const delivered = await read(
      contexts[1],
      "/api/student/interventions/" + report.approval_id,
    );
    assert.deepEqual(delivered.content_ref, authoring.content_ref);
    assert.ok(!JSON.stringify(delivered).includes('"rubric"'));
    assert.ok(!JSON.stringify(delivered).includes('"answer_guidance"'));
    await capture(student, "04-student-review", true);
    const followupEndpoint =
      "/api/student/interventions/" + report.approval_id + "/followup";
    const before = await read(contexts[1], followupEndpoint);
    assert.equal(before.started_at, null);
    await action(student, followupEndpoint, "start", () =>
      student
        .getByRole("button", { name: "Start fresh check", exact: true })
        .click(),
    );
    stage = "same-student-submits-followup";
    await student
      .locator("#intervention-response")
      .fill(preparation.followup_response);
    report.followup = await action(student, followupEndpoint, "submit", () =>
      student
        .getByRole("button", {
          name: "Submit fresh-check response",
          exact: true,
        })
        .click(),
    );
    assert.equal(report.followup.response_text, preparation.followup_response);
    assert.equal(
      report.followup.evaluation_status,
      "failed",
      "The blank provider must remain visibly distinct from an accepted evaluation.",
    );
    assert.ok(report.followup.submitted_at);
    await student
      .getByRole("heading", { name: "Evaluation failed", exact: true })
      .waitFor();
    await capture(student, "05-saved-followup-provider-disabled");
    stage = "teacher-inspects-linked-provider-disabled-followup";
    report.comparison = await read(contexts[0], endpoint + "/followup");
    const linked = sameOriginal(report.comparison);
    assert.equal(linked.followup.response_text, preparation.followup_response);
    assert.equal(linked.followup.evaluation_status, "failed");
    await showTeacherComparison();
    await capture(teacher, "06-teacher-linked-pending-evaluation");
    report.functional_completed_through =
      "teacher-inspected-provider-disabled-followup";
    report.next_step =
      "After the normal retry_after time, use the explicit evaluate-followup fixture seam; do not blindly retry pending/unknown outcomes.";
  } else {
    stage = "student-reloads-explicit-synthetic-evaluation";
    report.approval_id = seam.approval_id;
    assert.equal(review.approval.id, seam.approval_id);
    assert.ok(review.delivery);
    await student.goto(
      new URL("/study/interventions/" + seam.approval_id, manifest.origin).href,
    );
    await student
      .getByRole("heading", { name: "Evaluation accepted", exact: true })
      .waitFor();
    await student
      .getByText("Fixture evaluation for testing.", { exact: true })
      .waitFor();
    report.followup = await read(
      contexts[1],
      "/api/student/interventions/" + seam.approval_id + "/followup",
    );
    assert.equal(report.followup.response_text, preparation.followup_response);
    assert.equal(report.followup.evaluation_status, "accepted");
    assert.equal(report.followup.evaluation_provenance, "injected_fixture");
    await student
      .getByRole("heading", { name: "Saved response", exact: true })
      .scrollIntoViewIfNeeded();
    await capture(student, "07-student-accepted-fixture", true);
    stage = "teacher-inspects-original-and-accepted-linked-followup";
    report.comparison = await read(contexts[0], endpoint + "/followup");
    const linked = sameOriginal(report.comparison);
    assert.equal(linked.followup.response_text, preparation.followup_response);
    assert.equal(linked.followup.evaluation_status, "accepted");
    assert.equal(report.comparison.counts.intended, 1);
    assert.equal(report.comparison.counts.accepted, 1);
    await showTeacherComparison();
    assert.ok(
      (await teacher.locator(".lp-intervention-followup").innerText()).includes(
        "Fixture evaluation for testing",
      ),
    );
    await capture(teacher, "08-teacher-original-and-followup", true);
    report.functional_completed_through =
      "teacher-inspected-accepted-linked-followup-with-explicit-synthetic-seams";
    report.continuity =
      "Same source, immutable lesson version, assignment, student, original answer, approved intervention and linked follow-up across recorded browser stages. Synthetic evaluation/private-draft seams remain explicit; no actual-model claim.";
  }
  report.status = report.screenshots.some((value) => value.overflow)
    ? "failed-responsive"
    : "passed";
} catch (error) {
  report.status = "failed";
  report.failure_stage = stage;
  report.error = error.message;
  for (const [name, page] of [
    ["teacher", teacher],
    ["student", student],
  ])
    if (page) {
      try {
        await capture(page, "failure-" + name);
      } catch {
        /* Preserve the original error. */
      }
    }
  process.exitCode = 1;
} finally {
  report.finished_at = new Date().toISOString();
  await browser?.close();
  try {
    release?.();
  } catch (error) {
    report.status = "failed";
    report.lock_release_error = error.message;
    process.exitCode = 1;
  }
  await save();
  if (report.status !== "passed") process.exitCode = 1;
  console.log(
    JSON.stringify({
      phase,
      status: report.status,
      stage,
      report: resolve(out, "report.json"),
    }),
  );
}
