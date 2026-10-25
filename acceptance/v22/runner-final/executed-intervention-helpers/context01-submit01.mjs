/** Provider-disabled browser continuation. See INTERVENTION_CONTINUATION.md.
 * Usage: <review-and-submit|inspect-followup|context-checks|curated-activation> <state> <seam-json> <fresh-output> <playwright-package> <reviewed-safety.mjs>
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
assert.ok(
  [
    "review-and-submit",
    "inspect-followup",
    "context-checks",
    "curated-activation",
  ].includes(phase),
);
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
const directAuthoring =
  phase === "curated-activation" &&
  seam.functional_completed_through === "teacher-original-evidence";
const preparation = directAuthoring
  ? { authoring: seam }
  : phase === "inspect-followup"
    ? seam.preparation
    : seam;
const authoring = preparation.authoring;
assert.equal(manifest.sourceSha, "462cfb1b31d9108cec70d18b6553bd45048d2eed");
assert.equal(manifest.sourceTree, "03cca1fed3900a122e689c4a512afadd9052e5af");
assert.equal(manifest.project, "lp-v22-shell5");
assert.equal(manifest.origin, "http://localhost:3350");
assert.equal(manifest.paidModelCallsAuthorized, false);
if (directAuthoring) {
  assert.equal(
    hash(seamBytes),
    "7e99672e7cf7e6689d1bcc53d57a68f1a052eecd6b09ee77ea7a8d9de3970051",
    "This independent activation checkpoint accepts only the reviewed passed run05 receipt.",
  );
  assert.equal(seam.status, "passed");
  assert.equal(seam.sourceSha, manifest.sourceSha);
  assert.equal(seam.sourceTree, manifest.sourceTree);
  assert.equal(seam.paid_calls, 0);
} else {
  assert.equal(seam.status, "completed");
  assert.equal(seam.source_sha, manifest.sourceSha);
  assert.equal(seam.source_tree, manifest.sourceTree);
}
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
const { acquireLock, preflight, MIN_RUNTIME_GIB, LOCK_PATH } = await import(
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
  input_kind: directAuthoring
    ? "passed authoring receipt for separate curated activation; no completed intervention seam claimed"
    : "explicit synthetic preparation/evaluation receipt",
  harness_sha256: hash(readFileSync(new URL(import.meta.url))),
  preparation,
  started_at: new Date().toISOString(),
  checks: [],
  progress: [],
  mutations: [],
  screenshots: [],
  safety: [],
  blocked_off_origin_requests: [],
  blocked_context_writes: [],
  context_checks: [],
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
  contextReadOnly = false,
  mutationUncertain = false,
  browserCloseUncertain = false,
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
async function bounded(label, operation, observed = () => {}) {
  report.progress.push({
    label,
    status: "waiting",
    at: new Date().toISOString(),
  });
  await save();
  let timer;
  try {
    const result = await Promise.race([
      operation(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(label + " exceeded 20 seconds")),
          20_000,
        );
      }),
    ]);
    observed(result);
    report.progress.push({
      label,
      status: "completed",
      at: new Date().toISOString(),
    });
    await save();
    return result;
  } finally {
    clearTimeout(timer);
  }
}
async function read(context, path, status = 200) {
  const response = await bounded("GET " + path, () =>
    context.request.get(new URL(path, manifest.origin).href, {
      timeout: 20_000,
    }),
  );
  assert.equal(response.status(), status, path);
  return status === 200
    ? bounded("GET JSON " + path, () => response.json())
    : null;
}
async function action(
  page,
  path,
  expectedAction,
  click,
  matchesRequest = (request) =>
    request.postDataJSON()?.action === expectedAction,
) {
  guard(expectedAction);
  const intent = {
    action: expectedAction,
    path,
    status: "intent-recorded",
    at: new Date().toISOString(),
  };
  report.mutations.push(intent);
  await save();
  const promise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === path &&
      response.request().method() === "POST" &&
      matchesRequest(response.request()),
    { timeout: 20_000 },
  );
  // A rejected response wait may settle while click is pending. Its error is
  // still consumed below; suppress only an unhandled-promise notification.
  promise.catch(() => {});
  mutationUncertain = true;
  intent.status = "outcome-unestablished";
  await bounded("click " + expectedAction, click);
  const response = await bounded(
    "response headers " + expectedAction,
    () => promise,
  );
  intent.http_status = response.status();
  intent.request_identity_sha256 = hash(response.request().postData() || "");
  const text = await bounded(
    "response body " + expectedAction,
    () => response.text(),
    (body) => {
      // A fully received rejection is a known response, not transport uncertainty.
      // Latch this before any later receipt I/O, parsing or contract assertion.
      mutationUncertain = false;
      intent.status =
        response.status() === 200 ? "response-completed" : "rejected";
      intent.response_sha256 = hash(body);
      intent.completed_at = new Date().toISOString();
    },
  );
  await save();
  assert.equal(response.status(), 200, expectedAction + ": " + text);
  const body = JSON.parse(text);
  report.checks.push({
    action: expectedAction,
    at: new Date().toISOString(),
    http_status: response.status(),
  });
  await save();
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
    await bounded("fonts for " + name, () =>
      page.evaluate(() => document.fonts.ready),
    );
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
async function contextCase(id, run) {
  stage = id;
  try {
    report.context_checks.push({ id, status: "passed", ...(await run()) });
  } catch (error) {
    report.context_checks.push({
      id,
      status: "failed",
      error: error.message,
      url: teacher.url(),
    });
    try {
      await capture(teacher, id + "-failure");
    } catch {
      /* Keep the original finding. */
    }
  }
  await save();
}
async function checkSavedContext(context, endpoint, initialReview) {
  await contextCase("C3-saved-intervention-context", async () => {
    const saved = initialReview.draft.evidence;
    const selection = saved.selection;
    assert.equal(selection.assignment_id, authoring.assignment_id);
    assert.deepEqual(saved.content_ref, authoring.content_ref);
    const conflicting = new URL(preparation.teacher_url, manifest.origin);
    const raw = {
      concept: "acceptance-conflicting-concept",
      origin:
        selection.origin === "live_demo" ? "synthetic_fixture" : "live_demo",
      seedAttempt: "00000000-0000-4000-8000-0000000000c3",
    };
    assert.notEqual(raw.concept, selection.concept_id);
    assert.ok(!selection.attempt_ids.includes(raw.seedAttempt));
    conflicting.searchParams.set("assignment", selection.assignment_id);
    for (const [key, value] of Object.entries(raw))
      conflicting.searchParams.set(key, value);
    await teacher.goto(conflicting.href);
    await teacher
      .getByRole("heading", { name: "Interventions", exact: true, level: 1 })
      .waitFor();
    await teacher
      .getByRole("heading", { name: saved.concept.title, exact: true })
      .first()
      .waitFor();
    await teacher
      .locator("#evidence-" + authoring.presented_attempt_id)
      .waitFor();
    assert.equal(
      await teacher
        .locator('.lp-teacher-filters select[name="origin"]')
        .inputValue(),
      selection.origin,
    );
    const back = new URL(
      await teacher
        .getByRole("link", { name: "Back to your investigation", exact: true })
        .getAttribute("href"),
      manifest.origin,
    );
    assert.equal(back.searchParams.get("assignment"), selection.assignment_id);
    assert.equal(back.searchParams.get("concept"), selection.concept_id);
    assert.equal(back.searchParams.get("origin"), selection.origin);
    assert.deepEqual(
      back.searchParams.getAll("seedAttempt").sort(),
      [...selection.attempt_ids].sort(),
    );
    const observedLinks = [];
    for (const label of [
      "Assignment workspace",
      "Assignment workspace mobile",
    ]) {
      const navigation = teacher.getByRole("navigation", {
        name: label,
        exact: true,
        includeHidden: true,
      });
      const link = navigation.getByRole("link", {
        name: "Student work",
        exact: true,
        includeHidden: true,
      });
      assert.equal(await link.count(), 1);
      const href = new URL(await link.getAttribute("href"), manifest.origin);
      assert.equal(href.pathname, "/teacher/evidence");
      assert.equal(
        href.searchParams.get("assignment"),
        selection.assignment_id,
      );
      assert.equal(href.searchParams.get("concept"), selection.concept_id);
      assert.equal(href.searchParams.get("origin"), selection.origin);
      assert.equal(
        href.searchParams.get("misconception"),
        selection.misconception_id,
      );
      assert.deepEqual(
        href.searchParams.getAll("seedAttempt"),
        [],
        "Shared navigation deliberately clears starting-response selection.",
      );
      assert.equal(href.searchParams.get("draft"), null);
      observedLinks.push({ navigation: label, href: href.href });
    }
    await capture(teacher, "C3-saved-scope-conflicting-url");
    await teacher
      .getByRole("navigation", { name: "Assignment workspace", exact: true })
      .getByRole("link", { name: "Student work", exact: true })
      .click();
    await teacher
      .getByRole("heading", { name: "Evidence", exact: true, level: 1 })
      .waitFor();
    const used = new URL(teacher.url());
    assert.equal(used.searchParams.get("assignment"), selection.assignment_id);
    assert.equal(used.searchParams.get("concept"), selection.concept_id);
    assert.equal(used.searchParams.get("origin"), selection.origin);
    assert.equal(
      await teacher.locator('select[name="concept"]').inputValue(),
      selection.concept_id,
    );
    assert.equal(
      await teacher
        .locator('.lp-teacher-filters select[name="origin"]')
        .inputValue(),
      selection.origin,
    );
    assert.deepEqual(
      (await read(context, endpoint)).draft,
      initialReview.draft,
    );
    await capture(teacher, "C3-followed-saved-evidence-scope");
    return {
      expected_from: "authorized persisted draft API receipt",
      draft_id: initialReview.draft.id,
      persisted_selection: selection,
      content_ref: saved.content_ref,
      conflicting_url: conflicting.href,
      raw,
      observed_links: observedLinks,
      followed_url: used.href,
      draft_unchanged: true,
    };
  });
  await contextCase("C4-lesson-search-shell-evidence", async () => {
    const title = authoring.run_id;
    assert.equal(typeof title, "string");
    assert.ok(title.length > 0 && title.length <= 120);
    assert.ok(!authoring.original_response.includes(title));
    await teacher.goto(new URL("/teacher/lessons", manifest.origin).href);
    await teacher
      .getByRole("textbox", { name: "Find a lesson", exact: true })
      .fill(title);
    await teacher.getByRole("button", { name: "Search", exact: true }).click();
    await teacher.waitForURL(
      (url) =>
        url.pathname === "/teacher/lessons" &&
        url.searchParams.get("q") === title,
    );
    await teacher
      .locator('.la-lesson-name[href*="' + authoring.lesson_id + '"]')
      .waitFor();
    assert.equal(
      await teacher.locator(".tw-shell").getAttribute("data-scope"),
      "course",
    );
    const links = await teacher
      .locator(
        ".tw-course-nav a, .tw-assignment-nav a, .tw-section-nav a, .tw-bottom-nav a, .tw-switcher a",
      )
      .evaluateAll((elements) =>
        elements
          .map((element) => ({
            text: element.textContent.trim(),
            href: element.href,
          }))
          .filter(
            (value) => new URL(value.href).pathname === "/teacher/evidence",
          ),
      );
    await capture(teacher, "C4-lesson-title-search-course-shell");
    if (!links.length)
      return {
        status: "unreachable",
        reason:
          "The current course-level Lessons shell exposes no Evidence/Student work link. The historical direct-click reproduction is unreachable; no search-isolation pass is inferred.",
        lesson_id: authoring.lesson_id,
        query: title,
        shell_scope: "course",
        evidence_links: [],
      };
    for (const link of links)
      assert.notEqual(
        new URL(link.href).searchParams.get("q"),
        title,
        "Lesson-title search leaked into a shell Evidence destination.",
      );
    return {
      query: title,
      evidence_links: links,
      scope:
        "Rendered link inspection only; no claim about other navigation paths.",
    };
  });
  assert.deepEqual((await read(context, endpoint)).draft, initialReview.draft);
  assert.deepEqual(report.blocked_context_writes, []);
  report.context_check_counts = Object.fromEntries(
    ["passed", "failed", "unreachable"].map((status) => [
      status,
      report.context_checks.filter((check) => check.status === status).length,
    ]),
  );
}
async function reviewCuratedAssignment(context) {
  stage = "separate-curated-assignment-review";
  const assignmentId = "30000000-0000-4000-8000-000000000001";
  assert.notEqual(assignmentId, authoring.assignment_id);
  const endpoint = `/api/teacher/assignments/${assignmentId}/approval`;
  await teacher.goto(
    new URL(
      `/teacher/assignments?assignment=${assignmentId}&view=review`,
      manifest.origin,
    ).href,
  );
  await teacher.locator(".awa-lesson-review").waitFor();
  const before = await read(context, endpoint);
  assert.equal(before.id, assignmentId);
  assert.equal(before.class_id, "20000000-0000-4000-8000-000000000001");
  await teacher.locator("#assigned-reading").scrollIntoViewIfNeeded();
  assert.ok(
    (await teacher.locator("#assigned-reading").innerText()).length > 100,
  );
  await teacher
    .locator("#prepared-practice > details")
    .first()
    .locator("summary")
    .first()
    .click();
  await teacher.locator("#learning-goals").scrollIntoViewIfNeeded();
  await capture(teacher, "curated-reviewed-exact-lesson");
  report.curated_assignment = {
    assignment_id: assignmentId,
    class_id: before.class_id,
    content_ref: before.content_ref,
    title: before.title,
    before_approved_at: before.teacher_approved_at,
    decision: before.teacher_approved_at
      ? "already-active-no-new-approval"
      : "explicit-ui-approval-and-activation",
    separate_from_authored_journey: true,
  };
  if (!before.teacher_approved_at) {
    await teacher
      .getByLabel("I have reviewed this reading, its learning goals")
      .check();
    await action(
      teacher,
      endpoint,
      "curated-assignment-explicit-activation",
      () =>
        teacher
          .getByRole("button", { name: "Approve and activate", exact: true })
          .click(),
      (request) => request.postDataJSON()?.review_token === before.review_token,
    );
    report.checks.push({
      action: "separate-curated-assignment-activation",
      at: new Date().toISOString(),
      http_status: 200,
      review_identity_sha256: hash(before.review_token),
    });
  }
  await teacher
    .getByRole("heading", { name: "Active for enrolled students", exact: true })
    .waitFor();
  const after = await read(context, endpoint);
  assert.deepEqual(after.content_ref, before.content_ref);
  assert.equal(after.id, assignmentId);
  assert.ok(after.teacher_approved_at);
  if (before.teacher_approved_at)
    assert.equal(after.teacher_approved_at, before.teacher_approved_at);
  report.curated_assignment.after_approved_at = after.teacher_approved_at;
  await capture(teacher, "curated-active-before-regression-fixture");
}
try {
  release = acquireLock({
    mode: "browser-intervention-" + phase,
    source: manifest.source,
    state,
    project: manifest.project,
    sourceSha: manifest.sourceSha,
  });
  report.lock_owner = JSON.parse(
    readFileSync(resolve(LOCK_PATH, "owner.json"), "utf8"),
  );
  await save();
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
        contextReadOnly &&
        !["GET", "HEAD", "OPTIONS"].includes(route.request().method())
      ) {
        report.blocked_context_writes.push({
          url: url.href,
          method: route.request().method(),
        });
        return route.abort("blockedbyclient");
      }
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
  if (["review-and-submit", "inspect-followup"].includes(phase))
    await login(student, "student");
  contextReadOnly = phase === "context-checks";
  const endpoint = "/api/teacher/interventions/" + preparation.draft_id;
  let review;
  if (phase !== "curated-activation") {
    await teacher.goto(new URL(preparation.teacher_url, manifest.origin).href);
    review = await read(contexts[0], endpoint);
    assert.deepEqual(review.draft.evidence.content_ref, authoring.content_ref);
    assert.equal(
      review.draft.evidence.observations.find(
        (value) => value.attempt.id === authoring.presented_attempt_id,
      )?.attempt.response_text,
      authoring.original_response,
    );
  }
  if (phase === "context-checks") {
    await checkSavedContext(contexts[0], endpoint, review);
  } else if (phase === "curated-activation") {
    await reviewCuratedAssignment(contexts[0]);
  } else if (phase === "review-and-submit") {
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
  report.status = report.context_checks.some(
    (value) => value.status === "failed",
  )
    ? "failed-context"
    : report.screenshots.some((value) => value.overflow)
      ? "failed-responsive"
      : "passed";
} catch (error) {
  report.status = mutationUncertain ? "uncertain" : "failed";
  report.failure_stage = stage;
  report.error = error.message;
  for (const [name, page] of [
    ["teacher", teacher],
    ["student", student],
  ])
    if (page && !mutationUncertain) {
      try {
        await capture(page, "failure-" + name);
      } catch {
        /* Preserve the original error. */
      }
    }
  process.exitCode = 1;
} finally {
  if (browser) {
    let closed = false;
    try {
      await bounded(
        "close owned browser",
        () => browser.close(),
        () => {
          closed = true;
        },
      );
    } catch (error) {
      browserCloseUncertain = !closed;
      report.browser_close_error = error.message;
    }
  }
  try {
    if (release && (mutationUncertain || browserCloseUncertain)) {
      report.status = "uncertain";
      report.lock_retained = true;
      report.reconciliation_required =
        "Reconcile the recorded request and owned browser/process state before retrying or releasing this exact owned lock. No automatic retry, restart or lock removal.";
      process.exitCode = 1;
    } else {
      release?.();
      report.lock_retained = false;
    }
  } catch (error) {
    report.status = "failed";
    report.lock_release_error = error.message;
    process.exitCode = 1;
  }
  report.finished_at = new Date().toISOString();
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
