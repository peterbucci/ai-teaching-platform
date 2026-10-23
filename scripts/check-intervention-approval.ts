import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { resolveActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { EvidenceError, evidenceAccess } from "../lib/evidence/store.ts";
import { readAssignmentEvidence } from "../lib/teacher/store.ts";
import { InterventionDraftSchema } from "../lib/interventions/drafts.ts";
import { generateInterventionDraft } from "../lib/interventions/store.ts";
import {
  InterventionReviewSchema,
  StudentInterventionSchema,
  type InterventionAction,
} from "../lib/interventions/approval-contracts.ts";
import {
  applyInterventionAction,
  readInterventionReview,
} from "../lib/interventions/approval.ts";

// Runs only against an already-running local application and its isolated,
// fictional PostgreSQL database. Retains clearly labelled verification copies
// because approved history is immutable. Never calls the activity generator.
const base = process.env.CHECK_BASE_URL ?? process.env.AUTH_URL;
assert.ok(base, "Configure CHECK_BASE_URL or AUTH_URL.");
const origin = new URL(base).origin;
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
const saved = z
  .object({
    request: z.object({
      draft_id: z.uuid(),
      selection: z.object({ assignment_id: z.uuid() }),
    }),
  })
  .parse(
    JSON.parse(
      await readFile(
        resolve(
          process.env.CHECK_INTERVENTION_REPORT ??
            "evals/results/intervention-draft-live-v2.json",
        ),
        "utf8",
      ),
    ),
  );
assert.equal(saved.request.selection.assignment_id, DEMO_IDS.assignmentId);
const db = getPool();
const checks: string[] = [];
const cookies: string[] = [];
const cloneIds: string[] = [];

async function request(
  path: string,
  cookie = "",
  body?: unknown,
  requestOrigin = origin,
) {
  return fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    redirect: "manual",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json", Origin: requestOrigin }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
}
async function login(prefix: string, profileId: string) {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  assert.ok(email && password, `Configure fictional ${prefix} credentials.`);
  const response = await request("/api/auth/sign-in/email", "", {
    email,
    password,
  });
  assert.equal(
    response.status,
    200,
    `${prefix} login failed; credentials are not printed.`,
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
async function review(draftId: string, cookie: string) {
  const response = await request(
    `/api/teacher/interventions/${draftId}`,
    cookie,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return InterventionReviewSchema.parse(await response.json());
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
    `Unexpected ${input.action} response: ${await response.clone().text()}`,
  );
  return status === 200
    ? InterventionReviewSchema.parse(await response.json())
    : null;
}
async function studentList(cookie: string) {
  const response = await request(
    `/api/student/interventions?assignment=${DEMO_IDS.assignmentId}`,
    cookie,
  );
  assert.equal(response.status, 200);
  return z
    .object({ interventions: z.array(StudentInterventionSchema) })
    .parse(await response.json()).interventions;
}
async function rejected(operation: Promise<unknown>, status: number) {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof EvidenceError && error.status === status,
  );
}

try {
  const teacher = await login("DEMO_TEACHER", DEMO_IDS.teacher);
  const one = await login("DEMO_STUDENT_ONE", DEMO_IDS.studentOne);
  const two = await login("DEMO_STUDENT_TWO", DEMO_IDS.studentTwo);
  const three = await login("DEMO_STUDENT_THREE", DEMO_IDS.inactiveStudent);
  const assignmentPath = `/api/teacher/assignments/${DEMO_IDS.assignmentId}/approval`;
  const assignmentResponse = await request(assignmentPath, teacher.cookie);
  assert.equal(assignmentResponse.status, 200);
  const sourceAssignment = z
    .object({
      review_token: z.string(),
      teacher_approved_at: z.string().nullable(),
    })
    .parse(await assignmentResponse.json());
  if (!sourceAssignment.teacher_approved_at) {
    assert.equal(
      (
        await request(assignmentPath, teacher.cookie, {
          review_token: sourceAssignment.review_token,
        })
      ).status,
      200,
    );
    checks.push(
      "Activated the isolated fictional source assignment through its existing authenticated teacher-review endpoint as test setup.",
    );
  }
  const source = (
    await readInterventionReview(teacher.access, saved.request.draft_id)
  ).draft;
  assert.ok(
    source.evidence.observations.every(
      (row) => row.data_origin === "synthetic_fixture",
    ),
  );
  assert.ok(
    source.provenance.response_id &&
      !source.provenance.model.includes("synthetic"),
  );
  const originalEvidence = await readAssignmentEvidence(
    teacher.access,
    DEMO_IDS.assignmentId,
    "all",
  );
  const generationCount = z
    .object({ count: z.number() })
    .parse(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM teacher_intervention_requests",
        )
      ).rows[0],
    ).count;
  async function clone(label: string) {
    const now = new Date().toISOString();
    const draft = InterventionDraftSchema.parse({
      ...source,
      id: randomUUID(),
      revision: 1,
      status: "private_draft",
      created_at: now,
      updated_at: now,
      activity: { ...source.activity, title: `#45 verification: ${label}` },
    });
    await db.query(
      "INSERT INTO teacher_intervention_drafts(id,teacher_id,assignment_id,revision,snapshot) VALUES($1,$2,$3,$4,$5)",
      [draft.id, DEMO_IDS.teacher, draft.assignment_id, draft.revision, draft],
    );
    cloneIds.push(draft.id);
    return draft;
  }
  const draft = await clone("edit and deliver");
  const path = `/api/teacher/interventions/${draft.id}`;
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, one.cookie)).status, 404);
  const initial = await review(draft.id, teacher.cookie);
  assert.equal(initial.approval, null);
  assert.equal(initial.delivery, null);
  assert.ok(
    initial.eligible_recipients.some(
      (row) => row.student_id === DEMO_IDS.inactiveStudent,
    ),
  );
  assert.ok(
    !(await studentList(one.cookie)).some((row) => row.draft_id === draft.id),
  );
  const forged = evidenceAccess({
    profileId: DEMO_IDS.teacher,
    userId: "fictional-wrong-identity",
  });
  await rejected(readInterventionReview(forged, draft.id), 404);
  const foreignTeacherId = randomUUID();
  await db.query(
    "INSERT INTO profiles(id,display_name) VALUES($1,'Fictional #45 foreign teacher check')",
    [foreignTeacherId],
  );
  const foreign = evidenceAccess({
    profileId: foreignTeacherId,
    userId: "fictional-other-teacher",
  });
  await rejected(readInterventionReview(foreign, draft.id), 404);
  await rejected(
    applyInterventionAction(foreign, draft.id, {
      action: "dismiss",
      request_id: randomUUID(),
      expected_revision: 1,
    }),
    404,
  );
  await db.query("DELETE FROM profiles WHERE id=$1", [foreignTeacherId]);
  checks.push(
    "Authenticated teacher ownership and profile binding enforced; anonymous/student/foreign-teacher requests denied; generated copy invisible to students.",
  );

  const changedActivity = structuredClone(draft.activity);
  changedActivity.title = "#45 verified teacher edit: compare the two delays";
  changedActivity.exercise_text +=
    " State which quantities stay fixed before making your prediction.";
  changedActivity.practice_questions[0].rubric.partial_credit_guidance =
    "Private teacher guidance: inspect the stated reasoning before judging the conclusion.";
  const save: InterventionAction = {
    action: "save",
    request_id: randomUUID(),
    expected_revision: 1,
    activity: changedActivity,
  };
  const edited = (await action(draft.id, teacher.cookie, save))!;
  assert.equal(edited.draft.revision, 2);
  assert.deepEqual(edited.draft.evidence, source.evidence);
  assert.deepEqual(edited.draft.provenance, source.provenance);
  assert.deepEqual(await action(draft.id, teacher.cookie, save), edited);
  await action(
    draft.id,
    teacher.cookie,
    { ...save, request_id: randomUUID() },
    409,
  );
  await action(
    draft.id,
    teacher.cookie,
    {
      ...save,
      activity: { ...changedActivity, title: "Altered duplicate request" },
    },
    409,
  );
  await action(
    draft.id,
    teacher.cookie,
    {
      action: "approve",
      request_id: randomUUID(),
      expected_revision: 1,
      recipient_ids: [DEMO_IDS.studentOne],
    },
    409,
  );
  const unsupported = structuredClone(changedActivity);
  unsupported.fresh_check.content_ref.content_version = "unapproved-version";
  await action(
    draft.id,
    teacher.cookie,
    {
      action: "save",
      request_id: randomUUID(),
      expected_revision: 2,
      activity: unsupported,
    },
    400,
  );
  assert.equal(
    (
      await request(
        path,
        teacher.cookie,
        save,
        "https://outside.example.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(path, teacher.cookie, {
        ...save,
        teacher_id: DEMO_IDS.teacher,
      })
    ).status,
    400,
  );
  checks.push(
    "Save advances exactly once, preserves original evidence/provenance, rejects stale/altered replay, unauthorized source version, forged ownership and cross-origin writes.",
  );

  const removedId = randomUUID();
  await db.query(
    "INSERT INTO profiles(id,display_name) VALUES($1,'Fictional #45 removed enrollment check')",
    [removedId],
  );
  await db.query("INSERT INTO enrollments(class_id,student_id) VALUES($1,$2)", [
    DEMO_IDS.classId,
    removedId,
  ]);
  assert.ok(
    (await review(draft.id, teacher.cookie)).eligible_recipients.some(
      (row) => row.student_id === removedId,
    ),
  );
  await db.query(
    "DELETE FROM enrollments WHERE class_id=$1 AND student_id=$2",
    [DEMO_IDS.classId, removedId],
  );
  await action(
    draft.id,
    teacher.cookie,
    {
      action: "approve",
      request_id: randomUUID(),
      expected_revision: 2,
      recipient_ids: [removedId],
    },
    409,
  );
  await db.query("DELETE FROM profiles WHERE id=$1", [removedId]);
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
  assert.ok(
    !(await studentList(one.cookie)).some((row) => row.draft_id === draft.id),
  );
  const approve: InterventionAction = {
    action: "approve",
    request_id: randomUUID(),
    expected_revision: 2,
    recipient_ids: [DEMO_IDS.studentOne, DEMO_IDS.studentTwo],
  };
  const approvals = await Promise.all([
    action(draft.id, teacher.cookie, approve),
    action(draft.id, teacher.cookie, approve),
  ]);
  assert.deepEqual(approvals[0], approvals[1]);
  const approved = approvals[0]!;
  assert.ok(approved.approval);
  assert.equal(approved.approval.approved_revision, 2);
  assert.equal(approved.approval.approved_by, DEMO_IDS.teacher);
  assert.deepEqual(approved.approval.activity, changedActivity);
  assert.deepEqual(approved.approval.evidence, source.evidence);
  assert.deepEqual(approved.approval.provenance, source.provenance);
  assert.deepEqual(approved.approval.recipient_ids, [
    DEMO_IDS.studentOne,
    DEMO_IDS.studentTwo,
  ]);
  assert.equal(approved.delivery, null);
  assert.equal(
    (
      await request(
        `/api/student/interventions/${approved.approval.id}`,
        one.cookie,
      )
    ).status,
    404,
  );
  assert.ok(
    !(await studentList(one.cookie)).some((row) => row.draft_id === draft.id),
  );
  await action(
    draft.id,
    teacher.cookie,
    {
      ...save,
      request_id: randomUUID(),
      expected_revision: approved.draft.revision,
    },
    409,
  );
  await action(
    draft.id,
    teacher.cookie,
    {
      action: "dismiss",
      request_id: randomUUID(),
      expected_revision: approved.draft.revision,
    },
    409,
  );
  checks.push(
    "Enrollment is rechecked after preview; approval records final exact revision, content, evidence and two explicitly selected recipients once; approved-only content is still student-invisible.",
  );

  const deliver: InterventionAction = {
    action: "deliver",
    request_id: randomUUID(),
    expected_revision: approved.draft.revision,
    approval_id: approved.approval.id,
  };
  const deliveries = await Promise.all([
    action(draft.id, teacher.cookie, deliver),
    action(draft.id, teacher.cookie, deliver),
  ]);
  assert.deepEqual(deliveries[0], deliveries[1]);
  const delivered = deliveries[0]!;
  assert.ok(delivered.delivery);
  assert.deepEqual(
    await action(draft.id, teacher.cookie, {
      ...deliver,
      request_id: randomUUID(),
    }),
    delivered,
  );
  const studentPath = `/api/student/interventions/${approved.approval.id}`;
  for (const recipient of [one, two]) {
    const response = await request(studentPath, recipient.cookie);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const publicActivity = StudentInterventionSchema.parse(
      await response.json(),
    );
    assert.equal(publicActivity.displayed_at, null);
    assert.equal(publicActivity.activity.title, changedActivity.title);
    const publicText = JSON.stringify(publicActivity);
    for (const forbidden of [
      "rubric",
      "answer_guidance",
      "criteria",
      "rationale",
      "uncertainty",
      "suggested_recipients",
      "evidence_references",
      "response_id",
      "Private teacher guidance:",
    ])
      assert.ok(
        !publicText.includes(forbidden),
        `Student payload leaked ${forbidden}.`,
      );
    for (const observation of source.evidence.observations)
      assert.ok(
        !publicText.includes(observation.student_id),
        "Student payload leaked an evidence identity.",
      );
    assert.equal(
      (await studentList(recipient.cookie)).filter(
        (row) => row.approval_id === approved.approval!.id,
      ).length,
      1,
    );
  }
  for (const identity of [three, teacher]) {
    assert.equal((await request(studentPath, identity.cookie)).status, 404);
    assert.equal(
      (await request(studentPath, identity.cookie, { action: "displayed" }))
        .status,
      404,
    );
  }
  assert.ok(
    !(await studentList(three.cookie)).some(
      (row) => row.approval_id === approved.approval!.id,
    ),
  );
  const displayed = await request(studentPath, one.cookie, {
    action: "displayed",
  });
  assert.equal(displayed.status, 200);
  const firstDisplay = StudentInterventionSchema.parse(await displayed.json());
  assert.ok(firstDisplay.displayed_at);
  const duplicateDisplay = await request(studentPath, one.cookie, {
    action: "displayed",
  });
  assert.deepEqual(
    StudentInterventionSchema.parse(await duplicateDisplay.json()),
    firstDisplay,
  );
  assert.equal(
    StudentInterventionSchema.parse(
      await (await request(studentPath, two.cookie)).json(),
    ).displayed_at,
    null,
  );
  assert.deepEqual(await review(draft.id, teacher.cookie), delivered);
  checks.push(
    "Delivery is durable and idempotent under concurrent retries; two recipients can retrieve only public content, enrolled third student and teacher cannot; GET does not mark assistance, explicit display is recorded once per student.",
  );

  await assert.rejects(
    db.query(
      "UPDATE teacher_intervention_approvals SET approved_at=clock_timestamp() WHERE id=$1",
      [approved.approval.id],
    ),
    /immutable/,
  );
  await assert.rejects(
    db.query(
      "DELETE FROM teacher_intervention_deliveries WHERE approval_id=$1",
      [approved.approval.id],
    ),
    /immutable/,
  );
  await assert.rejects(
    db.query(
      "DELETE FROM teacher_intervention_recipients WHERE approval_id=$1",
      [approved.approval.id],
    ),
    /immutable/,
  );
  await assert.rejects(
    db.query(
      "INSERT INTO teacher_intervention_recipients(approval_id,class_id,student_id) VALUES($1,$2,$3)",
      [approved.approval.id, DEMO_IDS.classId, DEMO_IDS.inactiveStudent],
    ),
    /explicitly approved/,
  );
  await assert.rejects(
    db.query(
      "UPDATE teacher_intervention_drafts SET revision=revision+1 WHERE id=$1",
      [draft.id],
    ),
    /immutable/,
  );
  const persisted = await db.query(
    "SELECT (SELECT count(*)::int FROM teacher_intervention_approvals WHERE draft_id=$1) approvals,(SELECT count(*)::int FROM teacher_intervention_deliveries WHERE approval_id=$2) deliveries,(SELECT count(*)::int FROM teacher_intervention_recipients WHERE approval_id=$2) recipients",
    [draft.id, approved.approval.id],
  );
  assert.deepEqual(persisted.rows[0], {
    approvals: 1,
    deliveries: 1,
    recipients: 2,
  });

  const dismissedDraft = await clone("dismissal");
  const dismiss: InterventionAction = {
    action: "dismiss",
    request_id: randomUUID(),
    expected_revision: 1,
  };
  const dismissed = (await action(dismissedDraft.id, teacher.cookie, dismiss))!;
  assert.equal(dismissed.draft.status, "dismissed");
  assert.deepEqual(
    await action(dismissedDraft.id, teacher.cookie, dismiss),
    dismissed,
  );
  await action(
    dismissedDraft.id,
    teacher.cookie,
    {
      ...approve,
      request_id: randomUUID(),
      expected_revision: dismissed.draft.revision,
    },
    409,
  );
  await action(
    dismissedDraft.id,
    teacher.cookie,
    {
      ...deliver,
      request_id: randomUUID(),
      expected_revision: dismissed.draft.revision,
    },
    409,
  );
  assert.ok(
    !(await studentList(one.cookie)).some(
      (row) => row.draft_id === dismissedDraft.id,
    ),
  );
  let forbiddenGenerationCalls = 0;
  for (const terminal of [delivered.draft, dismissed.draft]) {
    await rejected(
      generateInterventionDraft(
        teacher.access,
        {
          request_id: randomUUID(),
          draft_id: terminal.id,
          expected_revision: terminal.revision,
          selection: terminal.evidence.selection,
          revision_instructions: "Do not regenerate a terminal draft.",
        },
        async () => {
          forbiddenGenerationCalls += 1;
          throw new Error("A terminal draft must never reach a provider.");
        },
      ),
      409,
    );
  }
  assert.equal(forbiddenGenerationCalls, 0);
  assert.deepEqual(
    (await readInterventionReview(teacher.access, source.id)).draft,
    source,
  );
  assert.deepEqual(
    await readAssignmentEvidence(teacher.access, DEMO_IDS.assignmentId, "all"),
    originalEvidence,
  );
  assert.equal(
    z
      .object({ count: z.number() })
      .parse(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM teacher_intervention_requests",
          )
        ).rows[0],
      ).count,
    generationCount,
  );
  checks.push(
    "PostgreSQL rejects mutation of final approvals, deliveries and recipients plus insertion of an unapproved recipient; dismissed and approved drafts cannot reach the generation provider; source #44 draft, original answers/evaluations and model-request count remain unchanged.",
  );
  const report = {
    issue: 45,
    checked_at: new Date().toISOString(),
    status: "passed",
    origin,
    verification:
      "real PostgreSQL and authenticated HTTP; browser interaction verified separately",
    source_draft_id: source.id,
    source_provenance: source.provenance,
    verification_copy_ids: cloneIds,
    approval_id: approved.approval.id,
    delivery_id: delivered.delivery.id,
    recipient_ids: approved.approval.recipient_ids,
    new_model_calls: 0,
    checks,
  };
  await writeFile(
    resolve("evals/results/intervention-approval-http.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
} finally {
  try {
    for (const cookie of cookies)
      await request("/api/auth/sign-out", cookie, {});
  } finally {
    await db.end();
  }
}
