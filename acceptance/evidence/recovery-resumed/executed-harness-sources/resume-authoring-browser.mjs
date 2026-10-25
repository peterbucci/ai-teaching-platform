import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { measureStorage, MIN_RUNTIME_GIB } from "./safety.mjs";

// Usage: node acceptance/resume-authoring-browser.mjs <target-state-dir> <browser-ws-file> <playwright-package-dir>
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
assert.equal(manifest.target, "combined-recovery");
assert.equal(manifest.sourceSha, "45326e243245c4941e2cefd0eab984bb7ee19765");
assert.equal(origin.origin, "http://localhost:3355");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname));
assert.equal(manifest.paidModelCallsAuthorized, false);
assert.match(manifest.configurationCategory, /provider-disabled/);
function checkHostHeadroom() {
  const disks = measureStorage([manifest.source, stateDirectory], MIN_RUNTIME_GIB);
  assert.ok(disks.every((disk) => disk.pass), "Host disk headroom fell below the runtime reserve.");
  return disks;
}
const initialHostHeadroom = checkHostHeadroom();
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
const endpoint = process.env.BROWSER_EXECUTABLE
  ? undefined
  : (await readFile(resolve(endpointArgument), "utf8")).trim();
const out = resolve(
  process.env.ACCEPTANCE_AUTHORING_OUT ||
    resolve(stateDirectory, "browser-authoring"),
);
assert.equal(
  existsSync(out),
  false,
  "Choose a fresh ACCEPTANCE_AUTHORING_OUT; prior reports must not be overwritten.",
);
await mkdir(out, { recursive: true });
const browser = process.env.BROWSER_EXECUTABLE
  ? await chromium.launch({
      executablePath: process.env.BROWSER_EXECUTABLE,
      headless: true,
    })
  : await chromium.connect(endpoint);
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
  initial_host_headroom: initialHostHeadroom,
  harness_sha256: createHash("sha256")
    .update(await readFile(new URL(import.meta.url)))
    .digest("hex"),
  checks: [],
  planned_stages: [
    "login",
    "source import",
    "manual objective",
    "manual question bank",
    "sequence and publication",
    "inactive assignment",
    "activation",
    "student reading and session",
    "teacher sees exact presented student evidence",
    "student explicitly submits original answer",
    "teacher sees exact submitted ungraded evidence",
    "new version and history preservation",
  ],
  viewports: [],
  unrun: [
    "File-upload browser variants",
    "Fresh model generation/evaluation",
    "Accepted historical evaluation preservation; provider-disabled submission remains ungraded",
    "200% zoom, keyboard-only journey and screen-reader verification",
  ],
};
let stage = "login";
async function capture(page, name, { fourWidths = false } = {}) {
  checkHostHeadroom();
  console.log(
    JSON.stringify({ target: report.target, stage, screenshot: name }),
  );
  await page.screenshot({
    path: resolve(out, `${name}.png`),
    fullPage: true,
    timeout: 15000,
  });
  screenshots.push(`${name}.png`);
  if ((page === teacher || fourWidths) && !name.startsWith("failure")) {
    const previous = page.viewportSize();
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
      { width: 320, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      report.viewports.push({ ...viewport, page: name, overflow });
      const file = `${name}-${viewport.width}.png`;
      await page.screenshot({
        path: resolve(out, file),
        fullPage: true,
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
  await teacher.getByRole("heading", { name: "Teaching Desk", exact: true }).waitFor();
  stage = "source import";
  await teacher.goto(new URL("/teacher/materials", origin).href);
  await teacher.getByRole("heading", { name: "Add teaching material", exact: true }).waitFor();
  await teacher.waitForFunction(() => location.pathname === "/teacher/materials" && document.querySelectorAll("#material-text").length === 1);
  assert.equal(await teacher.locator("#material-text").count(), 1);
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
    .getByRole("heading", { name: title, exact: true })
    .first()
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
    .getByRole("combobox", { name: /^Approved material/ })
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
  await teacher.getByRole("combobox", { name: /^Emphasis/ }).selectOption("essential");
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
    .getByRole("link", { name: "All questions", exact: true })
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
  await teacher
    .getByRole("button", { name: "Prepare tutoring sequence", exact: true })
    .click();
  await teacher
    .getByText("Draft v1 · revision 6", { exact: true })
    .first()
    .waitFor();
  await teacher
    .getByRole("link", { name: "Approve, publish and assign", exact: true })
    .click();
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
  await teacher.getByRole("heading", { name: "Published version 1", exact: true }).waitFor();
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
  await teacher
    .getByRole("link", { name: "Open class assignments", exact: true })
    .click();
  const publishedChoice = teacher.getByRole("region", {
    name: `${title}, version 1`,
    exact: true,
  });
  const createLink = publishedChoice.getByRole("link", {
    name: "Assign this version",
    exact: true,
  });
  const createHref = new URL(await createLink.getAttribute("href"), origin);
  assert.equal(createHref.pathname, "/teacher/assignments/new");
  assert.equal(createHref.searchParams.get("lesson"), report.lesson_id);
  assert.equal(createHref.searchParams.get("version"), "1");
  await createLink.click();
  report.assignment_handoff = {
    route: createHref.href,
    via: "Published lesson → Open class assignments → exact lesson/version → Assign this version",
    inline_lesson_create_control_used: false,
  };
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
        .getByRole("button", { name: "Create inactive assignment", exact: true })
        .click(),
  );
  report.assignment_id = assignment.id;
  assert.equal(assignment.class_id, "20000000-0000-4000-8000-000000000001");
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

  stage = "teacher sees exact presented student evidence";
  const teacherEvidenceResponse = await teacherContext.request.get(
    new URL(`/api/teacher/sessions/${sessionBefore.session.id}`, origin).href,
  );
  assert.equal(teacherEvidenceResponse.status(), 200);
  const teacherEvidence = await teacherEvidenceResponse.json();
  assert.equal(teacherEvidence.session.assignment_id, report.assignment_id);
  const presented = teacherEvidence.attempts.find(
    (attempt) => attempt.id === report.presented_attempt_id,
  );
  assert.ok(presented);
  assert.equal(presented.question.prompt_text, specs[0][1]);
  assert.equal(presented.question.content_ref.source_id, report.source_id);
  assert.equal(presented.question.content_ref.source_version, 1);
  assert.equal(presented.question.content_ref.content_version, "1");
  assert.equal(presented.response_text, null);
  evidence.teacher_presented_session = teacherEvidence;
  await teacher.goto(new URL(
    `/teacher/sessions/${sessionBefore.session.id}?assignment=${report.assignment_id}&origin=live_demo`,
    origin,
  ).href);
  await teacher.getByText(specs[0][1], { exact: true }).first().waitFor();
  await capture(teacher, "12b-teacher-exact-presented-evidence");
  report.checks.push(
    "Teacher authorized session page and API retain the exact assignment, presented question, source/version and attempt; no submitted answer or accepted evaluation is claimed",
  );

  stage = "student explicitly submits original answer";
  const composer = student.getByRole("textbox", { name: "Message your tutor", exact: true });
  const submit = student.getByRole("button", { name: "Submit this as my answer", exact: true });
  await student.waitForLoadState("networkidle");
  if (!(await submit.isVisible())) {
    // Request help through the real composer to expose the reviewed no-provider
    // fallback. This is not a classification or actual instructional-help claim.
    await composer.fill("What does evaporation mean in this reading?");
    await student.getByRole("button", { name: "Send", exact: true }).click();
    await student.getByRole("button", { name: "I’m asking for help", exact: true }).last().click();
    await student.getByText("Conversational help is unavailable for this step.", { exact: false }).waitFor();
    report.answer_fallback_entry = "Explicit help clarification returned provider-disabled fallback; no help content shown";
  } else {
    report.answer_fallback_entry = "Provider-disabled authored answer fallback already available";
  }
  const exactResponse = `  I think the puddle's liquid water became water vapor in the air through evaporation. The water still exists.\nFictional recovery trace: ${title}.  `;
  await composer.fill(exactResponse);
  const answerPath = `/api/sessions/${report.student_session_id}/answers`;
  const evaluationPath = `/api/tutoring/${report.student_session_id}`;
  const submissionRequests = [];
  const observeSubmission = (request) => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "POST" && [answerPath, evaluationPath].includes(pathname))
      submissionRequests.push({ pathname, method: request.method() });
  };
  student.on("request", observeSubmission);
  const savedAnswerResponse = student.waitForResponse(
    (response) => new URL(response.url()).pathname === answerPath && response.request().method() === "POST",
  );
  const evaluationResponse = student.waitForResponse(
    (response) => new URL(response.url()).pathname === evaluationPath && response.request().method() === "POST",
  );
  await submit.click();
  const [savedAnswer, evaluationUnavailable] = await Promise.all([savedAnswerResponse, evaluationResponse]);
  assert.equal(savedAnswer.status(), 200);
  assert.equal(evaluationUnavailable.status(), 503);
  const evaluationError = await evaluationUnavailable.json();
  assert.match(evaluationError.error, /Your answer is saved\. Evaluation is unavailable/);
  await student.getByText("Your answer is saved. Evaluation is unavailable", { exact: false }).waitFor();
  await student.waitForLoadState("networkidle");
  const submittedResponse = await studentContext.request.get(new URL(evaluationPath, origin).href);
  assert.equal(submittedResponse.status(), 200);
  const submittedSession = await submittedResponse.json();
  const submittedAttempt = submittedSession.attempts.find((attempt) => attempt.id === report.presented_attempt_id);
  assert.ok(submittedAttempt);
  assert.equal(submittedAttempt.response_text, exactResponse);
  assert.ok(submittedAttempt.submitted_at);
  assert.equal(submittedSession.progress.failed_evaluation_id, null);
  assert.equal(submittedSession.progress.phase, "evaluate");
  const conversationResponse = await studentContext.request.get(new URL(`${evaluationPath}/conversation`, origin).href);
  assert.equal(conversationResponse.status(), 200);
  const conversation = await conversationResponse.json();
  assert.equal(conversation.dialogue.state.provider_requests_used, 0);
  assert.equal(submissionRequests.filter((request) => request.pathname === answerPath).length, 1);
  assert.equal(submissionRequests.filter((request) => request.pathname === evaluationPath).length, 1);
  evidence.student_submitted_session = submittedSession;
  evidence.student_unavailable_evaluation = { status: evaluationUnavailable.status(), body: evaluationError };
  report.submitted_response = exactResponse;
  report.submitted_evaluation = { status: "unavailable", accepted_evaluation_id: null, saved_evaluation_rows: 0, provider_requests_used: 0 };
  await capture(student, "12c-student-saved-answer-unavailable-evaluation", { fourWidths: true });
  report.checks.push("One explicit UI answer submission preserves exact original text; provider-disabled evaluation returns 503 with honest saved-answer status and no accepted or failed evaluation row fabricated");

  stage = "teacher sees exact submitted ungraded evidence";
  const submittedTeacherResponse = await teacherContext.request.get(new URL(`/api/teacher/sessions/${report.student_session_id}`, origin).href);
  assert.equal(submittedTeacherResponse.status(), 200);
  const submittedTeacher = await submittedTeacherResponse.json();
  const teacherAttempt = submittedTeacher.attempts.find((attempt) => attempt.id === report.presented_attempt_id);
  assert.ok(teacherAttempt);
  assert.equal(submittedTeacher.session.assignment_id, report.assignment_id);
  assert.equal(teacherAttempt.response_text, exactResponse);
  assert.equal(teacherAttempt.submitted_at, submittedAttempt.submitted_at);
  assert.equal(teacherAttempt.current_evaluation_id, null);
  assert.deepEqual(teacherAttempt.question, presented.question);
  assert.equal(submittedTeacher.evaluations.length, 0);
  await teacher.reload();
  await teacher.locator(".lp-evidence-answer").filter({ hasText: exactResponse.trim() }).first().waitFor();
  assert.ok((await teacher.locator(".lp-evidence-answer").allTextContents()).includes(exactResponse));
  await teacher.getByText("Awaiting evaluation. No accepted result yet.", { exact: true }).first().waitFor();
  evidence.teacher_submitted_session = submittedTeacher;
  await capture(teacher, "12d-teacher-exact-submitted-ungraded-evidence");
  report.checks.push("Teacher sees the same exact original student answer, question, assignment, immutable source/version and attempt; UI explicitly says no accepted result yet");

  stage = "new version and history preservation";
  await teacher.goto(publishedURL);
  await teacher.getByRole("heading", { name: "Published version 1", exact: true }).waitFor();
  await teacher.waitForFunction(() => [...document.querySelectorAll("label")].filter((label) => label.textContent.includes("New version name")).length === 1);
  assert.equal(await teacher.getByLabel("New version name", { exact: true }).count(), 1);
  await teacher.getByLabel("New version name", { exact: true }).fill("2");
  await teacher
    .getByLabel(
      "Start from the current saved draft and review the new version before publishing.",
    )
    .check();
  await teacher
    .getByRole("button", { name: "Start new version", exact: true })
    .click();
  await teacher
    .getByText("Draft v2 · revision 7", { exact: true })
    .first()
    .waitFor();
  assert.ok(
    (await teacher.locator("body").innerText()).includes("Draft v2"),
  );
  await capture(teacher, "13-new-version-requires-review");
  const restoredResponse = await studentContext.request.get(
    new URL(`/api/tutoring/${sessionBefore.session.id}`, origin).href,
  );
  assert.equal(restoredResponse.status(), 200);
  const sessionAfter = await restoredResponse.json();
  assert.deepEqual(sessionAfter, submittedSession);
  evidence.session_presented_before_submission = sessionBefore;
  evidence.session_before = submittedSession;
  evidence.session_after = sessionAfter;
  const teacherAfterResponse = await teacherContext.request.get(new URL(`/api/teacher/sessions/${report.student_session_id}`, origin).href);
  assert.equal(teacherAfterResponse.status(), 200);
  assert.deepEqual(await teacherAfterResponse.json(), submittedTeacher);
  await student.reload();
  await student.getByText(specs[0][1], { exact: false }).first().waitFor();
  await student.locator(".lp-answer").filter({ hasText: exactResponse.trim() }).first().waitFor();
  assert.ok((await student.locator(".lp-answer").allTextContents()).includes(exactResponse));
  await student.waitForLoadState("networkidle");
  assert.equal(submissionRequests.filter((request) => request.pathname === answerPath).length, 1);
  assert.equal(submissionRequests.filter((request) => request.pathname === evaluationPath).length, 1);
  student.off("request", observeSubmission);
  await capture(student, "14-session-preserved-after-v2", { fourWidths: true });
  await student.goto(readingURL);
  await student.getByText(quote, { exact: false }).first().waitFor();
  assert.ok((await student.locator("body").innerText()).includes(source));
  await teacher.goto(publishedURL);
  await teacher.getByRole("heading", { name: "Published version 1", exact: true }).waitFor();
  await teacher.locator("summary").filter({ hasText: "Published reading" }).click();
  assert.ok(
    (await teacher.locator("body").innerText()).includes("Published v1"),
  );
  assert.ok(
    (await teacher.locator("body").innerText()).includes("Source version 1"),
  );
  report.new_draft_version = "2";
  report.new_draft_revision = 7;
  report.checks.push(
    "New v2 draft requires fresh review; published v1 remains source-pinned and prior submitted ungraded student and teacher evidence remain byte-equivalent; refresh does not resubmit or retry evaluation",
  );
  report.status = report.viewports.some((entry) => entry.overflow)
    ? "failed-responsive"
    : "passed";
  if (report.status !== "passed") process.exitCode = 1;
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
  const failedStageIndex = report.planned_stages.indexOf(report.failure_stage);
  report.stage_results = report.planned_stages.map((name, index) => ({
    name,
    status: failedStageIndex < 0
      ? "PASS"
      : index < failedStageIndex
        ? "PASS"
        : index === failedStageIndex
          ? "FAIL"
          : "UNRUN",
  }));
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
