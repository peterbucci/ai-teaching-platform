/** Draft independent acceptance runner. Preparing this file executes nothing.
 * The caller supplies fresh fictional sessions and isolated operator hooks.
 * No secrets, browser storage, Docker command, or model client are read here.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { viewports } from "./result-browser-check.mjs";

export const ORIGINAL_ANSWER =
  "  Original café 🌱 answer.\nKeep  all spacing.  ";
const defaultLabels = {
  composer: "Message your tutor",
  submit: "Submit this as my answer",
  check: "Check answer save",
  retry: "Retry original answer",
  signIn: /Sign in in a new tab|Check sign-in|Sign in again/,
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, message, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  do {
    if (await predicate()) return;
    await wait(75);
  } while (Date.now() < deadline);
  assert.fail(message);
}
async function jsonGet(context, base, route, expected = 200) {
  const response = await context.request.get(new URL(route, base).href);
  assert.equal(
    response.status(),
    expected,
    `GET ${route}: ${response.status()}`,
  );
  return expected === 200 ? response.json() : null;
}
function answerUrl(base, fixture) {
  return new URL(`/api/sessions/${fixture.sessionId}/answers`, base).href;
}
function evaluationUrl(base, fixture) {
  return new URL(`/api/tutoring/${fixture.sessionId}`, base).href;
}
function currentAttempt(evidence, fixture) {
  const attempt = evidence.attempts.find(
    (item) => item.id === fixture.attemptId,
  );
  assert.ok(
    attempt,
    "Fixture attempt must remain present in authorized evidence.",
  );
  return attempt;
}
async function teacherEvidence(base, fixture) {
  return jsonGet(
    fixture.teacherContext,
    base,
    `/api/teacher/sessions/${fixture.sessionId}`,
  );
}
function box(fixture, labels) {
  return fixture.page.getByRole("textbox", {
    name: labels.composer,
    exact: true,
  });
}
function button(fixture, name) {
  return fixture.page.getByRole("button", { name, exact: true });
}
function assertAbsent(evidence, fixture) {
  const attempt = currentAttempt(evidence, fixture);
  assert.equal(attempt.response_text, null);
  assert.equal(attempt.submitted_at, null);
  assert.equal(attempt.submission_key, null);
  assert.equal(
    evidence.evaluations.filter((item) => item.attempt_id === fixture.attemptId)
      .length,
    0,
  );
}
function assertSaved(evidence, fixture, submission) {
  const attempt = currentAttempt(evidence, fixture);
  assert.equal(attempt.response_text, ORIGINAL_ANSWER);
  assert.equal(attempt.submission_key, submission.submission_key);
  assert.ok(attempt.submitted_at);
  assert.equal(
    evidence.attempts.filter((item) => item.id === fixture.attemptId).length,
    1,
  );
}
function instrument(base, fixture) {
  const answerPosts = [];
  const evaluationPosts = [];
  const answerResponses = [];
  const onRequest = (request) => {
    if (request.method() !== "POST") return;
    if (request.url() === answerUrl(base, fixture))
      answerPosts.push(request.postDataJSON());
    if (request.url() === evaluationUrl(base, fixture))
      evaluationPosts.push(request.postDataJSON());
  };
  const onResponse = (response) => {
    if (
      response.request().method() === "POST" &&
      response.url() === answerUrl(base, fixture)
    )
      answerResponses.push({ status: response.status() });
  };
  fixture.page.on("request", onRequest);
  fixture.page.on("response", onResponse);
  return {
    answerPosts,
    evaluationPosts,
    answerResponses,
    stop() {
      fixture.page.off("request", onRequest);
      fixture.page.off("response", onResponse);
    },
  };
}
function firstSubmission(trace, fixture) {
  assert.equal(trace.answerPosts.length, 1);
  const sent = trace.answerPosts[0];
  assert.equal(sent.attempt_id, fixture.attemptId);
  assert.match(
    sent.submission_key,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  assert.equal(sent.response_text, ORIGINAL_ANSWER);
  return sent;
}

/** Prepare the provider-disabled intended-answer fallback using real visible UI. */
export async function prepareFallback({
  fixture,
  base,
  labels = defaultLabels,
}) {
  await fixture.page.goto(new URL(fixture.url, base).href);
  await fixture.page.locator(".lp-turns").waitFor();
  const input = box(fixture, labels);
  await input.waitFor();
  if (!(await button(fixture, labels.submit).count())) {
    await input.fill("What do you mean by packet size?");
    await button(fixture, "Send").click();
    const help = fixture.page
      .getByRole("button", { name: "I’m asking for help", exact: true })
      .last();
    await help.click();
    await button(fixture, labels.submit).waitFor();
  }
  const conversation = await jsonGet(
    fixture.studentContext,
    base,
    `/api/tutoring/${fixture.sessionId}/conversation`,
  );
  assert.equal(conversation.dialogue.state.provider_requests_used, 0);
  assertAbsent(await teacherEvidence(base, fixture), fixture);
  await input.fill(ORIGINAL_ANSWER);
}

