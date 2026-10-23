import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { betterAuth } from "better-auth";
import { z } from "zod";
import { getAuthOptions } from "../lib/auth-config.ts";
import { resolveActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import { QuestionSnapshotSchema } from "../lib/evidence/contracts.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import {
  EvidenceError,
  evidenceAccess,
  readSession,
} from "../lib/evidence/store.ts";
import type { requestEvaluation } from "../lib/evaluation/provider.ts";
import { ModelEvaluationSchema } from "../lib/evaluation/result.ts";
import { InterventionDraftSchema } from "../lib/interventions/drafts.ts";
import { InterventionReviewSchema } from "../lib/interventions/approval-contracts.ts";
import { readInterventionReview } from "../lib/interventions/approval.ts";
import {
  InterventionComparisonSchema,
  StudentInterventionFollowupSchema,
  type InterventionFollowupAction,
} from "../lib/interventions/outcomes-contracts.ts";
import {
  applyStudentInterventionFollowup,
  readInterventionComparison,
  readStudentInterventionFollowup,
} from "../lib/interventions/outcomes.ts";

import {
  checkInterventionTutorIsolation,
  checkInterventionEvaluatorRecovery,
} from "./intervention-isolation-checks.ts";

// An isolated fictional PostgreSQL database and a running authenticated app are
// required. Provider responses below are authored fixtures, never live scoring.
// Saved #44 generation provenance is reused; the generator is never called.
const base = process.env.CHECK_BASE_URL ?? process.env.AUTH_URL;
assert.ok(base, "Configure CHECK_BASE_URL or AUTH_URL.");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname));
if (
  !process.argv.includes("--verify-persistence") &&
  !process.argv.includes("--verify-integrity")
) {
  assert.equal(
    Boolean(process.env.OPENAI_API_KEY?.trim()),
    false,
    "Disable paid model calls for deterministic outcomes verification.",
  );
}
const origin = new URL(base).origin;
const reportPath = resolve("evals/results/intervention-outcomes-http.json");
const db = getPool();
const cookies: string[] = [];
const checks: string[] = [];
const copies: { label: string; draft_id: string; approval_id: string }[] = [];
let providerCalls = 0;
let foreignProfileId: string | null = null;
let foreignUserId: string | null = null;

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
    signal: AbortSignal.timeout(60_000),
  });
}
async function loginCredentials(
  email: string,
  password: string,
  profileId: string,
) {
  const response = await request("/api/auth/sign-in/email", "", {
    email,
    password,
  });
  assert.equal(
    response.status,
    200,
    "Fictional account login failed; credentials are not printed.",
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
async function login(prefix: string, profileId: string) {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  assert.ok(email && password, `Configure fictional ${prefix} credentials.`);
  return loginCredentials(email, password, profileId);
}
const pathFor = (approvalId: string) =>
  `/api/student/interventions/${approvalId}/followup`;
const comparisonPath = (draftId: string) =>
  `/api/teacher/interventions/${draftId}/followup`;
async function followup(
  approvalId: string,
  cookie: string,
  action?: InterventionFollowupAction,
) {
  const response = await request(pathFor(approvalId), cookie, action);
  assert.equal(
    response.status,
    200,
    `Follow-up HTTP ${response.status}: ${await response.clone().text()}`,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  return StudentInterventionFollowupSchema.parse(await response.json());
}
async function comparison(draftId: string, cookie: string) {
  const response = await request(comparisonPath(draftId), cookie);
  assert.equal(
    response.status,
    200,
    `Comparison HTTP ${response.status}: ${await response.clone().text()}`,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  return InterventionComparisonSchema.parse(await response.json());
}
async function rejects(operation: Promise<unknown>, status: number) {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof EvidenceError && error.status === status,
  );
}
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function comparisonFingerprint(
  value: z.infer<typeof InterventionComparisonSchema>,
) {
  return fingerprint({
    ...value,
    recipients: value.recipients.map((row) => ({
      ...row,
      followup: { ...row.followup, retry_allowed: null },
    })),
  });
}
async function checkDispatchIntegrity(approvalId: string) {
  for (const statement of [
    "UPDATE teacher_intervention_evaluation_requests SET state='failed',finished_at=NULL WHERE approval_id=$1 AND state='pending'",
    "UPDATE teacher_intervention_evaluation_requests SET state='completed',evaluation_id=NULL,finished_at=clock_timestamp() WHERE approval_id=$1 AND state='pending'",
  ]) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        "SELECT request_id FROM teacher_intervention_evaluation_requests WHERE approval_id=$1 AND state='pending'",
        [approvalId],
      );
      assert.ok(
        existing.rowCount,
        "A pending dispatch is required for the terminal-integrity regression.",
      );
      await assert.rejects(
        client.query(statement, [approvalId]),
        /intervention_dispatch_terminal_time|accepted saved evaluation|intervention_dispatch_completed_result/,
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }
}
async function originalRows(ids: string[]) {
  const values: Record<string, unknown[]> = {};
  for (const table of [
    "sessions",
    "attempts",
    "evaluations",
    "interventions",
  ] as const) {
    const condition =
      table === "sessions"
        ? "id=ANY($1::uuid[])"
        : table === "evaluations"
          ? "attempt_id IN (SELECT id FROM attempts WHERE session_id=ANY($1::uuid[]))"
          : "session_id=ANY($1::uuid[])";
    values[table] = (
      await db.query(
        `SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${condition} ORDER BY id`,
        [ids],
      )
    ).rows;
  }
  return values;
}
function fixture(
  correctness: "correct" | "uncertain",
): typeof requestEvaluation {
  return async (prompt) => {
    providerCalls += 1;
    const context = z
      .object({
        question: QuestionSnapshotSchema,
        student_response: z.string(),
      })
      .parse(JSON.parse(prompt.input));
    return {
      ok: true,
      model: "scripted-outcomes-verification",
      responseId: `fixture-${randomUUID()}`,
      latencyMs: 0,
      usage: null,
      result: ModelEvaluationSchema.parse({
        per_concept_results: context.question.concept_ids.map((concept_id) => ({
          concept_id,
          correctness,
          error_type:
            correctness === "uncertain" ? "insufficient_response" : null,
          rubric_criteria_met:
            correctness === "correct" ? context.question.rubric.criteria : [],
          rubric_criteria_missing:
            correctness === "uncertain" ? context.question.rubric.criteria : [],
        })),
        source_passage_ids: context.question.source_passage_ids,
        evidence_quotes: [
          {
            quote: context.student_response,
            interpretation:
              "Authored deterministic verification of response quotation and acceptance, not an actual model judgment.",
          },
        ],
        misconception_candidates: [],
        reasoning_observed:
          "Scripted verification response exercises the established evaluator and evidence validation.",
        uncertainty_reason:
          correctness === "uncertain"
            ? "The brief response does not state enough reasoning for this authored verification judgment."
            : null,
        proposed_next_action:
          correctness === "uncertain"
            ? "ASK_SELF_EXPLANATION"
            : "SCHEDULE_REVIEW",
      }),
    };
  };
}
const knownFailure: typeof requestEvaluation = async () => {
  providerCalls += 1;
  return {
    ok: false,
    code: "rate_limited",
    message: "Scripted known provider failure; no paid call was made.",
    model: "scripted-outcomes-verification",
    latencyMs: 0,
  };
};
const uncertainTransport: typeof requestEvaluation = async () => {
  providerCalls += 1;
  return {
    ok: false,
    code: "timeout",
    message: "Scripted unknown provider outcome; no paid call was made.",
    model: "scripted-outcomes-verification",
    latencyMs: 0,
  };
};
const correctAnswer =
  "Transmission delay stays the same because packet size and transmission rate are unchanged. Propagation delay increases because the same cable distance is divided by a lower signal speed. The delays depend on different quantities.";

try {
  const teacher = await login("DEMO_TEACHER", DEMO_IDS.teacher);
  const one = await login("DEMO_STUDENT_ONE", DEMO_IDS.studentOne);
  const two = await login("DEMO_STUDENT_TWO", DEMO_IDS.studentTwo);
  const three = await login("DEMO_STUDENT_THREE", DEMO_IDS.inactiveStudent);
  if (process.argv.includes("--verify-integrity")) {
    const saved = z
      .object({
        copies: z.array(z.object({ label: z.string(), approval_id: z.uuid() })),
      })
      .parse(JSON.parse(await readFile(reportPath, "utf8")));
    const pending = saved.copies.find(
      (copy) => copy.label === "uncertain provider outcome preserves answer",
    );
    assert.ok(pending);
    await checkDispatchIntegrity(pending.approval_id);
    const report = {
      checked_at: new Date().toISOString(),
      status: "passed",
      approval_id: pending.approval_id,
      new_model_calls: 0,
      checks: [
        "A pending dispatch cannot become terminal with a null completion timestamp.",
        "A completed dispatch cannot omit an accepted saved evaluation.",
        "Both negative probes ran in transactions that were rolled back.",
      ],
    };
    await writeFile(
      resolve("evals/results/intervention-outcomes-integrity.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    console.log(JSON.stringify(report));
  } else if (process.argv.includes("--verify-persistence")) {
    const saved = z
      .object({
        copies: z.array(
          z.object({ draft_id: z.uuid(), approval_id: z.uuid() }),
        ),
        persisted_fingerprints: z.record(z.string(), z.string()),
        original_session_ids: z.array(z.uuid()),
        original_rows_sha256: z.string(),
        new_model_calls: z.literal(0),
      })
      .parse(JSON.parse(await readFile(reportPath, "utf8")));
    for (const copy of saved.copies) {
      const current = await comparison(copy.draft_id, teacher.cookie);
      assert.equal(
        comparisonFingerprint(current),
        saved.persisted_fingerprints[copy.approval_id],
      );
      const response = await followup(copy.approval_id, one.cookie);
      assert.deepEqual(
        response,
        current.recipients.find(
          (row) => row.student_id === DEMO_IDS.studentOne,
        )!.followup,
      );
    }
    assert.equal(
      fingerprint(await originalRows(saved.original_session_ids)),
      saved.original_rows_sha256,
    );
    const persisted = {
      checked_at: new Date().toISOString(),
      status: "passed",
      origin,
      approvals: saved.copies.map((copy) => copy.approval_id),
      new_model_calls: 0,
      checks: [
        "After an application restart, all saved recipient responses, evaluations, assistance and teacher comparisons exactly match the pre-restart fingerprints.",
        "Original pre-existing sessions, attempts, evaluations and tutoring interventions remain unchanged.",
      ],
    };
    await writeFile(
      resolve("evals/results/intervention-outcomes-persistence.json"),
      `${JSON.stringify(persisted, null, 2)}\n`,
    );
    console.log(JSON.stringify(persisted));
  } else {
    const sourceReport = z
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
    assert.equal(
      sourceReport.request.selection.assignment_id,
      DEMO_IDS.assignmentId,
    );
    const source = (
      await readInterventionReview(
        teacher.access,
        sourceReport.request.draft_id,
      )
    ).draft;
    assert.ok(
      source.evidence.observations.every(
        (row) => row.data_origin === "synthetic_fixture",
      ),
    );
    assert.ok(source.provenance.response_id);
    const originalSessionIds = z
      .array(z.object({ id: z.uuid() }))
      .parse((await db.query("SELECT id FROM sessions ORDER BY id")).rows)
      .map((row) => row.id);
    const originalFingerprint = fingerprint(
      await originalRows(originalSessionIds),
    );
    const generationCount = (
      await db.query(
        "SELECT count(*)::int AS count FROM teacher_intervention_requests",
      )
    ).rows[0].count;
    async function clone(label: string) {
      const now = new Date().toISOString();
      const draft = InterventionDraftSchema.parse({
        ...source,
        id: randomUUID(),
        revision: 1,
        status: "private_draft",
        created_at: now,
        updated_at: now,
        activity: { ...source.activity, title: `#46 verification: ${label}` },
      });
      await db.query(
        "INSERT INTO teacher_intervention_drafts(id,teacher_id,assignment_id,revision,snapshot) VALUES($1,$2,$3,$4,$5)",
        [
          draft.id,
          DEMO_IDS.teacher,
          draft.assignment_id,
          draft.revision,
          draft,
        ],
      );
      const approvalResponse = await request(
        `/api/teacher/interventions/${draft.id}`,
        teacher.cookie,
        {
          action: "approve",
          request_id: randomUUID(),
          expected_revision: 1,
          recipient_ids: [DEMO_IDS.studentOne, DEMO_IDS.studentTwo],
        },
      );
      assert.equal(
        approvalResponse.status,
        200,
        await approvalResponse.clone().text(),
      );
      const approved = InterventionReviewSchema.parse(
        await approvalResponse.json(),
      );
      assert.ok(approved.approval);
      const delivered = await request(
        `/api/teacher/interventions/${draft.id}`,
        teacher.cookie,
        {
          action: "deliver",
          request_id: randomUUID(),
          expected_revision: approved.draft.revision,
          approval_id: approved.approval.id,
        },
      );
      assert.equal(delivered.status, 200, await delivered.clone().text());
      const copy = {
        label,
        draft_id: draft.id,
        approval_id: approved.approval.id,
      };
      copies.push(copy);
      return copy;
    }
    const main = await clone("two recipients, one assisted correct submission");
    const studentPath = pathFor(main.approval_id);
    const untouched = await followup(main.approval_id, one.cookie);
    assert.equal(untouched.started_at, null);
    assert.equal(untouched.submitted_at, null);
    assert.equal(untouched.evaluation_status, "not_submitted");
    assert.equal(
      (await followup(main.approval_id, two.cookie)).started_at,
      null,
    );
    assert.deepEqual((await comparison(main.draft_id, teacher.cookie)).counts, {
      intended: 2,
      started: 0,
      submitted: 0,
      missing: 2,
      accepted: 0,
      pending: 0,
      failed: 0,
      uncertain: 0,
    });
    const options = getAuthOptions();
    const provision = betterAuth({
      ...options,
      emailAndPassword: { ...options.emailAndPassword, disableSignUp: false },
    });
    const email = `outcomes-${randomUUID()}@example.invalid`;
    const password = `Fictional-${randomUUID()}`;
    const created = await provision.api.signUpEmail({
      body: { name: "Fictional #46 unrelated teacher", email, password },
    });
    foreignUserId = created.user.id;
    foreignProfileId = randomUUID();
    await db.query(
      "INSERT INTO profiles(id,auth_user_id,display_name) VALUES($1,$2,'Fictional #46 unrelated teacher')",
      [foreignProfileId, foreignUserId],
    );
    const foreign = await loginCredentials(email, password, foreignProfileId);
    for (const identity of [three, teacher, foreign]) {
      assert.equal((await request(studentPath, identity.cookie)).status, 404);
      for (const action of [
        { action: "start" },
        {
          action: "submit",
          request_id: randomUUID(),
          response_text: "Unauthorized response",
        },
        {
          action: "retry",
          request_id: randomUUID(),
          expected_evaluation_id: null,
        },
      ])
        assert.equal(
          (await request(studentPath, identity.cookie, action)).status,
          404,
        );
    }
    assert.equal((await request(studentPath)).status, 401);
    for (const identity of [one, two, three, foreign])
      assert.equal(
        (await request(comparisonPath(main.draft_id), identity.cookie)).status,
        404,
      );
    assert.equal((await request(comparisonPath(main.draft_id))).status, 401);
    const forged = evidenceAccess({
      profileId: DEMO_IDS.studentOne,
      userId: "fictional-mismatched-auth",
    });
    await rejects(
      readStudentInterventionFollowup(forged, main.approval_id),
      404,
    );
    await rejects(
      readInterventionComparison(foreign.access, main.draft_id),
      404,
    );
    assert.equal(
      (
        await request(
          studentPath,
          one.cookie,
          { action: "start" },
          "https://outside.example.invalid",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(studentPath, one.cookie, {
          action: "start",
          student_id: DEMO_IDS.studentTwo,
        })
      ).status,
      400,
    );
    checks.push(
      "Reads do not start an exercise; anonymous, nonrecipient, unrelated teacher, student-to-teacher, forged profile and cross-origin requests are denied before any provider dispatch.",
    );

    assert.equal(
      (
        await request(studentPath, one.cookie, {
          action: "submit",
          request_id: randomUUID(),
          response_text: correctAnswer,
        })
      ).status,
      409,
    );
    const starts = await Promise.all([
      followup(main.approval_id, one.cookie, { action: "start" }),
      followup(main.approval_id, one.cookie, { action: "start" }),
    ]);
    assert.deepEqual(starts[0], starts[1]);
    assert.ok(starts[0].attempt_id && starts[0].started_at);
    assert.equal(starts[0].submitted_at, null);
    assert.equal(
      (
        await request(
          `/api/student/interventions/${main.approval_id}`,
          one.cookie,
          { action: "displayed" },
        )
      ).status,
      200,
    );
    const submit: InterventionFollowupAction = {
      action: "submit",
      request_id: randomUUID(),
      response_text: correctAnswer,
    };
    const initialCalls = providerCalls;
    await Promise.all([
      applyStudentInterventionFollowup(one.access, main.approval_id, submit, {
        provider: fixture("correct"),
      }),
      applyStudentInterventionFollowup(one.access, main.approval_id, submit, {
        provider: fixture("correct"),
      }),
    ]);
    assert.equal(providerCalls, initialCalls + 1);
    const accepted = await followup(main.approval_id, one.cookie);
    assert.equal(accepted.evaluation_status, "accepted");
    assert.equal(accepted.evaluation_provenance, "injected_fixture");
    assert.equal(accepted.response_text, correctAnswer);
    assert.ok(accepted.feedback);
    assert.ok(
      accepted.assistance && accepted.assistance.intervention_ids.length > 0,
    );
    assert.ok(
      Object.values(
        accepted.assistance.independent_retrieval_eligible_by_concept,
      ).every((value) => !value),
    );
    assert.deepEqual(
      await followup(main.approval_id, one.cookie, submit),
      accepted,
    );
    assert.equal(providerCalls, initialCalls + 1);
    assert.equal(
      (
        await request(studentPath, one.cookie, {
          ...submit,
          response_text: "Altered duplicate response",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(studentPath, one.cookie, {
          ...submit,
          request_id: randomUUID(),
          response_text: "A second answer",
        })
      ).status,
      409,
    );
    await rejects(
      applyStudentInterventionFollowup(
        one.access,
        main.approval_id,
        {
          action: "retry",
          request_id: randomUUID(),
          expected_evaluation_id: accepted.evaluation_id,
        },
        { provider: fixture("correct") },
      ),
      409,
    );
    const compared = await comparison(main.draft_id, teacher.cookie);
    assert.deepEqual(compared.counts, {
      intended: 2,
      started: 1,
      submitted: 1,
      missing: 1,
      accepted: 1,
      pending: 0,
      failed: 0,
      uncertain: 0,
    });
    assert.deepEqual(compared.original_evidence, source.evidence);
    assert.deepEqual(
      compared.content_ref,
      source.activity.fresh_check.content_ref,
    );
    const participant = compared.recipients.find(
      (row) => row.student_id === DEMO_IDS.studentOne,
    )!;
    assert.ok(participant.attempt && participant.session_id);
    assert.deepEqual(participant.attempt.question, source.activity.fresh_check);
    assert.equal(participant.attempt.response_text, correctAnswer);
    assert.equal(participant.attempt.intent, "immediate_retest");
    assert.equal(
      compared.recipients.find((row) => row.student_id === DEMO_IDS.studentTwo)!
        .attempt,
      null,
    );
    const session = await readSession(
      one.access,
      participant.session_id,
      "student",
    );
    assert.equal(session.attempts.length, 1);
    assert.equal(
      session.evaluations.filter((row) => row.validation_status === "accepted")
        .length,
      1,
    );
    for (const concept of compared.metrics.concepts) {
      assert.equal(concept.content_assisted.correct, 1);
      assert.equal(concept.independent.correct, 0);
      assert.equal(concept.latest.no_response, 1);
    }
    await checkInterventionTutorIsolation(
      one.access,
      participant.session_id,
      DEMO_IDS.assignmentId,
    );
    await checkInterventionEvaluatorRecovery(
      one.access,
      DEMO_IDS.assignmentId,
      participant.attempt.question,
    );
    checks.push(
      "Dedicated follow-ups cannot enter the ordinary tutor controller, history or dashboard selection; evaluator timeout, connection and provider-error persistence/replay regressions passed through real PostgreSQL with four injected calls.",
    );
    const publicText = JSON.stringify(accepted);
    for (const forbidden of [
      "rubric",
      "answer_guidance",
      "partial_credit_guidance",
      "evidence_references",
      source.provenance.response_id,
    ])
      assert.ok(!publicText.includes(forbidden));
    checks.push(
      "Concurrent starts and exact submissions create one session, immutable approved question, answer and provider call. Student A has accepted assisted evidence; student B remains missing, not failed; exact replay and refresh preserve the original response; conflicting answers and accepted-result retries are rejected.",
    );
    checks.push(
      "Teacher comparison preserves original evidence and source identity, counts distinct recipients with established metrics, and marks assisted correct work without independent-learning or retention claims. Private question rubrics stay server-side.",
    );

    const uncertain = await clone("accepted but uncertain judgment");
    assert.equal(
      (
        await request(
          `/api/student/interventions/${uncertain.approval_id}`,
          one.cookie,
          { action: "displayed" },
        )
      ).status,
      200,
    );
    await followup(uncertain.approval_id, one.cookie, { action: "start" });
    const uncertainAction: InterventionFollowupAction = {
      action: "submit",
      request_id: randomUUID(),
      response_text: "One delay may change, but I cannot yet explain which.",
    };
    const uncertainResult = await applyStudentInterventionFollowup(
      one.access,
      uncertain.approval_id,
      uncertainAction,
      { provider: fixture("uncertain") },
    );
    assert.equal(uncertainResult.evaluation_status, "accepted");
    assert.equal(uncertainResult.evaluation_provenance, "injected_fixture");
    assert.equal(uncertainResult.uncertain, true);
    const uncertainComparison = await comparison(
      uncertain.draft_id,
      teacher.cookie,
    );
    assert.equal(uncertainComparison.counts.accepted, 1);
    assert.equal(uncertainComparison.counts.uncertain, 1);
    assert.equal(uncertainComparison.counts.failed, 0);
    const failed = await clone(
      "known evaluation failure and explicit recovery",
    );
    await followup(failed.approval_id, one.cookie, { action: "start" });
    const failedAction: InterventionFollowupAction = {
      action: "submit",
      request_id: randomUUID(),
      response_text: correctAnswer,
    };
    const failedResult = await applyStudentInterventionFollowup(
      one.access,
      failed.approval_id,
      failedAction,
      { provider: knownFailure },
    );
    assert.equal(failedResult.evaluation_status, "failed");
    assert.ok(failedResult.evaluation_id && failedResult.retry_after);
    const retry: InterventionFollowupAction = {
      action: "retry",
      request_id: randomUUID(),
      expected_evaluation_id: failedResult.evaluation_id,
    };
    await rejects(
      applyStudentInterventionFollowup(one.access, failed.approval_id, retry, {
        provider: fixture("correct"),
      }),
      409,
    );
    const pending = await clone("uncertain provider outcome preserves answer");
    await followup(pending.approval_id, one.cookie, { action: "start" });
    const pendingAction: InterventionFollowupAction = {
      action: "submit",
      request_id: randomUUID(),
      response_text: correctAnswer,
    };
    const pendingResult = await applyStudentInterventionFollowup(
      one.access,
      pending.approval_id,
      pendingAction,
      { provider: uncertainTransport },
    );
    assert.equal(pendingResult.evaluation_status, "pending");
    assert.equal(pendingResult.retry_allowed, false);
    const callsBeforeReplays = providerCalls;
    assert.deepEqual(
      await followup(pending.approval_id, one.cookie, pendingAction),
      pendingResult,
    );
    await rejects(
      applyStudentInterventionFollowup(
        one.access,
        pending.approval_id,
        {
          action: "retry",
          request_id: randomUUID(),
          expected_evaluation_id: pendingResult.evaluation_id,
        },
        { provider: fixture("correct") },
      ),
      409,
    );
    assert.equal(providerCalls, callsBeforeReplays);
    assert.equal(
      (await comparison(pending.draft_id, teacher.cookie)).counts.pending,
      1,
    );
    const configuredFailure = await clone(
      "HTTP submission with unavailable evaluator configuration",
    );
    await followup(configuredFailure.approval_id, one.cookie, {
      action: "start",
    });
    const httpAction: InterventionFollowupAction = {
      action: "submit",
      request_id: randomUUID(),
      response_text: correctAnswer,
    };
    const configurationResult = await followup(
      configuredFailure.approval_id,
      one.cookie,
      httpAction,
    );
    assert.equal(configurationResult.evaluation_status, "failed");
    assert.equal(configurationResult.response_text, correctAnswer);
    assert.equal(configurationResult.evaluation_id, null);
    assert.deepEqual(
      await followup(configuredFailure.approval_id, one.cookie, httpAction),
      configurationResult,
    );
    checks.push(
      "Accepted uncertainty is distinct from failure; an unknown timeout stays pending and cannot be retried or spent twice; authenticated HTTP with unavailable evaluator configuration saves the response and reports failure without losing work.",
    );
    console.log(
      "Known-failure recovery cooldown is running; original responses remain saved.",
    );
    while (Date.now() < Date.parse(failedResult.retry_after) + 50)
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.min(
            1000,
            Date.parse(failedResult.retry_after!) + 50 - Date.now(),
          ),
        ),
      );
    const recovered = await applyStudentInterventionFollowup(
      one.access,
      failed.approval_id,
      retry,
      { provider: fixture("correct") },
    );
    assert.equal(recovered.evaluation_status, "accepted");
    assert.equal(recovered.evaluation_provenance, "injected_fixture");
    assert.equal(recovered.response_text, correctAnswer);
    assert.equal(recovered.attempt_id, failedResult.attempt_id);
    assert.deepEqual(
      await followup(failed.approval_id, one.cookie, retry),
      recovered,
    );
    const recoveredComparison = await comparison(
      failed.draft_id,
      teacher.cookie,
    );
    const recoveredStudent = recoveredComparison.recipients.find(
      (row) => row.student_id === DEMO_IDS.studentOne,
    )!;
    assert.equal(recoveredStudent.evaluations.length, 2);
    assert.equal(
      recoveredStudent.evaluations[0].validation_status,
      "evaluation_failed",
    );
    assert.equal(recoveredStudent.evaluations[1].validation_status, "accepted");
    checks.push(
      "A known failed evaluation rejects early retry; after the real cooldown, explicit recovery evaluates the same saved answer once and retains the failed evaluation history.",
    );

    await assert.rejects(
      db.query(
        "UPDATE teacher_intervention_followups SET started_at=clock_timestamp() WHERE approval_id=$1",
        [main.approval_id],
      ),
      /immutable/,
    );
    await assert.rejects(
      db.query(
        "DELETE FROM teacher_intervention_evaluation_requests WHERE approval_id=$1",
        [main.approval_id],
      ),
      /cannot be deleted/,
    );
    await assert.rejects(
      db.query(
        "UPDATE teacher_intervention_evaluation_requests SET state='failed' WHERE approval_id=$1",
        [main.approval_id],
      ),
      /immutable/,
    );
    assert.equal(
      fingerprint(await originalRows(originalSessionIds)),
      originalFingerprint,
    );
    assert.deepEqual(
      (await readInterventionReview(teacher.access, source.id)).draft,
      source,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM teacher_intervention_requests",
        )
      ).rows[0].count,
      generationCount,
    );
    checks.push(
      "PostgreSQL protects follow-up links and completed dispatch history; all pre-existing original sessions, answers, accepted evaluations, tutoring assistance, the saved #44 draft and generator-request count remain byte-equivalent.",
    );
    await checkDispatchIntegrity(pending.approval_id);
    checks.push(
      "Migration017 rejects terminal dispatches with null completion time and completed dispatches without an accepted saved evaluation; negative SQL checks roll back.",
    );
    const fingerprints: Record<string, string> = {};
    for (const copy of copies)
      fingerprints[copy.approval_id] = comparisonFingerprint(
        await comparison(copy.draft_id, teacher.cookie),
      );
    const report = {
      issue: 46,
      checked_at: new Date().toISOString(),
      status: "passed",
      origin,
      verification:
        "real PostgreSQL and authenticated HTTP with authored deterministic provider fixtures; no actual-model evaluation",
      source_draft_id: source.id,
      source_provenance: source.provenance,
      copies,
      scripted_provider_calls: providerCalls + 4,
      followup_scripted_provider_calls: providerCalls,
      evaluator_regression_scripted_provider_calls: 4,
      new_model_calls: 0,
      original_session_ids: originalSessionIds,
      original_rows_sha256: originalFingerprint,
      persisted_fingerprints: fingerprints,
      checks,
    };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report));
  }
} finally {
  try {
    for (const cookie of cookies)
      await request("/api/auth/sign-out", cookie, {});
    if (foreignProfileId)
      await db.query("DELETE FROM profiles WHERE id=$1", [foreignProfileId]);
    if (foreignUserId)
      await db.query("DELETE FROM auth_user WHERE id=$1", [foreignUserId]);
  } finally {
    await db.end();
  }
}
