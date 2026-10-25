/** Real authenticated app/PostgreSQL checks. Fictional operator fixtures only. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { getPool } from "../../lib/db.ts";
import { DEMO_IDS } from "../../lib/evidence/demo.ts";
import {
  loadApprovedContent,
  getCuratedQuestion,
} from "../../lib/evidence/content.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
  submitAnswer,
  recordEvaluation,
  recordIntervention,
  acknowledgeIntervention,
} from "../../lib/evidence/store.ts";
import { readStudentNotebook } from "../../lib/evidence/student-notebook.ts";
import { checkNotebookHistory } from "../../tests/browser/notebook-integration/history.mjs";

assert.equal(process.env.PGDATABASE, "notebook_s2");
assert.equal(process.env.PGPORT, "5912");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
const root = process.cwd(),
  base = process.env.AUTH_URL,
  mode = process.argv[2];
const statePath = path.join(root, ".setup/s2/browser-state.json");
const pool = getPool(),
  require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const actorRow = (
  await pool.query("select id,auth_user_id from profiles where id=$1", [
    DEMO_IDS.studentOne,
  ])
).rows[0];
const actor = evidenceAccess({
  profileId: actorRow.id,
  userId: actorRow.auth_user_id,
});
const original = "  Identical original answer π🙂\nSecond line, unchanged.  ";
const exactOriginal = "  Original CRLF π🙂\r\nSecond line.\r\n\tFinal line  ";
async function fingerprint() {
  const h = createHash("sha256");
  for (const table of [
    "sessions",
    "attempts",
    "evaluations",
    "interventions",
    "dialogue_sessions",
    "dialogue_operations",
    "dialogue_events",
    "dialogue_provider_calls",
    "teacher_intervention_approvals",
    "teacher_intervention_deliveries",
    "teacher_intervention_recipients",
    "teacher_intervention_followups",
    "teacher_intervention_evaluation_requests",
  ]) {
    const r = await pool.query(
      `SELECT to_jsonb(t)::text AS record FROM ${table} t ORDER BY to_jsonb(t)::text`,
    );
    h.update(table).update(JSON.stringify(r.rows));
  }
  return h.digest("hex");
}
let browser;
const out = path.join(
  root,
  "acceptance/notebook-s2/evidence",
  `${mode}-${Date.now()}`,
);
fs.mkdirSync(out, { recursive: true });
const report = {
  mode,
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  buildId: fs.existsSync(".next/BUILD_ID")
    ? fs.readFileSync(".next/BUILD_ID", "utf8").trim()
    : null,
  providersDisabled: true,
  paidCalls: 0,
  checks: [],
  screenshots: [],
  requests: [],
  errors: [],
};
const save = () =>
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(report, null, 2),
  );
const check = (name) => {
  report.checks.push(name);
  save();
  console.log("PASS " + name);
};
async function deniedRoute(page, url) {
  const response = await page.goto(url);
  // The inherited /study/loading.tsx streams a 200 shell before async notFound.
  // Require the final not-found document AND no work; API denial is separately 404.
  assert.ok([200, 404].includes(response.status()));
  await page.getByRole("heading", { name: "404", exact: true }).waitFor();
  assert.equal(
    await page
      .locator("[data-original-response],[data-recorded-question]")
      .count(),
    0,
  );
  assert.ok(!(await page.locator("body").innerText()).includes(original));
  report.checks.push(
    `Denied document: final 404 content, HTTP ${response.status()} streamed shell`,
  );
}
async function login(context, prefix = "DEMO_STUDENT_ONE") {
  const res = await context.request.post(base + "/api/auth/sign-in/email", {
    headers: { Origin: base },
    data: {
      email: process.env[prefix + "_EMAIL"],
      password: process.env[prefix + "_PASSWORD"],
    },
  });
  assert.equal(
    res.status(),
    200,
    "Fictional login failed; credentials suppressed",
  );
}
try {
  if (mode === "setup-exact") {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    assert.ok(!state.exact, "Preserve existing exact-text fixture");
    const question = getCuratedQuestion(loadApprovedContent(), "NP-TX-01");
    const session = await startSession(
      actor,
      DEMO_IDS.assignmentId,
      "live_demo",
    );
    const attempt = await presentQuestion(actor, session.id, {
      question,
      intent: "initial_retrieval",
    });
    await submitAnswer(actor, session.id, {
      attempt_id: attempt.id,
      submission_key: randomUUID(),
      response_text: exactOriginal,
    });
    state.exact = { session: session.id, attempt: attempt.id };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    check(
      "ordinary current-data fixture stores exact CRLF, Unicode, tabs and spaces through real answer service",
    );
  } else if (mode === "setup") {
    assert.ok(!fs.existsSync(statePath), "Preserve existing fixtures");
    const content = loadApprovedContent(),
      question = getCuratedQuestion(content, "NP-TX-01");
    const session = await startSession(
      actor,
      DEMO_IDS.assignmentId,
      "live_demo",
    );
    const ids = [];
    for (let i = 0; i < 12; i++) {
      const attempt = await presentQuestion(actor, session.id, {
        question,
        intent: i ? "immediate_retest" : "initial_retrieval",
        ...(i ? { parent_attempt_id: ids[0] } : {}),
      });
      ids.push(attempt.id);
      await submitAnswer(actor, session.id, {
        attempt_id: attempt.id,
        submission_key: randomUUID(),
        response_text: original,
      });
      await recordEvaluation(actor, session.id, {
        id: randomUUID(),
        attempt_id: attempt.id,
        validation_status: i === 2 ? "evaluation_failed" : "accepted",
        evaluator: {
          type: "synthetic_fixture",
          model: null,
          version: "s2-authored-test",
        },
        supersedes_id: null,
        applied_result: null,
        failure_reason: i === 2 ? "PRIVATE_FAILURE" : null,
        result:
          i === 2
            ? null
            : {
                per_concept_results: question.concept_ids.map((concept_id) => ({
                  concept_id,
                  correctness: i === 1 ? "uncertain" : "correct",
                  error_type: null,
                  rubric_criteria_met: [],
                  rubric_criteria_missing: [],
                })),
                source_passage_ids: question.source_passage_ids,
                evidence_quotes: [],
                reasoning_observed: "PRIVATE_REASONING",
                uncertainty_reason: i === 1 ? "PRIVATE_UNCERTAINTY" : null,
                proposed_next_action: "MOVE_TO_NEXT_CONCEPT",
              },
      });
    }
    const pending = await recordIntervention(actor, session.id, {
      id: randomUUID(),
      related_attempt_id: ids.at(-1),
      related_evaluation_id: null,
      type: "hint",
      text_shown: "UNDISPLAYED_S2_SENTINEL",
      concept_ids: question.concept_ids,
      source_passage_ids: question.source_passage_ids,
      content_ref: question.content_ref,
    });
    const missing = await startSession(
      actor,
      DEMO_IDS.assignmentId,
      "live_demo",
    );
    const blank = await presentQuestion(actor, missing.id, {
      question,
      intent: "initial_retrieval",
    });
    await submitAnswer(actor, missing.id, {
      attempt_id: blank.id,
      submission_key: randomUUID(),
      response_text: "",
    });
    fs.writeFileSync(
      statePath,
      JSON.stringify(
        {
          session: session.id,
          ids,
          pending: pending.id,
          missing: missing.id,
          blank: blank.id,
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
    check(
      "12 distinct identical-answer attempts, failed/uncertain assessments, pending undisplayed help and empty unassessed answer stored through real services",
    );
  } else {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const undisplayedText = `UNDISPLAYED_S2_SENTINEL_${randomUUID()}`;
    if (mode === "recorded") {
      const question = getCuratedQuestion(loadApprovedContent(), "NP-TX-01");
      const pending = await recordIntervention(actor, state.session, {
        id: randomUUID(),
        related_attempt_id: state.ids.at(-1),
        related_evaluation_id: null,
        type: "hint",
        text_shown: undisplayedText,
        concept_ids: question.concept_ids,
        source_passage_ids: question.source_passage_ids,
        content_ref: question.content_ref,
      });
      state.pending = pending.id;
      report.operatorFixture = pending.id;
    }
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    await login(context);
    const page = await context.newPage();
    page.on("pageerror", (e) => report.errors.push(e.message));
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/"))
        report.requests.push({
          method: request.method(),
          path: new URL(request.url()).pathname,
        });
    });
    const firstFingerprint = await fingerprint();
    const route = `${base}/study/history/${state.session}`,
      detail = `${route}?attempt=${state.ids[0]}`;
    if (mode === "fallback") {
      await page.goto(detail);
      await page.locator("[data-original-response]").waitFor();
      assert.equal(await page.locator("[data-original-response]").count(), 1);
      assert.equal(
        await page.locator("[data-original-response]").textContent(),
        original,
      );
      assert.equal(await page.locator("[data-recorded-history]").count(), 0);
      assert.match(
        await page.locator("body").innerText(),
        /Recorded history is unavailable/,
      );
      check(
        "flag-off route uses independently authorized exact current-data question fallback",
      );
      await deniedRoute(page, `${route}?attempt=${randomUUID()}`);
      await page.goto(`${base}/study/history`);
      await checkNotebookHistory(page);
      check(
        "existing index search, scope/status/date filters, native saved-work links preserved",
      );
      assert.ok(state.exact, "Run setup-exact before final fallback");
      await page.goto(
        `${base}/study/history/${state.exact.session}?attempt=${state.exact.attempt}`,
      );
      const exact = page.locator("[data-original-response]");
      await exact.locator("[data-exact-text-ready]").waitFor();
      assert.equal(await exact.textContent(), exactOriginal);
      await exact.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });
      await page.keyboard.press("Control+c");
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      report.clipboard = {
        exact: copied === exactOriginal,
        source: exactOriginal,
        copied,
      };
      assert.equal(
        copied.replaceAll("\r\n", "\n"),
        exactOriginal.replaceAll("\r\n", "\n"),
      );
      check(
        "rebuilt current-data original preserves CRLF/Unicode/tabs/spaces in DOM; actual native copy verified with platform line-ending comparison reported separately",
      );
    } else {
      await page.goto(route);
      await page.locator("[data-recorded-history]").waitFor();
      assert.equal(
        await page
          .getByRole("link", { name: "Open saved question →", exact: true })
          .count(),
        10,
      );
      await page
        .getByRole("button", { name: "Load more recorded questions" })
        .click();
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("a")].filter(
            (e) => e.textContent.trim() === "Open saved question →",
          ).length === 12,
      );
      assert.equal(report.errors.length, 0);
      await page
        .getByRole("link", { name: "Open saved question →", exact: true })
        .nth(11)
        .click();
      await page.locator("[data-recorded-question]").waitFor();
      assert.ok(page.url().includes(state.ids[11]));
      assert.equal(
        await page.locator("[data-original-response]").textContent(),
        original,
      );
      assert.ok(
        !(await page.locator("body").innerText()).includes(undisplayedText),
      );
      check(
        "actual second-batch DOM rendering and exact deep link work after Load more; undisplayed body excluded",
      );
      await page.reload();
      await page.locator("[data-recorded-question]").waitFor();
      await page.goBack();
      await page.locator("[data-recorded-history]").waitFor();
      await page.goForward();
      await page.locator("[data-recorded-question]").waitFor();
      assert.ok(page.url().includes(state.ids[11]));
      check("refresh and native Back/Forward retain exact attempt identities");
      for (const [width, height] of [
        [1440, 1000],
        [1024, 768],
        [390, 844],
        [320, 844],
      ]) {
        await page.setViewportSize({ width, height });
        for (const [surface, url] of [
          ["session", route],
          ["question", detail],
          ["index", base + "/study/history"],
        ]) {
          await page.goto(url);
          await page
            .locator(
              surface === "index"
                ? "[data-n7-notebook-index]"
                : "[data-recorded-history]",
            )
            .waitFor();
          await page.evaluate(() => document.fonts.ready);
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            `${surface} ${width} overflow`,
          );
          assert.equal(await page.locator("textarea").count(), 0);
          const filename = `application-${surface}-${width}.png`;
          await page.screenshot({ path: path.join(out, filename) });
          report.screenshots.push(filename);
        }
      }
      check(
        "authenticated index/session/question rendered at 1440, 1024, 390 and 320; no horizontal overflow or composer",
      );
      const saved = JSON.parse(
        fs.readFileSync(process.env.NOTEBOOK_CHECK_STATE, "utf8"),
      );
      for (const session of saved.sessions) {
        const dto = await readStudentNotebook(actor, session.id);
        if (dto.session.kind === "teacher_intervention_followup") {
          await page.goto(`${base}/study/history/${session.id}`);
          await page
            .getByRole("heading", { name: "Teacher-review history" })
            .waitFor();
          assert.equal(
            await page.locator("[data-recorded-question]").count(),
            0,
          );
          assert.equal(
            await page
              .getByRole("link", {
                name: "Open the teacher review and saved check",
              })
              .getAttribute("href"),
            dto.session.resume_href,
          );
          check(
            "teacher follow-up stays a dedicated approval handoff; no study wrapper or activity mounted",
          );
          continue;
        }
        for (const p of dto.pages) {
          await page.goto(
            `${base}/study/history/${session.id}?attempt=${p.attempt_id}`,
          );
          await page.locator("[data-recorded-question]").waitFor();
          if (p.submission)
            assert.equal(
              await page.locator("[data-original-response]").textContent(),
              p.submission.response_text,
            );
          assert.deepEqual(
            await page
              .locator("[data-recorded-event]")
              .evaluateAll((els) => els.map((e) => e.dataset.recordedEvent)),
            p.events.map((e) => e.event_id),
          );
          assert.deepEqual(
            await page.locator("[data-recorded-help]").allTextContents(),
            p.events
              .filter((e) => e.kind === "help_displayed")
              .map((e) => e.aid.text),
          );
          assert.ok(
            !(await page.locator("body").innerText()).includes("PRIVATE_"),
          );
          if ("source_version" in p.source.content_ref) {
            await page
              .getByText("Source and saved identities", { exact: true })
              .click();
            assert.ok(
              (await page.locator("body").innerText()).includes(
                p.source.content_ref.content_version,
              ),
            );
          }
        }
      }
      check(
        "D1 real stored histories render exact originals/event order/displayed bodies, accepted uncertainty and historical source versions without private sentinels",
      );
      await page.goto(
        `${base}/study/history/${state.missing}?attempt=${state.blank}`,
      );
      await page
        .getByText("An empty answer was saved.", { exact: true })
        .waitFor();
      await page
        .getByText("Assessment not recorded", { exact: true })
        .waitFor();
      check("empty saved response and missing assessment are explicit");
      await page.goto(`${route}?attempt=${state.ids[2]}`);
      await page
        .getByText("Assessment failed · original answer remains saved", {
          exact: true,
        })
        .waitFor();
      check(
        "failed evaluation never becomes incorrect or overwrites original answer",
      );
      await page.goto(route);
      await page.locator("[data-recorded-history]").waitFor();
      await page.getByRole("searchbox").fill("missing-text-no-match");
      await page
        .getByText("No loaded questions match these filters.", { exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Clear filters" }).click();
      await page.getByLabel("Recorded result").selectOption("uncertain");
      assert.equal(
        await page
          .getByRole("link", { name: "Open saved question →", exact: true })
          .count(),
        1,
      );
      check(
        "loaded-question text/result/assistance filters preserve identity and explicit empty state",
      );
      for (const width of [1440, 1024, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(detail);
        await page.locator("[data-recorded-question]").waitFor();
        const origin = page.getByText(
          /Recorded demonstration work · 1 of 12 questions loaded/,
        );
        assert.ok(
          await origin.isVisible(),
          `origin and coverage visible at ${width}`,
        );
        let failedReads = 0;
        const pattern = "**/api/student/notebook/sessions/**";
        await page.route(pattern, (route) => {
          failedReads++;
          return route.fulfill({
            status: failedReads === 1 ? 409 : 503,
            contentType: "application/json",
            body: JSON.stringify({
              code: failedReads === 1 ? "SNAPSHOT_CHANGED" : "UNAVAILABLE",
            }),
          });
        });
        await page.getByRole("button", { name: "Refresh history" }).click();
        const notice = page.locator('[data-history-status="stale"]');
        await notice.getByText(/replacement could not be loaded/).waitFor();
        const noticeBox = await notice.boundingBox();
        const paperBox = await page
          .locator("[data-recorded-question]")
          .boundingBox();
        assert.ok(
          noticeBox &&
            paperBox &&
            noticeBox.y < paperBox.y &&
            noticeBox.y < 700,
          `stale notice precedes paper at ${width}`,
        );
        assert.equal(failedReads, 2, "one bounded replacement attempt");
        assert.equal(
          await page
            .getByRole("button", { name: "Load more recorded questions" })
            .count(),
          0,
        );
        assert.equal(
          await page.locator("[data-original-response]").textContent(),
          original,
        );
        await page.screenshot({
          path: path.join(out, `stale-question-${width}.png`),
        });
        report.screenshots.push(`stale-question-${width}.png`);
        await page.unroute(pattern);
        await page.getByRole("button", { name: "Refresh history" }).click();
        await notice.waitFor({ state: "detached" });
      }
      check(
        "injected transport conflict/replacement failure keeps a visible stale notice above real saved evidence at 1440/1024/390/320; mobile origin/coverage stays visible and explicit refresh recovers",
      );
      assert.equal(await fingerprint(), firstFingerprint);
      check(
        "all 13 evidence-table fingerprints unchanged across saved-history navigation",
      );
      // Deliberate operator display is outside the no-write baseline; it creates a real stale cursor.
      await page.goto(route);
      await page.locator("[data-recorded-history]").waitFor();
      await acknowledgeIntervention(actor, state.session, state.pending);
      const afterOperator = await fingerprint();
      let saw409 = false;
      page.on("response", (res) => {
        if (
          res.status() === 409 &&
          res.url().includes("/api/student/notebook/")
        )
          saw409 = true;
      });
      await page
        .getByRole("button", { name: "Load more recorded questions" })
        .click();
      await page
        .getByText("Updated saved history loaded.", { exact: true })
        .waitFor();
      assert.ok(saw409);
      assert.equal(
        await page
          .getByRole("link", { name: "Open saved question →", exact: true })
          .count(),
        10,
      );
      await page
        .getByRole("button", { name: "Load more recorded questions" })
        .click();
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("a")].filter(
            (e) => e.textContent.trim() === "Open saved question →",
          ).length === 12,
      );
      assert.equal(await fingerprint(), afterOperator);
      check(
        "real display-only snapshot conflict returns 409, atomically replaces ten rows then loads twelve without mixed or duplicate records",
      );
    }
    const peer = await browser.newContext();
    await login(peer, "DEMO_STUDENT_TWO");
    const peerPage = await peer.newPage();
    await deniedRoute(peerPage, detail);
    assert.equal(
      (
        await peer.request.get(
          `${base}/api/student/notebook/sessions/${state.session}`,
        )
      ).status(),
      404,
    );
    assert.ok(!(await peerPage.locator("body").innerText()).includes(original));
    await peer.close();
    const teacher = await browser.newContext();
    await login(teacher, "DEMO_TEACHER");
    const teacherPage = await teacher.newPage();
    await deniedRoute(teacherPage, detail);
    await teacher.close();
    await deniedRoute(page, `${base}/study/history/${randomUUID()}`);
    await deniedRoute(
      page,
      `${route}?attempt=${state.ids[0]}&attempt=${state.ids[1]}`,
    );
    await deniedRoute(page, `${route}?attempt=${randomUUID()}`);
    check(
      "peer/teacher/missing session and foreign or duplicate attempt selectors deny without exposing work",
    );
    if (mode === "fallback")
      assert.equal(await fingerprint(), firstFingerprint);
    assert.deepEqual(
      report.requests.filter((r) => r.method !== "GET"),
      [],
    );
    assert.deepEqual(report.errors, []);
    check(
      "history browser sent zero non-GET API requests and reported zero page errors",
    );
    report.fingerprint = await fingerprint();
  }
} catch (error) {
  report.failure = String(error.stack || error);
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  save();
  await browser?.close();
  await pool.end();
  console.log("REPORT " + path.relative(root, out));
}