async function suppressEvaluation(base, fixture, status = 401) {
  const handler = async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "Independent acceptance: evaluation request stopped before server/provider execution.",
      }),
    });
  };
  await fixture.page.route(evaluationUrl(base, fixture), handler);
  return () => fixture.page.unroute(evaluationUrl(base, fixture), handler);
}

async function assertLocalUnconfirmed(fixture, labels, expectedText) {
  assert.equal(await box(fixture, labels).inputValue(), ORIGINAL_ANSWER);
  const notices = (
    await fixture.page
      .locator('[role="alert"], .lp-notice, .lp-study-session-state')
      .allTextContents()
  ).join("\n");
  assert.match(notices, expectedText.local);
  assert.match(notices, expectedText.unconfirmed);
  assert.doesNotMatch(notices, /Your submitted work is saved\./i);
  await button(fixture, labels.check).waitFor({ state: "visible" });
}

async function captureWidths({
  fixture,
  labels,
  out,
  prefix,
  report,
  pending,
}) {
  for (const viewport of viewports) {
    await fixture.page.setViewportSize(viewport);
    const input = box(fixture, labels);
    if (pending) {
      await input.scrollIntoViewIfNeeded();
      assert.equal(await input.inputValue(), ORIGINAL_ANSWER);
    }
    const check = button(fixture, labels.check);
    const retry = button(fixture, labels.retry);
    const control =
      (await check.count()) && (await check.isVisible())
        ? check
        : (await retry.count()) && (await retry.isVisible())
          ? retry
          : null;
    if (control) {
      await control.scrollIntoViewIfNeeded();
      const bounds = await control.boundingBox();
      assert.ok(bounds && bounds.width > 0 && bounds.height > 0);
    }
    const geometry = await fixture.page.evaluate(() => ({
      width: innerWidth,
      document_width: document.documentElement.scrollWidth,
    }));
    assert.ok(
      geometry.document_width <= viewport.width + 1,
      JSON.stringify(geometry),
    );
    const file = `${prefix}-${viewport.width}x${viewport.height}.png`;
    await fixture.page.screenshot({
      path: path.join(out, file),
      fullPage: false,
    });
    report.screenshots.push({ file, viewport, geometry });
  }
}

async function verifyQuietReturn({
  fixture,
  base,
  trace,
  labels,
  pending,
  report,
}) {
  const before = {
    answers: trace.answerPosts.length,
    evaluations: trace.evaluationPosts.length,
  };
  await fixture.page.reload();
  await fixture.page.locator(".lp-turns").waitFor();
  await fixture.page.waitForLoadState("networkidle");
  if (pending)
    assert.equal(await box(fixture, labels).inputValue(), ORIGINAL_ANSWER);
  // A user returning focus must not turn recovery into an automatic submission.
  await fixture.page.bringToFront();
  await wait(300);
  assert.equal(trace.answerPosts.length, before.answers);
  assert.equal(trace.evaluationPosts.length, before.evaluations);
  report.quiet_refresh = { ...before, text_preserved: pending };
  const conversation = await jsonGet(
    fixture.studentContext,
    base,
    `/api/tutoring/${fixture.sessionId}/conversation`,
  );
  assert.equal(conversation.dialogue.state.provider_requests_used, 0);
}

