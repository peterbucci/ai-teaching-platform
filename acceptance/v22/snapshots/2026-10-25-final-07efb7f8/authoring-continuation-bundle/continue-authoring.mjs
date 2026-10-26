/** Narrow verification continuation of the one hash-pinned failed authoring run. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [stateArg, priorArg, outArg, playwrightArg, safetyArg] = process.argv.slice(2);
for (const value of [stateArg, priorArg, outArg, playwrightArg, safetyArg]) assert.ok(isAbsolute(value || ""));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const state = realpathSync(stateArg), priorPath = realpathSync(priorArg), safetyPath = realpathSync(safetyArg);
const priorBytes = readFileSync(priorPath);
assert.equal(hash(priorBytes), "d0e934029f6666f2b5945697c296b959efb7a610a6dcefbf15b3e79c5eda202e");
const prior = JSON.parse(priorBytes);
const priorEvidencePath = join(dirname(priorPath), "api-evidence.json");
const priorEvidenceBytes = readFileSync(priorEvidencePath);
assert.equal(hash(priorEvidenceBytes), "ffbf7b95b3d39c33504d809547a2627d693b706ff054728437e966641e39f46b");
const priorEvidence = JSON.parse(priorEvidenceBytes);
assert.equal(prior.status, "failed");
assert.equal(prior.failure_stage, "new version and history preservation");
assert.match(prior.error, /Published version 1/);
assert.equal(prior.original_response, undefined);
const manifest = JSON.parse(readFileSync(join(state, "manifest.json"), "utf8"));
for (const [key, value] of Object.entries({
  target: "shell", project: "lp-v22-final-01a173d6", origin: "http://localhost:3396",
  sourceSha: "07efb7f821339538800f150f57b298eb2e606be3", sourceTree: "948b9a6005a056c97f10d181c589b5352d6221f3",
})) { assert.equal(manifest[key], value); assert.equal(prior[key], value); }
assert.equal(manifest.paidModelCallsAuthorized, false);
assert.equal(prior.paid_calls, 0);
assert.equal(hash(readFileSync(safetyPath)), "af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485");
const { acquireLock, preflight, MIN_RUNTIME_GIB, writeReceipt } = await import(pathToFileURL(safetyPath).href);
const source = realpathSync(manifest.source);
const out = join(realpathSync(dirname(outArg)), resolve(outArg).split(/[\\/]/).at(-1));
assert.equal(existsSync(out), false);
const relativeOut = relative(source, out);
assert.ok(isAbsolute(relativeOut) || relativeOut === ".." || relativeOut.startsWith(`..${sep}`));
const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true, shell: false, timeout: 20000 });
  assert.equal(result.status, 0, `${cmd} identity query failed`);
  return result.stdout.trim();
};
assert.equal(run("git", ["-C", source, "rev-parse", "HEAD"]), manifest.sourceSha);
assert.equal(run("git", ["-C", source, "rev-parse", "HEAD^{tree}"]), manifest.sourceTree);
assert.equal(run("git", ["-C", source, "status", "--porcelain"]), "");
const environment = Object.fromEntries(readFileSync(join(state, ".env.acceptance"), "utf8").trim().split(/\r?\n/).map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
assert.equal(environment.AUTH_URL, manifest.origin);
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"]) assert.equal(environment[key], "");
const origin = manifest.origin;
const sessionPath = `/api/tutoring/${prior.student_session_id}`;
const answerPath = `/api/sessions/${prior.student_session_id}/answers`;
const conversationPath = `${sessionPath}/conversation`;
const expectedStudent = "10000000-0000-4000-8000-000000000002";
const originalResponse = "  I think evaporation makes liquid water stop existing rather than changing its state.\nThis is an original fictional acceptance response.  ";
const helpText = "What does water vapor mean in the reading?";
const nextDraft = priorEvidence.teacher.find((item) => item.url.endsWith(`/api/teacher/lessons/${prior.lesson_id}/versions`))?.body;
assert.deepEqual(nextDraft, { lesson_id: prior.lesson_id, version: "2", revision: 7 });
assert.deepEqual(priorEvidence.session_before, priorEvidence.session_after);
assert.equal(priorEvidence.session_before.attempts[0].id, prior.presented_attempt_id);
assert.equal(priorEvidence.session_before.attempts[0].response_text, null);
mkdirSync(out);
const report = {
  target: prior.target, project: prior.project, sourceSha: prior.sourceSha, sourceTree: prior.sourceTree,
  sha: prior.sha, tree: prior.tree, origin, run_id: prior.run_id, paid_calls: 0,
  started_at_utc: new Date().toISOString(), status: "running", functional_completed_through: null,
  fixture_scope: prior.fixture_scope, configuration: prior.configuration,
  source_id: prior.source_id, source_version: prior.source_version, lesson_id: prior.lesson_id,
  prepared_revision: prior.prepared_revision, published_version: prior.published_version,
  content_ref: prior.content_ref, assignment_id: prior.assignment_id, class_id: prior.class_id,
  assignment_handoff: prior.assignment_handoff, student_session_id: prior.student_session_id,
  student_session_url: prior.student_session_url, presented_attempt_id: prior.presented_attempt_id,
  inherited_checks: prior.checks.map((check) => ({ check, report: priorPath, sourceSha: prior.sourceSha, report_sha256: hash(priorBytes) })),
  resumed_from: { report: priorPath, report_sha256: hash(priorBytes), api_evidence: priorEvidencePath, api_evidence_sha256: hash(priorEvidenceBytes), status: prior.status, failure_stage: prior.failure_stage, error: prior.error, scope: "No earlier authoring/assignment/version mutation is repeated. Existing state must reconcile before new help/answer actions." },
  checks: [], mutations: [], blocked_requests: [], viewports: [], screenshots: [],
  prior_screenshots: { report: priorPath, files: prior.screenshots },
  unrun: ["Actual-model generation/evaluation", "Screen reader and physical device", "Full teacher/student/intervention chain pending separate synthetic evaluation/draft continuation"],
  harness_sha256: hash(readFileSync(fileURLToPath(import.meta.url))),
};
const evidence = { inherited: report.resumed_from, reconciled: {}, continued: {} };
const guard = { status: "prepared", sourceSha: manifest.sourceSha, sourceTree: manifest.sourceTree, project: manifest.project, out, safety_sha256: hash(readFileSync(safetyPath)), observations: [] };
const save = () => {
  writeReceipt(join(out, "report.json"), report);
  writeReceipt(join(out, "api-evidence.json"), evidence);
  writeReceipt(join(out, "guard-receipt.json"), guard);
};
let release, browser, teacher, student, teacherContext, studentContext;
let stage = "preflight", uncertain = false, browserClosed = false, allowed = null;
let autoEvaluationResponse = null;
const preflightStage = (label) => {
  const observed = preflight({ source, state, minimumGiB: MIN_RUNTIME_GIB, explicitPath: manifest.dockerDataPath, probeContainer: manifest.storageProbeContainer });
  guard.observations.push({ label, ...observed }); save(); assert.equal(observed.pass, true, `Storage gate ${label}`);
};
const bounded = async (label, promise) => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timeout; reconcile before retry`)), 20000); })]); }
  finally { clearTimeout(timer); }
};
async function get(context, path) {
  const response = await context.request.get(origin + path, { timeout: 15000 });
  assert.equal(response.status(), 200, `GET ${path}`);
  return bounded(`GET body ${path}`, response.json());
}
function verifyOriginal(privateView, unanswered) {
  assert.equal(privateView.session.id, prior.student_session_id);
  assert.equal(privateView.session.assignment_id, prior.assignment_id);
  assert.equal(privateView.session.class_id, prior.class_id);
  assert.equal(privateView.session.student_id, expectedStudent);
  const attempt = privateView.attempts.find((item) => item.id === prior.presented_attempt_id);
  assert.ok(attempt); assert.deepEqual(attempt.question.content_ref, prior.content_ref);
  assert.equal(attempt.response_text, unanswered ? null : originalResponse);
  if (unanswered) { assert.equal(attempt.submitted_at, null); assert.equal(attempt.current_evaluation_id, null); }
  else { assert.ok(attempt.submitted_at); assert.match(attempt.submission_key, /^[a-f0-9-]{36}$/); }
  return attempt;
}
async function capture(page, name) {
  const before = page.viewportSize();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 844 }]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const file = `${name}-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: join(out, file), fullPage: false, timeout: 15000 });
    report.viewports.push({ ...viewport, page: name, overflow }); report.screenshots.push(file); save();
  }
  await page.setViewportSize(before);
}
async function clickAction(label, path, action) {
  preflightStage(label); assert.equal(uncertain, false);
  allowed = { path, remaining: 1 };
  uncertain = true; stage = label; save();
  const pending = student.waitForResponse((response) => new URL(response.url()).pathname === path && response.request().method() === "POST");
  await action();
  const response = await bounded(`${label} response`, pending);
  assert.equal(response.status(), 200, `${label} must acknowledge successfully`);
  const body = await bounded(`${label} body`, response.json());
  allowed = null;
  evidence.continued[label] = { status: response.status(), request: response.request().postDataJSON(), body };
  save(); return body;
}
try {
  release = acquireLock({ action: "authoring-01-narrow-continuation", source, state, out, sourceSha: manifest.sourceSha });
  preflightStage("initial");
  const container = JSON.parse(run("docker", ["inspect", `${manifest.project}-app-1`]))[0];
  assert.equal(container.Config.Image, `${manifest.project}:${manifest.sourceSha}`);
  assert.equal(container.Config.Labels["com.docker.compose.project"], manifest.project);
  const runtimeEnv = Object.fromEntries(container.Config.Env.map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
  assert.equal(runtimeEnv.AUTH_URL, origin); for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"]) assert.equal(runtimeEnv[key], "");
  guard.image = container.Image;
  const { chromium } = createRequire(import.meta.url)(realpathSync(playwrightArg));
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
  teacherContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  studentContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  for (const [role, context] of [["teacher", teacherContext], ["student", studentContext]]) {
    let loginAllowed = true;
    await context.route("**/*", async (route) => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin && !["data:", "blob:"].includes(url.protocol)) { report.blocked_requests.push({ role, method: request.method(), url: url.href }); return route.abort(); }
      if (["GET", "HEAD", "OPTIONS"].includes(request.method())) return route.continue();
      if (loginAllowed && url.pathname === "/api/auth/demo-sign-in" && request.method() === "POST") { loginAllowed = false; return route.continue(); }
      if (role === "student" && request.method() === "POST" && allowed?.path === url.pathname && allowed.remaining === 1) {
        allowed.remaining--; report.mutations.push({ stage, method: "POST", url: url.href, body: request.postDataJSON() }); save(); return route.continue();
      }
      if (role === "student" && stage === "submit-original-answer" && request.method() === "POST" && url.pathname === sessionPath && !report.automatic_evaluation_requested) {
        report.automatic_evaluation_requested = true;
        report.mutations.push({ stage: "automatic-provider-disabled-evaluation", method: "POST", url: url.href, body: request.postDataJSON() }); save(); return route.continue();
      }
      report.blocked_requests.push({ role, method: request.method(), url: url.href }); save(); return route.abort("blockedbyclient");
    });
  }
  teacher = await teacherContext.newPage(); student = await studentContext.newPage();
  for (const page of [teacher, student]) page.setDefaultTimeout(15000);
  student.on("response", (response) => { if (response.request().method() === "POST" && new URL(response.url()).pathname === sessionPath) autoEvaluationResponse = response; });
  await teacher.goto(origin + "/login"); await teacher.getByRole("button", { name: "Demo teacher", exact: true }).click(); await teacher.waitForURL("**/teacher");
  await student.goto(origin + "/login"); await student.getByRole("button", { name: "Demo student", exact: true }).click(); await student.waitForURL("**/study/assignments");

  stage = "read-only-reconciliation"; preflightStage(stage);
  const draft = await get(teacherContext, `/api/teacher/objectives/${prior.lesson_id}`);
  assert.equal(draft.lesson.id, prior.lesson_id); assert.equal(draft.lesson.revision, 7);
  assert.equal(draft.lesson.draft.content_ref.content_version, "2");
  assert.equal(draft.lesson.draft.content_ref.source_id, prior.source_id);
  assert.equal(draft.lesson.draft.content_ref.source_version, prior.source_version);
  const assignment = await get(teacherContext, `/api/teacher/assignments/${prior.assignment_id}/approval`);
  assert.equal(assignment.id, prior.assignment_id); assert.equal(assignment.class_id, prior.class_id);
  assert.deepEqual(assignment.content_ref, prior.content_ref); assert.ok(assignment.teacher_approved_at);
  const { review_token: _token, ...safeAssignment } = assignment; void _token;
  const before = await get(studentContext, sessionPath);
  assert.deepEqual(before, priorEvidence.session_after);
  const privateBefore = await get(teacherContext, `/api/teacher/sessions/${prior.student_session_id}`);
  verifyOriginal(privateBefore, true);
  const conversationBefore = await get(studentContext, conversationPath);
  assert.equal(conversationBefore.messages.length, 0);
  assert.equal(conversationBefore.dialogue.state.provider_requests_used, 0);
  evidence.reconciled = { draft, assignment: safeAssignment, public_session: before, teacher_session: privateBefore, conversation: conversationBefore };
  await teacher.goto(prior.assignment_handoff.published_url);
  await teacher.locator(".la-publication-status").filter({ hasText: "Published version 1" }).waitFor();
  await teacher.getByText("Published v1 · immutable", { exact: true }).waitFor();
  const handoff = teacher.getByRole("link", { name: "Prepare assignment from version 1", exact: true });
  const href = new URL(await handoff.getAttribute("href"), origin);
  assert.equal(href.searchParams.get("lesson"), prior.lesson_id); assert.equal(href.searchParams.get("version"), "1");
  report.new_draft_version = "2"; report.new_draft_revision = 7;
  report.checks.push("Read-only reconciliation verified existing draft v2/revision7, published v1, active exact-v1 assignment, original unanswered session/attempt and empty conversation before any new action.");
  await capture(teacher, "published-v1-after-v2-reconciled");

  await student.goto(prior.student_session_url);
  const composer = student.getByRole("textbox", { name: "Message your tutor", exact: true });
  await composer.waitFor(); await composer.fill(helpText);
  await clickAction("send-help-question", conversationPath, () => student.getByRole("button", { name: "Send", exact: true }).click());
  await student.getByRole("button", { name: "I’m asking for help", exact: true }).last().waitFor();
  const afterSend = await get(studentContext, conversationPath);
  assert.equal(afterSend.messages.length, 1);
  assert.equal(afterSend.messages[0].text, helpText);
  assert.equal(afterSend.messages[0].attempt_id, prior.presented_attempt_id);
  assert.equal(afterSend.messages[0].outcome.status, "clarification");
  verifyOriginal(await get(teacherContext, `/api/teacher/sessions/${prior.student_session_id}`), true);
  evidence.continued.after_send = afterSend; uncertain = false; save();
  await clickAction("clarify-help-intent", conversationPath, () => student.getByRole("button", { name: "I’m asking for help", exact: true }).last().click());
  await student.getByText("Conversational help is unavailable for this step.", { exact: false }).waitFor();
  const afterHelp = await get(studentContext, conversationPath);
  const helpPublic = await get(studentContext, sessionPath);
  const helpPrivate = await get(teacherContext, `/api/teacher/sessions/${prior.student_session_id}`);
  verifyOriginal(helpPrivate, true);
  assert.deepEqual(helpPrivate.interventions, privateBefore.interventions);
  assert.equal(afterHelp.dialogue.state.provider_requests_used, 0);
  assert.equal(afterHelp.messages.at(-1).request_id, afterSend.messages[0].request_id);
  assert.equal(afterHelp.messages.at(-1).text, helpText);
  assert.equal(afterHelp.messages.at(-1).outcome.status, "fallback");
  evidence.continued.help_fallback = { conversation: afterHelp, session: helpPublic, teacher_session: helpPrivate };
  uncertain = false; report.checks.push("Actual help question and explicit help clarification preserved the unanswered attempt; provider-disabled fallback consumed zero provider requests. No generated help is claimed."); save();
  await capture(student, "help-clarified-not-graded");

  assert.deepEqual(await get(studentContext, sessionPath), helpPublic);
  report.original_response = originalResponse; await composer.fill(originalResponse);
  const evaluationFinished = student.waitForResponse((response) => new URL(response.url()).pathname === sessionPath && response.request().method() === "POST");
  const acknowledgement = await clickAction("submit-original-answer", answerPath, () => student.getByRole("button", { name: "Submit this as my answer", exact: true }).click());
  assert.equal(acknowledgement.session.id, prior.student_session_id);
  assert.equal(acknowledgement.attempts.find((item) => item.id === prior.presented_attempt_id)?.response_text, originalResponse);
  await student.getByText("Your answer — saved", { exact: false }).first().waitFor();
  autoEvaluationResponse = await bounded("automatic provider-disabled evaluation", evaluationFinished);
  assert.equal(report.automatic_evaluation_requested, true);
  evidence.continued.automatic_evaluation = { status: autoEvaluationResponse.status(), body: await bounded("automatic evaluation body", autoEvaluationResponse.json()) };
  const savedPublic = await get(studentContext, sessionPath);
  const savedPrivate = await get(teacherContext, `/api/teacher/sessions/${prior.student_session_id}`);
  const savedAttempt = verifyOriginal(savedPrivate, false);
  const submission = report.mutations.find((item) => item.stage === "submit-original-answer").body;
  assert.equal(submission.attempt_id, savedAttempt.id); assert.equal(submission.response_text, originalResponse);
  assert.equal(submission.submission_key, savedAttempt.submission_key);
  assert.equal(savedPublic.attempts.find((item) => item.id === savedAttempt.id).response_text, originalResponse);
  assert.equal(report.mutations.filter((item) => item.stage === "submit-original-answer").length, 1);
  const finalConversation = await get(studentContext, conversationPath);
  assert.equal(finalConversation.dialogue.state.provider_requests_used, 0);
  assert.ok(!savedPrivate.evaluations.some((item) => item.validation_status === "pending"));
  evidence.continued.submitted_session = savedPublic; evidence.continued.teacher_original_session = savedPrivate;
  evidence.continued.conversation = finalConversation;
  uncertain = false; stage = "read-only-final-inspection"; report.student_id = expectedStudent; save();
  await student.reload(); await student.getByText("Your answer — saved", { exact: false }).first().waitFor();
  assert.deepEqual(await get(studentContext, sessionPath), savedPublic);
  await capture(student, "original-answer-saved");
  await teacher.goto(`${origin}/teacher/sessions/${prior.student_session_id}?assignment=${prior.assignment_id}&origin=all`);
  await teacher.getByRole("heading", { name: "Original student response", exact: true }).first().waitFor();
  assert.ok((await teacher.locator("body").innerText()).includes(originalResponse.trim()));
  await capture(teacher, "teacher-original-evidence");
  assert.deepEqual(await get(teacherContext, `/api/teacher/sessions/${prior.student_session_id}`), savedPrivate);
  assert.equal(report.blocked_requests.filter((item) => item.method !== "GET").length, 0);
  report.checks.push("One intended answer preserved exact whitespace, original attempt/submission identity and published v1 source; student refresh did not resubmit; teacher inspected exact original evidence.");
  report.functional_completed_through = "teacher-original-evidence";
  report.full_journey = "Prior hash-pinned source→objectives→questions→approval→publication→inactive assignment→activation steps plus this reconciled same-record help/answer/teacher continuation. Accepted synthetic evaluation and intervention remain separate subsequent seams.";
  report.status = report.viewports.some((item) => item.overflow) ? "failed-responsive" : "passed";
} catch (error) {
  report.status = "failed"; report.failure_stage = stage; report.error = error.message; process.exitCode = 1;
  for (const [name, page] of [["teacher", teacher], ["student", student]]) if (page) { try { await page.screenshot({ path: join(out, `failure-${name}.png`), timeout: 10000 }); } catch {} }
} finally {
  report.checked_at_utc = new Date().toISOString();
  try { if (browser) await bounded("browser close", browser.close()); browserClosed = true; } catch (error) { report.close_error = error.message; process.exitCode = 1; }
  guard.status = report.status; guard.uncertain_mutation = uncertain;
  guard.lockRetained = Boolean(release && (uncertain || !browserClosed));
  guard.finishedAt = new Date().toISOString(); save();
  if (release && !guard.lockRetained) release();
  if (report.status !== "passed") process.exitCode = 1;
  console.log(JSON.stringify({ status: report.status, out, failure_stage: report.failure_stage, lockRetained: guard.lockRetained }));
}
