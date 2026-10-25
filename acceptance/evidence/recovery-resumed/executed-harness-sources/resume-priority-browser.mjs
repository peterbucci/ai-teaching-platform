import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, join } from "node:path";
import { teacherReady, readinessSha256 } from "./browser-readiness.mjs";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const [base, output, sha] = process.argv.slice(2);
const main = false;
const expectedSources = {
  "http://localhost:3355": "45326e243245c4941e2cefd0eab984bb7ee19765",
};
assert.ok(Object.hasOwn(expectedSources, base ?? ""));
assert.equal(sha, expectedSources[base]);
assert.ok(
  output && isAbsolute(output),
  "Use a fresh absolute output directory",
);
assert.equal(
  existsSync(join(output, "report.json")),
  false,
  "Use a fresh output directory",
);
await mkdir(output, { recursive: true });
const report = {
  readinessSha256,
  base,
  sourceSha: sha,
  harnessSha256: createHash("sha256")
    .update(readFileSync(new URL(import.meta.url)))
    .digest("hex"),
  category:
    "provider-disabled real browser; actual teacher attention-card navigation through synthetic accepted evidence",
  startedAt: new Date().toISOString(),
  status: "incomplete",
  cases: [],
  requests: [],
  screenshots: [],
};
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
report.browser = browser.version();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("request", (request) => {
  if (request.method() !== "GET" && !request.url().includes("/api/auth/"))
    report.requests.push({ method: request.method(), url: request.url() });
});
const assignment = "30000000-0000-4000-8000-000000000001";
async function shot(name) {
  await page.screenshot({ path: join(output, `${name}.png`) });
  report.screenshots.push(`${name}.png`);
}
try {
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL("**/teacher");
  await teacherReady(page, "/teacher");
  await page.goto(
    `${base}/teacher?assignment=${assignment}&origin=synthetic_fixture`,
  );
  await teacherReady(
    page,
    `/teacher?assignment=${assignment}&origin=synthetic_fixture`,
  );
  if (main) {
    await page
      .getByRole("heading", { name: "Class overview", exact: true })
      .waitFor();
    const card = page.locator(".lp-teacher-task-highlight");
    report.priorityText = await card.innerText();
    const priorityLink = card.getByRole("link", {
      name: "Review explanations",
    });
    const priorityHref = await priorityLink.getAttribute("href");
    const priorityUrl = new URL(priorityHref, base);
    assert.equal(priorityUrl.pathname, "/teacher/insights");
    assert.equal(priorityUrl.searchParams.get("assignment"), assignment);
    assert.equal(priorityUrl.searchParams.get("origin"), "synthetic_fixture");
    await shot("selected-teacher-attention-card");
    await priorityLink.click();
    await page.waitForURL((url) => url.pathname === "/teacher/insights");
    const pattern = page.locator(".lp-pattern-detail").first();
    await pattern.locator(":scope > summary").click();
    const learner = pattern.locator(".lp-pattern-student").first();
    await learner.locator(":scope > summary").click();
    const original = learner
      .getByRole("link", { name: "Read original response and feedback" })
      .last();
    const originalHref = await original.getAttribute("href");
    const originalUrl = new URL(originalHref, base);
    const sessionId = originalUrl.pathname.split("/").at(-1);
    const evaluationId = originalUrl.hash.replace("#evaluation-", "");
    await original.click();
    await page.waitForURL((url) => url.pathname === originalUrl.pathname);
    const response = await context.request.get(
      `${base}/api/teacher/sessions/${sessionId}`,
    );
    assert.equal(response.status(), 200);
    const evidence = await response.json();
    const evaluation = evidence.evaluations.find(
      (item) => item.id === evaluationId,
    );
    assert.equal(evaluation.validation_status, "accepted");
    const attempt = evidence.attempts.find(
      (item) => item.current_evaluation_id === evaluationId,
    );
    assert.ok(
      attempt,
      "Followed evaluation must be the current accepted result",
    );
    assert.equal(evidence.session.assignment_id, assignment);
    const detail = page.locator(`#attempt-${attempt.id}`);
    await detail.waitFor();
    assert.equal(
      await detail.locator(".lp-evidence-answer").innerText(),
      attempt.response_text,
    );
    const content = await detail.innerText();
    const source = attempt.question.content_ref;
    // The source-version details are collapsed but still inspectable in the DOM.
    const allContent = await detail.textContent();
    assert.ok(allContent.includes(source.content_version));
    assert.ok(
      allContent.includes(source.source_commit ?? source.source_version),
    );
    if (attempt.assistance.assistance_level === "none_recorded")
      assert.ok(
        content.includes("No content help recorded before this answer."),
      );
    await detail.scrollIntoViewIfNeeded();
    await shot("priority-original-evidence");
    const concept = attempt.question.concept_ids[0];
    report.cases.push({
      id: "P01 current-main attention card opens exact accepted evidence",
      status: "pass",
      details: {
        priorityHref,
        originalHref,
        assignment,
        concept,
        sessionId,
        attemptId: attempt.id,
        evaluationId,
        originalResponse: attempt.response_text,
        source,
        assistance: attempt.assistance,
      },
    });
    await page.goBack();
    await page.waitForURL((url) => url.pathname === "/teacher/insights");
    const conceptDetail = page.locator(`#concept-${concept}`);
    if ((await conceptDetail.getAttribute("open")) === null)
      await conceptDetail.locator(":scope > summary").click();
    const prepare = conceptDetail.getByRole("link", {
      name: "Draft a review activity",
    });
    await prepare.click();
    await page.waitForURL((url) => url.pathname === "/teacher/interventions");
    await page
      .getByText("Recorded learning evidence", { exact: true })
      .waitFor();
    const prepared = new URL(page.url());
    assert.equal(prepared.searchParams.get("assignment"), assignment);
    assert.equal(prepared.searchParams.get("origin"), "synthetic_fixture");
    assert.equal(prepared.searchParams.get("concept"), concept);
    assert.equal(report.requests.length, 0);
    await shot("priority-prepared-evidence");
    report.cases.push({
      id: "P02 current-main reviewed concept prepares the same assignment scope",
      status: "pass",
      details: {
        url: page.url(),
        nonAuthMutations: 0,
        limitation:
          "Main uses concept-wide preparation; exact selected-response handoff is not available in this baseline UI.",
      },
    });
    report.status = "pass";
  } else {
    await page
      .getByRole("heading", { name: "Teaching Desk", exact: true })
      .waitFor();
    const priorities = page.locator(
      "section[aria-labelledby=priorities-title] .wb-priority",
    );
    report.availablePriorityCards = await priorities.count();
    if (!report.availablePriorityCards) {
      report.status = "unrun";
      report.reason =
        "No teaching priority is available in this prepared-history view; no direct-URL substitute was used.";
      await shot("no-priority-card");
    } else {
      const card = priorities.first();
      report.priorityText = await card.innerText();
      const link = card.getByRole("link", { name: "Review evidence" });
      const priorityHref = await link.getAttribute("href");
      const expected = new URL(priorityHref, base);
      assert.equal(expected.pathname, "/teacher/evidence");
      assert.equal(expected.searchParams.get("assignment"), assignment);
      assert.equal(expected.searchParams.get("origin"), "synthetic_fixture");
      const concept = expected.searchParams.get("concept");
      const sessionId = expected.searchParams.get("session");
      const attemptId = expected.searchParams.get("attempt");
      const evaluationId = expected.searchParams.get("evaluation");
      assert.ok(
        concept && sessionId && attemptId && evaluationId,
        "Priority must identify inspectable evidence",
      );
      await card.scrollIntoViewIfNeeded();
      await shot("selected-teaching-priority");
      await link.click();
      await page.waitForURL((url) => url.pathname === "/teacher/evidence");
      await page.locator(".wb-original-response").waitFor();
      const actual = new URL(page.url());
      for (const key of [
        "assignment",
        "origin",
        "concept",
        "session",
        "attempt",
        "evaluation",
      ])
        assert.equal(
          actual.searchParams.get(key),
          expected.searchParams.get(key),
        );
      const response = await context.request.get(
        `${base}/api/teacher/sessions/${sessionId}`,
      );
      assert.equal(response.status(), 200);
      const evidence = await response.json();
      const attempt = evidence.attempts.find((item) => item.id === attemptId);
      const evaluation = evidence.evaluations.find(
        (item) => item.id === evaluationId,
      );
      assert.equal(evidence.session.assignment_id, assignment);
      assert.ok(attempt.question.concept_ids.includes(concept));
      assert.equal(attempt.current_evaluation_id, evaluationId);
      assert.equal(evaluation.validation_status, "accepted");
      assert.equal(
        await page.locator(".wb-original-response").innerText(),
        attempt.response_text,
      );
      const displayed = await page.locator("body").innerText();
      const source = attempt.question.content_ref;
      assert.ok(displayed.includes(source.content_version));
      assert.ok(
        displayed.includes(source.source_commit ?? source.source_version),
      );
      assert.ok(
        displayed.includes(
          `Assistance: ${attempt.assistance?.assistance_level.replaceAll("_", " ") ?? "not recorded"}`,
        ),
      );
      await shot("priority-original-evidence");
      report.cases.push({
        id: "P01 actual priority click preserves exact accepted evidence",
        status: "pass",
        details: {
          priorityHref,
          assignment,
          concept,
          sessionId,
          attemptId,
          evaluationId,
          originalResponse: attempt.response_text,
          assistance: attempt.assistance,
          source: attempt.question.content_ref,
        },
      });
      const prepare = page.getByRole("link", {
        name: "Prepare from this response",
      });
      if (!(await prepare.count())) {
        report.status = "unrun";
        report.reason =
          "Selected priority evidence inspected; preparation is unavailable for its current state.";
      } else {
        await prepare.click();
        await page.waitForURL(
          (url) => url.pathname === "/teacher/interventions",
        );
        await page
          .getByRole("heading", { name: "Evidence used", exact: true })
          .first()
          .waitFor();
        const prepared = new URL(page.url());
        for (const key of ["assignment", "origin", "concept"])
          assert.equal(
            prepared.searchParams.get(key),
            expected.searchParams.get(key),
          );
        assert.deepEqual(prepared.searchParams.getAll("seedAttempt"), [
          attemptId,
        ]);
        const body = await page.locator("body").innerText();
        assert.ok(body.includes(attempt.response_text));
        assert.ok(body.includes("Selected starting responses"));
        assert.equal(
          report.requests.length,
          0,
          "Priority inspection and preparation must not generate, approve or deliver",
        );
        await shot("priority-prepared-evidence");
        report.cases.push({
          id: "P02 priority evidence prepares the same source scope without generation",
          status: "pass",
          details: {
            url: page.url(),
            selectedAttempt: attemptId,
            nonAuthMutations: 0,
          },
        });
        report.status = "pass";
      }
    }
  }
} catch (error) {
  report.status = "fail";
  report.error = error.message;
  process.exitCode = 1;
  await shot("failure");
  await writeFile(
    join(output, "failure.txt"),
    await page.locator("body").innerText(),
  );
} finally {
  report.finishedAt = new Date().toISOString();
  report.passed = report.cases
    .filter((item) => item.status === "pass")
    .map((item) => item.id);
  report.failed =
    report.status === "fail" ? [report.error ?? "harness-execution"] : [];
  report.unrun = [
    "P01 actual priority click preserves exact accepted evidence",
    "P02 priority evidence prepares the same source scope without generation",
  ].filter((id) => !report.cases.some((item) => item.id === id));
  await writeFile(
    join(output, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      status: report.status,
      cases: report.cases,
      output,
      error: report.error,
      reason: report.reason,
    }),
  );
  await context.close();
  await browser.close();
}
