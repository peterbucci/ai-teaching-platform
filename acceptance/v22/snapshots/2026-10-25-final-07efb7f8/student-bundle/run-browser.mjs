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
assert.equal(sha, "07efb7f821339538800f150f57b298eb2e606be3");
assert.equal(base, "http://localhost:3396");
assert.equal(required("ACCEPTANCE_GUARDED_MATRIX"), "1");
const studentFixture = JSON.parse(fs.readFileSync(required("ACCEPTANCE_STUDENT_FIXTURE"), "utf8"));
assert.equal(studentFixture.project, "lp-v22-final-01a173d6");
assert.equal(studentFixture.source_sha, sha);
assert.equal(studentFixture.source_tree, "948b9a6005a056c97f10d181c589b5352d6221f3");
assert.equal(studentFixture.actual_model_calls, 0);
const studentProfileId = studentFixture.fixtures.recovery.student_id;
const studentEmail = studentFixture.fixtures.recovery.email;
assert.match(studentEmail, /^acceptance-regression-[a-f0-9-]+@example\.invalid$/);
const safetyPath = required("ACCEPTANCE_SAFETY");
assert.equal(createHash("sha256").update(fs.readFileSync(safetyPath)).digest("hex"), "af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485");
const { preflight, MIN_RUNTIME_GIB } = await import(pathToFileURL(safetyPath).href);
let commandSequence = 0;
function guardCommand() {
  const observation = preflight({
    source, state: setup, minimumGiB: MIN_RUNTIME_GIB,
    explicitPath: process.env.ACCEPTANCE_DOCKER_DATA_PATH,
    probeContainer: process.env.ACCEPTANCE_STORAGE_PROBE,
  });
  fs.writeFileSync(path.join(out, `storage-${++commandSequence}.json`), JSON.stringify(observation, null, 2), { flag: "wx" });
  assert.equal(observation.pass, true, "Reviewed runtime storage gate must pass before every Docker operation");
}
assert.match(sha, /^[a-f0-9]{40}$/);
const run = (cmd, args) => {
  if (cmd === "docker") guardCommand();
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
assert.equal(manifest.project, "lp-v22-final-01a173d6");
assert.equal(manifest.sourceSha, sha);
assert.equal(manifest.sourceTree, "948b9a6005a056c97f10d181c589b5352d6221f3");
assert.equal(manifest.origin, base);
const container = "lp-v22-final-01a173d6-app-1";
const config = JSON.parse(run("docker", ["inspect", container]));
const image = config[0].Config.Image;
assert.equal(image, `lp-v22-final-01a173d6:${sha}`);
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
assert.deepEqual(networks, ["lp-v22-final-01a173d6_acceptance"]);
assert.equal(
  JSON.parse(run("docker", ["network", "inspect", networks[0]]))[0].Internal,
  true,
);
const here = path.dirname(fileURLToPath(import.meta.url));
assert.notEqual(path.resolve(here).toLowerCase(), path.resolve(source).toLowerCase());
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
      "ACCEPTANCE_PROJECT=lp-v22-final-01a173d6",
      "-e",
      `ACCEPTANCE_SOURCE_SHA=${sha}`,
      "-e",
      `ACCEPTANCE_STUDENT_PROFILE_ID=${studentProfileId}`,
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
      source_tree: manifest.sourceTree,
      student_profile_id: studentProfileId,
      fixture_sha256: createHash("sha256").update(fs.readFileSync(required("ACCEPTANCE_STUDENT_FIXTURE"))).digest("hex"),
      auth_expiry: "UNRUN: saved timestamp alteration prohibited; no expire hook supplied",
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
const browser = await chromium.launch({
  headless: true,
  executablePath: required("BROWSER_EXECUTABLE"),
});
async function login(page, role) {
  await page.goto(`${base}/login`);
  await page
    .getByRole("textbox", { name: "Demo email", exact: true })
    .fill(
      role === "teacher" ? secrets.DEMO_TEACHER_EMAIL : studentEmail,
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
      viewport: { width: 1440, height: 1000 },
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
          viewport: { width: 1440, height: 1000 },
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
      // R5 is explicitly UNRUN: this assignment prohibits saved timestamp edits.
      // All existing R1/R2/R3/R4/R6 assertions remain unchanged.
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