async function reconcileAbsent({ fixture, base, trace, labels, report }) {
  const before = {
    answers: trace.answerPosts.length,
    evaluations: trace.evaluationPosts.length,
  };
  await button(fixture, labels.check).click();
  await button(fixture, labels.retry).waitFor({ state: "visible" });
  assertAbsent(await teacherEvidence(base, fixture), fixture);
  assert.equal(await box(fixture, labels).inputValue(), ORIGINAL_ANSWER);
  assert.equal(trace.answerPosts.length, before.answers);
  assert.equal(trace.evaluationPosts.length, before.evaluations);
  report.reconciliation = {
    confirmed: "absent",
    answer_writes: 0,
    evaluation_writes: 0,
  };
}

/** Default same-browser new-tab sign-in. Supply a hook if the fixture uses Student Two. */
export async function signInAndReturnViaDemo({
  fixture,
  labels = defaultLabels,
}) {
  const originUrl = fixture.page.url();
  const link = fixture.page.getByRole("link", { name: labels.signIn }).first();
  assert.equal(
    await link.getAttribute("target"),
    "_blank",
    "Sign-in recovery should preserve the original study tab.",
  );
  const popupPromise = fixture.studentContext.waitForEvent("page");
  await link.click();
  const loginPage = await popupPromise;
  await loginPage
    .getByRole("button", { name: "Demo student", exact: true })
    .click();
  await loginPage.waitForURL(/\/study/);
  await fixture.page.bringToFront();
  assert.equal(fixture.page.url(), originUrl);
  await loginPage.close();
  return { original_tab_preserved: true, method: "new-tab Demo student UI" };
}

/**
 * Required hooks:
 * createCase({ id, base, sourceSha, out }) -> { page, studentContext, teacherContext,
 *   sessionId, attemptId, url, close() }. Each must be a NEW unanswered fixture.
 * expireAuthentication({ fixture }) -> { auth_session_id, expires_at }; mutate only
 *   the fresh student's isolated auth_session, never print or return its token.
 * seedAcceptedEvaluation({ fixture, submission }) -> synthetic accepted result via
 *   existing services. No paid evaluator. Used only after R6 has saved the answer.
 * Optional prepare({fixture,base,labels}), signInAndReturn({fixture,labels}).
 * Caller must enforce the storage/runtime gate and exact build/source identity.
 */
