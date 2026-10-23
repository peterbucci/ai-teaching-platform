import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { z } from "zod";
import { getPool } from "../lib/db.ts";
import { resolveActor } from "../lib/auth.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { evidenceAccess } from "../lib/evidence/store.ts";
import {
  assignmentReview,
  approveAssignment,
} from "../lib/assignments/store.ts";
import { readAssignmentEvidence } from "../lib/teacher/store.ts";
import {
  InterventionDraftSchema,
  type InterventionDraft,
} from "../lib/interventions/drafts.ts";
import {
  InterventionReviewSchema,
  StudentInterventionSchema,
  type InterventionAction,
} from "../lib/interventions/approval-contracts.ts";

// Local synthetic regression. --setup-fixtures creates its own injected drafts.
// No path invokes a live provider, and only fictional actors receive credentials.
const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every((arg) => arg === "--setup-fixtures"));
function setupFixture(script: string, idField: "draft_id" | "saved_draft_id") {
  const output = execFileSync(
    process.execPath,
    ["--experimental-strip-types", "--conditions=react-server", script],
    {
      env: { ...process.env, OPENAI_API_KEY: "", OPENAI_MODEL: "" },
      encoding: "utf8",
      maxBuffer: 4_000_000,
      timeout: 120_000,
    },
  );
  const line = output.trim().split(/\r?\n/).at(-1)!;
  const report = z
    .object({ status: z.literal("passed") })
    .catchall(z.unknown())
    .parse(JSON.parse(line));
  return z.uuid().parse(report[idField]);
}
const uploadedId = args.length
  ? setupFixture("scripts/check-intervention-lessons.ts", "draft_id")
  : z.uuid().parse(process.env.CHECK_UPLOADED_INTERVENTION_DRAFT);
const curatedId = args.length
  ? setupFixture("scripts/check-interventions.ts", "saved_draft_id")
  : z.uuid().parse(process.env.CHECK_CURATED_INTERVENTION_DRAFT);
