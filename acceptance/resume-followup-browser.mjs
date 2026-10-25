/** Real UI follow-up to an explicitly supplied teacher delivery. No injected outcomes. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, join } from "node:path";
import {
  contentReady,
  teacherReady,
  readinessSha256,
} from "./browser-readiness.mjs";

const [base, output, sha, draftId, approvalId, deliveryId] =
  process.argv.slice(2);
const expectedSha = "45326e243245c4941e2cefd0eab984bb7ee19765";
const project = "lp-accept-recovery-01a1714f";
const studentId = "10000000-0000-4000-8000-000000000003";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
assert.equal(process.argv.length, 8);
assert.equal(base, "http://localhost:3355");
assert.equal(sha, expectedSha);
assert.ok(
  output && isAbsolute(output) && !existsSync(output),
  "Use a fresh absolute output directory",
);
for (const id of [draftId, approvalId, deliveryId])
  assert.match(id ?? "", uuid);
const setup = process.env.ACCEPTANCE_SETUP;
assert.ok(
  setup && isAbsolute(setup),
  "Supply the initialized recovery state through ACCEPTANCE_SETUP",
);
const manifest = JSON.parse(readFileSync(join(setup, "manifest.json"), "utf8"));
assert.equal(manifest.project, project);
assert.equal(manifest.origin, base);
assert.equal(manifest.sourceSha, sha);
assert.equal(manifest.paidModelCallsAuthorized, false);
const config = Object.fromEntries(
  readFileSync(join(setup, ".env.acceptance"), "utf8")
    .split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const at = line.indexOf("=");
      return [
        line.slice(0, at),
        line.slice(at + 1).replace(/^['"]|['"]$/g, ""),
      ];
    }),
);
assert.ok(!config.OPENAI_API_KEY, "Provider configuration must be disabled");
assert.ok(!config.OPENAI_MODEL, "Provider configuration must be disabled");
assert.equal(config.AUTH_URL, base);
assert.ok(config.DEMO_STUDENT_TWO_EMAIL && config.DEMO_STUDENT_TWO_PASSWORD);
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
mkdirSync(output, { recursive: true });
const planned = [
  "F01 exact delivered fixture and private projection",
  "F02 nonrecipient denied",
  "F03 assigned review navigation and actual display acknowledgement",
  "F04 explicit fresh check and unsent refresh preservation",
  "F05 real UI submission preserves answer with provider-disabled failure",
  "F06 reload preserves saved followup without duplicate submission",
  "F07 teacher comparison preserves approval and exact original evidence",
  ...[1440, 1024, 390, 320].map((width) => `F08 followup layout ${width}`),
];
const report = {
  readinessSha256,
  sourceSha: sha,
  base,
  project,
  draftId,
  approvalId,
  deliveryId,
  harnessSha256: createHash("sha256")
    .update(readFileSync(new URL(import.meta.url)))
    .digest("hex"),
  startedAt: new Date().toISOString(),
  result: "incomplete",
  category:
    "Real teacher-delivery-to-student-to-teacher browser journey; fictional authored response and synthetic original evidence; provider disabled; no injected follow-up evaluation",
  cases: [],
  screenshots: [],
  unrun: [
    "Accepted model evaluation and accepted-result comparison (provider disabled)",
    "Native browser zoom and screen reader",
  ],
};
const save = () => {
  report.passed = report.cases
    .filter((item) => item.status === "pass")
    .map((item) => item.id);
  report.failed = report.cases
    .filter((item) => item.status === "fail")
    .map((item) => item.id);
  report.unrunCases = planned.filter(
    (id) => !report.cases.some((item) => item.id === id),
  );
  writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2));
};
const evidence = (name, value) =>
  writeFileSync(join(output, name), JSON.stringify(value, null, 2), {
    flag: "wx",
  });
let activeCase = "initialization";
async function check(id, fn) {
  activeCase = id;
  const details = await fn();
  report.cases.push({ id, status: "pass", details });
  save();
}
async function get(context, path) {
  const response = await context.request.get(base + path);
  assert.equal(response.status(), 200, `Read failed: ${path}`);
  return response.json();
}
async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: join(output, file), fullPage: true });
  report.screenshots.push(file);
}
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
const teacher = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const student = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const t = await teacher.newPage();
const s = await student.newPage();
t.setDefaultTimeout(20000);
s.setDefaultTimeout(20000);
s.on("dialog", (dialog) => dialog.accept());
const reviewPath = `/api/teacher/interventions/${draftId}`;
const studentPath = `/api/student/interventions/${approvalId}`;
const followupPath = `${studentPath}/followup`;
const writes = [];
s.on("request", (request) => {
  if (
    request.method() === "POST" &&
    request.url().startsWith(base + studentPath)
  )
    writes.push({ url: request.url(), action: request.postDataJSON()?.action });
});
let initial, publicActivity, saved, comparison;
const answer = `Fictional recovery follow-up ${approvalId}:\nTransmission time depends on the amount of data and the link rate. Propagation depends on distance and signal speed. I would compare these quantities separately before deciding which change improves the path.`;
try {
  save();
  await t.goto(base + "/login");
  await t.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await t.waitForURL("**/teacher");
  await teacherReady(t, "/teacher");
  await s.goto(base + "/login");
  await s
    .getByRole("textbox", { name: "Demo email", exact: true })
    .fill(config.DEMO_STUDENT_TWO_EMAIL);
  await s
    .getByLabel("Password", { exact: true })
    .fill(config.DEMO_STUDENT_TWO_PASSWORD);
  await s.getByRole("button", { name: "Sign in", exact: true }).click();
  await s.waitForURL(/\/study/);
  await check(planned[0], async () => {
    initial = await get(teacher, reviewPath);
    assert.equal(initial.draft.id, draftId);
    assert.equal(initial.approval?.id, approvalId);
    assert.equal(initial.delivery?.id, deliveryId);
    assert.equal(initial.delivery.approval_id, approvalId);
    assert.deepEqual(initial.approval.recipient_ids, [studentId]);
    assert.deepEqual(initial.delivery.recipient_ids, [studentId]);
    publicActivity = await get(student, studentPath);
    assert.equal(publicActivity.approval_id, approvalId);
    assert.equal(publicActivity.draft_id, draftId);
    assert.deepEqual(publicActivity.content_ref, initial.approval.content_ref);
    assert.equal(
      publicActivity.activity.title,
      initial.approval.activity.title,
    );
    assert.equal(
      publicActivity.activity.fresh_check.prompt_text,
      initial.approval.activity.fresh_check.prompt_text,
    );
    const keys = new Set();
    const collect = (value) => {
      if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === "object")
        for (const [key, child] of Object.entries(value)) {
          keys.add(key);
          collect(child);
        }
    };
    collect(publicActivity);
    for (const key of [
      "answer_guidance",
      "criteria",
      "evidence",
      "evidence_references",
      "suggested_recipients",
      "rationale",
    ])
      assert.equal(keys.has(key), false, `Private field disclosed: ${key}`);
    const fresh = await get(student, followupPath);
    assert.equal(
      fresh.started_at,
      null,
      "Use a delivery with an unstarted Student Two follow-up",
    );
    assert.equal(fresh.submitted_at, null);
    assert.equal(
      publicActivity.displayed_at,
      null,
      "Use a newly delivered activity for actual display verification",
    );
    evidence("approved-delivery-before.json", initial);
    evidence("student-public-activity.json", publicActivity);
    return {
      studentId,
      approvedRevision: initial.approval.approved_revision,
      freshFollowup: true,
    };
  });
  await check(planned[1], async () => {
    const outsider = await browser.newContext();
    try {
      const p = await outsider.newPage();
      await p.goto(base + "/login");
      await p
        .getByRole("button", { name: "Demo student", exact: true })
        .click();
      await p.waitForURL(/\/study/);
      for (const path of [studentPath, followupPath])
        assert.equal((await outsider.request.get(base + path)).status(), 404);
      return {
        actor: "Student One, not selected for this activity",
        statuses: [404, 404],
      };
    } finally {
      await outsider.close();
    }
  });
  await check(planned[2], async () => {
    await s.goto(base + "/study/assignments");
    await s.locator(`a[href="/study/interventions/${approvalId}"]`).click();
    await s.waitForURL(`**/study/interventions/${approvalId}`);
    const activity = s.locator(".lp-review-activity");
    await activity
      .getByRole("heading", {
        name: publicActivity.activity.title,
        exact: true,
      })
      .waitFor();
    assert.ok(
      (await activity.innerText()).includes(
        publicActivity.activity.exercise_text,
      ),
    );
    await s.locator(".lp-review-explanation").scrollIntoViewIfNeeded();
    await s
      .getByRole("button", { name: "Start fresh check", exact: true })
      .waitFor();
    // Wait for the visible-content acknowledgement triggered by the application observer.
    for (let attempt = 0; attempt < 20; attempt++) {
      if ((await get(student, studentPath)).displayed_at) break;
      await s.waitForTimeout(250);
    }
    assert.ok((await get(student, studentPath)).displayed_at);
    assert.ok(writes.some((item) => item.action === "displayed"));
    const untouched = await get(student, followupPath);
    assert.equal(untouched.started_at, null);
    assert.equal(untouched.submitted_at, null);
    await shot(s, "student-delivered-activity");
    return {
      navigatedFromAssignments: true,
      actuallyDisplayed: true,
      openingCreatedNoFollowup: true,
    };
  });
  await check(planned[3], async () => {
    const result = s.waitForResponse(
      (response) =>
        response.url() === base + followupPath &&
        response.request().method() === "POST",
    );
    await s
      .getByRole("button", { name: "Start fresh check", exact: true })
      .click();
    assert.equal((await result).status(), 200);
    await s.locator("#intervention-response").fill(answer);
    const started = await get(student, followupPath);
    assert.ok(started.started_at && started.attempt_id);
    assert.equal(started.submitted_at, null);
    assert.equal(started.response_text, null);
    await s.reload();
    await s.locator("#intervention-response").waitFor();
    assert.equal(
      await s.locator("#intervention-response").inputValue(),
      answer,
    );
    const after = await get(student, followupPath);
    assert.equal(after.attempt_id, started.attempt_id);
    assert.equal(after.submitted_at, null);
    return {
      attemptId: started.attempt_id,
      unsentTextPreserved: true,
      noSubmissionOnReload: true,
    };
  });
  await check(planned[4], async () => {
    const result = s.waitForResponse(
      (response) =>
        response.url() === base + followupPath &&
        response.request().method() === "POST",
    );
    await s
      .getByRole("button", { name: "Submit fresh-check response", exact: true })
      .click();
    assert.equal((await result).status(), 200);
    await s.locator(".lp-followup-saved").waitFor();
    saved = await get(student, followupPath);
    assert.equal(saved.response_text, answer);
    assert.ok(saved.submitted_at);
    assert.equal(saved.evaluation_status, "failed");
    assert.deepEqual(saved.results, []);
    assert.ok(
      saved.assistance && saved.assistance.assistance_level !== "none_recorded",
    );
    assert.equal(
      await s.locator(".lp-followup-saved blockquote").textContent(),
      answer,
    );
    await s
      .locator(".lp-followup-saved")
      .getByRole("heading", { name: "Evaluation failed", exact: true })
      .waitFor();
    evidence("student-saved-followup.json", saved);
    await shot(s, "student-saved-provider-disabled");
    return {
      attemptId: saved.attempt_id,
      evaluationStatus: saved.evaluation_status,
      results: saved.results,
      assistance: saved.assistance,
      actualModelCallsClaim:
        "None: model configuration disabled; no accepted evaluation inferred",
    };
  });
  await check(planned[5], async () => {
    const beforeWrites = writes.length;
    await s.reload();
    await s.locator(".lp-followup-saved").waitFor();
    await contentReady(s, {
      selector: '.lp-followup-response[aria-busy="false"]',
    });
    const after = await get(student, followupPath);
    for (const key of [
      "attempt_id",
      "submitted_at",
      "response_text",
      "evaluation_status",
      "evaluation_id",
      "assistance",
      "results",
    ])
      assert.deepEqual(after[key], saved[key]);
    assert.equal(
      writes.length,
      beforeWrites,
      "Reload must not repeat display/start/submission writes",
    );
    assert.equal(writes.filter((item) => item.action === "start").length, 1);
    assert.equal(writes.filter((item) => item.action === "submit").length, 1);
    assert.equal(writes.filter((item) => item.action === "retry").length, 0);
    return { immutableSavedFields: true, writes };
  });
  await check(planned[6], async () => {
    const query = new URLSearchParams({
      assignment: initial.approval.assignment_id,
      origin: "synthetic_fixture",
      draft: draftId,
    });
    await t.goto(`${base}/teacher/interventions?${query}`);
    await teacherReady(t, "/teacher/interventions");
    await t
      .getByRole("heading", {
        name: "Before and after the activity",
        exact: true,
      })
      .waitFor();
    const refresh = t.getByRole("button", {
      name: "Refresh follow-up",
      exact: true,
    });
    await refresh.click();
    await t.locator('.lp-intervention-followup[aria-busy="false"]').waitFor();
    comparison = await get(teacher, `${reviewPath}/followup`);
    assert.equal(comparison.approval_id, approvalId);
    assert.equal(comparison.draft_id, draftId);
    assert.equal(
      comparison.approved_revision,
      initial.approval.approved_revision,
    );
    assert.deepEqual(comparison.content_ref, initial.approval.content_ref);
    assert.deepEqual(comparison.original_evidence, initial.approval.evidence);
    assert.equal(comparison.recipients.length, 1);
    const recipient = comparison.recipients[0];
    assert.equal(recipient.student_id, studentId);
    assert.equal(recipient.followup.response_text, answer);
    assert.equal(recipient.attempt.id, saved.attempt_id);
    assert.equal(recipient.attempt.response_text, answer);
    assert.deepEqual(
      recipient.attempt.question,
      initial.approval.activity.fresh_check,
    );
    assert.deepEqual(recipient.followup.assistance, saved.assistance);
    assert.equal(recipient.followup.evaluation_status, "failed");
    assert.deepEqual(comparison.counts, {
      intended: 1,
      started: 1,
      submitted: 1,
      missing: 0,
      accepted: 0,
      pending: 0,
      failed: 1,
      uncertain: 0,
    });
    const card = t.locator(".lp-followup-recipient");
    assert.equal(await card.count(), 1);
    await card.locator(":scope > summary").click();
    assert.equal(
      await card.locator(".lp-followup-after blockquote").textContent(),
      answer,
    );
    await card
      .locator(".lp-followup-after")
      .getByRole("heading", { name: "Evaluation failed", exact: true })
      .waitFor();
    const originals = comparison.original_evidence.observations.filter(
      (item) => item.student_id === studentId,
    );
    const originalCards = card.locator(".lp-followup-original");
    assert.equal(await originalCards.count(), originals.length);
    for (let index = 0; index < originals.length; index++) {
      await originalCards.nth(index).locator(":scope > summary").click();
      assert.equal(
        await originalCards.nth(index).locator("blockquote").textContent(),
        originals[index].attempt.response_text,
      );
    }
    if (!originals.length)
      await card
        .getByText(
          "No response from this recipient was included in the approved draft’s original evidence snapshot.",
          { exact: true },
        )
        .waitFor();
    const after = await get(teacher, reviewPath);
    assert.deepEqual(after.approval, initial.approval);
    assert.deepEqual(after.delivery, initial.delivery);
    evidence("teacher-comparison.json", comparison);
    await shot(t, "teacher-before-after");
    return {
      sessionId: recipient.session_id,
      counts: comparison.counts,
      originalRecipientResponsesShown: originals.length,
      entireOriginalEvidenceUnchanged: true,
      approvalAndDeliveryUnchanged: true,
    };
  });
  for (const width of [1440, 1024, 390, 320]) {
    await check(`F08 followup layout ${width}`, async () => {
      for (const [name, page] of [
        ["student", s],
        ["teacher", t],
      ]) {
        await page.setViewportSize({ width, height: 900 });
        const dimensions = await page.evaluate(() => ({
          viewport: innerWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        assert.ok(
          dimensions.scroll <= dimensions.viewport + 2,
          `${name} horizontal overflow at ${width}`,
        );
        await shot(page, `${name}-followup-${width}`);
      }
      return { width, studentAndTeacher: true };
    });
  }
  report.result = "pass";
} catch (error) {
  report.cases.push({ id: activeCase, status: "fail", error: error.message });
  report.result = "fail";
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  save();
  await browser.close();
  console.log(
    JSON.stringify({
      output,
      result: report.result,
      passed: report.passed,
      failed: report.failed,
      unrun: report.unrunCases,
    }),
  );
}