export async function runRecoveryAcceptance(options) {
  const {
    base,
    sourceSha,
    out,
    createCase,
    expireAuthentication,
    seedAcceptedEvaluation,
  } = options;
  const labels = { ...defaultLabels, ...options.labels };
  const expectedText = {
    local:
      /(?:this (?:browser|tab)|locally|stays here|kept here|preserved|still here)/i,
    unconfirmed:
      /(?:not confirmed|unconfirmed|couldn.t confirm|could not confirm|cannot confirm|don.t know whether|unknown|not yet saved|has not been saved|not saved|check (?:the )?(?:server|answer|save))/i,
    saved:
      /(?:The server confirmed saving your original answer\.|Your answer is saved(?:[.,]|\s+and))/i,
    ...options.expectedText,
  };
  assert.match(sourceSha, /^[a-f0-9]{40}$/);
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
  assert.equal(typeof createCase, "function");
  mkdirSync(out, { recursive: true });
  const reportPath = path.join(out, "independent-recovery-report.json");
  const report = {
    source_sha: sourceSha,
    base,
    started_at: new Date().toISOString(),
    original_answer: ORIGINAL_ANSWER,
    category:
      "Provider-disabled real browser/auth/database with explicit precommit/postcommit fault injection",
    actual_model_calls: 0,
    cases: [],
    screenshots: [],
    limitations: [
      "Viewport emulation is not native zoom, mobile keyboard or screen-reader verification.",
    ],
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2), { flag: "wx" });
  const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2));
  const sessionIds = new Set();
  async function run(id, operation) {
    const item = {
      id,
      status: "RUNNING",
      started_at: new Date().toISOString(),
    };
    report.cases.push(item);
    save();
    let fixture;
    let trace;
    try {
      fixture = await createCase({ id, base, sourceSha, out });
      assert.equal(
        sessionIds.has(fixture.sessionId),
        false,
        "Each recovery case requires its own session.",
      );
      sessionIds.add(fixture.sessionId);
      item.session_id = fixture.sessionId;
      item.attempt_id = fixture.attemptId;
      assertAbsent(await teacherEvidence(base, fixture), fixture);
      await (options.prepare || prepareFallback)({ fixture, base, labels });
      trace = instrument(base, fixture);
      await suppressEvaluation(base, fixture);
      await operation(fixture, trace, item);
      item.status = "PASS";
    } catch (error) {
      item.status = error.unrun ? "UNRUN" : "FAIL";
      item.error = error.message;
      if (fixture) {
        const file = `${id}-failure.png`;
        try {
          await fixture.page.screenshot({
            path: path.join(out, file),
            fullPage: false,
          });
          report.screenshots.push({ file, failure: true });
        } catch (captureError) {
          item.screenshot_error = captureError.message;
        }
      }
    } finally {
      if (trace) {
        item.answer_posts = trace.answerPosts;
        item.answer_responses = trace.answerResponses;
        item.evaluation_posts = trace.evaluationPosts;
        trace.stop();
      }
      item.finished_at = new Date().toISOString();
      if (fixture) await fixture.close();
      save();
    }
  }
  async function initialFault(fixture, trace, fault) {
    const handler = async (route) =>
      fault === "401"
        ? route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Synthetic precommit authentication failure",
            }),
          })
        : route.abort("internetdisconnected");
    await fixture.page.route(answerUrl(base, fixture), handler);
    await button(fixture, labels.submit).click();
    await until(
      () => trace.answerPosts.length === 1,
      "Initial answer POST was not observed.",
    );
    await button(fixture, labels.check).waitFor();
    await fixture.page.waitForLoadState("networkidle");
    const submission = firstSubmission(trace, fixture);
    assert.equal(trace.evaluationPosts.length, 0);
    assertAbsent(await teacherEvidence(base, fixture), fixture);
    await assertLocalUnconfirmed(fixture, labels, expectedText);
    await fixture.page.unroute(answerUrl(base, fixture), handler);
    return submission;
  }

  for (const [id, fault] of [
    ["R1-initial-save-401", "401"],
    ["R2-offline-save", "offline"],
  ]) {
    await run(id, async (fixture, trace, item) => {
      const submission = await initialFault(fixture, trace, fault);
      await captureWidths({
        fixture,
        labels,
        out,
        prefix: id,
        report,
        pending: true,
      });
      await verifyQuietReturn({
        fixture,
        base,
        trace,
        labels,
        pending: true,
        report: item,
      });
      await reconcileAbsent({ fixture, base, trace, labels, report: item });
      await button(fixture, labels.retry).click();
      await until(
        async () =>
          Boolean(
            currentAttempt(await teacherEvidence(base, fixture), fixture)
              .submitted_at,
          ),
        "Explicit same-identity resend was not saved.",
      );
      assert.equal(trace.answerPosts.length, 2);
      assert.deepEqual(trace.answerPosts[1], submission);
      assertSaved(await teacherEvidence(base, fixture), fixture, submission);
      await fixture.page.waitForLoadState("networkidle");
      assert.ok(
        trace.evaluationPosts.length <= 1,
        "An explicit resend must not initiate duplicate evaluations.",
      );
      assert.equal(
        (await teacherEvidence(base, fixture)).evaluations.length,
        0,
      );
      item.automatic_retries = 0;
      item.original_identity_preserved_after_refresh = true;
    });
  }

  await run("R3-committed-response-lost", async (fixture, trace, item) => {
    let committedStatus;
    const handler = async (route) => {
      const response = await route.fetch();
      committedStatus = response.status();
      await route.abort("internetdisconnected");
    };
    await fixture.page.route(answerUrl(base, fixture), handler);
    await button(fixture, labels.submit).click();
    await button(fixture, labels.check).waitFor();
    await fixture.page.waitForLoadState("networkidle");
    const submission = firstSubmission(trace, fixture);
    assert.equal(
      committedStatus,
      200,
      "Fault must occur after an actual server success.",
    );
    assert.equal(
      trace.answerResponses.some((response) => response.status === 200),
      false,
    );
    assertSaved(await teacherEvidence(base, fixture), fixture, submission);
    assert.equal(trace.evaluationPosts.length, 0);
    await assertLocalUnconfirmed(fixture, labels, expectedText);
    await captureWidths({
      fixture,
      labels,
      out,
      prefix: "R3-unknown-before-check",
      report,
      pending: true,
    });
    await fixture.page.unroute(answerUrl(base, fixture), handler);
    await button(fixture, labels.check).click();
    await until(
      async () =>
        !(await button(fixture, labels.retry).count()) ||
        !(await button(fixture, labels.retry).isVisible()),
      "Saved reconciliation must not offer another answer send.",
    );
    await fixture.page.waitForLoadState("networkidle");
    assert.equal(trace.answerPosts.length, 1);
    assert.equal(trace.evaluationPosts.length, 0);
    assertSaved(await teacherEvidence(base, fixture), fixture, submission);
    const visible = await fixture.page.locator("body").innerText();
    assert.match(visible, expectedText.saved);
    await verifyQuietReturn({
      fixture,
      base,
      trace,
      labels,
      pending: false,
      report: item,
    });
    item.fault = "Real server answer 200 discarded before the page received it";
    item.read_only_reconciliation = true;
  });

  await run(
    "R4-acknowledged-save-evaluation-401",
    async (fixture, trace, item) => {
      await button(fixture, labels.submit).click();
      await until(
        () => trace.answerResponses.some((response) => response.status === 200),
        "Answer success was not acknowledged to the page.",
      );
      await until(
        () => trace.evaluationPosts.length === 1,
        "Expected explicit submission flow to attempt evaluation once.",
      );
      await fixture.page.waitForLoadState("networkidle");
      const submission = firstSubmission(trace, fixture);
      assertSaved(await teacherEvidence(base, fixture), fixture, submission);
      assert.match(
        await fixture.page.locator("body").innerText(),
        expectedText.saved,
      );
      assert.equal(await button(fixture, labels.retry).count(), 0);
      await captureWidths({
        fixture,
        labels,
        out,
        prefix: "R4-acknowledged-save",
        report,
        pending: false,
      });
      await verifyQuietReturn({
        fixture,
        base,
        trace,
        labels,
        pending: false,
        report: item,
      });
      item.server_save_acknowledged = true;
      item.evaluation_fault =
        "401 intercepted before server/provider execution";
    },
  );

  await run("R5-real-auth-expiry-safe-return", async (fixture, trace, item) => {
    if (!expireAuthentication)
      throw Object.assign(
        new Error(
          "Missing isolated auth-expiry operator hook; real expiry is UNRUN.",
        ),
        { unrun: true },
      );
    const expiry = await expireAuthentication({ fixture });
    assert.ok(expiry?.auth_session_id);
    assert.ok(
      Number.isFinite(Date.parse(expiry.expires_at)) &&
        Date.parse(expiry.expires_at) <= Date.now(),
    );
    item.expired_auth_session = {
      auth_session_id: expiry.auth_session_id,
      expires_at: expiry.expires_at,
    };
    await jsonGet(
      fixture.studentContext,
      base,
      `/api/tutoring/${fixture.sessionId}`,
      401,
    );
    await button(fixture, labels.submit).click();
    await button(fixture, labels.check).waitFor();
    await fixture.page.waitForLoadState("networkidle");
    const submission = firstSubmission(trace, fixture);
    assert.ok(
      trace.answerResponses.some((response) => response.status === 401),
    );
    assertAbsent(await teacherEvidence(base, fixture), fixture);
    await assertLocalUnconfirmed(fixture, labels, expectedText);
    await captureWidths({
      fixture,
      labels,
      out,
      prefix: "R5-expired-auth",
      report,
      pending: true,
    });
    item.sign_in = await (options.signInAndReturn || signInAndReturnViaDemo)({
      fixture,
      labels,
    });
    await jsonGet(
      fixture.studentContext,
      base,
      `/api/tutoring/${fixture.sessionId}`,
    );
    assert.equal(await box(fixture, labels).inputValue(), ORIGINAL_ANSWER);
    assert.equal(trace.answerPosts.length, 1);
    assert.equal(trace.evaluationPosts.length, 0);
    await reconcileAbsent({ fixture, base, trace, labels, report: item });
    await button(fixture, labels.retry).click();
    await until(
      async () =>
        Boolean(
          currentAttempt(await teacherEvidence(base, fixture), fixture)
            .submitted_at,
        ),
      "Authenticated explicit resend did not save.",
    );
    assert.equal(trace.answerPosts.length, 2);
    assert.deepEqual(trace.answerPosts[1], submission);
    assertSaved(await teacherEvidence(base, fixture), fixture, submission);
    await fixture.page.waitForLoadState("networkidle");
    assert.ok(
      trace.evaluationPosts.length <= 1,
      "Authentication return/resend must not initiate duplicate evaluations.",
    );
    assert.equal((await teacherEvidence(base, fixture)).evaluations.length, 0);
    item.return_did_not_submit = true;
  });

  await run(
    "R6-duplicate-and-original-identity",
    async (fixture, trace, item) => {
      const submission = await initialFault(fixture, trace, "offline");
      await reconcileAbsent({ fixture, base, trace, labels, report: item });
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const delay = async (route) => {
        await gate;
        await route.continue();
      };
      await fixture.page.route(answerUrl(base, fixture), delay);
      try {
        await button(fixture, labels.retry).dblclick();
        await until(
          () => trace.answerPosts.length >= 2,
          "Explicit retry was not observed.",
        );
        await wait(300);
        assert.equal(
          trace.answerPosts.length,
          2,
          "Rapid double activation must dispatch one resend only.",
        );
      } finally {
        release();
      }
      await until(
        async () =>
          Boolean(
            currentAttempt(await teacherEvidence(base, fixture), fixture)
              .submitted_at,
          ),
        "Gated resend did not save.",
      );
      await fixture.page.unroute(answerUrl(base, fixture), delay);
      assert.deepEqual(trace.answerPosts[1], submission);
      assertSaved(await teacherEvidence(base, fixture), fixture, submission);
      const post = (data) =>
        fixture.studentContext.request.post(answerUrl(base, fixture), {
          headers: { Origin: base },
          data,
        });
      const repeated = await post(submission);
      assert.equal(repeated.status(), 200);
      const changed = await post({
        ...submission,
        response_text: `${ORIGINAL_ANSWER}altered`,
      });
      assert.equal(changed.status(), 409);
      const anotherIdentity = await post({
        ...submission,
        submission_key: randomUUID(),
      });
      assert.equal(anotherIdentity.status(), 409);
      assertSaved(await teacherEvidence(base, fixture), fixture, submission);
      item.answer_replays = {
        exact: repeated.status(),
        altered: changed.status(),
        new_identity: anotherIdentity.status(),
      };
      await captureWidths({
        fixture,
        labels,
        out,
        prefix: "R6-preserved-answer",
        report,
        pending: false,
      });
      if (!seedAcceptedEvaluation)
        throw Object.assign(
          new Error(
            "Answer duplicate checks passed; accepted-evaluation replay requires the synthetic operator hook and is UNRUN.",
          ),
          { unrun: true },
        );
      await seedAcceptedEvaluation({ fixture, submission });
      const before = await teacherEvidence(base, fixture);
      const evaluations = before.evaluations.filter(
        (entry) =>
          entry.attempt_id === fixture.attemptId &&
          entry.validation_status === "accepted",
      );
      assert.equal(evaluations.length, 1);
      assert.equal(evaluations[0].evaluator.type, "synthetic_fixture");
      const replayEvaluation = () =>
        fixture.studentContext.request.post(evaluationUrl(base, fixture), {
          headers: { Origin: base },
          data: { attempt_id: fixture.attemptId },
        });
      const replays = await Promise.all([
        replayEvaluation(),
        replayEvaluation(),
      ]);
      const replayStatuses = replays.map((response) => response.status());
      assert.ok(replayStatuses.includes(200));
      assert.ok(
        replayStatuses.every((status) => status === 200 || status === 409),
      );
      assert.deepEqual(
        await teacherEvidence(base, fixture),
        before,
        "Concurrent accepted evaluation replay must not append or replace evidence.",
      );
      const sequentialReplay = await replayEvaluation();
      assert.equal(sequentialReplay.status(), 200);
      assert.deepEqual(
        await teacherEvidence(base, fixture),
        before,
        "Sequential accepted evaluation replay must reuse the same accepted identity and evidence.",
      );
      item.accepted_evaluation_reused = evaluations[0].id;
      item.evaluation_replays = replayStatuses;
      item.sequential_evaluation_replay = sequentialReplay.status();
    },
  );
  report.finished_at = new Date().toISOString();
  report.result = report.cases.every((item) => item.status === "PASS")
    ? "PASS"
    : "INCOMPLETE_OR_FAILED";
  save();
  return report;
}
