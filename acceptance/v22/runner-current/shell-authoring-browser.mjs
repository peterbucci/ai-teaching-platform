import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Adapted from the verification-only authoring-browser.mjs, SHA256
// e39f6a361586ea09a8a6062bf03b2ee95852a3d967270dde08d1f11ee67003c8.
// Current snapshot e6126016 includes PR118 7b82197, PR117 9f300ce,
// PR116 94e4, PR113 83114ef and PR120 a045def. Runtime remains separately reported.
// Usage: node shell-authoring-browser.mjs <target-state-dir> <browser-ws-file> <playwright-package-dir>
// The target state directory must already contain the isolated runner's manifest and .env.acceptance.
// This script creates fictional records through manual UI controls only. No generation controls are used.
const [stateArgument, endpointArgument, playwrightArgument] =
  process.argv.slice(2);
assert.ok(
  stateArgument && endpointArgument && playwrightArgument,
  "Pass target state directory, browser endpoint file and Playwright package directory.",
);
const stateDirectory = resolve(stateArgument);
const manifest = JSON.parse(
  await readFile(resolve(stateDirectory, "manifest.json"), "utf8"),
);
const origin = new URL(manifest.origin);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname));
assert.equal(manifest.paidModelCallsAuthorized, false);
assert.match(manifest.configurationCategory, /provider-disabled/);
assert.equal(manifest.target, "shell");
assert.equal(manifest.project, "lp-v22-shell5");
assert.equal(Number(origin.port), 3350);
assert.equal(origin.protocol, "http:");
assert.equal(
  origin.username + origin.password + origin.search + origin.hash,
  "",
);
assert.equal(origin.pathname, "/");
assert.equal(manifest.sourceSha, "e6126016c9b4ec2b479d252ff45e4e16a6a633f7");
assert.equal(manifest.sourceTree, "fc9dd9f5db5e0843a6d46327df6be1e631dada94");
for (const [ref, expected] of [
  ["HEAD", manifest.sourceSha],
  ["HEAD^{tree}", manifest.sourceTree],
]) {
  const result = spawnSync("git", ["-C", manifest.source, "rev-parse", ref], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(
    result.status,
    0,
    "Pinned source must be readable before browser startup.",
  );
  assert.equal(
    result.stdout.trim(),
    expected,
    "Source differs from the runtime manifest.",
  );
}
const dirtySource = spawnSync(
  "git",
  ["-C", manifest.source, "diff", "--name-only", "HEAD"],
  { encoding: "utf8", windowsHide: true },
);
assert.equal(dirtySource.status, 0, "Source cleanliness must be readable.");
assert.deepEqual(
  dirtySource.stdout
    .trim()
    .split(/\r?\n/)
    .filter((file) => file && !file.startsWith("acceptance/")),
  [],
  "Application files must match the pinned source.",
);
const environment = await readFile(
  resolve(stateDirectory, ".env.acceptance"),
  "utf8",
);
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"]) {
  const line = environment
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));
  assert.equal(
    line,
    `${key}=`,
    "Model configuration must explicitly be empty.",
  );
}
const { chromium } = createRequire(import.meta.url)(
  resolve(playwrightArgument),
);
const endpoint = process.env.BROWSER_EXECUTABLE
  ? undefined
  : (await readFile(resolve(endpointArgument), "utf8")).trim();
const browser = process.env.BROWSER_EXECUTABLE
  ? await chromium.launch({
      executablePath: process.env.BROWSER_EXECUTABLE,
      headless: true,
    })
  : await chromium.connect(endpoint);
const out = resolve(
  process.env.ACCEPTANCE_AUTHORING_OUT ||
    resolve(stateDirectory, "browser-authoring"),
);
assert.equal(
  existsSync(resolve(out, "report.json")),
  false,
  "Choose a fresh ACCEPTANCE_AUTHORING_OUT; prior reports must not be overwritten.",
);
await mkdir(out, { recursive: true });
const teacherContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const studentContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const blockedRequests = [];
for (const context of [teacherContext, studentContext]) {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.origin === origin.origin ||
      ["data:", "blob:"].includes(url.protocol)
    )
      await route.continue();
    else {
      blockedRequests.push(url.href);
      await route.abort("blockedbyclient");
    }
  });
}
const teacher = await teacherContext.newPage();
const student = await studentContext.newPage();
for (const page of [teacher, student]) page.setDefaultTimeout(15000);
const title = `Water changing state · verification ${Date.now()}`;
const source =
  "Evaporation changes liquid water into water vapor, a gas. A puddle can shrink as water evaporates into the air. The water has changed state; it has not disappeared.\n\nCondensation changes water vapor into liquid water. When water vapor in air cools near a cold surface, liquid droplets can form on the surface. Evaporation and condensation describe opposite changes of state.";
