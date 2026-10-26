/** Draft browser assertions, not a launcher. Import from the independent runner.
 * No browser action ran during preparation. Contexts must use the recorded disposable origin.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const viewports = [
  { width: 1440, height: 1000 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
];
const messages = {
  correct: "Your answer is correct.",
  partially_correct: "Your latest answer is partly correct.",
  incorrect: "Your latest answer is not correct yet.",
  uncertain: "Your latest answer could not be assessed with confidence.",
};
async function get(context, base, route) {
  const response = await context.request.get(new URL(route, base).href);
  assert.equal(
    response.status(),
    200,
    `Read-only check failed for ${route}: ${response.status()}`,
  );
  return response.json();
}

/** Rendering normal app feedback is the only operation that may acknowledge it. */
export async function displayPendingFeedback({
  page,
  studentContext,
  base,
  fixture,
}) {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
  await page.goto(new URL(fixture.url, base).href);
  await page.locator(".lp-turns").waitFor();
  let view = await get(
    studentContext,
    base,
    `/api/tutoring/${fixture.session_id}`,
  );
  for (const feedback of view.interventions.filter(
    (item) => item.delivery_status === "created",
  )) {
    const target = page.locator(`#feedback-${feedback.id}`);
    await target.scrollIntoViewIfNeeded();
    await target.waitFor({ state: "visible" });
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      view = await get(
        studentContext,
        base,
        `/api/tutoring/${fixture.session_id}`,
      );
      if (
        view.interventions.find((item) => item.id === feedback.id)
          ?.delivery_status === "displayed"
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(
      view.interventions.find((item) => item.id === feedback.id)
        ?.delivery_status,
      "displayed",
      "Visible feedback was not acknowledged by the normal UI; stop fixture progression.",
    );
  }
  return { phase: view.progress.phase, status: view.session.status };
}

/** Run after all real controller steps and visible feedback receipts have completed. */
export async function captureCompletedResult({
  page,
  studentContext,
  teacherContext,
  base,
  fixture,
  out,
  sourceSha,
}) {
  assert.equal(fixture.source_sha, sourceSha);
  assert.ok(messages[fixture.kind]);
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
  assert.equal(
    fixture.receipt.status,
    "completed",
    "Keep nonterminal phases as observations, not completed-result passes.",
  );
  mkdirSync(out, { recursive: true });
  const report = {
    source_sha: sourceSha,
    kind: fixture.kind,
    session_id: fixture.session_id,
    started_at: new Date().toISOString(),
    actual_model_calls: 0,
    category:
      "Independent browser + synthetic accepted evaluation + real controller/database",
    cases: [],
    screenshots: [],
  };
  const reportPath = path.join(out, `${fixture.kind}-result-report.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2), { flag: "wx" });
  const writes = [];
  const onRequest = (request) => {
    const url = new URL(request.url());
    if (request.method() !== "GET" && url.pathname.startsWith("/api/"))
      writes.push({ method: request.method(), path: url.pathname });
  };
  page.on("request", onRequest);
  try {
    await page.goto(new URL(fixture.url, base).href);
    await page.locator(".lp-turns").waitFor();
    const before = await get(
      studentContext,
      base,
      `/api/tutoring/${fixture.session_id}`,
    );
    assert.equal(before.progress.phase, "completed");
    assert.equal(before.session.status, "completed");
    const teacherBefore = await get(
      teacherContext,
      base,
      `/api/teacher/sessions/${fixture.session_id}`,
    );
    const attempt = teacherBefore.attempts.find(
      (item) => item.id === fixture.receipt.attempt_id,
    );
    assert.ok(attempt);
    assert.equal(attempt.current_evaluation_id, fixture.receipt.evaluation_id);
    assert.equal(attempt.submission_key, fixture.receipt.submission_key);
    assert.equal(attempt.response_text, fixture.receipt.response_text);
    assert.deepEqual(attempt.assistance, fixture.receipt.assistance);
    assert.deepEqual(attempt.question.content_ref, fixture.receipt.content_ref);
    const accepted = teacherBefore.evaluations.find(
      (item) => item.id === attempt.current_evaluation_id,
    );
    assert.equal(accepted.validation_status, "accepted");
    assert.equal(accepted.evaluator.type, "synthetic_fixture");
    assert.deepEqual(
      accepted.result.per_concept_results,
      fixture.receipt.correctness,
    );
    assert.equal(
      accepted.result.uncertainty_reason,
      fixture.receipt.uncertainty_reason,
    );
    assert.equal(
      new Set(
        accepted.result.per_concept_results.map((item) => item.concept_id),
      ).size,
      attempt.question.concept_ids.length,
    );
    assert.ok(
      accepted.result.per_concept_results.every((item) =>
        attempt.question.concept_ids.includes(item.concept_id),
      ),
    );
    assert.equal(
      JSON.stringify(before).includes(fixture.private_canary),
      false,
    );
    const conversation = await get(
      studentContext,
      base,
      `/api/tutoring/${fixture.session_id}/conversation`,
    );
    assert.equal(conversation.dialogue.state.provider_requests_used, 0);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const panel = page
        .locator(".lp-study-session-state")
        .filter({ hasText: messages[fixture.kind] });
      assert.equal(
        await panel.count(),
        1,
        "Expected exact accepted result in the existing session result component.",
      );
      await panel.scrollIntoViewIfNeeded();
      await panel.waitFor({ state: "visible" });
      const text = await panel.innerText();
      assert.ok(text.startsWith(messages[fixture.kind]));
      assert.ok(text.includes("Practice complete."));
      assert.ok(text.includes("not lasting mastery"));
      const assisted = attempt.assistance?.assistance_level !== "none_recorded";
      assert.equal(text.includes("This answer followed help."), assisted);
      assert.equal(
        (await page.locator("body").innerText()).includes(
          fixture.private_canary,
        ),
        false,
      );
      assert.ok(
        (await page.locator(".lp-answer").allTextContents()).includes(
          attempt.response_text,
        ),
      );
      const geometry = await page.evaluate(() => ({
        width: innerWidth,
        document_width: document.documentElement.scrollWidth,
      }));
      assert.ok(
        geometry.document_width <= viewport.width + 1,
        JSON.stringify(geometry),
      );
      const file = `${fixture.kind}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: path.join(out, file), fullPage: false });
      report.screenshots.push({ file, viewport });
      report.cases.push({
        id: `accepted-result-${viewport.width}`,
        status: "PASS",
        text,
        geometry,
      });
    }
    const beforeRefreshWrites = writes.length;
    await page.reload();
    await page.locator(".lp-turns").waitFor();
    await page.waitForLoadState("networkidle");
    assert.deepEqual(
      await get(studentContext, base, `/api/tutoring/${fixture.session_id}`),
      before,
    );
    assert.deepEqual(
      await get(
        teacherContext,
        base,
        `/api/teacher/sessions/${fixture.session_id}`,
      ),
      teacherBefore,
    );
    assert.equal(
      writes.length,
      beforeRefreshWrites,
      "Completed refresh must not write evidence or invoke evaluation.",
    );
    assert.equal(
      writes.length,
      0,
      "Settled result inspection must be read-only.",
    );
    report.cases.push({
      id: "refresh-and-original-evidence",
      status: "PASS",
      api_writes: writes,
    });
    report.accepted_evaluation_id = accepted.id;
    report.original_submission_key = attempt.submission_key;
    report.provider_requests_used =
      conversation.dialogue.state.provider_requests_used;
  } catch (error) {
    report.cases.push({
      id: "independent-result-check",
      status: "FAIL",
      error: error.message,
    });
    throw error;
  } finally {
    page.off("request", onRequest);
    report.finished_at = new Date().toISOString();
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }
  return report;
}
