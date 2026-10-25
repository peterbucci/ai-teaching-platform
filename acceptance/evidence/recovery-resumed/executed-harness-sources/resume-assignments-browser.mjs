/** PR117/combined assignment acceptance. UI mutations are restricted to fictional loopback stacks. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { measureStorage, MIN_RUNTIME_GIB } from "./safety.mjs";
const [state, output, playwright] = process.argv.slice(2);
assert.ok(
  state && output && playwright,
  "Pass target state, fresh output folder, Playwright package",
);
assert.equal(
  fs.existsSync(output),
  false,
  "Preserve earlier reports",
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(state, "manifest.json"), "utf8"),
);
assert.equal(manifest.target, "combined-recovery");
assert.equal(manifest.sourceSha, "45326e243245c4941e2cefd0eab984bb7ee19765");
assert.equal(manifest.origin, "http://localhost:3355");
assert.equal(manifest.paidModelCallsAuthorized, false);
const origin = manifest.origin;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
function checkHostHeadroom() {
  const disks = measureStorage([manifest.source, state], MIN_RUNTIME_GIB);
  assert.ok(disks.every((disk) => disk.pass), "Host disk headroom fell below the runtime reserve.");
  return disks;
}
const initialHostHeadroom = checkHostHeadroom();
const env = fs.readFileSync(path.join(state, ".env.acceptance"), "utf8");
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"])
  assert.ok(env.split(/\r?\n/).some((l) => l === `${key}=`));
const authoring = JSON.parse(
  fs.readFileSync(
    process.env.ACCEPTANCE_AUTHORING_REPORT ||
      path.join(state, "browser-authoring", "report.json"),
    "utf8",
  ),
);
assert.equal(authoring.status, "passed");
assert.equal(authoring.sha, manifest.sourceSha);
const { chromium } = createRequire(import.meta.url)(playwright);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.BROWSER_EXECUTABLE ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const teacher = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const student = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const p = await teacher.newPage();
const s = await student.newPage();
for (const page of [p, s]) page.setDefaultTimeout(15000);
fs.mkdirSync(output, { recursive: true });
const report = {
  target: manifest.target,
  source_sha: manifest.sourceSha,
  origin,
  started_at: new Date().toISOString(),
  category:
    "provider-disabled browser; fictional authored and synthetic histories; no actual model calls",
  authoring_fixture: authoring.assignment_id,
  initial_host_headroom: initialHostHeadroom,
  harness_sha256: createHash("sha256")
    .update(fs.readFileSync(new URL(import.meta.url)))
    .digest("hex"),
  cases: [],
  planned_cases: [
    "AS-01-draft-refresh-exact",
    "AS-02-create-responsive-four-viewports",
    "AS-03-two-tab-safe-conflict",
    "AS-04-initial401-safe-recovery",
    "AS-05-unknown-create-reload-and-explicit-replay",
    "AS-06-created-inactive-student-hidden",
    "AS-07-safe-preview-no-writes",
    "AS-08-explicit-activation-student-start",
    "AS-09-presented-progress-not-wrong",
    "AS-10-progress-responsive-four-viewports",
    "AS-11-exact-history-assistance-and-accepted-evaluation",
    "AS-15-narrow-details-escape-and-close-focus",
    "AS-14-in-page-back-retains-assignment-selection",
    "AS-12-selection-refresh-and-history",
    "AS-13-readonly-preview-original-evidence-unchanged",
  ],
  screenshots: [],
};
const save = () =>
  fs.writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
const record = (id, status, details) => {
  report.cases.push({ id, status, details });
  save();
};
async function check(id, fn) {
  try {
    record(id, "PASS", await fn());
  } catch (e) {
    record(id, "FAIL", { error: e.message });
    throw e;
  }
}
async function screenshot(page, label) {
  checkHostHeadroom();
  const file = `${label}.png`;
  await page.screenshot({ path: path.join(output, file), fullPage: true });
  report.screenshots.push(file);
  save();
}
async function responsive(page, label) {
  const checks = [];
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ]) {
    await page.setViewportSize(vp);
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(
      layout.scrollWidth <= layout.width,
      `${label}: unintended document overflow`,
    );
    await screenshot(page, `${label}-${vp.width}x${vp.height}`);
    checks.push({ ...vp, ...layout });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  return checks;
}
const classId = "20000000-0000-4000-8000-000000000001";
const assignmentId = "30000000-0000-4000-8000-000000000001";
const sessionIds = [
  "40000000-0000-4000-8000-000000000001",
  "40000000-0000-4000-8000-000000000002",
];
const fields = {
  title: `Independent assignments ${manifest.target} ${Date.now()}`,
  instructions:
    "  Original fictional instructions.\nExplain your reasoning and retain this line.  ",
};
const createURL = `${origin}/teacher/assignments/new?lesson=${authoring.lesson_id}&version=1&class=${classId}`;
const createAPI = `**/api/teacher/lessons/${authoring.lesson_id}/assignments`;
let stage = "login";
try {
  await p.goto(`${origin}/login`);
  await p.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await p.waitForURL(/\/teacher/, { waitUntil: "domcontentloaded" });
  await s.goto(`${origin}/login`);
  await s.getByRole("button", { name: "Demo student", exact: true }).click();
  await s.waitForURL(/\/study/, { waitUntil: "domcontentloaded" });
  stage = "draft preservation";
  await p.goto(createURL);
  await p
    .getByRole("heading", { name: "Create an assignment", exact: true })
    .waitFor();
  report.instructions_aria_before = await p
    .locator('textarea[name="instructions"]')
    .ariaSnapshot();
  await p.getByLabel("Assignment title", { exact: true }).fill(fields.title);
  await p.locator('textarea[name="instructions"]').fill(fields.instructions);
  await p.getByText("Draft saved on this browser.", { exact: true }).waitFor();
  await check("AS-01-draft-refresh-exact", async () => {
    await p.reload();
    await p
      .getByText("Saved draft restored on this browser.", { exact: true })
      .waitFor();
    assert.equal(
      await p.getByLabel("Assignment title", { exact: true }).inputValue(),
      fields.title,
    );
    assert.equal(
      await p.locator('textarea[name="instructions"]').inputValue(),
      fields.instructions,
    );
    report.instructions_aria_after_restore = await p
      .locator('textarea[name="instructions"]')
      .ariaSnapshot();
    return {
      title_exact: true,
      instructions_exact: true,
      published_version: "1",
    };
  });
  await check("AS-02-create-responsive-four-viewports", () =>
    responsive(p, "create"),
  );
  stage = "two-tab conflict";
  const p2 = await teacher.newPage();
  p2.setDefaultTimeout(15000);
  await p2.goto(createURL);
  await p2
    .getByText("Saved draft restored on this browser.", { exact: true })
    .waitFor();
  const newest = fields.instructions + "\nNewer first-tab edit.";
  await p.locator('textarea[name="instructions"]').fill(newest);
  await p.getByText("Draft saved on this browser.", { exact: true }).waitFor();
  const staleText = "Stale second-tab local text must remain visible.";
  await check("AS-03-two-tab-safe-conflict", async () => {
    await p2.locator('textarea[name="instructions"]').fill(staleText);
    await p2
      .getByRole("alert")
      .getByText("Another tab changed this draft.", { exact: false })
      .waitFor();
    assert.equal(
      await p2.locator('textarea[name="instructions"]').inputValue(),
      staleText,
    );
    assert.equal(
      await p2
        .getByRole("button", {
          name: "Create inactive assignment",
          exact: true,
        })
        .isDisabled(),
      true,
    );
    await screenshot(p2, "two-tab-conflict");
    await p2
      .getByRole("button", {
        name: "Load saved draft and replace this tab",
        exact: true,
      })
      .click();
    await p2.getByText("Saved draft loaded.", { exact: true }).waitFor();
    assert.equal(
      await p2.locator('textarea[name="instructions"]').inputValue(),
      newest,
    );
    return {
      local_stale_text_preserved: true,
      explicit_reconciliation: true,
      newer_saved_text_loaded: true,
    };
  });
  await p2.close();
  stage = "precommit401";
  let faultCalls = 0;
  await p.route(createAPI, async (route) => {
    if (route.request().method() === "POST") {
      faultCalls++;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Synthetic expired authentication before assignment creation.",
        }),
      });
    } else await route.continue();
  });
  await check("AS-04-initial401-safe-recovery", async () => {
    await p
      .getByRole("button", { name: "Create inactive assignment", exact: true })
      .click();
    await p
      .getByText(
        "The server rejected this request before creating an assignment.",
        { exact: false },
      )
      .waitFor();
    assert.equal(faultCalls, 1);
    assert.equal(
      await p.locator('textarea[name="instructions"]').inputValue(),
      newest.trim(),
    );
    await screenshot(p, "creation-401-preserved");
    await p
      .getByRole("button", {
        name: "Return to saved details for a new request",
        exact: true,
      })
      .click();
    await p
      .getByRole("button", { name: "Create inactive assignment", exact: true })
      .waitFor();
    return {
      injected_before_commit: true,
      requests: 1,
      preserved_request_fields: true,
      real_expiry_unrun: true,
    };
  });
  await p.unroute(createAPI);
  stage = "unknown outcome then explicit replay";
  let created;
  let pendingBody;
  let calls = 0;
  let finishIntercept;
  const interceptedCreation = new Promise((resolve) => { finishIntercept = resolve; });
  await p.route(createAPI, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    try {
      calls++;
      pendingBody = route.request().postDataJSON();
      const response = await route.fetch();
      created = await response.json();
      await route.abort("failed");
      finishIntercept({ status: response.status() });
    } catch {
      // Playwright transport diagnostics can include request cookies. Keep the
      // original outcome unknown and emit only this fixed, credential-free error.
      finishIntercept({ error: "Creation interception failed before a confirmed response; server outcome remains unknown." });
      await route.abort("failed").catch(() => {});
    }
  });
  await check("AS-05-unknown-create-reload-and-explicit-replay", async () => {
    await p
      .getByRole("button", { name: "Create inactive assignment", exact: true })
      .click();
    const intercepted = await interceptedCreation;
    report.creation_interception = { status: intercepted.status ?? null, assignment_id: created?.id ?? null, request_id: pendingBody?.request_id ?? null, error: intercepted.error ?? null };
    save();
    assert.equal(intercepted.error, undefined);
    assert.equal(intercepted.status, 200);
    await p.getByRole("button", { name: "Check saved request", exact: true }).waitFor();
    await p.getByRole("alert").filter({ hasText: "Failed to fetch" }).waitFor();
    assert.ok(created?.id);
    assert.equal(calls, 1);
    assert.equal(
      await p
        .getByRole("button", { name: "Check saved request", exact: true })
        .count(),
      1,
    );
    await screenshot(p, "unknown-create-preserved");
    await p.unroute(createAPI);
    let replayCount = 0;
    let repeated;
    const listener = (req) => {
      if (
        req.method() === "POST" &&
        req
          .url()
          .includes(`/api/teacher/lessons/${authoring.lesson_id}/assignments`)
      ) {
        replayCount++;
        repeated = req.postDataJSON();
      }
    };
    p.on("request", listener);
    await p.reload();
    await p
      .getByText("A saved request needs confirmation.", { exact: true })
      .waitFor();
    assert.equal(replayCount, 0, "Reload must not retry");
    assert.equal(
      await p.locator('textarea[name="instructions"]').inputValue(),
      newest.trim(),
    );
    const replayResponse = p.waitForResponse(
      (r) =>
        r
          .url()
          .includes(
            `/api/teacher/lessons/${authoring.lesson_id}/assignments`,
          ) && r.request().method() === "POST",
    );
    await p
      .getByRole("button", { name: "Check saved request", exact: true })
      .click();
    const replay = await replayResponse;
    assert.equal(replay.status(), 200);
    assert.equal((await replay.json()).id, created.id);
    await p
      .getByRole("heading", { name: "Inactive assignment saved", exact: true })
      .waitFor();
    assert.deepEqual(repeated, pendingBody);
    assert.equal(replayCount, 1);
    p.off("request", listener);
    report.created_assignment_id = created.id;
    return {
      created_id: created.id,
      request_id: pendingBody.request_id,
      repeat_same_identity: true,
      same_assignment: true,
      no_automatic_reload_retry: true,
      paid_operation: false,
    };
  });
  stage = "inactive and preview";
  await p.getByRole("link", { name: "Review assignment", exact: true }).click();
  await p
    .getByRole("heading", { name: "Saved, not yet active", exact: true })
    .waitFor();
  await s.reload();
  assert.ok(!(await s.locator("body").innerText()).includes(fields.title));
  await check("AS-06-created-inactive-student-hidden", async () => ({
    assignment_id: created.id,
    class_id: created.class_id,
    lesson_id: created.lesson_id,
    lesson_version: created.lesson_version,
    student_list_hidden: true,
  }));
  await check("AS-07-safe-preview-no-writes", async () => {
    let writes = 0;
    const listener = (req) => {
      if (
        req.url().includes("/api/") &&
        !["GET", "HEAD"].includes(req.method())
      )
        writes++;
    };
    p.on("request", listener);
    await p.getByRole("link", { name: "Preview student learning", exact: true }).click();
    await p.locator(".awa-preview-readonly").waitFor();
    const text = await p.locator("body").innerText();
    assert.ok(text.includes("No student session is started"));
    assert.ok(
      !text.includes(
        "A puddle is smaller after a dry afternoon. Explain what happened",
      ),
    );
    assert.ok(!text.includes("rather than destroying it"));
    const layouts = await responsive(p, "student-preview");
    assert.equal(writes, 0);
    p.off("request", listener);
    return {
      no_api_writes: true,
      no_unrevealed_question_or_private_criterion: true,
      layouts,
    };
  });
  stage = "separate activation and student session";
  await check("AS-08-explicit-activation-student-start", async () => {
    await p
      .getByRole("link", { name: "Review lesson and activation", exact: true })
      .click();
    await p
      .getByLabel("I have reviewed this reading, its learning goals")
      .check();
    await p
      .getByRole("button", { name: "Approve and activate", exact: true })
      .click();
    await p
      .getByText("Active for enrolled students", { exact: true })
      .first()
      .waitFor();
    await s.reload();
    await s
      .getByRole("link", { name: `Details: ${fields.title}`, exact: true })
      .click();
    await s.getByRole("link", { name: "Open reading", exact: true }).click();
    await s.locator('article.reading-article[aria-busy="false"]').waitFor();
    assert.ok(
      (await s.locator("body").innerText()).includes(
        "Evaporation changes liquid water into water vapor",
      ),
    );
    await s.goBack();
    await s.getByRole("link", { name: "Study session", exact: true }).click();
    const result = s.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/tutoring" &&
        r.request().method() === "POST",
    );
    await s
      .getByRole("button", { name: "Start assignment", exact: false })
      .click();
    const response = await result;
    assert.equal(response.status(), 200);
    const view = await response.json();
    report.student_session_id = view.session.id;
    const teacherView = await (
      await teacher.request.get(
        `${origin}/api/teacher/sessions/${view.session.id}`,
      )
    ).json();
    assert.equal(teacherView.session.assignment_id, created.id);
    assert.equal(
      teacherView.attempts[0].question.content_ref.content_version,
      "1",
    );
    await s
      .getByRole("textbox", { name: "Message your tutor", exact: true })
      .waitFor();
    assert.equal(
      await s
        .getByRole("textbox", { name: "Message your tutor", exact: true })
        .count(),
      1,
    );
    await screenshot(s, "activated-student-session");
    return {
      assignment: created.id,
      session: view.session.id,
      lesson_version: "1",
      single_composer: true,
      no_answer_submitted: true,
    };
  });
  stage = "new progress";
  await check("AS-09-presented-progress-not-wrong", async () => {
    await p.goto(
      `${origin}/teacher/assignments?assignment=${created.id}&view=progress&origin=live_demo`,
    );
    await p
      .getByRole("heading", { name: "Class progress", exact: true })
      .waitFor();
    const summary = await p.locator(".ap-summary").innerText();
    const counts = await p.locator(".ap-summary > div").evaluateAll((entries) =>
      Object.fromEntries(entries.map((entry) => [
        entry.querySelector("dt").textContent.trim(),
        entry.querySelector("dd").textContent.replace(/\s+/g, " ").trim(),
      ])),
    );
    const metricsResponse = await teacher.request.get(`${origin}/api/teacher/assignments/${created.id}/metrics?origin=live_demo`);
    assert.equal(metricsResponse.status(), 200);
    const metrics = await metricsResponse.json();
    assert.equal(metrics.assignment_id, created.id);
    assert.equal(metrics.class_id, classId);
    assert.ok(Number.isSafeInteger(metrics.metrics.enrolled_students) && metrics.metrics.enrolled_students >= 3);
    assert.equal(metrics.metrics.participation.numerator, 0);
    assert.equal(metrics.metrics.participation.denominator, metrics.metrics.enrolled_students);
    assert.equal(counts["students have answered"], `0 of ${metrics.metrics.enrolled_students}`);
    assert.equal(counts.answers, "0");
    await p.locator(".ap-count-details > summary").click();
    const participation = await p.locator(".ap-count-details").innerText();
    assert.match(participation, /1 students started/);
    assert.match(participation, /1 presented questions without answers/);
    assert.equal(await p.locator(".ap-grid .ap-result-incorrect").count(), 0);
    assert.equal(await p.locator(".ap-grid .ap-result-no_response").count(), 1);
    return { summary, counts, participation, authorized_metrics: metrics, presented_answer_not_graded: true };
  });
  stage = "original synthetic history";
  const baseline = [];
  for (const id of sessionIds) {
    const response = await teacher.request.get(
      `${origin}/api/teacher/sessions/${id}`,
    );
    assert.equal(response.status(), 200);
    baseline.push(await response.json());
  }
  await p.goto(
    `${origin}/teacher/assignments?assignment=${assignmentId}&class=${classId}&status=all&view=progress&origin=synthetic_fixture`,
  );
  await p
    .getByRole("heading", { name: "Class progress", exact: true })
    .waitFor();
  await check("AS-10-progress-responsive-four-viewports", () =>
    responsive(p, "progress"),
  );
  await check(
    "AS-11-exact-history-assistance-and-accepted-evaluation",
    async () => {
      await p
        .locator(
          '.ap-cell[href*="student=10000000-0000-4000-8000-000000000002"][href*="concept=transmission_delay"]',
        )
        .first()
        .click();
      await p.locator(".ap-evidence-item").first().waitFor();
      const original = baseline[0];
      const expected = original.attempts
        .filter((a) => a.question.concept_ids.includes("transmission_delay"))
        .map((a) => a.response_text ?? "No response submitted.");
      const visible = await p
        .locator(".ap-evidence-item blockquote")
        .allTextContents();
      const displayedEvidence = [];
      const loadedSessions = new Map(baseline.map((item) => [item.session.id, item]));
      const seenAttempts = new Set();
      for (const row of await p.locator(".ap-evidence-item").all()) {
        const href = new URL(await row.getByRole("link", { name: "Read in full", exact: true }).getAttribute("href"), origin);
        const sessionId = href.pathname.split("/").at(-1);
        const attemptId = href.hash.replace(/^#attempt-/, "");
        assert.equal(href.searchParams.get("assignment"), assignmentId);
        assert.equal(href.searchParams.get("student"), original.session.student_id);
        assert.equal(href.searchParams.get("concept"), "transmission_delay");
        assert.equal(seenAttempts.has(attemptId), false, "An attempt must not be duplicated in selected evidence");
        seenAttempts.add(attemptId);
        if (!loadedSessions.has(sessionId)) {
          const response = await teacher.request.get(`${origin}/api/teacher/sessions/${sessionId}`);
          assert.equal(response.status(), 200);
          loadedSessions.set(sessionId, await response.json());
        }
        const stored = loadedSessions.get(sessionId);
        assert.equal(stored.session.assignment_id, assignmentId);
        assert.equal(stored.session.student_id, original.session.student_id);
        assert.equal(stored.session.data_origin, "synthetic_fixture");
        const attempt = stored.attempts.find((item) => item.id === attemptId);
        assert.ok(attempt);
        assert.ok(attempt.question.concept_ids.includes("transmission_delay"));
        assert.equal(await row.locator("blockquote").textContent(), attempt.response_text ?? "No response submitted.");
        if (attempt.current_evaluation_id) {
          const accepted = stored.evaluations.find((item) => item.id === attempt.current_evaluation_id);
          assert.equal(accepted?.validation_status, "accepted");
          assert.equal(accepted.attempt_id, attemptId);
        }
        displayedEvidence.push({ session_id: sessionId, attempt_id: attemptId, response_text: attempt.response_text, current_evaluation_id: attempt.current_evaluation_id, content_ref: attempt.question.content_ref });
      }
      assert.equal(displayedEvidence.length, visible.length);
      for (const disclosure of await p.locator(
        "#cell-evidence .ap-record-details > summary",
      ).all()) {
        await disclosure.click();
      }
      const text = await p.locator("#cell-evidence").innerText();
      assert.ok(
        text.includes(
          original.attempts[0].question.content_ref.content_version,
        ),
      );
      assert.ok(
        text.includes("Prepared example judgment; not a model result."),
      );
      const selectedAttempts = original.attempts.filter((attempt) =>
        attempt.question.concept_ids.includes("transmission_delay"),
      );
      for (const attempt of selectedAttempts) {
        const row = p.locator(".ap-evidence-item").filter({
          has: p.locator(`a[href$="#attempt-${attempt.id}"]`),
        });
        assert.equal(await row.count(), 1);
        assert.equal(await row.locator("blockquote").textContent(), attempt.response_text ?? "No response submitted.");
        const assistance = attempt.assistance?.assistance_level;
        const rowText = await row.innerText();
        if (assistance === "none_recorded") {
          assert.ok(rowText.includes("No content help recorded"));
        } else if (assistance) {
          assert.ok(rowText.includes("Help:"));
          assert.match(rowText, new RegExp(assistance.replaceAll("_", "[ -]"), "i"));
        } else {
          assert.ok(rowText.includes("Not answered yet"));
        }
      }
      const layouts = await responsive(p, "original-evidence");
      return {
        exact_original_texts: expected,
        all_displayed_evidence_verified: displayedEvidence,
        accepted_evaluation_ids: original.attempts.map(
          (a) => a.current_evaluation_id,
        ),
        source_version:
          original.attempts[0].question.content_ref.content_version,
        assistance_displayed: true,
        layouts,
      };
    },
  );
  await check("AS-15-narrow-details-escape-and-close-focus", async () => {
    const selected = p.url();
    const selectedCell = p.locator(
      '.ap-cell[href*="student=10000000-0000-4000-8000-000000000002"][href*="concept=transmission_delay"]',
    ).first();
    const cellId = await selectedCell.getAttribute("id");
    assert.ok(cellId);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.getByRole("complementary", { name: "Details", exact: true }).waitFor();
    await p.keyboard.press("Escape");
    await p.waitForURL((url) => url.searchParams.get("pane") === "grid");
    await p.waitForFunction((id) => document.activeElement?.id === id, cellId);
    await selectedCell.click();
    await p.waitForURL((url) => url.searchParams.get("pane") === "details");
    await p.getByRole("complementary", { name: "Details", exact: true })
      .getByRole("link", { name: "Close", exact: true }).click();
    await p.waitForURL((url) => url.searchParams.get("pane") === "grid");
    await p.waitForFunction((id) => document.activeElement?.id === id, cellId);
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.goto(selected);
    await p.locator(".ap-evidence-item").first().waitFor();
    return { viewport: 390, escape_returns_focus: true, close_returns_focus: true, cell_id: cellId };
  });
  stage = "full session return navigation";
  const selectedBeforeFullSession = p.url();
  await p
    .getByRole("link", { name: "Read in full", exact: true })
    .first()
    .click();
  await p
    .getByRole("link", { name: "Back to learning insights", exact: true })
    .waitFor();
  const fullSessionURL = p.url();
  await p.goBack();
  await p.locator(".ap-evidence-item").first().waitFor();
  assert.equal(p.url(), selectedBeforeFullSession);
  await p.goForward();
  await p
    .getByRole("link", { name: "Back to learning insights", exact: true })
    .click();
  await p.waitForURL(/\/teacher\/insights/);
  const inPageBackURL = p.url();
  record(
    "AS-14-in-page-back-retains-assignment-selection",
    inPageBackURL === selectedBeforeFullSession ? "PASS" : "FAIL",
    {
      expected: selectedBeforeFullSession,
      actual: inPageBackURL,
      full_session: fullSessionURL,
      browser_back_restored_selection: true,
      owner:
        "Shared evidence/navigation #114; existing session route outside PR117",
      severity: "P3 navigation context gap; no original evidence mutation",
    },
  );
  await screenshot(p, "in-page-back-loses-assignment-selection");
  await p.goto(selectedBeforeFullSession);
  await p.locator(".ap-evidence-item").first().waitFor();
  await check("AS-12-selection-refresh-and-history", async () => {
    const selected = p.url();
    await p.reload();
    await p.locator(".ap-evidence-item").first().waitFor();
    assert.equal(p.url(), selected);
    await p.getByRole("link", { name: "What students see", exact: true }).click();
    await p.locator(".awa-preview-readonly").waitFor();
    await p.goBack();
    await p.locator(".ap-evidence-item").first().waitFor();
    assert.equal(p.url(), selected);
    await p.goForward();
    await p.locator(".awa-preview-readonly").waitFor();
    return {
      selected_url: selected,
      refresh: true,
      back_forward: true,
      narrow_details_focus_checked_separately: true,
    };
  });
  await check(
    "AS-13-readonly-preview-original-evidence-unchanged",
    async () => {
      const after = [];
      for (const id of sessionIds) {
        after.push(
          await (
            await teacher.request.get(`${origin}/api/teacher/sessions/${id}`)
          ).json(),
        );
      }
      assert.deepEqual(after, baseline);
      return { session_ids: sessionIds, unchanged: true };
    },
  );
  report.status = report.cases.some((c) => c.status === "FAIL")
    ? "completed_with_findings"
    : "passed";
} catch (error) {
  report.status = "failed";
  report.failure_stage = stage;
  report.error = error.message;
  if (!report.cases.some((c) => c.status === "FAIL"))
    record("HARNESS", "FAIL", { stage, error: error.message });
  try {
    report.failure_urls = { teacher: p.url(), student: s.url() };
    await screenshot(s, "failure-student");
    fs.writeFileSync(
      path.join(output, "failure-student-visible-text.txt"),
      await s.locator("body").innerText(),
    );
    await screenshot(p, "failure-teacher");
    fs.writeFileSync(
      path.join(output, "failure-visible-text.txt"),
      await p.locator("body").innerText(),
    );
  } catch {}
  process.exitCode = 1;
} finally {
  report.unrun_cases = report.planned_cases.filter(
    (id) => !report.cases.some((item) => item.id === id),
  );
  report.finished_at = new Date().toISOString();
  report.unrun = [
    "Real authentication expiry and sign-in return",
    "Fresh model calls",
    "Hosted release",
    "Full keyboard-only and screen-reader journey",
    "Actual browser200%zoom in this suite",
    "Unchanged private published-history guarantees beyond separately executed service checks",
  ];
  save();
  await browser.close();
}
if (report.cases.some((c) => c.status === "FAIL")) process.exitCode = 1;
console.log(
  JSON.stringify(
    {
      report: path.join(output, "report.json"),
      status: report.status,
      cases: report.cases.map(({ id, status }) => ({ id, status })),
      failure_stage: report.failure_stage,
      error: report.error,
    },
    null,
    2,
  ),
);
