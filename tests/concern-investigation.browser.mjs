/** Provider-disabled browser regression. Run with node --env-file=.env and
 * PLAYWRIGHT_MODULE pointing to an installed Playwright package. Output is ignored
 * under .setup unless CONCERN_ARTIFACT_DIR specifies another directory. Requires
 * the existing fictional class fixture and a running app at AUTH_URL. */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import pg from "pg";
const { Pool } = pg;
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const env = process.env;
if (env.OPENAI_API_KEY)
  throw new Error(
    "This verification requires the model provider to be disabled.",
  );
if (
  !env.AUTH_URL ||
  !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(env.AUTH_URL)
)
  throw new Error("Use a local isolated fictional runtime.");
const root = path.resolve(
  env.CONCERN_ARTIFACT_DIR ?? ".setup/concern-verification",
);
fs.mkdirSync(path.join(root, "captures"), { recursive: true });
(async () => {
  const pool = new Pool({
    host: env.PGHOST,
    port: +env.PGPORT,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
  });
  const snapshot = async () => {
    const out = {};
    for (const table of [
      "sessions",
      "attempts",
      "evaluations",
      "interventions",
      "teacher_intervention_drafts",
    ]) {
      try {
        out[table] = (
          await pool.query(
            `select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) as hash from ${table} t`,
          )
        ).rows[0].hash;
      } catch (e) {
        if (e.code !== "42P01") throw e;
      }
    }
    return out;
  };
  const before = await snapshot();
  const b = await chromium.launch({
    headless: true,
    ...(env.BROWSER_EXECUTABLE
      ? { executablePath: env.BROWSER_EXECUTABLE }
      : { channel: "msedge" }),
  });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  let blocked = [];
  await ctx.route("**/*", async (route) => {
    const r = route.request();
    const url = new URL(r.url());
    if (
      url.origin !== env.AUTH_URL ||
      (!["GET", "HEAD"].includes(r.method()) &&
        !url.pathname.startsWith("/api/auth/"))
    ) {
      blocked.push(r.method() + " " + url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  async function login(context, prefix) {
    const r = await context.request.post(
      env.AUTH_URL + "/api/auth/sign-in/email",
      {
        headers: { Origin: env.AUTH_URL },
        data: {
          email: env[prefix + "_EMAIL"],
          password: env[prefix + "_PASSWORD"],
        },
      },
    );
    assert.equal(r.status(), 200);
  }
  await login(ctx, "DEMO_TEACHER");
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const checks = [];
  const check = (s) => {
    checks.push(s);
    console.log("PASS " + s);
  };
  await p.goto(
    env.AUTH_URL +
      "/teacher/insights?origin=synthetic_fixture&concept=transmission_delay",
  );
  await p.waitForURL(/view=concerns/);
  await p.getByRole("heading", { name: "Reasons to look closer" }).waitFor();
  await p.waitForFunction(
    () =>
      document.querySelector(".tw-section-nav a[aria-current=page]")
        ?.textContent === "Concerns",
  );
  const concern = p.url();
  assert.equal(
    await p.locator(".tw-section-nav a[aria-current=page]").innerText(),
    "Concerns",
  );
  check("concern entry and active section");
  assert.ok((await p.locator(".ci-counts").innerText()).includes("8 / 24"));
  assert.ok((await p.locator(".ci-counts").innerText()).includes("15"));
  check("distinct student and response counts");
  const original = await p
    .locator(".ci-response blockquote")
    .first()
    .innerText();
  const evidenceHref = await p
    .getByRole("link", { name: "Read original response, source and feedback" })
    .first()
    .getAttribute("href");
  await p
    .getByRole("link", { name: "Read original response, source and feedback" })
    .first()
    .click();
  await p.locator(".wb-original-response").waitFor();
  assert.ok(
    (await p.locator(".wb-original-response").innerText()).startsWith(
      original.replace(/…$/, ""),
    ),
  );
  assert.equal(
    new URL(p.url()).searchParams.get("attempt"),
    new URL(evidenceHref, env.AUTH_URL).searchParams.get("attempt"),
  );
  check("exact Evidence response and original words");
  await p.goBack();
  await p.getByRole("heading", { name: "Reasons to look closer" }).waitFor();
  assert.equal(
    new URL(p.url()).searchParams.get("concept"),
    "transmission_delay",
  );
  await p.reload();
  await p.getByRole("heading", { name: "Reasons to look closer" }).waitFor();
  check("Back and reload retain concern");
  await p
    .locator(".ci-history summary")
    .filter({ hasText: "Supporting and contrary" })
    .first()
    .click();
  const support = await p
    .getByRole("link", { name: "Supporting evidence 1", exact: true })
    .first()
    .getAttribute("href");
  assert.ok(new URL(support, env.AUTH_URL).searchParams.get("evaluation"));
  check("supporting exact evaluation links");
  await p
    .getByRole("heading", { name: "Evidence against", level: 2 })
    .scrollIntoViewIfNeeded();
  assert.equal(
    await p
      .locator(".ci-section")
      .filter({
        has: p.getByRole("heading", { name: "Evidence against", level: 2 }),
      })
      .locator(".ci-student")
      .count(),
    2,
  );
  check("counterevidence remains visible");
  await p.goto(concern);
  const prepare = await p
    .getByRole("link", { name: "Prepare an intervention" })
    .getAttribute("href");
  assert.equal(
    new URL(prepare, env.AUTH_URL).searchParams.getAll("seedAttempt").length,
    5,
  );
  await p.getByRole("link", { name: "Prepare an intervention" }).click();
  await p
    .getByRole("link", { name: "Back to investigation", exact: true })
    .waitFor();
  await p
    .getByRole("link", { name: "Back to investigation", exact: true })
    .click();
  await p.getByRole("heading", { name: "Reasons to look closer" }).waitFor();
  check(
    "five accepted response seeds and intervention return without generation",
  );
  await p.goto(concern);
  await p.getByRole("link", { name: "About this idea" }).click();
  await p.getByRole("heading", { name: "By situation", exact: true }).waitFor();
  assert.equal(
    await p.locator(".tw-section-nav a[aria-current=page]").innerText(),
    "By idea",
  );
  check("By idea situation groups and active section");
  const earlier = p
    .locator(".ci-history summary")
    .filter({ hasText: "Earlier responses" })
    .first();
  await earlier.click();
  const history = earlier.locator("..");
  assert.ok((await history.locator("a.ci-session-link").count()) > 0);
  const earlierHref = await history
    .locator("a.ci-session-link")
    .first()
    .getAttribute("href");
  assert.equal(
    new URL(earlierHref, env.AUTH_URL).searchParams.get("returnTo"),
    "insights",
  );
  await earlier.click();
  check("earlier By idea response and session links remain available");
  for (const width of [1440, 1024, 390, 320]) {
    await p.setViewportSize({ width, height: 900 });
    await p.screenshot({
      path: path.join(root, "captures/after-ideas-" + width + ".png"),
    });
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  check("By idea no horizontal overflow at 1440/1024/390/320");
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto(concern);
  await p.locator("select[name=concept]").selectOption("propagation_delay");
  await p.getByRole("button", { name: "Update view", exact: true }).click();
  await p.waitForURL(/concept=propagation_delay/);
  assert.ok(
    !(await p.locator(".ci-list").innerText()).includes("Claims transmission"),
  );
  check("concept filter");
  await p.locator("select[name=origin]").selectOption("live_demo");
  await p.getByRole("button", { name: "Update view", exact: true }).click();
  await p
    .getByRole("heading", { name: "No concerns recorded", exact: true })
    .waitFor();
  assert.equal(await p.locator(".ci-response").count(), 0);
  check("empty live origin contains no invented concerns");
  await p.locator("select[name=concept]").selectOption("");
  await p.getByRole("button", { name: "Update view", exact: true }).click();
  await p
    .getByRole("heading", { name: "No concerns recorded", exact: true })
    .waitFor();
  check("all ideas empty filter valid");
  for (const [hash, target] of [
    ["concepts", "ideas"],
    ["concept-transmission_delay", "ideas"],
    ["patterns", "concerns"],
    ["responses", "evidence"],
  ]) {
    await p.goto(
      env.AUTH_URL +
        "/teacher/insights?origin=synthetic_fixture&concept=transmission_delay#" +
        hash,
    );
    if (target === "evidence") await p.waitForURL(/\/teacher\/evidence/);
    else await p.waitForURL(new RegExp("view=" + target));
    check("legacy #" + hash);
  }
  for (const width of [1440, 1024, 390, 320]) {
    await p.setViewportSize({ width, height: 900 });
    await p.goto(concern);
    await p.getByRole("heading", { name: "Reasons to look closer" }).waitFor();
    await p.screenshot({
      path: path.join(root, "captures/after-concern-" + width + ".png"),
    });
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (width === 1024) {
      await p
        .getByRole("button", { name: "Open Context", exact: true })
        .click();
      await p.locator("dialog:modal").waitFor();
      await p.screenshot({
        path: path.join(root, "captures/after-context-1024.png"),
      });
      await p.keyboard.press("Escape");
      await p.locator("dialog:modal").waitFor({ state: "hidden" });
    }
    if (width <= 390) {
      await p.getByRole("tab", { name: "Context", exact: true }).click();
      await p
        .getByRole("heading", { name: "Approved lesson and source" })
        .waitFor({ state: "visible" });
      await p.getByRole("tab", { name: "Investigation", exact: true }).click();
    }
  }
  check("concern panes usable at 1440/1024/390/320");
  const anon = await b.newContext();
  const anonymous = await anon.request.get(env.AUTH_URL + "/teacher/insights");
  assert.ok(anonymous.url().includes("/login"));
  check("anonymous redirected to login");
  const student = await b.newContext();
  await login(student, "DEMO_STUDENT_ONE");
  const denied = await student.request.get(concern);
  const deniedBody = await denied.text();
  assert.ok(!deniedBody.includes(original));
  assert.ok(deniedBody.includes("404") || denied.status() === 404);
  check("student denied teacher reasoning");
  for (const query of [
    "assignment=11111111-1111-4111-8111-111111111111",
    "concept=not-approved",
    "origin=unknown",
    "misconception=not-approved",
    "view=unknown",
  ]) {
    const r = await ctx.request.get(
      env.AUTH_URL + "/teacher/insights?" + query,
    );
    const text = await r.text();
    assert.ok(!text.includes(original));
    assert.ok(text.includes("404") || r.status() === 404);
  }
  check("invalid or unauthorized scopes do not leak evidence");
  assert.deepEqual(await snapshot(), before);
  check("evidence database unchanged by browser journey");
  const diagnostics = blocked.filter(
    (x) => x === "POST /__nextjs_original-stack-frames",
  );
  assert.deepEqual(
    blocked.filter((x) => !diagnostics.includes(x)),
    [],
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(root, "captures/browser-report.json"),
    JSON.stringify(
      {
        checks,
        errors,
        blocked,
        diagnostics,
        scope:
          "Existing buildClassFixture only; no model key; read-only investigation and handoff",
        before,
        after: await snapshot(),
      },
      null,
      2,
    ),
  );
  await pool.end();
  await b.close();
})();
