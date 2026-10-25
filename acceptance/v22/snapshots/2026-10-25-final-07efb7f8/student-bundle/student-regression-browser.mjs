/** Verification only. Real browser against the separately seeded synthetic fixture.
 * Arguments: target-state-dir fixture-json fresh-output-dir playwright-package-dir
 * Browser cookies remain in isolated in-memory contexts and are never exported.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const [stateArg, fixtureArg, outArg, playwrightArg] = process.argv.slice(2);
assert.ok(
  stateArg && fixtureArg && outArg && playwrightArg,
  "Pass state, synthetic fixture JSON, fresh output directory and Playwright directory.",
);
const state = resolve(stateArg),
  out = resolve(outArg);
const onlyCase = process.env.ACCEPTANCE_REGRESSION_CASE || null;
assert.ok(
  onlyCase === null || onlyCase === "long-response-reading-back-and-reload",
  "Only the reading case with explicitly allowed display acknowledgements may be rerun separately.",
);
const readJson = (file) =>
  JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const manifest = readJson(join(state, "manifest.json"));
const fixture = readJson(resolve(fixtureArg));
const origin = new URL(manifest.origin);
assert.equal(manifest.project, "lp-v22-final-01a173d6");
assert.equal(origin.origin, "http://localhost:3396");
assert.equal(manifest.sourceSha, "07efb7f821339538800f150f57b298eb2e606be3");
assert.equal(manifest.sourceTree, "948b9a6005a056c97f10d181c589b5352d6221f3");
assert.equal(manifest.paidModelCallsAuthorized, false);
assert.equal(fixture.project, manifest.project);
assert.equal(fixture.source_sha, manifest.sourceSha);
assert.equal(fixture.source_tree, manifest.sourceTree);
assert.equal(fixture.actual_model_calls, 0);
const environment = Object.fromEntries(
  readFileSync(join(state, ".env.acceptance"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL"])
  assert.equal(environment[key] || "", "");
assert.equal(fixture.password_environment_key, "DEMO_STUDENT_TWO_PASSWORD");
assert.ok(environment.DEMO_STUDENT_TWO_PASSWORD);
assert.equal(
  existsSync(join(out, "report.json")),
  false,
  "Choose a fresh output directory; prior results must be retained.",
);
mkdirSync(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)(resolve(playwrightArg));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
const report = {
  source_sha: manifest.sourceSha,
  source_tree: manifest.sourceTree,
  harness_sha256: createHash("sha256")
    .update(readFileSync(new URL(import.meta.url)))
    .digest("hex"),
  fixture_sha256: createHash("sha256")
    .update(readFileSync(resolve(fixtureArg)))
    .digest("hex"),
  origin: origin.origin,
  project: manifest.project,
  browser: browser.version(),
  started_at: new Date().toISOString(),
  status: "running",
  cases: [],
  case_filter: onlyCase,
  screenshots: [],
  category:
    "real provider-disabled browser with explicitly synthetic accepted evaluation; no model-quality claim",
  actual_model_calls: 0,
  blocked_off_origin_requests: [],
  blocked_mutation_attempts: [],
  allowed_reading_requests: [],
  reading_progress: [],
  unrun: [
    "Actual-model verification",
    "Screen reader",
    "Native 200% zoom",
    "Real session expiry (401 is a browser injection)",
    "Multi-turn generated conversation (long case is one original authored response)",
    "Hosted release",
  ],
};
const save = () =>
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
save();
async function boundedReading(label, action) {
  report.reading_progress.push({
    label,
    status: "waiting",
    at: new Date().toISOString(),
  });
  save();
  let timer;
  try {
    const value = await Promise.race([
      action(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `${label} exceeded 15000ms; preserve incomplete outcome and reconcile before retry.`,
              ),
            ),
          15000,
        );
      }),
    ]);
    report.reading_progress.push({
      label,
      status: "completed",
      at: new Date().toISOString(),
    });
    save();
    return value;
  } finally {
    clearTimeout(timer);
  }
}
async function check(id, page, fn) {
  if (onlyCase && id !== onlyCase) {
    report.cases.push({ id, status: "unrun-filtered" });
    save();
    return;
  }
  try {
    const detail = await fn();
    report.cases.push({ id, status: "pass", detail });
  } catch (error) {
    report.cases.push({ id, status: "fail", error: error.message });
    try {
      await shot(page, `${id}-failure`);
    } catch {
      /* Retain original failure. */
    }
  }
  save();
}
async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: join(out, file), fullPage: false });
  report.screenshots.push({
    file,
    viewport: page.viewportSize(),
    url: page.url(),
  });
}
async function get(context, path) {
  const response = await context.request.get(new URL(path, origin).href);
  assert.equal(response.status(), 200, `GET ${path}`);
  return response.json();
}
async function login(kind) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  let loggedIn = false;
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      onlyCase &&
      loggedIn &&
      !["GET", "HEAD", "OPTIONS"].includes(route.request().method())
    ) {
      const sessionId = fixture.fixtures.long.session_id;
      const readingOpen = url.pathname === `/api/tutoring/${sessionId}/reading`;
      const readingAck = new RegExp(
        `^/api/sessions/${sessionId}/interventions/[a-f0-9-]{36}$`,
      ).test(url.pathname);
      if (
        kind === "long" &&
        url.origin === origin.origin &&
        route.request().method() === "POST" &&
        (readingOpen || readingAck)
      ) {
        report.allowed_reading_requests.push({
          url: url.href,
          method: "POST",
          body: route.request().postDataJSON(),
        });
        return route.continue();
      }
      report.blocked_mutation_attempts.push(
        `read-only:${route.request().method()}:${url.href}`,
      );
      return route.abort("blockedbyclient");
    }
    if (
      url.origin === origin.origin ||
      ["data:", "blob:"].includes(url.protocol)
    )
      await route.continue();
    else {
      report.blocked_off_origin_requests.push(url.href);
      await route.abort("blockedbyclient");
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(new URL("/login", origin).href);
  await page
    .getByRole("textbox", { name: "Demo email", exact: true })
    .fill(fixture.fixtures[kind].email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(environment.DEMO_STUDENT_TWO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/study/);
  loggedIn = true;
  await page.goto(new URL(fixture.fixtures[kind].url, origin).href);
  await page.locator(".lp-turns").waitFor();
  return { context, page };
}

try {
  const accepted = await login("accepted");
  await check("S01-accepted-result-visible", accepted.page, async () => {
    const item = fixture.fixtures.accepted;
    const publicView = await get(
      accepted.context,
      `/api/tutoring/${item.session_id}`,
    );
    assert.equal(publicView.attempts[0].response_text, item.response_text);
    const savedAnswers = await accepted.page
      .locator(".lp-answer")
      .allTextContents();
    assert.ok(savedAnswers.includes(item.response_text));
    const visibleAssessment = await accepted.page
      .locator("body")
      .evaluate((body) =>
        [...body.querySelectorAll("*")]
          .filter(
            (element) =>
              !element.closest(".sr-only, .lp-student-message") &&
              element.children.length === 0 &&
              element.getBoundingClientRect().width > 0 &&
              element.getBoundingClientRect().height > 0,
          )
          .map((element) => element.textContent)
          .join("\n"),
      );
    writeFileSync(join(out, "accepted-visible-text.txt"), visibleAssessment);
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
      { width: 320, height: 844 },
    ]) {
      await accepted.page.setViewportSize(viewport);
      await shot(
        accepted.page,
        `accepted-${viewport.width}x${viewport.height}`,
      );
    }
    assert.match(
      visibleAssessment,
      /\b(correct|incorrect|partially correct|uncertain|assessment result)\b/i,
      "Accepted synthetic correctness is saved, but no visible assessment outcome is rendered. Owner PR113/#76.",
    );
    return {
      evaluation_id: item.evaluation_id,
      original_text_visible: true,
      evaluation_provenance: "synthetic_fixture",
    };
  });
  await check(
    "accepted-reload-and-other-student-isolation",
    accepted.page,
    async () => {
      const path = `/api/tutoring/${fixture.fixtures.accepted.session_id}`;
      const before = await get(accepted.context, path);
      await accepted.page.reload();
      await accepted.page.locator(".lp-turns").waitFor();
      assert.deepEqual(await get(accepted.context, path), before);
      const denied = await accepted.context.request.get(
        new URL(`/api/tutoring/${fixture.fixtures.long.session_id}`, origin)
          .href,
      );
      assert.equal(denied.status(), 404);
      return {
        unchanged_on_reload: true,
        cross_student_status: denied.status(),
      };
    },
  );
  await accepted.context.close();

  const long = await login("long");
  await check("long-response-manual-scroll-and-jump", long.page, async () => {
    const scroll = long.page.getByRole("region", {
      name: "Learning conversation",
      exact: true,
    });
    await scroll.waitFor();
    const initial = await scroll.evaluate((element) => ({
      top: element.scrollTop,
      height: element.clientHeight,
      total: element.scrollHeight,
    }));
    assert.ok(
      initial.total > initial.height + 500,
      "Long fixture must produce meaningful scrollable history.",
    );
    await scroll.hover();
    await long.page.mouse.wheel(0, -15000);
    await long.page
      .getByRole("button", { name: "Jump to latest", exact: true })
      .waitFor();
    const afterManual = await scroll.evaluate((element) => element.scrollTop);
    assert.ok(
      afterManual < initial.top,
      "Upward wheel should reach earlier response text.",
    );
    await shot(long.page, "long-response-earlier-text");
    await long.page
      .getByRole("button", { name: "Jump to latest", exact: true })
      .click();
    const afterJump = await scroll.evaluate((element) => ({
      top: element.scrollTop,
      focused: document.activeElement === element,
    }));
    assert.ok(afterJump.top > afterManual);
    assert.equal(afterJump.focused, true);
    await shot(long.page, "long-response-jump-restores-region-focus");
    return {
      initial,
      afterManual,
      afterJump,
      method:
        "Actual pointer wheel and Jump to latest button; no direct DOM scroll mutation.",
    };
  });
  await check("long-response-reading-back-and-reload", long.page, async () => {
    const item = fixture.fixtures.long;
    const originalSessionURL = long.page.url();
    const before = await boundedReading("read original saved session", () =>
      get(long.context, `/api/tutoring/${item.session_id}`),
    );
    const readingLink = long.page.getByRole("link", {
      name: "Reading",
      exact: true,
    });
    assert.equal(
      new URL(await readingLink.getAttribute("href"), origin).searchParams.get(
        "session",
      ),
      item.session_id,
    );
    const opened = long.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/tutoring/${item.session_id}/reading` &&
        response.request().method() === "POST",
    );
    const acknowledged = long.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.startsWith(
          `/api/sessions/${item.session_id}/interventions/`,
        ) && response.request().method() === "POST",
    );
    await boundedReading("click exact session Reading", () =>
      readingLink.click(),
    );
    const deliveryResponse = await boundedReading(
      "reading open response headers",
      () => opened,
    );
    assert.equal(deliveryResponse.status(), 200);
    report.reading_progress.push({
      label: "reading open response",
      http_status: deliveryResponse.status(),
    });
    const delivery = await boundedReading("reading delivery JSON", () =>
      deliveryResponse.json(),
    );
    const acknowledgement = await boundedReading(
      "reading display acknowledgement headers",
      () => acknowledged,
    );
    assert.equal(acknowledgement.status(), 200);
    report.reading_progress.push({
      label: "reading acknowledgement",
      http_status: acknowledgement.status(),
      url: acknowledgement.url(),
    });
    save();
    assert.equal(
      new URL(acknowledgement.url()).pathname,
      `/api/sessions/${item.session_id}/interventions/${delivery.intervention_id}`,
    );
    await boundedReading("rendered and acknowledged reading", () =>
      long.page.locator("article.reading-article[aria-busy=false]").waitFor(),
    );
    await shot(long.page, "long-response-reading");
    await boundedReading("Browser Back", () => long.page.goBack());
    await boundedReading("exact original session URL", () =>
      long.page.waitForURL(originalSessionURL),
    );
    await long.page.locator(".lp-turns").waitFor();
    await boundedReading("reload original session", () => long.page.reload());
    assert.equal(long.page.url(), originalSessionURL);
    await long.page.locator(".lp-turns").waitFor();
    const after = await boundedReading("read saved session after reading", () =>
      get(long.context, `/api/tutoring/${item.session_id}`),
    );
    assert.equal(
      after.attempts[0].response_text,
      before.attempts[0].response_text,
    );
    assert.equal(after.attempts[0].response_text, item.response_text);
    assert.deepEqual(after.attempts, before.attempts);
    const displayed = after.interventions.find(
      (entry) => entry.id === delivery.intervention_id,
    );
    assert.equal(displayed?.type, "reading");
    assert.equal(displayed.delivery_status, "displayed");
    assert.ok(displayed.visible_at);
    await shot(long.page, "long-response-reload");
    return {
      exact_response_retained: true,
      characters: item.response_text.length,
      original_session_url: originalSessionURL,
      restored_url: long.page.url(),
      displayed_reading_intervention_id: delivery.intervention_id,
      intended_reading_effect: {
        type: displayed.type,
        delivery_status: displayed.delivery_status,
        visible_at: displayed.visible_at,
        exact_attempts_unchanged: true,
      },
      reading_write_scope:
        "Normal application passage opening and displayed-text acknowledgement only; no answer or evaluation replay.",
    };
  });
  await long.context.close();

  const recovery = await login("recovery");
  await check("help-fallback-never-grades", recovery.page, async () => {
    const composer = recovery.page.getByRole("textbox", {
      name: "Message your tutor",
      exact: true,
    });
    await composer.fill("What do you mean by packet size?");
    await recovery.page
      .getByRole("button", { name: "Send", exact: true })
      .click();
    await recovery.page
      .getByRole("button", { name: "I’m asking for help", exact: true })
      .last()
      .click();
    await recovery.page
      .getByText("Conversational help is unavailable for this step.", {
        exact: false,
      })
      .waitFor();
    const view = await get(
      recovery.context,
      `/api/tutoring/${fixture.fixtures.recovery.session_id}`,
    );
    assert.equal(view.attempts[0].response_text, null);
    const dialogue = await get(
      recovery.context,
      `/api/tutoring/${fixture.fixtures.recovery.session_id}/conversation`,
    );
    assert.equal(dialogue.dialogue.state.provider_requests_used, 0);
    return {
      ungraded: true,
      provider_requests: 0,
      classification:
        "Explicit no-provider clarification; no model interpretation claimed.",
    };
  });
  await check(
    "S02-precommit-401-durability-message",
    recovery.page,
    async () => {
      const item = fixture.fixtures.recovery;
      const composer = recovery.page.getByRole("textbox", {
        name: "Message your tutor",
        exact: true,
      });
      const text =
        "  Fictional acceptance original answer.\nThis 401 request must not be described as saved.  ";
      await composer.fill(text);
      const intercepted = [];
      const answerPath = `/api/sessions/${item.session_id}/answers`;
      const waitForRejectedAnswer = () =>
        recovery.page.waitForResponse(
          (response) =>
            new URL(response.url()).origin === origin.origin &&
            new URL(response.url()).pathname === answerPath &&
            response.request().method() === "POST" &&
            response.status() === 401,
        );
      await recovery.page.route(`**${answerPath}`, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        intercepted.push(route.request().postDataJSON());
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Synthetic precommit authentication failure",
          }),
        });
      });
      const rejectedAnswer = waitForRejectedAnswer();
      await recovery.page
        .getByRole("button", { name: "Submit this as my answer", exact: true })
        .click();
      await (await rejectedAnswer).finished();
      const checkSave = recovery.page.getByRole("button", {
        name: "Check answer save",
        exact: true,
      });
      const retryOriginal = recovery.page.getByRole("button", {
        name: "Retry original answer",
        exact: true,
      });
      await checkSave.waitFor();
      await checkSave.click({ trial: true });
      await recovery.page
        .getByText("The server has not confirmed saving your answer.", {
          exact: false,
        })
        .waitFor();
      assert.equal(
        await retryOriginal.isDisabled(),
        true,
        "Retry must remain disabled until the explicit authorized check.",
      );
      assert.equal(await composer.inputValue(), text);
      const view = await get(
        recovery.context,
        `/api/tutoring/${item.session_id}`,
      );
      assert.equal(view.attempts[0].response_text, null);
      assert.equal(intercepted.length, 1);
      assert.equal(intercepted[0].attempt_id, item.attempt_id);
      assert.equal(intercepted[0].response_text, text);
      assert.match(intercepted[0].submission_key, /^[a-f0-9-]{36}$/);
      const body = await recovery.page.locator("body").innerText();
      writeFileSync(join(out, "precommit-401-visible-text.txt"), body);
      await shot(recovery.page, "precommit-401-local-text-preserved");
      assert.ok(
        !body.includes("Your submitted work is saved."),
        "Initial answer POST was intercepted before server commit and response_text remains null, but UI claims submitted work is saved. Owner PR113/#76.",
      );
      assert.ok(
        !body.includes("The server confirmed saving your original answer."),
        "An intercepted precommit request must not show the acknowledged-save message.",
      );
      const checkedSave = recovery.page.waitForResponse(
        (response) =>
          new URL(response.url()).origin === origin.origin &&
          new URL(response.url()).pathname ===
            `/api/tutoring/${item.session_id}` &&
          response.request().method() === "GET" &&
          response.status() === 200,
      );
      await checkSave.click();
      const checkedView = await (await checkedSave).json();
      assert.equal(checkedView.session.id, item.session_id);
      assert.equal(checkedView.attempts.at(-1).id, item.attempt_id);
      assert.equal(checkedView.attempts.at(-1).response_text, null);
      assert.equal(checkedView.attempts.at(-1).submitted_at, null);
      await recovery.page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (button) =>
            button.textContent.trim() === "Retry original answer" &&
            !button.disabled,
        ),
      );
      assert.equal(
        intercepted.length,
        1,
        "Checking save must not resend the answer.",
      );
      const rejectedRetry = waitForRejectedAnswer();
      await retryOriginal.click();
      await (await rejectedRetry).finished();
      await checkSave.click({ trial: true });
      await recovery.page
        .getByText("The server has not confirmed saving your answer.", {
          exact: false,
        })
        .waitFor();
      assert.equal(intercepted.length, 2);
      assert.deepEqual(
        intercepted[1],
        intercepted[0],
        "Explicit retry must preserve exact original text, attempt and submission identity.",
      );
      assert.equal(await composer.inputValue(), text);
      assert.equal(await retryOriginal.isDisabled(), true);
      const afterRetry = await get(
        recovery.context,
        `/api/tutoring/${item.session_id}`,
      );
      assert.equal(afterRetry.attempts.at(-1).id, item.attempt_id);
      assert.equal(afterRetry.attempts.at(-1).response_text, null);
      await shot(recovery.page, "precommit-401-explicit-same-identity-retry");
      return {
        exact_local_text_preserved: true,
        server_response: null,
        automatic_retries: 0,
        explicit_authorized_check: true,
        explicit_retries: 1,
        original_submission_key_preserved: true,
        fault: "Injected browser401 before server; real session expiry unrun",
      };
    },
  );
  await recovery.context.close();
  if (onlyCase)
    assert.deepEqual(
      report.blocked_mutation_attempts,
      [],
      "Reading rerun attempted a mutation outside its explicit display acknowledgements; do not hide it behind route blocking.",
    );
  report.status = report.cases.some((item) => item.status === "fail")
    ? "fail"
    : "pass";
} catch (error) {
  report.status = "aborted";
  report.error = error.message;
} finally {
  report.finished_at = new Date().toISOString();
  save();
  await browser.close();
}
if (report.status !== "pass") process.exitCode = 1;
console.log(
  JSON.stringify(
    {
      status: report.status,
      report: join(out, "report.json"),
      cases: report.cases,
    },
    null,
    2,
  ),
);
