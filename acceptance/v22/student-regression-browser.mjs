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
const readJson = (file) =>
  JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const manifest = readJson(join(state, "manifest.json"));
const fixture = readJson(resolve(fixtureArg));
const origin = new URL(manifest.origin);
assert.match(manifest.project, /^lp-v22-(integration5|shell5)$/);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
assert.ok([3349, 3350].includes(Number(origin.port)));
assert.equal(manifest.paidModelCallsAuthorized, false);
assert.equal(fixture.project, manifest.project);
assert.equal(fixture.source_sha, manifest.sourceSha);
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
  screenshots: [],
  category:
    "real provider-disabled browser with explicitly synthetic accepted evaluation; no model-quality claim",
  actual_model_calls: 0,
  blocked_off_origin_requests: [],
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
async function check(id, page, fn) {
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
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
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
    const before = await get(long.context, `/api/tutoring/${item.session_id}`);
    const readingLink = long.page.getByRole("link", {
      name: "Open reading",
      exact: true,
    });
    await readingLink.click();
    await long.page
      .locator("article.reading-article[aria-busy=false]")
      .waitFor();
    await shot(long.page, "long-response-reading");
    await long.page.goBack();
    await long.page.locator(".lp-turns").waitFor();
    await long.page.reload();
    await long.page.locator(".lp-turns").waitFor();
    const after = await get(long.context, `/api/tutoring/${item.session_id}`);
    assert.equal(
      after.attempts[0].response_text,
      before.attempts[0].response_text,
    );
    assert.equal(after.attempts[0].response_text, item.response_text);
    await shot(long.page, "long-response-reload");
    return {
      exact_response_retained: true,
      characters: item.response_text.length,
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
      let intercepted = 0;
      await recovery.page.route(
        `**/api/sessions/${item.session_id}/answers`,
        async (route) => {
          intercepted++;
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Synthetic precommit authentication failure",
            }),
          });
        },
      );
      await recovery.page
        .getByRole("button", { name: "Submit this as my answer", exact: true })
        .click();
      await recovery.page
        .getByRole("button", {
          name: "Retry sending saved answer",
          exact: false,
        })
        .waitFor();
      assert.equal(await composer.inputValue(), text);
      const view = await get(
        recovery.context,
        `/api/tutoring/${item.session_id}`,
      );
      assert.equal(view.attempts[0].response_text, null);
      assert.equal(intercepted, 1);
      const body = await recovery.page.locator("body").innerText();
      writeFileSync(join(out, "precommit-401-visible-text.txt"), body);
      await shot(recovery.page, "precommit-401-local-text-preserved");
      assert.ok(
        !body.includes("Your submitted work is saved."),
        "Initial answer POST was intercepted before server commit and response_text remains null, but UI claims submitted work is saved. Owner PR113/#76.",
      );
      return {
        exact_local_text_preserved: true,
        server_response: null,
        automatic_retries: 0,
        fault: "Injected browser401 before server; real session expiry unrun",
      };
    },
  );
  await recovery.context.close();
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
