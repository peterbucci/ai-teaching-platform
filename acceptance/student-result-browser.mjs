/** Supplemental browser/HTTP acceptance. Requires the explicit seed-student-result fixture. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  pathToFileURL(
    process.env.ACCEPTANCE_PLAYWRIGHT ||
      "C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  ).href
);
const base = process.env.ACCEPTANCE_BASE_URL || "http://localhost:3322";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const setup =
  process.env.ACCEPTANCE_SETUP ||
  "C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-pr116";
const input =
  process.env.ACCEPTANCE_INPUT || path.join(setup, "browser-student");
const out = process.env.ACCEPTANCE_RESULT_OUT || input;
assert.equal(
  fs.existsSync(path.join(out, "student-result-report.json")),
  false,
  "Choose a fresh ACCEPTANCE_RESULT_OUT; preserve previous supplemental results.",
);
fs.mkdirSync(out, { recursive: true });
const fixture = JSON.parse(
  fs
    .readFileSync(path.join(input, "accepted-result-fixture.json"), "utf8")
    .replace(/^\uFEFF/, ""),
);
const main = JSON.parse(
  fs.readFileSync(path.join(input, "student-browser-report.json"), "utf8"),
);
const report = {
  source_sha: main.source_sha,
  base,
  started_at: new Date().toISOString(),
  fixture,
  category:
    "Provider-disabled browser plus explicitly synthetic accepted-evaluation fixture; no actual-model claim",
  cases: [],
  screenshots: [],
};
const save = () =>
  fs.writeFileSync(
    path.join(out, "student-result-report.json"),
    JSON.stringify(report, null, 2),
  );
const record = (id, status, details) => {
  report.cases.push({ id, status, details });
  save();
};
const values = {};
for (const line of fs
  .readFileSync(path.join(setup, ".env.acceptance"), "utf8")
  .split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (
    m &&
    ["DEMO_STUDENT_TWO_EMAIL", "DEMO_STUDENT_TWO_PASSWORD"].includes(m[1])
  )
    values[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}
const browser = await chromium.connect(
  fs
    .readFileSync(
      process.env.ACCEPTANCE_WS_FILE ||
        "C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-browser-endpoint.txt",
      "utf8",
    )
    .trim(),
);
try {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const p = await c.newPage();
  await p.goto(`${base}/login`);
  await p
    .getByRole("textbox", { name: "Demo email", exact: true })
    .fill(values.DEMO_STUDENT_TWO_EMAIL);
  await p
    .getByLabel("Password", { exact: true })
    .fill(values.DEMO_STUDENT_TWO_PASSWORD);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL(/\/study/);
  await c.storageState({ path: path.join(out, "storage-student-two.json") });
  await p.goto(`${base}${fixture.url}`);
  await p.locator(".lp-turns").waitFor();
  await p.waitForLoadState("networkidle");
  const original = await p.locator(".lp-answer").allTextContents();
  assert.ok(original.includes(fixture.response_text));
  const text = await p.locator("body").evaluate((body) =>
    [...body.querySelectorAll("*")]
      .filter(
        (e) =>
          !e.closest(".sr-only") &&
          e.children.length === 0 &&
          e.getBoundingClientRect().width > 0 &&
          e.getBoundingClientRect().height > 0,
      )
      .map((e) => e.textContent)
      .join("\n"),
  );
  fs.writeFileSync(path.join(out, "correct-result-visible-text.txt"), text);
  const checked = text.replace(fixture.response_text, "");
  const visibleAssessment =
    /\b(correct|incorrect|partially correct|uncertain|assessment result)\b/i.test(
      checked,
    );
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ]) {
    await p.setViewportSize(vp);
    const file = `correct-result-${vp.width}x${vp.height}.png`;
    await p.screenshot({ path: path.join(out, file), fullPage: true });
    report.screenshots.push({ file, viewport: vp });
  }
  record(
    "S-01-accepted-correct-result-visible",
    visibleAssessment ? "PASS" : "FAIL",
    {
      observed: visibleAssessment
        ? "Visible assessment outcome found"
        : "Only Completed and saved original answer; accepted correct outcome and uncertainty are not visibly rendered.",
      accepted_evaluation: fixture.evaluation_id,
      session_id: fixture.session_id,
      exact_original_text_visible: true,
      evaluator_type: "synthetic_fixture",
      owner: "Student result/scroll PR #113",
    },
  );
  const sessionBefore = await (
    await c.request.get(`${base}/api/tutoring/${fixture.session_id}`)
  ).json();
  await p.reload();
  await p.locator(".lp-turns").waitFor();
  const sessionAfter = await (
    await c.request.get(`${base}/api/tutoring/${fixture.session_id}`)
  ).json();
  assert.deepEqual(sessionAfter, sessionBefore);
  record("ST-03-accepted-fixture-refresh-unchanged", "PASS", {
    session_id: fixture.session_id,
    view_equal: true,
  });
  const foreign = await c.request.get(
    `${base}/api/tutoring/${main.session_id}`,
  );
  assert.equal(foreign.status(), 404);
  record("RC-09-other-student-denied", "PASS", {
    status: foreign.status(),
    foreign_session: main.session_id,
  });
  await c.close();
  const c1 = await browser.newContext({
    storageState: path.join(input, "storage-student.json"),
  });
  const before = await (
    await c1.request.get(`${base}/api/tutoring/${main.session_id}/conversation`)
  ).json();
  const msg = before.messages.find(
    (m) => m.text === "What do you mean by packet size?",
  );
  assert.ok(msg);
  const action = {
    version: "r7-conversation-v1",
    action: "send_message",
    request_id: msg.request_id,
    session_id: main.session_id,
    attempt_id: msg.attempt_id,
    expected_revision: msg.expected_revision,
    text: msg.text,
  };
  const url = `${base}/api/tutoring/${main.session_id}/conversation`;
  const repeated = await c1.request.post(url, {
    headers: { Origin: base },
    data: action,
  });
  assert.equal(repeated.status(), 200);
  const changed = await c1.request.post(url, {
    headers: { Origin: base },
    data: { ...action, text: "Altered same identity" },
  });
  assert.equal(changed.status(), 409);
  const stale = await c1.request.post(url, {
    headers: { Origin: base },
    data: { ...action, request_id: randomUUID(), expected_revision: 99999 },
  });
  assert.equal(stale.status(), 409);
  const after = await (await c1.request.get(url)).json();
  assert.deepEqual(after, before);
  record("RC-07-exact-replay-altered-payload-stale-revision", "PASS", {
    same_request: repeated.status(),
    altered_payload: changed.status(),
    stale_revision: stale.status(),
    view_unchanged: true,
    provider_requests_used: after.dialogue.state.provider_requests_used,
  });
  const p1 = await c1.newPage();
  await p1.goto(
    `${base}/study/assignments/30000000-0000-4000-8000-000000000099?tab=study&session=${main.session_id}`,
  );
  await p1
    .getByText("This page could not be found.", { exact: false })
    .waitFor();
  record("RC-09-assignment-mismatch", "PASS", {
    observed: "404 page",
    private_evidence_exposed: false,
  });
  await c1.close();
} catch (error) {
  record("SUPPLEMENT-HARNESS", "FAIL", { error: error.message });
  process.exitCode = 1;
} finally {
  report.finished_at = new Date().toISOString();
  save();
  await browser.close();
}
if (report.cases.some((item) => item.status === "FAIL")) process.exitCode = 1;
console.log(
  JSON.stringify(
    {
      report: path.join(out, "student-result-report.json"),
      cases: report.cases,
      screenshots: report.screenshots,
    },
    null,
    2,
  ),
);
