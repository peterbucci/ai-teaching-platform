import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { resolveActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { evidenceAccess } from "../lib/evidence/store.ts";
import {
  InterventionDraftSchema,
  InterventionGenerationResponseSchema,
} from "../lib/interventions/drafts.ts";
import { readAssignmentEvidence } from "../lib/teacher/store.ts";

// Authenticate fictional accounts against an already-running local application.
// All generation POSTs below are deliberately invalid. No model is called.
const base = process.env.CHECK_BASE_URL ?? process.env.AUTH_URL;
assert.ok(
  base,
  "Configure CHECK_BASE_URL or AUTH_URL for the running application.",
);
const origin = new URL(base).origin;
const reportPath = resolve(
  process.env.CHECK_INTERVENTION_REPORT ??
    "evals/results/intervention-draft-live.json",
);
const saved = z
  .object({
    request: z.object({
      request_id: z.uuid(),
      draft_id: z.uuid(),
      selection: z.object({ assignment_id: z.uuid() }),
    }),
  })
  .parse(JSON.parse(await readFile(reportPath, "utf8")));
assert.equal(
  saved.request.selection.assignment_id,
  DEMO_IDS.assignmentId,
  "This check only uses the fictional demo assignment.",
);
const api = "/api/teacher/interventions";
const assignment = saved.request.selection.assignment_id;
const draftPath = `${api}?${new URLSearchParams({ assignment, draft: saved.request.draft_id })}`;
const requestPath = `${api}?${new URLSearchParams({ assignment, request: saved.request.request_id })}`;
const cookies: string[] = [];
const checks: string[] = [];

async function request(
  path: string,
  cookie = "",
  options: { body?: unknown; rawBody?: string; requestOrigin?: string } = {},
) {
  const body =
    options.rawBody ??
    (options.body === undefined ? undefined : JSON.stringify(options.body));
  return fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            Origin: options.requestOrigin ?? origin,
          }),
    },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
}

async function login(prefix: string, profileId: string) {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  assert.ok(email && password, `Configure the fictional ${prefix} account.`);
  const response = await request("/api/auth/sign-in/email", "", {
    body: { email, password },
  });
  assert.notEqual(
    response.status,
    429,
    "Authentication cooldown is active. No model call was made; wait before retrying this check.",
  );
  assert.equal(
    response.status,
    200,
    `${prefix} login failed; no credentials are included in this report.`,
  );
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert.ok(cookie, "Successful fictional login must return a session cookie.");
  cookies.push(cookie);
  const actor = await resolveActor(new Headers({ Cookie: cookie }));
  assert.equal(
    actor.profileId,
    profileId,
    "The account must match the intended fictional fixture profile.",
  );
  return { cookie, access: evidenceAccess(actor) };
}

async function generationRows() {
  const result = await getPool().query(
    "SELECT (SELECT count(*)::int FROM teacher_intervention_requests) AS requests, (SELECT count(*)::int FROM teacher_intervention_drafts) AS drafts",
  );
  return z
    .object({ requests: z.number(), drafts: z.number() })
    .parse(result.rows[0]);
}