const base = new URL(process.env.CHECK_BASE_URL ?? process.env.AUTH_URL!);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname));
const db = getPool();
const cookies: string[] = [];
const checks: string[] = [];
const completed: {
  kind: string;
  draft_id: string;
  approval_id: string;
  assignment_id: string;
}[] = [];
const ownerSchema = z.object({
  teacher_id: z.uuid(),
  class_id: z.uuid(),
  snapshot: InterventionDraftSchema,
});
async function request(path: string, cookie = "", body?: unknown) {
  return fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined
        ? {}
        : { Origin: base.origin, "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
}
async function login(profileId: string, demoPrefix?: string) {
  const found = await db.query(
    "SELECT u.id,u.email FROM profiles p JOIN auth_user u ON u.id=p.auth_user_id WHERE p.id=$1",
    [profileId],
  );
  const user = z
    .object({ id: z.string(), email: z.email() })
    .parse(found.rows[0]);
  let password: string;
  if (demoPrefix) {
    assert.equal(user.email, process.env[`${demoPrefix}_EMAIL`]);
    password = z.string().min(12).parse(process.env[`${demoPrefix}_PASSWORD`]);
  } else {
    assert.ok(
      user.id.startsWith("intervention-lesson-") &&
        user.email.endsWith("@example.invalid"),
      "Only the synthetic fixture actors may receive test credentials.",
    );
    password = createHmac(
      "sha256",
      z.string().min(32).parse(process.env.AUTH_SECRET),
    )
      .update(user.id)
      .digest("hex");
    const prior = await db.query(
      'SELECT password FROM auth_account WHERE "userId"=$1 AND "providerId"=\'credential\'',
      [user.id],
    );
    if (prior.rows.length)
      assert.ok(
        await verifyPassword({
          password,
          hash: z.string().parse(prior.rows[0].password),
        }),
      );
    else
      await db.query(
        'INSERT INTO auth_account(id,"accountId","providerId","userId",password) VALUES($1,$2,\'credential\',$2,$3)',
        [randomUUID(), user.id, await hashPassword(password)],
      );
  }
  const response = await request("/api/auth/sign-in/email", "", {
    email: user.email,
    password,
  });
  assert.equal(
    response.status,
    200,
    "Fictional sign-in failed; no credentials are logged.",
  );
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert.ok(cookie);
  cookies.push(cookie);
  const actor = await resolveActor(new Headers({ Cookie: cookie }));
  assert.equal(actor.profileId, profileId);
  return { cookie, access: evidenceAccess(actor) };
}
async function clone(
  source: InterventionDraft,
  teacherId: string,
  mutate?: (draft: InterventionDraft) => void,
) {
  const now = new Date().toISOString();
  const draft = structuredClone(source);
  Object.assign(draft, {
    id: randomUUID(),
    revision: 1,
    status: "private_draft",
    created_at: now,
    updated_at: now,
  });
  mutate?.(draft);
  InterventionDraftSchema.parse(draft);
  await db.query(
    "INSERT INTO teacher_intervention_drafts(id,teacher_id,assignment_id,revision,snapshot) VALUES($1,$2,$3,1,$4)",
    [draft.id, teacherId, draft.assignment_id, draft],
  );
  return draft;
}
async function action(
  draftId: string,
  cookie: string,
  input: InterventionAction,
  status = 200,
) {
  const response = await request(
    `/api/teacher/interventions/${draftId}`,
    cookie,
    input,
  );
  assert.equal(
    response.status,
    status,
    `Unexpected ${input.action} result: ${await response.clone().text()}`,
  );
  return status === 200
    ? InterventionReviewSchema.parse(await response.json())
    : null;
}
try {
  const beforeRequests = (
    await db.query(
      "SELECT count(*)::int AS count FROM teacher_intervention_requests",
    )
  ).rows;
  const outsider = await login(DEMO_IDS.studentTwo, "DEMO_STUDENT_TWO");
  for (const [kind, id] of [
    ["uploaded", uploadedId],
    ["curated", curatedId],
  ] as const) {
    const found = await db.query(
      "SELECT d.teacher_id,a.class_id,d.snapshot FROM teacher_intervention_drafts d JOIN assignments a ON a.id=d.assignment_id WHERE d.id=$1",
      [id],
    );
    const source = ownerSchema.parse(found.rows[0]);
    assert.ok(
      source.snapshot.provenance.model.includes("synthetic") ||
        source.snapshot.provenance.model.includes("injected"),
    );
    const teacher = await login(
      source.teacher_id,
      kind === "curated" ? "DEMO_TEACHER" : undefined,
    );
    const studentId =
      kind === "curated"
        ? DEMO_IDS.studentOne
        : source.snapshot.evidence.observations[0].student_id;
    const student = await login(
      studentId,
      kind === "curated" ? "DEMO_STUDENT_ONE" : undefined,
    );
    const approval = await assignmentReview(
      teacher.access,
      source.snapshot.assignment_id,
    );
    if (!approval.teacher_approved_at)
      await approveAssignment(
        teacher.access,
        source.snapshot.assignment_id,
        approval.review_token,
      );
    const originalEvidence = await readAssignmentEvidence(
      teacher.access,
      source.snapshot.assignment_id,
      "all",
    );
    const draft = await clone(
      source.snapshot,
      source.teacher_id,
      kind === "curated"
        ? (saved) => {
            saved.provenance.prompt_template_version =
              "teacher-intervention-v2";
            for (const passage of saved.evidence.sources)
              passage.text = passage.text.trim();
          }
        : undefined,
    );
    const path = `/api/teacher/interventions/${draft.id}`;
    assert.equal((await request(path)).status, 401);
    assert.equal((await request(path, outsider.cookie)).status, 404);
    assert.equal((await request(path, student.cookie)).status, 404);
    const edited = structuredClone(draft.activity);
    edited.title = `Synthetic ${kind} teacher-reviewed activity`;
    edited.fresh_check.rubric.partial_credit_guidance =
      "Private teacher guidance remains private.";
    const save: InterventionAction = {
      action: "save",
      request_id: randomUUID(),
      expected_revision: 1,
      activity: edited,
    };
    const saved = (await action(draft.id, teacher.cookie, save))!;
    assert.equal(saved.draft.revision, 2);
    assert.deepEqual(saved.draft.evidence, draft.evidence);
    assert.deepEqual(saved.draft.provenance, draft.provenance);
    assert.deepEqual(await action(draft.id, teacher.cookie, save), saved);
    await action(
      draft.id,
      teacher.cookie,
      { ...save, request_id: randomUUID() },
      409,
    );
    const invalid = structuredClone(edited);
    invalid.fresh_check.content_ref.content_version = "unapproved-version";
    await action(
      draft.id,
      teacher.cookie,
      {
        ...save,
        request_id: randomUUID(),
        expected_revision: 2,
        activity: invalid,
      },
      400,
    );
    invalid.fresh_check.content_ref = edited.fresh_check.content_ref;
    invalid.fresh_check.source_passage_ids = ["unapproved-passage"];
    await action(
      draft.id,
      teacher.cookie,
      {
        ...save,
        request_id: randomUUID(),
        expected_revision: 2,
        activity: invalid,
      },
      400,
    );
    await action(
      draft.id,
      teacher.cookie,
      {
        action: "approve",
        request_id: randomUUID(),
        expected_revision: 2,
        recipient_ids: [randomUUID()],
      },
      409,
    );
    await action(
      draft.id,
      teacher.cookie,
      {
        action: "deliver",
        request_id: randomUUID(),
        expected_revision: 2,
        approval_id: randomUUID(),
      },
      409,
    );
    const approve: InterventionAction = {
      action: "approve",
      request_id: randomUUID(),
      expected_revision: 2,
      recipient_ids: [studentId],
    };
    const approved = (await action(draft.id, teacher.cookie, approve))!;
    assert.ok(approved.approval);
    assert.equal(approved.delivery, null);
    assert.deepEqual(approved.approval.evidence, draft.evidence);
    assert.equal(approved.approval.approved_revision, 2);
    assert.deepEqual(await action(draft.id, teacher.cookie, approve), approved);
    const studentPath = `/api/student/interventions/${approved.approval.id}`;
    assert.equal((await request(studentPath, student.cookie)).status, 404);
    const deliver: InterventionAction = {
      action: "deliver",
      request_id: randomUUID(),
      expected_revision: 3,
      approval_id: approved.approval.id,
    };
    const delivered = (await action(draft.id, teacher.cookie, deliver))!;
    assert.ok(delivered.delivery);
    assert.deepEqual(
      await action(draft.id, teacher.cookie, deliver),
      delivered,
    );
    const read = await request(studentPath, student.cookie);
    assert.equal(read.status, 200);
    assert.equal(read.headers.get("cache-control"), "no-store");
    const publicView = StudentInterventionSchema.parse(await read.json());
    assert.deepEqual(publicView.content_ref, draft.evidence.content_ref);
    assert.equal(publicView.displayed_at, null);
    const publicText = JSON.stringify(publicView);
    for (const key of [
      "rubric",
      "answer_guidance",
      "criteria",
      "rationale",
      "evidence_references",
      "suggested_recipients",
      "Private teacher guidance",
    ])
      assert.ok(!publicText.includes(key), `Private ${key} leaked`);
    assert.equal((await request(studentPath, outsider.cookie)).status, 404);
    assert.equal((await request(studentPath, teacher.cookie)).status, 404);
    const display = await request(studentPath, student.cookie, {
      action: "displayed",
    });
    assert.equal(display.status, 200);
    const shown = StudentInterventionSchema.parse(await display.json());
    assert.ok(shown.displayed_at);
    assert.deepEqual(
      StudentInterventionSchema.parse(
        await (
          await request(studentPath, student.cookie, { action: "displayed" })
        ).json(),
      ),
      shown,
    );
    const page = await request(
      `/teacher/interventions?assignment=${draft.assignment_id}&draft=${draft.id}`,
      teacher.cookie,
    );
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.ok(html.includes(edited.title));
    assert.ok(!html.includes('href="null"'));
    assert.ok(html.includes(draft.evidence.concept.title));
    assert.deepEqual(
      InterventionReviewSchema.parse(
        await (await request(path, teacher.cookie)).json(),
      ),
      delivered,
    );
    assert.deepEqual(
      await readAssignmentEvidence(teacher.access, draft.assignment_id, "all"),
      originalEvidence,
    );
    await assert.rejects(
      db.query(
        "UPDATE teacher_intervention_approvals SET approved_at=clock_timestamp() WHERE id=$1",
        [approved.approval.id],
      ),
      /immutable/,
    );
    const wrongSource = await clone(
      source.snapshot,
      source.teacher_id,
      (saved) => {
        saved.evidence.content_ref.content_version = "wrong-version";
      },
    );
    await action(
      wrongSource.id,
      teacher.cookie,
      {
        action: "approve",
        request_id: randomUUID(),
        expected_revision: 1,
        recipient_ids: [studentId],
      },
      409,
    );
    checks.push(
      `${kind}: exact-source edit/replay/stale/reference checks, explicit approval then delivery, enrollment and private projection, displayed-once, immutable history and unchanged original evidence passed.`,
    );
    completed.push({
      kind,
      draft_id: draft.id,
      approval_id: approved.approval.id,
      assignment_id: draft.assignment_id,
    });
  }
  assert.deepEqual(
    (
      await db.query(
        "SELECT count(*)::int AS count FROM teacher_intervention_requests",
      )
    ).rows,
    beforeRequests,
  );
  const report = {
    status: "passed",
    verification:
      "PostgreSQL, authenticated HTTP and server-rendered UI; injected fixtures, no live model acceptance or visual browser interaction",
    paid_calls: 0,
    completed,
    checks,
  };
  if (process.env.CHECK_INTERVENTION_APPROVAL_OUTPUT)
    await writeFile(
      process.env.CHECK_INTERVENTION_APPROVAL_OUTPUT,
      `${JSON.stringify(report, null, 2)}\n`,
    );
  console.log(JSON.stringify(report));
} finally {
  for (const cookie of cookies)
    assert.equal((await request("/api/auth/sign-out", cookie, {})).status, 200);
  await db.end();
}
