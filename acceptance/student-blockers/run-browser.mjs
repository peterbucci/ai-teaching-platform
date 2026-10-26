/** Runs provider-disabled, isolated student acceptance. Operator supplies private setup and browser endpoint. */
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
  displayPendingFeedback,
  captureCompletedResult,
} from "./result-browser-check.mjs";
import { runRecoveryAcceptance } from "./recovery-browser-check.mjs";
const required = (name) => {
  const value = process.env[name];
  assert.ok(value, `${name} required`);
  return value;
};
const base = required("ACCEPTANCE_BASE_URL");
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const setup = required("ACCEPTANCE_SETUP");
const source = required("ACCEPTANCE_SOURCE");
const sha = required("ACCEPTANCE_SOURCE_SHA");
const out = required("ACCEPTANCE_OUT");
assert.match(sha, /^[a-f0-9]{40}$/);
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) throw Error(`${cmd} failed: ${r.stderr}\n${r.stdout}`);
  return r.stdout;
};
assert.equal(run("git", ["-C", source, "rev-parse", "HEAD"]).trim(), sha);
assert.equal(
  run("git", ["-C", source, "status", "--porcelain"]).trim(),
  "",
  "Production source must match pinned HEAD",
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(setup, "manifest.json"), "utf8"),
);
assert.equal(manifest.project, "lp-accept-pr113");
assert.equal(manifest.sourceSha, sha);
assert.equal(manifest.origin, base);
const container = "lp-accept-pr113-app-1";
const config = JSON.parse(run("docker", ["inspect", container]));
const image = config[0].Config.Image;
assert.equal(image, `lp-accept-pr113:${sha}`);
assert.equal(
  config[0].Image,
  JSON.parse(run("docker", ["image", "inspect", image]))[0].Id,
);
const env = Object.fromEntries(
  config[0].Config.Env.map((v) => {
    const i = v.indexOf("=");
    return [v.slice(0, i), v.slice(i + 1)];
  }),
);
assert.equal(env.AUTH_URL, base);
assert.equal(env.OPENAI_API_KEY?.trim() || "", "");
assert.equal(env.OPENAI_MODEL?.trim() || "", "");
const networks = Object.keys(config[0].NetworkSettings.Networks);
assert.deepEqual(networks, ["lp-accept-pr113_acceptance"]);
assert.equal(
  JSON.parse(run("docker", ["network", "inspect", networks[0]]))[0].Internal,
  true,
);
const here = path.dirname(fileURLToPath(import.meta.url));
assert.equal(
  path.resolve(here).toLowerCase(),
  path.resolve(source, "acceptance/student-blockers").toLowerCase(),
);
const verificationHashes = Object.fromEntries(
  fs
    .readdirSync(here)
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => [
      name,
      createHash("sha256")
        .update(fs.readFileSync(path.join(here, name)))
        .digest("hex"),
    ]),
);
for (const name of ["recovery-fixture.mjs", "result-fixture-step.mjs"])
  run("docker", ["cp", path.join(here, name), `${container}:/tmp/${name}`]);
const fixture = (script, args) =>
  JSON.parse(
    run("docker", [
      "exec",
      "-w",
      "/app",
      "-e",
      "ALLOW_DISPOSABLE_STUDENT_FIXTURES=1",
      "-e",
      "ACCEPTANCE_PROJECT=lp-accept-pr113",
      "-e",
      `ACCEPTANCE_SOURCE_SHA=${sha}`,
      container,
      "node",
      "--experimental-strip-types",
      "--conditions=react-server",
      `/tmp/${script}`,
      ...args,
    ]),
  );