const quote = "Evaporation changes liquid water into water vapor, a gas.";
const answer =
  "The water has changed from liquid to water vapor, a gas, through evaporation; it has not disappeared.";
const criterion =
  "Explains that evaporation changes liquid water into water vapor rather than destroying it.";
const specs = [
  [
    "initial",
    "A puddle is smaller after a dry afternoon. Explain what happened to the water and name the process.",
  ],
  [
    "alternative",
    "A damp cloth dries in the air. Describe the change in the water and explain whether the water still exists.",
  ],
  [
    "diagnostic",
    "Someone says that the water from a drying tabletop has ceased to exist. What would you say to them, and why?",
  ],
  [
    "retest",
    "A display labels a container with less liquid than yesterday as evidence that matter was destroyed. Evaluate this conclusion using the reading and give a better explanation.",
  ],
];
const evidence = { teacher: [], student: [] };
const screenshots = [];
const report = {
  target: manifest.target,
  project: manifest.project,
  sha: manifest.sourceSha,
  tree: manifest.sourceTree,
  sourceSha: manifest.sourceSha,
  sourceTree: manifest.sourceTree,
  harness_sha256: createHash("sha256")
    .update(await readFile(new URL(import.meta.url)))
    .digest("hex"),
  harness_upstream_sha256:
    "e39f6a361586ea09a8a6062bf03b2ee95852a3d967270dde08d1f11ee67003c8",
  origin: origin.origin,
  environment_manifest: "../manifest.json",
  configuration: manifest.configurationCategory,
  verification:
    "Provider-disabled browser manual authoring and cross-role assignment using original synthetic material",
  run_id: title,
  started_at_utc: new Date().toISOString(),
  status: "running",
  paid_calls: 0,
  blocked_off_origin_requests: blockedRequests,
  full_journey: "unrun",
  functional_completed_through: null,
  fixture_scope:
    "One original fictional source, one objective and four manually authored questions; not a count-equivalent prototype dataset.",
  checks: [],
  viewports: [],
  unrun: [
    "File-upload browser variants",
    "Fresh model generation/evaluation",
    "Accepted model evaluation and same-journey intervention delivery/follow-up (provider disabled)",
    "200% zoom, keyboard-only journey and screen-reader verification",
  ],
};
let stage = "login";
async function capture(page, name) {
  console.log(
    JSON.stringify({ target: report.target, stage, screenshot: name }),
  );
  await page.screenshot({
    path: resolve(out, `${name}.png`),
    fullPage: false,
    timeout: 15000,
  });
  screenshots.push(`${name}.png`);
  if (page === teacher && !name.startsWith("failure")) {
    const previous = page.viewportSize();
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
      { width: 320, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      report.viewports.push({ ...viewport, page: name, overflow });
      const file = `${name}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({
        path: resolve(out, file),
        fullPage: false,
        timeout: 15000,
      });
      screenshots.push(file);
    }
    await page.setViewportSize(previous);
  }
}
async function clickedResponse(page, suffix, click) {
  const pending = page.waitForResponse(
    (response) =>
      response.url().endsWith(suffix) && response.request().method() !== "GET",
  );
  await click();
  const response = await pending;
  const body = suffix.endsWith("/approval")
    ? { http_status: response.status() }
    : await response.json();
  evidence[page === teacher ? "teacher" : "student"].push({
    url: response.url(),
    status: response.status(),
    body,
  });
  assert.equal(
    response.status(),
    200,
    `Unexpected response at ${stage}: ${JSON.stringify(body)}`,
  );
  return body;
}
async function fillQuestion(index) {
  const item = teacher.locator("article.qb-question").first();
  await item.getByLabel("Purpose").selectOption(specs[index][0]);
  await item
    .getByLabel("Question wording · student visible")
    .fill(specs[index][1]);
  await item.locator("#qb-criteria > summary").click();
  await item.getByLabel("Expected answer", { exact: true }).fill(answer);
  await item.getByLabel("Evaluation criteria").fill(criterion);
  await item
    .getByLabel("Acceptable answer variations")
    .fill("Water becomes a gas in the air; the material still exists.");
  await item
    .getByLabel("Partial-answer guidance")
    .fill(
      "Credit a stated liquid-to-gas change even if the process name is omitted.",
    );
  await item
    .getByLabel("Corrective feedback for later student delivery")
    .fill(
      "Evaporation changes liquid water into water vapor. The water changes state rather than ceasing to exist.",
    );
  await item.locator("#qb-sources > summary").click();
  await item.getByLabel("Exact supporting quote").fill(quote);
  await item
    .getByLabel("Supported criterion")
    .selectOption({ label: criterion });
  await item.getByLabel("I checked answer correctness").check();
}
try {
  await teacher.goto(new URL("/login", origin).href);
  await teacher
    .getByRole("button", { name: "Demo teacher", exact: true })
    .click();
  await teacher.waitForURL("**/teacher");
  stage = "source import";
  await teacher.goto(new URL("/teacher/materials", origin).href);
  await teacher.locator("#material-text").fill(source);
  await teacher
    .getByRole("button", { name: "Preview extracted passages" })
    .click();
  await teacher.locator("#material-passage-0").waitFor();
  assert.equal(
    await teacher.locator("#material-passage-0").inputValue(),
    source,
  );
  await capture(teacher, "01-extraction-review");
  await teacher
    .getByRole("button", { name: "Next: credit and permission" })
    .click();
  await teacher.locator("#material-title").fill(title);
  await teacher
    .locator("#material-authors")
    .fill("Fictional acceptance teacher");
  await teacher
    .locator("#material-copyright")
    .fill("2026 fictional acceptance fixture");
  await teacher
    .locator("#material-license")
    .fill("Original synthetic material; permitted for this test");
  await teacher.getByLabel("I have permission to use this material").check();
  await teacher.getByLabel("I reviewed the included passages").check();
  await clickedResponse(teacher, "/api/teacher/materials", () =>
    teacher
      .getByRole("button", { name: "Save private source", exact: true })
      .click(),
  );
  await teacher.waitForURL("**/teacher/materials/*");
  report.source_id = new URL(teacher.url()).pathname.split("/").at(-1);
  report.source_version = 1;
  await teacher
    .getByRole("link", { name: "Start a lesson from version 1", exact: true })
    .waitFor();
  await capture(teacher, "02-source-saved");
  report.checks.push(
    "Manual pasted source import, exact extraction review, attribution and private source save",
  );

  stage = "manual objective";
  await teacher
    .getByRole("link", { name: "Start a lesson from version 1", exact: true })
    .click();
  await teacher.getByLabel("Lesson title", { exact: true }).fill(title);
  await teacher
    .getByLabel("Approved material", { exact: true })
    .selectOption({ label: `${title} · version 1` });
  await teacher
    .getByRole("button", { name: "Create lesson and write objectives" })
    .click();
  await teacher.waitForURL("**/teacher/objectives/*");
  report.lesson_id = new URL(teacher.url()).pathname.split("/").at(-1);
  await teacher
    .getByRole("button", { name: "Add an objective manually" })
    .click();
  await teacher
    .getByPlaceholder("For example, Evaporation")
    .fill("Evaporation");
  await teacher
    .getByLabel("Emphasis", { exact: true })
    .selectOption("essential");
  await teacher
    .getByPlaceholder("Students will be able to explain…")
    .fill(
      "Explain that evaporation changes liquid water into water vapor rather than making it disappear.",
    );
  await teacher.getByLabel("Use passage p001").check();
  await teacher
    .getByPlaceholder("Copy the relevant words from this passage")
    .fill(quote);
  await teacher
    .getByPlaceholder(
      "Explain which part of the objective the passage supports.",
    )
    .fill(
      "The passage identifies liquid water becoming vapor and says it has not disappeared.",
    );
  await teacher.getByLabel("I reviewed the quoted passages").check();
  await clickedResponse(
    teacher,
    `/api/teacher/objectives/${report.lesson_id}`,
    () =>
      teacher
        .getByRole("button", { name: "Save changes", exact: true })
        .click(),
  );
  await teacher.getByLabel("I approve the content, order, emphasis").check();
  await clickedResponse(
    teacher,
    `/api/teacher/objectives/${report.lesson_id}/approve`,
    () =>
      teacher
        .getByRole("button", { name: "Approve objectives", exact: true })
        .click(),
  );
  await teacher
    .getByText("Objectives approved for this revision.", { exact: false })
    .waitFor();
  await capture(teacher, "03-objectives-approved");
  report.checks.push(
    "Manually authored objective with exact source quote saved and explicitly approved",
  );

  stage = "manual question bank";
  await teacher
    .getByRole("link", { name: "All questions", exact: true })
    .click();
  for (let index = 0; index < specs.length; index++) {
    await teacher
      .getByRole("button", { name: "+ Add a question", exact: true })
      .click();
    await fillQuestion(index);
  }
  const bank = await clickedResponse(
    teacher,
    `/api/teacher/lessons/${report.lesson_id}/question-bank`,
    () =>
      teacher.getByRole("button", { name: "Save draft", exact: true }).click(),
  );
  assert.equal(bank.revision, 4);
  await teacher
    .getByRole("button", { name: "Student preview", exact: true })
    .click();
  assert.ok(!(await teacher.locator("body").innerText()).includes(answer));
  assert.ok(!(await teacher.locator("body").innerText()).includes(criterion));
  await capture(teacher, "04-student-preview");
  await teacher
    .getByRole("button", { name: "Return to editor", exact: true })
    .click();
  await teacher
    .getByRole("button", { name: "Review question bank", exact: true })
    .click();
  await teacher
    .getByText("Review closing feedback and fallback messages", { exact: true })
    .click();
  await teacher
    .getByText("Review lesson scope and evaluation policy", { exact: true })
    .click();
  await teacher
    .getByLabel("I reviewed the complete saved question bank")
    .check();
  await clickedResponse(
    teacher,
    `/api/teacher/lessons/${report.lesson_id}/question-bank`,
    () =>
      teacher
        .getByRole("button", {
          name: "Approve reviewed question bank",
          exact: true,
        })
        .click(),
  );
  await teacher
    .getByText("Question bank approved", { exact: false })
    .first()
    .waitFor();
  await capture(teacher, "05-bank-approved");
  report.checks.push(
    "Four manually authored source-cited questions saved/reviewed/approved; student preview excludes private guidance",
  );

  stage = "sequence and publication";
  await teacher
    .getByRole("link", {
      name: "Continue to tutoring sequence",
    })
    .click();
  const assembled = await clickedResponse(
    teacher,
    `/api/teacher/lessons/${report.lesson_id}/assembly`,
    () =>
      teacher
        .getByRole("button", { name: "Prepare tutoring sequence", exact: true })
        .click(),
  );
  assert.equal(
    assembled.revision,
    bank.revision + 2,
    "Bank approval and assembly must each create their expected revision.",
  );
  report.prepared_revision = assembled.revision;
  await teacher
    .getByText(`Draft v1 · revision ${assembled.revision}`, { exact: true })
    .waitFor();
  await teacher
    .getByRole("link", { name: "Approve, publish and assign", exact: true })
    .click();
  await teacher.getByLabel("I have reviewed the source, concepts").check();
  await clickedResponse(
    teacher,
    `/api/teacher/lessons/${report.lesson_id}/approval`,
    () =>
      teacher
        .getByRole("button", {
          name: "Approve this lesson revision",
          exact: true,
        })
        .click(),
  );
  await teacher
    .getByRole("button", { name: "Publish approved version", exact: true })
    .waitFor();
  await capture(teacher, "06-lesson-approved");
  await teacher
    .getByLabel(
      "Publish this approved revision as an immutable lesson version.",
    )
    .check();
  const published = await clickedResponse(
    teacher,
    `/api/teacher/lessons/${report.lesson_id}/publication`,
    () =>
      teacher
        .getByRole("button", { name: "Publish approved version", exact: true })
        .click(),
  );
  await teacher
    .getByRole("heading", { name: "Published version 1", exact: true })
    .waitFor();
  const publishedURL = teacher.url();
  report.published_version = published.version;
  report.content_ref = published.content_ref;
  assert.equal(published.content_ref.source_id, report.source_id);
  assert.equal(published.content_ref.source_version, report.source_version);
  assert.equal(published.content_ref.content_version, "1");
  await capture(teacher, "07-published-v1");
  report.checks.push(
    "Tutoring sequence prepared, current lesson explicitly approved, immutable version 1 published separately",
  );

  stage = "inactive assignment";
  // Follow the actual published-page link, then deliberately select the exact
  // version in PR117's builder. This records the C5 context gap instead of
  // pretending the published-page link itself carries lesson/version identity.
  const handoff = teacher.getByRole("link", {
    name: "Open class assignments",
    exact: true,
  });
  const handoffHref = await handoff.getAttribute("href");
  const handoffURL = new URL(handoffHref, origin);
  report.assignment_handoff = {
    published_url: publishedURL,
    href: handoffHref,
    exact_version_automatically_carried:
      handoffURL.searchParams.get("lesson") === report.lesson_id &&
      handoffURL.searchParams.get("version") === report.published_version,
    resolution:
      "Teacher explicitly selects the just-published lesson/version in the new assignment builder.",
  };
  await handoff.click();
  await teacher
    .getByRole("link", { name: "New assignment", exact: true })
    .click();
  const versionChoice = teacher
    .getByRole("navigation", { name: "Published lesson versions", exact: true })
    .getByRole("link")
    .filter({ has: teacher.getByText(title, { exact: true }) });
  assert.equal(
    await versionChoice.count(),
    1,
    "The newly published fictional lesson must have one explicit version choice.",
  );
  await versionChoice.click();
  const builderUrl = new URL(teacher.url());
  assert.equal(builderUrl.searchParams.get("lesson"), report.lesson_id);
  assert.equal(
    builderUrl.searchParams.get("version"),
    report.published_version,
  );
  report.assignment_handoff.selected_builder_url = builderUrl.href;
  await teacher
    .locator('select[name="class_id"]')
    .selectOption("20000000-0000-4000-8000-000000000001");
  await teacher
    .getByLabel("Assignment title", { exact: true })
    .fill(`${title} assignment`);
  await teacher
    .getByLabel("Instructions for students")
    .fill(
      "Read the approved source and explain evaporation in your own words. Fictional acceptance exercise.",
    );
  const assignment = await clickedResponse(
    teacher,
    `/api/teacher/lessons/${report.lesson_id}/assignments`,
    () =>
      teacher
        .getByRole("button", {
          name: "Create inactive assignment",
          exact: true,
        })
        .click(),
  );
  report.assignment_id = assignment.id;
  report.class_id = assignment.class_id;
  assert.equal(assignment.class_id, "20000000-0000-4000-8000-000000000001");
  assert.equal(assignment.lesson_id, report.lesson_id);
  assert.equal(assignment.lesson_version, report.published_version);
  // The creation response intentionally exposes identity only. Inactivity is
  // verified by the visible saved state and enrolled student's absence below.
  await teacher
    .getByRole("heading", { name: "Inactive assignment saved", exact: true })
    .waitFor();
  await teacher
    .getByRole("link", { name: "Review assignment", exact: true })
    .waitFor();
  await student.goto(new URL("/login", origin).href);
  await student
    .getByRole("button", { name: "Demo student", exact: true })
    .click();
  await student.waitForURL("**/study/assignments");
  await student
    .getByRole("heading", { name: "Assignments", exact: true })
    .waitFor();
  assert.ok(!(await student.locator("body").innerText()).includes(title));
  await capture(student, "08-inactive-hidden-student");
  report.checks.push(
    "Inactive assignment is absent from enrolled student's list before activation",
  );

  stage = "activation";
  await teacher
    .getByRole("link", { name: "Review assignment", exact: true })
    .click();
  await teacher
    .getByLabel("I have reviewed this reading, its learning goals")
    .check();
  await clickedResponse(
    teacher,
    `/api/teacher/assignments/${assignment.id}/approval`,
    () =>
      teacher
        .getByRole("button", { name: "Approve and activate", exact: true })
        .click(),
  );
  await teacher.reload();
  await teacher
    .getByText("Active for enrolled students", { exact: true })
    .first()
    .waitFor();
  await capture(teacher, "09-active-assignment");
  await student.reload();
  await student
    .getByRole("link", { name: `Details: ${title} assignment`, exact: true })
    .click();
  await student
    .getByText(`${title} assignment`, { exact: true })
    .first()
    .waitFor();
  await capture(student, "10-student-assignment");
  report.checks.push(
    "Separate explicit teacher activation makes the exact assignment visible and openable by enrolled student",
  );

  stage = "student reading and session";
  await student
    .getByRole("link", { name: "Open reading", exact: true })
    .click();
  await student.getByText(quote, { exact: false }).first().waitFor();
  const readingURL = student.url();
  const readingText = await student.locator("body").innerText();
  assert.ok(readingText.includes(source));
  assert.ok(!readingText.includes(answer) && !readingText.includes(criterion));
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ]) {
    await student.setViewportSize(viewport);
    await capture(student, `11-reading-${viewport.width}`);
    const overflow = await student.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    report.viewports.push({ ...viewport, page: "reading", overflow });
    assert.equal(overflow, false);
  }
  await student.setViewportSize({ width: 1440, height: 1000 });
  await student.goBack();
  await student
    .getByRole("link", { name: "Study session", exact: true })
    .click();
  const sessionBefore = await clickedResponse(student, "/api/tutoring", () =>
    student
      .getByRole("button", { name: "Start assignment", exact: false })
      .click(),
  );
  await student.getByText(specs[0][1], { exact: false }).first().waitFor();
  assert.equal(
    await student.getByRole("textbox", { name: "Message your tutor" }).count(),
    1,
  );
  assert.ok(
    !JSON.stringify(sessionBefore).includes(answer) &&
      !JSON.stringify(sessionBefore).includes(criterion),
  );
  report.student_session_id = sessionBefore.session.id;
  report.student_id = sessionBefore.session.student_id;
  report.student_session_url = student.url();
  report.presented_attempt_id = sessionBefore.attempts[0].id;
  await capture(student, "12-student-session");
  report.checks.push(
    "Student reading retains exact imported text; initial question opens with one composer and no private answer/criterion in public API",
  );

  stage = "new version and history preservation";
  await teacher.goto(publishedURL);
  await teacher.getByLabel("New version name", { exact: true }).fill("2");
  await teacher
    .getByLabel(
      "Start from the current saved draft and review the new version before publishing.",
    )
    .check();
  const nextDraft = await clickedResponse(
    teacher,
    `/api/teacher/lessons/${report.lesson_id}/versions`,
    () =>
      teacher
        .getByRole("button", { name: "Start new version", exact: true })
        .click(),
  );
  assert.equal(nextDraft.revision, assembled.revision + 1);
  await teacher
    .getByText(`Draft v2 · revision ${nextDraft.revision}`, { exact: true })
    .waitFor();
  await capture(teacher, "13-new-version-requires-review");
  const restoredResponse = await studentContext.request.get(
    new URL(`/api/tutoring/${sessionBefore.session.id}`, origin).href,
  );
  assert.equal(restoredResponse.status(), 200);
  const sessionAfter = await restoredResponse.json();
  assert.deepEqual(sessionAfter, sessionBefore);
  evidence.session_before = sessionBefore;
  evidence.session_after = sessionAfter;
  await student.reload();
  await student.getByText(specs[0][1], { exact: false }).first().waitFor();
  await capture(student, "14-session-preserved-after-v2");
  await student.goto(readingURL);
  await student.getByText(quote, { exact: false }).first().waitFor();
  assert.ok((await student.locator("body").innerText()).includes(source));
  await teacher.goto(publishedURL);
  await teacher
    .getByRole("heading", { name: "Published version 1", exact: true })
    .waitFor();
  await teacher
    .getByText("Published v1 · immutable", { exact: true })
    .waitFor();
  // Exact source identity was checked against the publication API and the
  // retained earlier session above; the persistent layout's wording differs.
  report.new_draft_version = "2";
  report.new_draft_revision = nextDraft.revision;
  report.checks.push(
    "New v2 draft requires fresh review; published v1 remains source-pinned and earlier presented student session/attempt remain byte-equivalent",
  );

  stage = "provider-disabled help clarification";
  await student.goto(report.student_session_url);
  const composer = student.getByRole("textbox", {
    name: "Message your tutor",
    exact: true,
  });
  await composer.fill("What does water vapor mean in the reading?");
  await student.getByRole("button", { name: "Send", exact: true }).click();
  await student
    .getByRole("button", { name: "I’m asking for help", exact: true })
    .last()
    .click();
  await student
    .getByText("Conversational help is unavailable for this step.", {
      exact: false,
    })
    .waitFor();
  const sessionPath = `/api/tutoring/${report.student_session_id}`;
  const helpView = await (
    await studentContext.request.get(new URL(sessionPath, origin).href)
  ).json();
  const conversation = await (
    await studentContext.request.get(
      new URL(`${sessionPath}/conversation`, origin).href,
    )
  ).json();
  assert.equal(helpView.attempts[0].response_text, null);
  assert.equal(helpView.attempts[0].submitted_at, null);
  assert.equal(conversation.dialogue.state.provider_requests_used, 0);
  assert.equal(conversation.messages.at(-1).outcome.status, "fallback");
  evidence.help_fallback = { session: helpView, conversation };
  await capture(student, "15-help-clarified-not-graded");
  report.checks.push(
    "Browser help request required explicit clarification with provider disabled; fallback preserved the original unanswered attempt and consumed zero provider requests.",
  );

  stage = "explicit answer submission and original evidence";
  const originalResponse =
    "  I think evaporation makes liquid water stop existing rather than changing its state.\nThis is an original fictional acceptance response.  ";
  report.original_response = originalResponse;
  await composer.fill(originalResponse);
  const savedResponse = student.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/api/sessions/${report.student_session_id}/answers`) &&
      response.request().method() === "POST",
  );
  await student
    .getByRole("button", { name: "Submit this as my answer", exact: true })
    .click();
  const saved = await savedResponse;
  assert.equal(saved.status(), 200);
  const submitted = await (
    await studentContext.request.get(new URL(sessionPath, origin).href)
  ).json();
  assert.equal(submitted.attempts[0].response_text, originalResponse);
  assert.deepEqual(
    submitted.attempts[0].question.content_ref,
    report.content_ref,
  );
  evidence.submitted_session = submitted;
  await student.reload();
  await student
    .getByText("Your answer — saved", { exact: false })
    .first()
    .waitFor();
  await capture(student, "16-original-answer-saved-provider-disabled");
  await teacher.goto(
    new URL(
      `/teacher/sessions/${report.student_session_id}?assignment=${report.assignment_id}&origin=all`,
      origin,
    ).href,
  );
  await teacher
    .getByRole("heading", { name: "Original student response", exact: true })
    .first()
    .waitFor();
  assert.ok(
    (await teacher.locator("body").innerText()).includes(
      originalResponse.trim(),
    ),
  );
  await capture(teacher, "17-teacher-original-evidence");
  report.functional_completed_through = "teacher-original-evidence";
  report.checks.push(
    "Explicit fallback answer submission preserved exact whitespace/text and published v1 source identity; reload retained it and teacher inspected original response in the same session.",
  );
  report.full_journey =
    "incomplete: same source→lesson→inactive assignment→activation→student→help fallback→original answer→teacher evidence; no accepted model evaluation or same-session intervention/follow-up is claimed";
  report.status = report.viewports.some((entry) => entry.overflow)
    ? "failed-responsive"
    : "passed";
} catch (error) {
  report.status = "failed";
  report.failure_stage = stage;
  report.error = error instanceof Error ? error.message : String(error);
  for (const [name, page] of [
    ["teacher", teacher],
    ["student", student],
  ]) {
    try {
      await capture(page, `failure-${name}`);
      await writeFile(
        resolve(out, `failure-${name}.txt`),
        await page.locator("body").innerText(),
      );
    } catch {
      /* Preserve the original failure if screenshot capture fails. */
    }
  }
  process.exitCode = 1;
} finally {
  if (report.status !== "passed") process.exitCode = 1;
  report.checked_at_utc = new Date().toISOString();
  report.screenshots = screenshots;
  await writeFile(
    resolve(out, "api-evidence.json"),
    JSON.stringify(evidence, null, 2),
  );
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await teacherContext.close();
  await studentContext.close();
  await browser.close();
  console.log(
    JSON.stringify({
      target: report.target,
      status: report.status,
      failure_stage: report.failure_stage,
      report: resolve(out, "report.json"),
    }),
  );
}
