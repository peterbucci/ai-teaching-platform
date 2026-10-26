import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { isAbsolute, join } from "node:path";
const load = createRequire(import.meta.url);
const { chromium } = load(process.env.PLAYWRIGHT_MODULE || "playwright");
const [base, output, sha, draftId] = process.argv.slice(2);
const expectedSources = {
  "http://localhost:3321": "723ed6fea41138b604a9d333ebcd4a07b2202c36",
  "http://localhost:3322": "5d6363d2867a6f0250f8220db0474342b1241d00",
  "http://localhost:3325": "545b880749c757f7502a9bfa7fd127afdf290afd",
};
if (
  !Object.hasOwn(expectedSources, base ?? "") ||
  sha !== expectedSources[base] ||
  !output ||
  !isAbsolute(output) ||
  (draftId && !/^[a-f0-9-]{36}$/.test(draftId))
)
  throw new Error("Use an isolated acceptance origin and pinned SHA");
if (existsSync(join(output, "report.json")))
  throw new Error(
    "Choose a fresh output directory; prior acceptance evidence must not be overwritten.",
  );
await mkdir(output, { recursive: true });
const report = {
  sourceSha: sha,
  harnessSha256: createHash("sha256")
    .update(readFileSync(new URL(import.meta.url)))
    .digest("hex"),
  base,
  startedAt: new Date().toISOString(),
  category: "provider-disabled real browser; synthetic saved evidence/draft",
  browser: null,
  cases: [],
  screenshots: [],
  unrun: [
    "screen reader",
    "native browser 200% zoom",
    "human presenter",
    "hosted release",
    "fresh actual-model generation",
    "real session expiry (save rejection is an injected 401)",
  ],
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
page.on("dialog", (dialog) => dialog.accept());
const assignment = "30000000-0000-4000-8000-000000000001";
const session = "40000000-0000-4000-8000-000000000001";
let seq = 0;
async function save() {
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
}
async function check(id, fn) {
  const startedAt = new Date().toISOString();
  try {
    const details = await fn();
    report.cases.push({
      id,
      status: "pass",
      startedAt,
      finishedAt: new Date().toISOString(),
      details,
    });
  } catch (e) {
    report.cases.push({
      id,
      status: "fail",
      startedAt,
      finishedAt: new Date().toISOString(),
      error: e.message,
    });
  }
  await save();
}
async function shot(name) {
  const path = join(output, `${++seq}-${name}.png`);
  await page.screenshot({ path });
  report.screenshots.push(path);
}
async function go(path, allowError = false) {
  const response = await page.goto(base + path);
  await page.waitForLoadState("networkidle");
  assert.equal(
    new URL(page.url()).pathname,
    new URL(base + path).pathname,
    "Unexpected navigation/authorization redirect",
  );
  if (!allowError)
    assert.ok(
      response?.ok(),
      `Unexpected HTTP ${response?.status()} for ${path}`,
    );
}
async function review() {
  const res = await context.request.get(
    `${base}/api/teacher/interventions/${draftId}`,
  );
  assert.equal(res.status(), 200);
  return res.json();
}
try {
  await go("/login");
  await page.getByRole("button", { name: "Demo teacher", exact: true }).click();
  await page.waitForURL("**/teacher");
  await page.waitForLoadState("networkidle");
  await check("T01 exact original and accepted evaluation", async () => {
    const res = await context.request.get(
      `${base}/api/teacher/sessions/${session}`,
    );
    assert.equal(res.status(), 200);
    const data = await res.json();
    await writeFile(
      join(output, "synthetic-session.json"),
      JSON.stringify(data, null, 2),
    );
    await go(
      `/teacher/sessions/${session}#evaluation-60000000-0000-4000-8000-000000000001`,
    );
    const text = await page.locator("body").innerText();
    assert.match(text, /Student One/);
    assert.match(text, /Transmission|transmission/);
    assert.ok(
      text.includes(data.attempts[0].response_text),
      "Exact original student response missing",
    );
    assert.equal(
      data.attempts[0].current_evaluation_id,
      "60000000-0000-4000-8000-000000000001",
    );
    const accepted = data.evaluations.find(
      (item) => item.id === data.attempts[0].current_evaluation_id,
    );
    assert.equal(accepted?.validation_status, "accepted");
    assert.match(
      await page
        .locator("#evaluation-60000000-0000-4000-8000-000000000001")
        .innerText(),
      /current accepted judgment/,
    );
    await shot("original-response");
    return {
      session,
      acceptedEvaluation: "60000000-0000-4000-8000-000000000001",
      sourceData: "synthetic-session.json",
    };
  });
  const isWorkbench = [
    "http://localhost:3322",
    "http://localhost:3325",
  ].includes(base);
  const hasAssignmentsSlice = [
    "http://localhost:3323",
    "http://localhost:3325",
  ].includes(base);
  const hasLessonsSlice = [
    "http://localhost:3324",
    "http://localhost:3325",
  ].includes(base);
  const headings = {
    desk: isWorkbench ? "Teaching Desk" : "Class overview",
    evidence: isWorkbench ? "Evidence" : "Learning insights",
    assignments: hasAssignmentsSlice
      ? "Assignments & class progress"
      : "Assignments",
    lessons: hasLessonsSlice ? "Lessons" : "Your lessons",
  };
  const routes = [
    ["desk", `/teacher?assignment=${assignment}&origin=synthetic_fixture`],
    [
      "evidence",
      isWorkbench
        ? `/teacher/evidence?assignment=${assignment}&origin=synthetic_fixture`
        : `/teacher/insights?assignment=${assignment}&origin=synthetic_fixture`,
    ],
    ["assignments", `/teacher/assignments?assignment=${assignment}`],
    ["lessons", "/teacher/lessons"],
  ];
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ]) {
    await page.setViewportSize(size);
    for (const [name, path] of routes)
      await check(`R-${name}-${size.width}`, async () => {
        await go(path);
        assert.equal(
          await page
            .getByRole("heading", {
              name: headings[name],
              level: 1,
              exact: true,
            })
            .isVisible(),
          true,
          "Expected teacher page heading is not visible",
        );
        const geometry = await page.evaluate(() => ({
          viewport: innerWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        }));
        await shot(`${name}-${size.width}`);
        assert.ok(
          geometry.document <= size.width + 1,
          JSON.stringify(geometry),
        );
        return {
          ...geometry,
          height: size.height,
          url: page.url(),
          heading: headings[name],
          scope: "expected page and horizontal overflow only",
        };
      });
    if (size.width < 801)
      await check(`K-navigation-${size.width}`, async () => {
        const trigger = page.getByRole("button", { name: "Open navigation" });
        await trigger.focus();
        await page.keyboard.press("Enter");
        await page.getByRole("dialog").waitFor();
        const links = await page
          .getByRole("dialog")
          .getByRole("link")
          .allTextContents();
        await shot(`keyboard-drawer-${size.width}`);
        await page.keyboard.press("Escape");
        assert.equal(await page.getByRole("dialog").isVisible(), false);
        assert.equal(
          await trigger.evaluate((e) => e === document.activeElement),
          true,
        );
        return { links, focusReturned: true };
      });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await check("N01 Back Forward reload keep assignment", async () => {
    await go(routes[0][1]);
    await go(routes[1][1]);
    const expected = page.url();
    await page.goBack();
    await page.waitForLoadState("networkidle");
    assert.equal(page.url(), base + routes[0][1]);
    await page.goForward();
    await page.waitForLoadState("networkidle");
    assert.equal(page.url(), expected);
    await page.reload();
    await page.waitForLoadState("networkidle");
    assert.equal(page.url(), expected);
    return { url: expected };
  });
  await check("A01 explicitly invalid assignment", async () => {
    await go("/teacher?assignment=invalid", true);
    const text = await page.locator("body").innerText();
    assert.ok(
      /404|not found|not available|isn.t available|couldn.t|unavailable/i.test(
        text,
      ),
      `Invalid assignment silently fell back: ${text.slice(-1400)}`,
    );
    await shot("invalid-assignment");
    return { text };
  });
  if (draftId) {
    const editTitle = `Independent acceptance ${sha.slice(0, 7)} ${report.startedAt}`;
    await go(
      `/teacher/interventions?assignment=${assignment}&origin=synthetic_fixture&draft=${draftId}`,
    );
    await check("T02 saved draft is private before editing", async () => {
      const r = await review();
      assert.equal(r.approval, null);
      assert.equal(r.delivery, null);
      assert.equal(r.draft.assignment_id, assignment);
      report.initialDraft = {
        id: draftId,
        revision: r.draft.revision,
        status: r.draft.status,
        evidence: r.draft.evidence,
      };
      return { revision: r.draft.revision };
    });
    await page
      .getByRole("button", { name: "Edit activity", exact: true })
      .click();
    await check("T03 unsent edit refresh recovery", async () => {
      const before = await review();
      assert.notEqual(before.draft.activity.title, editTitle);
      await page.getByLabel("Activity title", { exact: true }).fill(editTitle);
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page
        .getByRole("button", { name: "Edit activity", exact: true })
        .click();
      assert.equal(
        await page.getByLabel("Activity title", { exact: true }).inputValue(),
        editTitle,
      );
      const after = await review();
      assert.equal(after.draft.revision, before.draft.revision);
      assert.deepEqual(after.draft.activity, before.draft.activity);
      await shot("unsent-recovered");
      return "Local recovery observed; no save implied";
    });
    await check(
      "T04 injected 401 preserves text then explicit save",
      async () => {
        const before = await review();
        let intercepted = 0;
        await page.route(`**/api/teacher/interventions/${draftId}`, (route) => {
          if (route.request().method() === "POST" && !intercepted++) {
            return route.fulfill({
              status: 401,
              contentType: "application/json",
              body: JSON.stringify({
                error: "Acceptance test: authentication expired",
              }),
            });
          }
          return route.continue();
        });
        await page
          .getByRole("button", { name: "Save private revision", exact: true })
          .click();
        await page
          .getByText("Acceptance test: authentication expired", { exact: true })
          .waitFor();
        assert.equal(
          await page.getByLabel("Activity title", { exact: true }).inputValue(),
          editTitle,
        );
        assert.equal((await review()).draft.revision, before.draft.revision);
        await shot("failed-save-preserved");
        await page.unroute(`**/api/teacher/interventions/${draftId}`);
        const savedResponse = page.waitForResponse(
          (response) =>
            response.url() === `${base}/api/teacher/interventions/${draftId}` &&
            response.request().method() === "POST",
        );
        await page
          .getByRole("button", { name: "Save private revision", exact: true })
          .click();
        assert.equal((await savedResponse).status(), 200);
        await page
          .getByRole("button", { name: "Save private revision", exact: true })
          .waitFor({ state: "visible" });
        await page.waitForFunction(
          () => !document.body.innerText.includes("unsaved changes"),
        );
        const after = await review();
        assert.equal(after.draft.revision, before.draft.revision + 1);
        assert.equal(after.draft.activity.title, editTitle);
        assert.deepEqual(after.draft.evidence, before.draft.evidence);
        assert.equal(after.approval, null);
        assert.equal(after.delivery, null);
        return {
          previous: before.draft.revision,
          saved: after.draft.revision,
          approval: null,
          delivery: null,
          failureInjected: "HTTP 401; real session remained valid",
        };
      },
    );
    for (const width of [1440, 1024, 390, 320])
      await check(`R-intervention-edit-${width}`, async () => {
        await page
          .getByRole("button", { name: "Edit activity", exact: true })
          .click();
        await page.setViewportSize({
          width,
          height: width === 1440 ? 900 : width === 1024 ? 768 : 844,
        });
        await page
          .getByLabel("Activity title", { exact: true })
          .scrollIntoViewIfNeeded();
        const geo = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        await shot(`intervention-edit-${width}`);
        assert.ok(geo.scroll <= width + 1, JSON.stringify(geo));
        return geo;
      });
    await page.setViewportSize({ width: 1440, height: 900 });
    await check("T05 preview excludes private criteria", async () => {
      await page
        .getByRole("button", { name: "Student preview", exact: true })
        .click();
      const preview = page.getByRole("region", {
        name: "Student-facing activity preview",
      });
      const text = await preview.innerText();
      const r = await review();
      const normalize = (value) => value.replace(/\s+/g, " ").trim();
      const publicTexts = [
        r.draft.activity.title,
        r.draft.activity.learning_objective,
        r.draft.activity.explanation ?? "",
        r.draft.activity.exercise_text,
        ...r.draft.activity.source_references.map((source) => source.quote),
        ...r.draft.activity.practice_questions.map(
          (question) => question.prompt_text,
        ),
        r.draft.activity.fresh_check.prompt_text,
      ].map(normalize);
      const guidance = [
        ...r.draft.activity.practice_questions,
        r.draft.activity.fresh_check,
      ]
        .map((question) => question.rubric.answer_guidance)
        .filter((value) => typeof value === "string" && value.length >= 20)
        .map(normalize);
      const privateOnlyGuidance = guidance.filter(
        (value) =>
          !publicTexts.some((publicText) => publicText.includes(value)),
      );
      for (const privateText of privateOnlyGuidance)
        assert.equal(
          normalize(text).includes(privateText),
          false,
          "Private answer guidance appears in the student preview",
        );
      assert.doesNotMatch(
        text,
        /expected answer|acceptable alternatives|private rubric|suggested recipient/i,
      );
      if (!privateOnlyGuidance.length)
        report.unrun.push(
          "Unique private answer-text privacy sentinel: this fixture duplicates private guidance in approved public source citations",
        );
      await shot("student-safe-preview");
      return {
        previewChars: text.length,
        privateAnswerGuidanceChecked: privateOnlyGuidance.length,
        privateGuidanceAlsoInPublicSources:
          guidance.length - privateOnlyGuidance.length,
        scope:
          "rendered teacher preview; student API projection is covered separately",
      };
    });
    await check(
      "T06 explicit one-recipient approval remains undelivered",
      async () => {
        const before = await review();
        await page
          .getByRole("checkbox", {
            name: "Student Two (fictional)",
            exact: true,
          })
          .check();
        await page
          .getByRole("button", { name: /^Approve revision \d+ for 1 student/ })
          .click();
        await page
          .getByText("Approved · awaiting delivery", { exact: true })
          .waitFor();
        const r = await review();
        assert.equal(r.approval.approved_revision, before.draft.revision);
        assert.equal(r.approval.assignment_id, assignment);
        assert.deepEqual(r.approval.activity, before.draft.activity);
        assert.deepEqual(r.approval.evidence, before.draft.evidence);
        assert.deepEqual(
          r.approval.content_ref,
          before.draft.evidence.content_ref,
        );
        assert.equal(r.approval.recipient_ids.length, 1);
        assert.equal(
          r.approval.recipient_ids[0],
          "10000000-0000-4000-8000-000000000003",
        );
        assert.equal(r.delivery, null);
        report.approval = r.approval;
        await shot("approved-not-delivered");
        return {
          approval: r.approval.id,
          recipient_ids: r.approval.recipient_ids,
          delivery: null,
        };
      },
    );
    await check(
      "T07 explicit delivery and reload do not duplicate",
      async () => {
        await page
          .getByRole("button", {
            name: /^Deliver approved activity to 1 student/,
          })
          .click();
        await page.getByText("Delivered", { exact: true }).waitFor();
        const r = await review();
        assert.ok(r.delivery?.id);
        assert.equal(r.delivery.approval_id, r.approval.id);
        assert.deepEqual(r.delivery.recipient_ids, r.approval.recipient_ids);
        await page.reload();
        await page.waitForLoadState("networkidle");
        assert.equal((await review()).delivery.id, r.delivery.id);
        report.delivery = r.delivery;
        await shot("delivered");
        return { delivery: r.delivery.id };
      },
    );
  } else
    report.unrun.push(
      "Intervention edit, approval and delivery browser path: no draft fixture supplied",
    );
} catch (error) {
  report.cases.push({
    id: "harness-execution",
    status: "fail",
    error: error.message,
  });
} finally {
  report.finishedAt = new Date().toISOString();
  report.result = report.cases.some((item) => item.status === "fail")
    ? "fail"
    : "pass";
  if (report.result === "fail") process.exitCode = 1;
  await save();
  console.log(
    JSON.stringify({
      cases: report.cases.map(({ id, status, error }) => ({
        id,
        status,
        error,
      })),
      output,
    }),
  );
  await context.close();
  await browser.close();
}
