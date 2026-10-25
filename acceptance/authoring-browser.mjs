import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Usage: node acceptance/authoring-browser.mjs <target-state-dir> <browser-ws-file> <playwright-package-dir>
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
const environment = await readFile(
  resolve(stateDirectory, ".env.acceptance"),
  "utf8",
);
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"]) {
  const line = environment
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));
  assert.ok(!line || line === `${key}=`, "Model configuration must be empty.");
}
const { chromium } = createRequire(import.meta.url)(
  resolve(playwrightArgument),
);
const endpoint = (await readFile(resolve(endpointArgument), "utf8")).trim();
const browser = await chromium.connect(endpoint);
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
  viewport: { width: 1440, height: 900 },
});
const studentContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const teacher = await teacherContext.newPage();
const student = await studentContext.newPage();
for (const page of [teacher, student]) page.setDefaultTimeout(15000);
const title = `Manual authoring ${manifest.target} ${Date.now()}`;
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
  sha: manifest.sourceSha,
  origin: origin.origin,
  environment_manifest: "../manifest.json",
  configuration: manifest.configurationCategory,
  verification:
    "Provider-disabled browser manual authoring and cross-role assignment using original synthetic material",
  run_id: title,
  started_at_utc: new Date().toISOString(),
  status: "running",
  paid_calls: 0,
  checks: [],
  viewports: [],
  unrun: [
    "File-upload browser variants",
    "Fresh model generation/evaluation",
    "Submitted historical answer/evaluation preservation; only a presented attempt is preserved here",
    "200% zoom, keyboard-only journey and screen-reader verification",
    "Full responsive authoring form review",
  ],
};
let stage = "login";
async function capture(page, name) {
  console.log(
    JSON.stringify({ target: report.target, stage, screenshot: name }),
  );
  await page.screenshot({
    path: resolve(out, `${name}.png`),
    fullPage: true,
    timeout: 15000,
  });
  screenshots.push(`${name}.png`);
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
  const item = teacher.locator("article.qb-question").nth(index);
  await item.getByLabel("Purpose").selectOption(specs[index][0]);
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
  await item.getByLabel("Exact supporting quote").fill(quote);
  await item
    .getByLabel("Supported criterion")
    .selectOption({ label: criterion });
  await item
    .getByLabel("Question wording · student visible")
    .fill(specs[index][1]);
  if (
    !(await item
      .locator("details")
      .first()
      .evaluate((element) => element.open))
  )
    await item.locator("summary").first().click();
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
  await teacher.locator("#material-title").waitFor();
  assert.equal(
    await teacher.locator("#material-passage-0").inputValue(),
    source,
  );
  await capture(teacher, "01-extraction-review");
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
    .getByText("Private source · Version 1", { exact: true })
    .waitFor();
  await capture(teacher, "02-source-saved");
  report.checks.push(
    "Manual pasted source import, exact extraction review, attribution and private source save",
  );

  stage = "manual objective";
  await teacher
    .getByRole("link", { name: "Create learning objectives" })
    .click();
  await teacher.getByLabel("Lesson title", { exact: true }).fill(title);
  await teacher
    .locator("select")
    .selectOption({ label: `${title} · version 1` });
  await teacher
    .getByRole("button", { name: "Create objectives draft" })
    .click();
  await teacher.waitForURL("**/teacher/objectives/*");
  report.lesson_id = new URL(teacher.url()).pathname.split("/").at(-1);
  await teacher
    .getByRole("button", { name: "Add an objective manually" })
    .click();
  await teacher
    .getByPlaceholder("For example, Evaporation")
    .fill("Evaporation");
  await teacher.locator("select").selectOption("essential");
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
    .getByRole("link", { name: "Continue to question bank" })
    .waitFor();
  await capture(teacher, "03-objectives-approved");
  report.checks.push(
    "Manually authored objective with exact source quote saved and explicitly approved",
  );

  stage = "manual question bank";
  await teacher
    .getByRole("link", { name: "Continue to question bank" })
    .click();
  for (let index = 0; index < specs.length; index++) {
    await teacher
      .getByRole("button", { name: "Add a manual question" })
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
    .getByRole("button", { name: "Student question preview", exact: true })
    .click();
  assert.ok(!(await teacher.locator("body").innerText()).includes(answer));
  assert.ok(!(await teacher.locator("body").innerText()).includes(criterion));
  await capture(teacher, "04-student-preview");
  await teacher
    .getByRole("button", { name: "Return to teacher editor" })
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
      name: "Lesson publication review · separate publishing workflow",
    })
    .click();
  await teacher
    .getByRole("button", { name: "Prepare tutoring sequence", exact: true })
    .click();
  await teacher.getByText("Draft revision 6", { exact: true }).waitFor();
  await teacher.getByLabel("I have reviewed the source, concepts").check();
  await teacher
    .getByRole("button", { name: "Approve this lesson revision", exact: true })
    .click();
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
    .getByRole("button", { name: "Save class assignment for review" })
    .waitFor();
  const publishedURL = teacher.url();
  report.published_version = published.version;
  report.content_ref = published.content_ref;
  await capture(teacher, "07-published-v1");
  report.checks.push(
    "Tutoring sequence prepared, current lesson explicitly approved, immutable version 1 published separately",
  );

  stage = "inactive assignment";
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
        .getByRole("button", { name: "Save class assignment for review" })
        .click(),
  );
  report.assignment_id = assignment.id;
  assert.equal(assignment.class_id, "20000000-0000-4000-8000-000000000001");
  await teacher
    .getByRole("link", { name: "Review and activate assignment", exact: true })
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
    .getByRole("link", { name: "Review and activate assignment", exact: true })
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
    .getByText("Active for students", { exact: true })
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
    { width: 1440, height: 900 },
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
  await student.setViewportSize({ width: 1440, height: 900 });
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
  await teacher
    .getByRole("button", { name: "Start new version", exact: true })
    .click();
  await teacher.getByText("Draft revision 7", { exact: true }).waitFor();
  assert.ok(
    (await teacher.locator("body").innerText()).includes(
      "Lesson version 2 · Source version 1",
    ),
  );
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
  await teacher.getByText("Published version 1", { exact: true }).waitFor();
  assert.ok(
    (await teacher.locator("body").innerText()).includes(
      "Lesson version 1 · Source version 1",
    ),
  );
  report.new_draft_version = "2";
  report.new_draft_revision = 7;
  report.checks.push(
    "New v2 draft requires fresh review; published v1 remains source-pinned and earlier presented student session/attempt remain byte-equivalent",
  );
  report.status = "passed";
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
