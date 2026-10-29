/** Independent N6 rerun: original #113 assertions on the isolated N7 host runtime. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runRecoveryAcceptance } from "../student-blockers/recovery-browser-check.mjs";
import {
  displayPendingFeedback,
  captureCompletedResult,
} from "../student-blockers/result-browser-check.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const base = "http://127.0.0.1:3427";
assert.equal(
  root.replaceAll("\\", "/").toLowerCase(),
  "c:/users/sb128/.codex/worktrees/student-notebook-active/learningplatform",
);
for (const [key, value] of Object.entries({
  PGHOST: "127.0.0.1",
  PGPORT: "5927",
  PGDATABASE: "active_notebook_s1_01a17497",
  AUTH_URL: base,
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
}))
  assert.equal(process.env[key], value, key);
assert.equal(process.env.DATABASE_URL, undefined);
const runtime = JSON.parse(
  readFileSync(path.join(root, ".setup/runtime/manifest.json"), "utf8"),
);
assert.equal(runtime.project, "lp-notebook-s1-01a17497");
assert.equal(runtime.origin, base);
assert.equal(runtime.database, process.env.PGDATABASE);
assert.equal(runtime.modelProvidersDisabled, true);
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
}).trim();
assert.match(sourceSha, /^[a-f0-9]{40}$/);
const production = process.argv.includes("--production");
const recoveryOnly = process.argv.includes("--recovery-only");
const buildId = production
  ? readFileSync(path.join(root, ".next/BUILD_ID"), "utf8").trim()
  : null;
if (production) {
  assert.ok(buildId);
  assert.equal(
    execFileSync(
      "git",
      [
        "diff",
        "HEAD",
        "--",
        "app",
        "lib",
        "content",
        "db",
        "package.json",
        "package-lock.json",
        "next.config.ts",
        "tsconfig.json",
      ],
      { cwd: root, encoding: "utf8", windowsHide: true },
    ).trim(),
    "",
    "Production application files must match HEAD.",
  );
}
const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
const out = path.join(
  root,
  "acceptance/active-notebook/evidence",
  `recovery-${stamp}`,
);
mkdirSync(out, { recursive: true });
const digest = (value) => createHash("sha256").update(value).digest("hex");
function safeDiagnostic(value) {
  if (Array.isArray(value)) return value.map(safeDiagnostic);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, safeDiagnostic(child)]),
    );
  if (typeof value !== "string") return value;
  return value.replace(
    /better-auth\.[^=\s]+=[^\s]+/gi,
    "[redacted session cookie]",
  );
}
function sourceHashes() {
  const files = [];
  function walk(relative) {
    const absolute = path.join(root, relative);
    if (!existsSync(absolute)) return;
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files.push(child.replaceAll("\\", "/"));
    }
  }
  for (const directory of ["app", "lib", "db", "content"]) walk(directory);
  for (const file of [
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "next.config.mjs",
    "tsconfig.json",
  ])
    if (existsSync(path.join(root, file))) files.push(file);
  return Object.fromEntries(
    files
      .sort()
      .map((file) => [file, digest(readFileSync(path.join(root, file)))]),
  );
}
const hashes = sourceHashes();
const originalHashes = {
  "recovery-fixture.mjs":
    "ed8d073b29a5e0376e1c324fadb849898a9e51994b3da8b71924906356e1dba2",
  "result-fixture-step.mjs":
    "63ea19bb9ab4053e12befb669aef3d6a315f9c0d520f9f575d5d6335e1947d36",
  "recovery-browser-check.mjs":
    "2def9ad389cd7a76ed8db73f8813493d90870e1697085aad63e8b68f2d10cd61",
  "result-browser-check.mjs":
    "013af530f6caeb3bc7a49100910f73339e89330348d88a1a2b7ee7b8d671bf0e",
};
for (const [file, hash] of Object.entries(originalHashes))
  assert.equal(
    digest(readFileSync(path.join(root, "acceptance/student-blockers", file))),
    hash,
    file,
  );
const identity = {
  source_sha: sourceSha,
  source_tree_sha256: digest(JSON.stringify(hashes)),
  source_file_sha256: hashes,
  original_pr113_helpers_sha256: originalHashes,
  harness_sha256: Object.fromEntries(
    ["run-recovery.mjs", "operators-host.mjs"].map((file) => [
      file,
      digest(readFileSync(path.join(root, "acceptance/active-notebook", file))),
    ]),
  ),
  runtime: {
    project: runtime.project,
    origin: base,
    database: runtime.database,
    postgres_port: process.env.PGPORT,
    mode: production ? "production" : runtime.mode,
    build_id: buildId,
  },
  source_is_development_candidate: !production,
  original_assertions_unchanged: true,
  scope: recoveryOnly
    ? "Six original recovery cases only; outcome and restart receipts remain separately source-bound"
    : "Four outcome matrices, restart and six original recovery cases",
  synthetic_evaluation_provenance:
    "Existing #113 authored fixture outcomes, real application services/database; no model judgments.",
  providers_disabled: true,
  paid_calls: 0,
  authentication_events: [],
  started_at: new Date().toISOString(),
};
writeFileSync(
  path.join(out, "run-identity.json"),
  JSON.stringify(identity, null, 2),
  { flag: "wx" },
);
console.log(`N6 recovery evidence: ${out}`);
function operator(kind, args) {
  const output = execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--conditions=react-server",
      "acceptance/active-notebook/operators-host.mjs",
      kind,
      ...args,
    ],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        ALLOW_DISPOSABLE_STUDENT_FIXTURES: "1",
        ACCEPTANCE_PROJECT: "lp-accept-notebook-s1",
        ACCEPTANCE_SOURCE_SHA: sourceSha,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return JSON.parse(output);
}
const playwrightPath = process.env.PLAYWRIGHT_MODULE;
assert.ok(playwrightPath);
const { chromium } = await import(
  pathToFileURL(path.join(playwrightPath, "index.mjs")).href
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
async function context() {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  ctx.setDefaultTimeout(20_000);
  await ctx.route("**/*", (route) =>
    new URL(route.request().url()).origin === base
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  return ctx;
}
async function login(page, role) {
  await page.goto(`${base}/login`);
  await page
    .getByRole("textbox", { name: "Demo email", exact: true })
    .fill(
      process.env[
        role === "teacher" ? "DEMO_TEACHER_EMAIL" : "DEMO_STUDENT_TWO_EMAIL"
      ],
    );
  await page
    .getByLabel("Password", { exact: true })
    .fill(
      process.env[
        role === "teacher"
          ? "DEMO_TEACHER_PASSWORD"
          : "DEMO_STUDENT_TWO_PASSWORD"
      ],
    );
  const result = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/auth/sign-in/email",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const response = await result;
  identity.authentication_events.push({
    role,
    status: response.status(),
    at: new Date().toISOString(),
  });
  assert.equal(
    response.status(),
    200,
    `Fixture sign-in returned HTTP ${response.status()}; no recovery assertion has run for this fixture.`,
  );
  await page.waitForURL(role === "teacher" ? /\/teacher/ : /\/study/);
}
async function verifyRestart({
  page,
  studentContext,
  teacherContext,
  fixture,
}) {
  const oldId = fixture.session_id;
  async function get(context, pathname) {
    const response = await context.request.get(`${base}${pathname}`);
    assert.equal(response.status(), 200);
    return response.json();
  }
  const oldBefore = await get(teacherContext, `/api/teacher/sessions/${oldId}`);
  const writes = [];
  const record = (request) => {
    const url = new URL(request.url());
    if (
      url.origin === base &&
      request.method() !== "GET" &&
      url.pathname.startsWith("/api/")
    )
      writes.push({ method: request.method(), path: url.pathname });
  };
  page.on("request", record);
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/api/tutoring/${oldId}/restart`,
    );
    await page
      .getByRole("button", { name: "Start new session", exact: true })
      .click();
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    const restarted = await response.json();
    const newId = restarted.session.id;
    assert.notEqual(newId, oldId);
    await page.waitForURL((url) => url.searchParams.get("session") === newId);
    await page.locator('textarea[id^="tutor-message-"]').waitFor();
    const newView = await get(studentContext, `/api/tutoring/${newId}`);
    assert.equal(newView.session.status, "active");
    assert.equal(newView.progress.phase, "answer");
    assert.equal(newView.attempts.length, 1);
    assert.equal(newView.attempts[0].response_text, null);
    assert.equal(newView.attempts[0].submitted_at, null);
    assert.equal(newView.interventions.length, 0);
    assert.deepEqual(
      await get(teacherContext, `/api/teacher/sessions/${oldId}`),
      oldBefore,
      "Explicit restart preserves all completed originals, evaluations, assistance and version identities",
    );
    assert.deepEqual(writes, [
      { method: "POST", path: `/api/tutoring/${oldId}/restart` },
    ]);
    await page.screenshot({
      path: path.join(out, "restart-new-session.png"),
      fullPage: false,
    });
    const receipt = {
      id: "S1-restart-preserves-completed-evidence",
      status: "PASS",
      old_session_id: oldId,
      new_session_id: newId,
      old_evidence_unchanged: true,
      writes,
      category: "Supplemental S1 assertion; original #113 helpers unchanged",
    };
    writeFileSync(
      path.join(out, "restart-report.json"),
      JSON.stringify(receipt, null, 2),
    );
    return receipt;
  } finally {
    page.off("request", record);
  }
}
let failure;
const outcomes = [];
try {
  const teacherContext = await context();
  await login(await teacherContext.newPage(), "teacher");
  if (!recoveryOnly) {
    const studentContext = await context();
    const page = await studentContext.newPage();
    await login(page, "student");
    for (const kind of [
      "correct",
      "partially_correct",
      "incorrect",
      "uncertain",
    ]) {
      const file = path.join(
        root,
        ".setup/runtime/recovery",
        `result_${kind}_${Date.now()}.json`,
      );
      let current = operator("result", ["init", kind, file]);
      for (let count = 0; count < 5; count++) {
        current = operator("result", ["step", file]);
        if (current.receipt.pending_feedback_ids.length) {
          const pendingIds = new Set(current.receipt.pending_feedback_ids);
          const feedbackPages = new Set(
            current.receipt.student_view.interventions
              .filter((item) => pendingIds.has(item.id))
              .map((item) => item.related_attempt_id),
          );
          assert.equal(
            feedbackPages.size,
            1,
            "This bounded fixture step must expose one feedback page.",
          );
          const displayedFixture = {
            ...current,
            url:
              current.url.split("#")[0] + "#question-" + [...feedbackPages][0],
          };
          await page.goto("about:blank");
          await displayPendingFeedback({
            page,
            studentContext,
            base,
            fixture: displayedFixture,
          });
          current = operator("result", ["inspect", file]);
        }
        if (current.receipt.status === "completed") break;
      }
      writeFileSync(
        path.join(out, `${kind}-fixture.json`),
        JSON.stringify(current, null, 2),
      );
      await page.goto("about:blank");
      await captureCompletedResult({
        page,
        studentContext,
        teacherContext,
        base,
        fixture: current,
        out,
        sourceSha,
      });
      outcomes.push({ kind, status: "PASS" });
      if (kind === "correct")
        outcomes.push(
          await verifyRestart({
            page,
            studentContext,
            teacherContext,
            fixture: current,
          }),
        );
      console.log(
        `${kind}: original result/privacy/refresh assertions at four widths PASS`,
      );
    }
    await studentContext.close();
  }
  const report = await runRecoveryAcceptance({
    base,
    sourceSha,
    out,
    async createCase() {
      const saved = operator("recovery", ["create"]);
      const studentContext = await context();
      const page = await studentContext.newPage();
      await login(page, "student");
      return {
        ...saved,
        page,
        studentContext,
        teacherContext,
        close: () => studentContext.close(),
      };
    },
    async expireAuthentication({ fixture }) {
      const response = await fixture.studentContext.request.get(
        `${base}/api/auth/get-session`,
      );
      assert.equal(response.status(), 200);
      const session = (await response.json()).session;
      assert.ok(session?.id);
      return operator("recovery", ["expire", session.id]);
    },
    async signInAndReturn({ fixture, labels }) {
      const original = fixture.page.url();
      const link = fixture.page
        .getByRole("link", { name: labels.signIn })
        .first();
      assert.equal(await link.getAttribute("target"), "_blank");
      const pending = fixture.studentContext.waitForEvent("page");
      await link.click();
      const popup = await pending;
      await login(popup, "student");
      await popup.close();
      await fixture.page.bringToFront();
      assert.equal(fixture.page.url(), original);
      return {
        original_tab_preserved: true,
        method: "Same fictional Student Two account via real new-tab sign-in",
      };
    },
    async seedAcceptedEvaluation({ fixture }) {
      return operator("recovery", [
        "evaluate",
        fixture.sessionId,
        fixture.attemptId,
      ]);
    },
  });
  outcomes.push(
    ...report.cases.map(({ id, status, error }) => ({ id, status, error })),
  );
  assert.equal(report.result, "PASS");
  await teacherContext.close();
} catch (error) {
  failure = error;
} finally {
  await browser.close();
  const after = sourceHashes();
  identity.source_tree_after_sha256 = digest(JSON.stringify(after));
  identity.source_unchanged =
    identity.source_tree_after_sha256 === identity.source_tree_sha256;
  identity.finished_at = new Date().toISOString();
  identity.outcomes = outcomes;
  if (failure) identity.error = safeDiagnostic(failure.message);
  // Playwright network errors can contain request cookies. Preserve assertion
  // diagnostics without committing even fictional authentication credentials.
  for (const file of readdirSync(out).filter((name) =>
    name.endsWith(".json"),
  )) {
    const target = path.join(out, file);
    writeFileSync(
      target,
      JSON.stringify(
        safeDiagnostic(JSON.parse(readFileSync(target, "utf8"))),
        null,
        2,
      ),
    );
  }
  writeFileSync(
    path.join(out, "run-identity.json"),
    JSON.stringify(identity, null, 2),
  );
  assert.equal(
    identity.source_unchanged,
    true,
    "Application source changed during acceptance; rerun on the final candidate.",
  );
}
if (failure) throw new Error(safeDiagnostic(failure.message));
console.log(
  JSON.stringify(
    {
      result: "PASS",
      outcomes,
      out,
      source_tree_sha256: identity.source_tree_sha256,
    },
    null,
    2,
  ),
);