const secrets = Object.fromEntries(
  fs
    .readFileSync(path.join(setup, ".env.acceptance"), "utf8")
    .split(/\r?\n/)
    .filter((x) => /^[A-Z_]+=/.test(x))
    .map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i), x.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    }),
);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, "run-identity.json"),
  JSON.stringify(
    {
      source_sha: sha,
      verification_hashes: verificationHashes,
      image,
      image_id: config[0].Image,
      project: manifest.project,
      base,
      providers_disabled: true,
      network_internal: true,
      started_at: new Date().toISOString(),
    },
    null,
    2,
  ),
  { flag: "wx" },
);
const { chromium } = await import(
  pathToFileURL(required("ACCEPTANCE_PLAYWRIGHT")).href
);
const browser = await chromium.connect(
  fs.readFileSync(required("ACCEPTANCE_WS_FILE"), "utf8").trim(),
);
async function login(page, role) {
  await page.goto(`${base}/login`);
  await page
    .getByRole("textbox", { name: "Demo email", exact: true })
    .fill(
      secrets[
        role === "teacher" ? "DEMO_TEACHER_EMAIL" : "DEMO_STUDENT_TWO_EMAIL"
      ],
    );
  await page
    .getByLabel("Password", { exact: true })
    .fill(
      secrets[
        role === "teacher"
          ? "DEMO_TEACHER_PASSWORD"
          : "DEMO_STUDENT_TWO_PASSWORD"
      ],
    );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(role === "teacher" ? /\/teacher/ : /\/study/);
}
try {
  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await login(teacherPage, "teacher");
  const mode = process.env.ACCEPTANCE_MATRIX || "all";
  if (mode === "all" || mode === "results") {
    const studentContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await studentContext.newPage();
    await login(page, "student");
    for (const kind of [
      "correct",
      "partially_correct",
      "incorrect",
      "uncertain",
    ]) {
      const file = `/tmp/result_${kind}_${Date.now()}.json`;
      let current = fixture("result-fixture-step.mjs", ["init", kind, file]);
      for (let count = 0; count < 5; count++) {
        current = fixture("result-fixture-step.mjs", ["step", file]);
        if (current.receipt.pending_feedback_ids.length) {
          await displayPendingFeedback({
            page,
            studentContext,
            base,
            fixture: current,
          });
          current = fixture("result-fixture-step.mjs", ["inspect", file]);
        }
        if (current.receipt.status === "completed") break;
      }
      fs.writeFileSync(
        path.join(out, `${kind}-fixture.json`),
        JSON.stringify(current, null, 2),
      );
      await captureCompletedResult({
        page,
        studentContext,
        teacherContext,
        base,
        fixture: current,
        out,
        sourceSha: sha,
      });
      console.log(`${kind} result and all four widths PASS`);
    }
    await studentContext.close();
  }
  if (mode === "all" || mode === "recovery") {
    const report = await runRecoveryAcceptance({
      base,
      sourceSha: sha,
      out,
      async createCase() {
        const saved = fixture("recovery-fixture.mjs", ["create"]);
        const studentContext = await browser.newContext({
          viewport: { width: 1440, height: 900 },
        });
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
      async expireAuthentication({ fixture: caseFixture }) {
        const response = await caseFixture.studentContext.request.get(
          `${base}/api/auth/get-session`,
        );
        assert.equal(response.status(), 200);
        const session = (await response.json()).session;
        assert.ok(session?.id);
        return fixture("recovery-fixture.mjs", ["expire", session.id]);
      },
      async signInAndReturn({ fixture: caseFixture, labels }) {
        const original = caseFixture.page.url();
        const link = caseFixture.page
          .getByRole("link", { name: labels.signIn })
          .first();
        assert.equal(await link.getAttribute("target"), "_blank");
        const pending = caseFixture.studentContext.waitForEvent("page");
        await link.click();
        const popup = await pending;
        await login(popup, "student");
        await popup.close();
        await caseFixture.page.bringToFront();
        assert.equal(caseFixture.page.url(), original);
        return {
          original_tab_preserved: true,
          method: "Same fictional Student Two account via real new-tab sign-in",
        };
      },
      async seedAcceptedEvaluation({ fixture: caseFixture }) {
        return fixture("recovery-fixture.mjs", [
          "evaluate",
          caseFixture.sessionId,
          caseFixture.attemptId,
        ]);
      },
    });
    console.log(
      JSON.stringify(
        {
          result: report.result,
          cases: report.cases.map(({ id, status, error }) => ({
            id,
            status,
            error,
          })),
        },
        null,
        2,
      ),
    );
    assert.equal(report.result, "PASS");
  }
  await teacherContext.close();
} finally {
  await browser.close();
}