try {
  const teacher = await login("DEMO_TEACHER", DEMO_IDS.teacher);
  const student = await login("DEMO_STUDENT_ONE", DEMO_IDS.studentOne);
  const original = await readAssignmentEvidence(
    teacher.access,
    assignment,
    "all",
  );
  const countsBefore = await generationRows();
  for (const path of [draftPath, requestPath]) {
    const anonymous = await request(path);
    assert.equal(anonymous.status, 401);
    const denied = await request(path, student.cookie);
    assert.equal(denied.status, 404);
    assert.deepEqual(Object.keys(await denied.json()), ["error"]);
  }
  checks.push(
    "anonymous access returns 401; fictional student cannot read teacher draft or generation request (404)",
  );

  const draftResponse = await request(draftPath, teacher.cookie);
  assert.equal(draftResponse.status, 200);
  assert.equal(draftResponse.headers.get("cache-control"), "no-store");
  const draftPayload = z
    .object({
      drafts: z.array(InterventionDraftSchema),
      draft: InterventionDraftSchema,
    })
    .parse(await draftResponse.json());
  assert.equal(draftPayload.draft.id, saved.request.draft_id);
  assert.equal(draftPayload.draft.status, "private_draft");
  assert.ok(
    draftPayload.drafts.some((draft) => draft.id === saved.request.draft_id),
  );
  const generationResponse = await request(requestPath, teacher.cookie);
  assert.equal(generationResponse.status, 200);
  const generation = InterventionGenerationResponseSchema.parse(
    await generationResponse.json(),
  );
  assert.equal(generation.status, "completed");
  assert.equal(generation.request_id, saved.request.request_id);
  assert.equal(generation.draft?.id, saved.request.draft_id);
  checks.push(
    "authenticated teacher retrieves saved private draft and immutable completed request via no-store API",
  );

  const pagePath = `/teacher/interventions?${new URLSearchParams({ assignment, origin: "synthetic_fixture", draft: saved.request.draft_id })}`;
  const page = await request(pagePath, teacher.cookie);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<h1\b[^>]*>Interventions<\/h1>/);
  for (const marker of [
    "Private draft",
    "Evidence used",
    "Write and save draft",
    "Choose recipients",
    "Approve saved revision",
    "Deliver activity",
    "Read follow-up",
    "Student preview",
    "Teacher-only review",
    "Check your understanding",
    "Source references",
  ])
    assert.ok(html.includes(marker), `Saved review page is missing ${marker}.`);
  for (const [pane, label] of [
    ["navigation", "Evidence"],
    ["main", "Activity"],
    ["context", "Steps"],
  ])
    assert.match(
      html,
      new RegExp(`id="[^"]+-${pane}-heading"[^>]*>${label}</h2>`),
      `Saved review page must include the shared ${label} pane.`,
    );
  assert.ok(html.includes(saved.request.draft_id));
  const deniedPage = await request(pagePath, student.cookie);
  // Next can stream the authorized not-found boundary after a 200 response starts.
  assert.ok([200, 404].includes(deniedPage.status));
  const deniedHtml = await deniedPage.text();
  assert.ok(deniedHtml.includes("This evidence isn’t available"));
  assert.ok(
    !deniedHtml.includes(
      draftPayload.draft.activity.fresh_check.rubric.answer_guidance,
    ),
    "Student page must not include the saved private answer guidance.",
  );
  assert.ok(!deniedHtml.includes("Private answer guidance"));
  checks.push(
    "saved teacher workspace renders shared Evidence/Activity/Steps, private-draft status, separate lifecycle actions, student preview and teacher-review controls; student page denies private evidence",
  );

  const crossOrigin = await request(api, teacher.cookie, {
    body: {},
    requestOrigin: "https://outside.example.invalid",
  });
  assert.equal(crossOrigin.status, 403);
  const oversized = await request(api, teacher.cookie, {
    rawBody: JSON.stringify({ oversized: "x".repeat(17_000) }),
  });
  assert.equal(oversized.status, 400);
  const invalid = await request(api, teacher.cookie, { body: {} });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await generationRows(), countsBefore);
  assert.deepEqual(
    await readAssignmentEvidence(teacher.access, assignment, "all"),
    original,
  );
  checks.push(
    "cross-origin POST returns 403; oversized and malformed generation requests return 400 before any reservation or model call; original evidence preserved",
  );

  const report = {
    issue: 44,
    verification:
      "authenticated HTTP and server-rendered saved review page; not a visual browser interaction test",
    checked_at: new Date().toISOString(),
    origin,
    draft_id: saved.request.draft_id,
    saved_revision: draftPayload.draft.revision,
    status: "passed",
    paid_requests: 0,
    checks,
  };
  await writeFile(
    resolve(
      process.env.CHECK_INTERVENTION_HTTP_REPORT ??
        "evals/results/intervention-http.json",
    ),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
} finally {
  try {
    for (const cookie of cookies) {
      const response = await request("/api/auth/sign-out", cookie, {
        body: {},
      });
      assert.equal(
        response.status,
        200,
        "A fictional check login could not be signed out.",
      );
    }
  } finally {
    await getPool().end();
  }
}
