import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { getPool } from "../../lib/db.ts";
import { DEMO_IDS } from "../../lib/evidence/demo.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
} from "../../lib/evidence/store.ts";
import {
  loadApprovedContent,
  getCuratedQuestion,
} from "../../lib/evidence/content.ts";
assert.equal(process.env.PGDATABASE, "active_notebook_s1_01a17497");
assert.equal(process.env.AUTH_URL, "http://127.0.0.1:3427");
assert.equal(process.env.OPENAI_API_KEY, "");
assert.equal(process.env.OPENAI_MODEL, "");
const base = process.env.AUTH_URL,
  pool = getPool(),
  root = process.cwd();
const require = createRequire(import.meta.url),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const out = path.join(
  root,
  "acceptance/active-notebook/evidence",
  `baseline-${Date.now()}`,
);
fs.mkdirSync(out, { recursive: true });
const source = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  windowsHide: true,
}).trim();
const profile = (
  await pool.query("SELECT id,auth_user_id FROM profiles WHERE id=$1", [
    DEMO_IDS.studentOne,
  ])
).rows[0];
const actor = evidenceAccess({
  profileId: profile.id,
  userId: profile.auth_user_id,
});
const session = await startSession(actor, DEMO_IDS.assignmentId, "live_demo");
const content = loadApprovedContent();
const attempt = await presentQuestion(actor, session.id, {
  question: getCuratedQuestion(content, content.sequence.initial_question_id),
  intent: "initial_retrieval",
});
const route = `/study/assignments/${DEMO_IDS.assignmentId}?tab=study&session=${session.id}`;
fs.writeFileSync(
  ".setup/runtime/baseline.json",
  JSON.stringify(
    {
      source,
      session: session.id,
      attempt: attempt.id,
      route,
      url: base + route,
      out,
    },
    null,
    2,
  ),
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.READER_BROWSER_PATH,
});
const context = await browser.newContext();
await context.route("**/*", (r) =>
  new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
);
const login = await context.request.post(base + "/api/auth/sign-in/email", {
  headers: { Origin: base },
  data: {
    email: process.env.DEMO_STUDENT_ONE_EMAIL,
    password: process.env.DEMO_STUDENT_ONE_PASSWORD,
  },
});
assert.equal(login.status(), 200);
const page = await context.newPage(),
  shots = [];
try {
  for (const [width, height] of [
    [1440, 1000],
    [1024, 768],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(base + route);
    await page.locator(".lp-turns").waitFor();
    await page
      .getByRole("textbox", { name: "Message your tutor", exact: true })
      .waitFor();
    await page.screenshot({
      path: path.join(out, `application-first-${width}x${height}.png`),
      fullPage: true,
    });
    shots.push({
      width,
      height,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    });
  }
  const result = {
    source,
    base,
    route,
    out,
    shots,
    providersDisabled: true,
    paidCalls: 0,
  };
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await pool.end();
}
