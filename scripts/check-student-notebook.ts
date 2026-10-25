import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { getPool } from "../lib/db.ts";
import { resolveActor } from "../lib/auth.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import {
  getCuratedQuestion,
  loadApprovedContent,
} from "../lib/evidence/content.ts";
import {
  evidenceAccess,
  EvidenceError,
  startSession,
  presentQuestion,
  submitAnswer,
  recordEvaluation,
  recordIntervention,
  acknowledgeIntervention,
} from "../lib/evidence/store.ts";
import { readStudentNotebook } from "../lib/evidence/student-notebook.ts";
import {
  assignmentReview,
  approveAssignment,
} from "../lib/assignments/store.ts";
import { StudentNotebookSchema } from "../lib/evidence/student-notebook-contracts.ts";
import { createApprovedRuntimeLesson } from "./fixtures/approved-r7-lesson.ts";
import { createSourceVersion } from "../lib/lessons/sources.ts";
import {
  readLessonDraft,
  saveLessonDraft,
  approveLessonDraft,
  publishLessonVersion,
} from "../lib/lessons/store.ts";
import { serializeLessonContent } from "../lib/lessons/validate.ts";
import {
  reserveConversationOperation,
  commitConversationIntent,
  commitConversationHelp,
  acknowledgeConversation,
  loadConversation,
} from "../lib/dialogue/store.ts";
import { makeDialogueExamples } from "../lib/dialogue/examples.ts";
import { buildInterventionEvidence } from "../lib/interventions/evidence.ts";
import { InterventionDraftSchema } from "../lib/interventions/drafts.ts";
import { readAssignmentEvidence } from "../lib/teacher/store.ts";
import {
  applyInterventionAction,
  markStudentInterventionDisplayed,
} from "../lib/interventions/approval.ts";
import {
  applyStudentInterventionFollowup,
  readStudentInterventionFollowup,
} from "../lib/interventions/outcomes.ts";

// Explicitly disposable, fictional PostgreSQL + real authenticated HTTP. Never loads .env.
assert.equal(process.env.NOTEBOOK_CHECK_SYNTHETIC, "1");
assert.ok(
  !process.env.OPENAI_API_KEY?.trim(),
  "Paid provider credentials must be absent.",
);
for (const key of [
  "PGHOST",
  "PGPORT",
  "PGUSER",
  "PGDATABASE",
  "PGPASSWORD",
  "AUTH_URL",
  "NOTEBOOK_CHECK_STATE",
])
  assert.ok(process.env[key], `Set ${key}.`);
const base = process.env.AUTH_URL!;
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const statePath = process.env.NOTEBOOK_CHECK_STATE!;
const db = getPool();
const check = (s: string) => console.log(`PASS: ${s}`);
const path = (id: string, query = "") =>
  `/api/student/notebook/sessions/${id}${query}`;
async function request(url: string, cookie = "", body?: unknown) {
  return fetch(new URL(url, base), {
    method: body === undefined ? "GET" : "POST",
    redirect: "manual",
    headers: {
      Cookie: cookie,
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json", Origin: base }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
}
async function login(prefix: string) {
  const response = await request("/api/auth/sign-in/email", "", {
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  });
  assert.equal(
    response.status,
    200,
    "Fictional sign-in failed (credentials suppressed).",
  );
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";", 1)[0])
    .join("; ");
  return {
    cookie,
    access: evidenceAccess(await resolveActor(new Headers({ Cookie: cookie }))),
  };
}
async function get(id: string, cookie: string, query = "") {
  const response = await request(path(id, query), cookie);
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(response.headers.get("cache-control"), "no-store");
  return StudentNotebookSchema.parse(await response.json());
}
async function fingerprint() {
  const tables = [
    "sessions",
    "attempts",
    "evaluations",
    "interventions",
    "dialogue_sessions",
    "dialogue_operations",
    "dialogue_events",
    "dialogue_provider_calls",
    "teacher_intervention_approvals",
    "teacher_intervention_deliveries",
    "teacher_intervention_recipients",
    "teacher_intervention_followups",
    "teacher_intervention_evaluation_requests",
  ];
  const hash = createHash("sha256");
  for (const table of tables) {
    const rows = await db.query(
      `SELECT to_jsonb(t)::text AS record FROM ${table} t ORDER BY to_jsonb(t)::text`,
    );
    hash.update(table).update(JSON.stringify(rows.rows));
  }
  return hash.digest("hex");
}
const State = z.object({
  sessions: z.array(
    z.object({
      id: z.uuid(),
      snapshot: z.string(),
      student: z.enum(["one", "two"]),
    }),
  ),
  fingerprint: z.string(),
});
try {
  const teacher = await login("DEMO_TEACHER");
  const one = await login("DEMO_STUDENT_ONE");
  const two = await login("DEMO_STUDENT_TWO");
  if (process.argv.includes("--verify-persistence")) {
    const saved = State.parse(JSON.parse(await readFile(statePath, "utf8")));
    for (const s of saved.sessions)
      assert.equal(
        (await get(s.id, s.student === "one" ? one.cookie : two.cookie))
          .snapshot.id,
        s.snapshot,
      );
    assert.equal(await fingerprint(), saved.fingerprint);
    check(
      "Notebook identities and evidence fingerprints survive app/database restart; zero evidence writes.",
    );
  } else {
    const activation = await assignmentReview(
      teacher.access,
      DEMO_IDS.assignmentId,
    );
    if (!activation.teacher_approved_at)
      await approveAssignment(
        teacher.access,
        DEMO_IDS.assignmentId,
        activation.review_token,
      );
    assert.equal((await request(path(DEMO_IDS.supportedSession))).status, 401);
    for (const cookie of [two.cookie, teacher.cookie])
      assert.equal(
        (await request(path(DEMO_IDS.supportedSession), cookie)).status,
        404,
      );
    await assert.rejects(
      readStudentNotebook(
        evidenceAccess({
          profileId: one.access.actor.profileId,
          userId: two.access.actor.userId,
        }),
        DEMO_IDS.supportedSession,
      ),
      (e: unknown) => e instanceof EvidenceError && e.status === 404,
    );
    assert.equal(
      (
        await request(
          path(DEMO_IDS.supportedSession, "?limit=1&limit=2"),
          one.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          path(DEMO_IDS.supportedSession, "?student_id=" + DEMO_IDS.studentTwo),
          one.cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          path(
            DEMO_IDS.supportedSession,
            "?attempt_id=" + DEMO_IDS.correctRoot,
          ),
          one.cookie,
        )
      ).status,
      404,
    );
    check(
      "D1-14: real HTTP anonymous/peer/teacher denial, actor binding and selector validation.",
    );
    const initial = await fingerprint();
    const legacy = await get(DEMO_IDS.supportedSession, one.cookie);
    await get(DEMO_IDS.supportedSession, one.cookie);
    assert.equal(await fingerprint(), initial);
    const raw = await db.query(
      "SELECT to_jsonb(a) AS record FROM attempts a WHERE session_id=$1 ORDER BY sequence_index",
      [DEMO_IDS.supportedSession],
    );
    for (const [index, page] of legacy.pages.entries()) {
      assert.equal(
        page.submission?.response_text,
        raw.rows[index].record.response_text,
      );
      assert.equal(
        page.submission?.submitted_at,
        raw.rows[index].record.submitted_at,
      );
      assert.deepEqual(
        page.submission?.assistance_at_submission,
        raw.rows[index].record.assistance,
      );
    }
    check(
      "D1-09/10/17: exact saved text and PostgreSQL microseconds; repeated GET leaves evidence unchanged.",
    );

    const uploaded = await createApprovedRuntimeLesson(
      teacher.access,
      DEMO_IDS.classId,
    );
    const content = uploaded.content;
    const session = await startSession(
      one.access,
      uploaded.assignmentId,
      "synthetic_fixture",
    );
    const question = getCuratedQuestion(content, "NP-TX-01");
    const first = await presentQuestion(one.access, session.id, {
      question,
      intent: "initial_retrieval",
    });
    const exact = "  Original answer π🙂\r\nwith spacing.  ";
    await submitAnswer(one.access, session.id, {
      attempt_id: first.id,
      submission_key: randomUUID(),
      response_text: exact,
    });
    const accepted = await recordEvaluation(one.access, session.id, {
      id: randomUUID(),
      attempt_id: first.id,
      validation_status: "accepted",
      evaluator: {
        type: "synthetic_fixture",
        model: null,
        version: "notebook-test",
      },
      supersedes_id: null,
      applied_result: null,
      failure_reason: null,
      result: {
        per_concept_results: question.concept_ids.map((concept_id) => ({
          concept_id,
          correctness: "uncertain",
          error_type: null,
          rubric_criteria_met: [],
          rubric_criteria_missing: [],
        })),
        source_passage_ids: question.source_passage_ids,
        evidence_quotes: [],
        reasoning_observed: "PRIVATE_REASONING",
        uncertainty_reason: "PRIVATE_UNCERTAINTY",
        proposed_next_action: "ASK_SELF_EXPLANATION",
      },
    });
    await recordEvaluation(one.access, session.id, {
      id: randomUUID(),
      attempt_id: first.id,
      validation_status: "evaluation_failed",
      evaluator: {
        type: "synthetic_fixture",
        model: null,
        version: "notebook-test",
      },
      supersedes_id: null,
      applied_result: null,
      result: null,
      failure_reason: "PRIVATE_PROVIDER_OUTPUT",
    });
    const second = await presentQuestion(one.access, session.id, {
      question,
      intent: "immediate_retest",
      parent_attempt_id: first.id,
    });
    let beforeHelp = await get(session.id, one.cookie, "?limit=1");
    assert.deepEqual(beforeHelp.pages[0].assessment, {
      status: "accepted",
      current_evaluation_id: accepted.id,
    });
    assert.ok(!JSON.stringify(beforeHelp).includes("PRIVATE_"));
    assert.ok(!JSON.stringify(beforeHelp).includes("access_scope"));
    assert.equal(
      beforeHelp.pages[0].source.content_ref.content_version,
      content.content_ref.content_version,
    );
    const rawRef = beforeHelp.pages[0].source.content_ref;
    assert.ok("source_kind" in rawRef && rawRef.source_version === 1);
    check(
      "D1-07/08/13/18: saved accepted pointer, safe uncertainty and uploaded version provenance; private fields excluded.",
    );

    const conversation = await loadConversation(one.access, session.id);
    const action = {
      version: "r7-conversation-v1",
      action: "send_message",
      request_id: randomUUID(),
      session_id: session.id,
      attempt_id: second.id,
      expected_revision: conversation.dialogue.state.revision,
      text: "Please explain before I answer.",
    };
    await reserveConversationOperation(one.access, action);
    const pending = await get(
      session.id,
      one.cookie,
      `?attempt_id=${second.id}`,
    );
    assert.equal(pending.pages[0].messages[0].state, "pending");
    await commitConversationIntent(
      one.access,
      session.id,
      action.request_id,
      { category: "QUESTION_OR_HELP", rationale: "PRIVATE_INTENT" },
      { answer_intent: "uncertain", disclosure: "safe" },
    );
    const examples = makeDialogueExamples(content);
    const generated = {
      ...examples.help,
      content_id: randomUUID(),
      generation: {
        model: "synthetic-notebook",
        prompt_template_version: "PRIVATE_PROMPT",
        generated_at: new Date().toISOString(),
      },
    };
    const delivery = await commitConversationHelp(
      one.access,
      session.id,
      action.request_id,
      generated,
      examples.review,
    );
    const turn = delivery.dialogue.turns[0].response;
    assert.equal(turn.status, "accepted");
    if (turn.status !== "accepted")
      throw new Error("Expected fixture help acceptance.");
    beforeHelp = await get(session.id, one.cookie, "?limit=1");
    assert.ok(
      !JSON.stringify(await get(session.id, one.cookie)).includes(
        examples.help.kind === "help" ? examples.help.text : "unused",
      ),
    );
    await assert.rejects(
      acknowledgeIntervention(one.access, session.id, turn.intervention_id),
      EvidenceError,
    );
    const ack = {
      version: "r7-v1",
      request_id: action.request_id,
      session_id: session.id,
      expected_revision: turn.expected_revision,
      accepted_event_id: turn.accepted_event_id,
      content_id: turn.content.content_id,
    };
    const [racingRead] = await Promise.all([
      readStudentNotebook(one.access, session.id),
      acknowledgeConversation(one.access, session.id, ack),
    ]);
    const displayed = await loadConversation(one.access, session.id);
    assert.equal(
      displayed.dialogue.state.revision,
      delivery.dialogue.state.revision,
    );
    const stale = await request(
      path(session.id, `?cursor=${beforeHelp.paging.next_cursor}`),
      one.cookie,
    );
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).code, "SNAPSHOT_CHANGED");
    const afterHelp = await get(session.id, one.cookie);
    assert.ok(
      [beforeHelp.snapshot.id, afterHelp.snapshot.id].includes(
        racingRead.snapshot.id,
      ),
      "A concurrent read must be one complete pre- or post-acknowledgment snapshot.",
    );
    assert.ok(
      afterHelp.pages[1].events.some((e) => e.kind === "help_displayed"),
    );
    assert.deepEqual(
      afterHelp.pages[0].submission?.assistance_at_submission,
      beforeHelp.pages[0].submission?.assistance_at_submission,
    );
    await submitAnswer(one.access, session.id, {
      attempt_id: second.id,
      submission_key: randomUUID(),
      response_text: exact,
    });
    const duplicate = await get(session.id, one.cookie);
    assert.equal(
      duplicate.pages[0].submission?.response_text,
      duplicate.pages[1].submission?.response_text,
    );
    assert.notEqual(
      duplicate.pages[0].submission?.answer_id,
      duplicate.pages[1].submission?.answer_id,
    );
    assert.ok(
      duplicate.pages[1].submission?.assistance_at_submission.intervention_ids.includes(
        turn.intervention_id,
      ),
    );
    check(
      "D1-01/03/04/05/06/11/12: persisted pending/help lifecycle, acknowledgment ownership, duplicate answers, frozen assistance and stale HTTP cursor without R7 revision change.",
    );

    const lateAid = await recordIntervention(one.access, session.id, {
      id: randomUUID(),
      related_attempt_id: first.id,
      related_evaluation_id: accepted.id,
      type: "corrective_feedback",
      text_shown: "Saved corrective feedback",
      concept_ids: question.concept_ids,
      source_passage_ids: question.source_passage_ids,
      content_ref: question.content_ref,
    });
    await acknowledgeIntervention(one.access, session.id, lateAid.id);
    const late = await get(session.id, one.cookie);
    assert.equal(
      late.pages[0].events.find((e) => e.kind === "help_displayed")?.aid
        .counted_at_submission,
      false,
    );
    assert.ok("source_kind" in content.content_ref);
    const sourcePassages = [...content.passages.values()].map((p) => ({
      passage_id: p.id,
      text: p.text,
    }));
    const sourceTwo = await createSourceVersion(teacher.access, {
      request_id: randomUUID(),
      document_id: content.content_ref.source_id,
      expected_latest_version: 1,
      original_bytes: new TextEncoder().encode(
        sourcePassages.map((p) => p.text).join("\n\n"),
      ),
      file_name: "synthetic-notebook-source-two.txt",
      mime_type: "text/plain",
      attribution: content.attribution,
      extraction: sourcePassages,
      passages: sourcePassages,
      review_status: "approved",
      permitted_use: true,
    });
    const oldDraft = await readLessonDraft(
      teacher.access,
      content.content_ref.package_id,
    );
    const replacement = serializeLessonContent(content);
    replacement.content_ref = {
      ...sourceTwo.source_ref,
      package_id: oldDraft.id,
      content_version: "2",
    };
    replacement.questions = replacement.questions.map((q) => ({
      ...q,
      content_ref: replacement.content_ref,
    }));
    replacement.passages = replacement.passages.map((p) => ({
      ...p,
      source_version: 2,
    }));
    const changed = await saveLessonDraft(teacher.access, {
      lesson_id: oldDraft.id,
      expected_revision: oldDraft.revision,
      title: oldDraft.title,
      draft: replacement,
    });
    await approveLessonDraft(teacher.access, changed.id, changed.revision);
    await publishLessonVersion(teacher.access, changed.id, changed.revision);
    assert.equal(
      (await get(session.id, one.cookie)).snapshot.id,
      late.snapshot.id,
    );
    check(
      "D1-13: publishing source and lesson version two leaves the earlier assignment's version-one chronology unchanged.",
    );

    // An authored synthetic teacher draft uses the real approval/delivery/follow-up services.
    const curated = loadApprovedContent();
    const original = await readAssignmentEvidence(
      teacher.access,
      DEMO_IDS.assignmentId,
      "synthetic_fixture",
    );
    const reviewEvidence = buildInterventionEvidence(original, curated, {
      assignment_id: DEMO_IDS.assignmentId,
      concept_id: legacy.pages[0].question.concept_ids[0],
      attempt_ids: [DEMO_IDS.supportedRoot],
      origin: "synthetic_fixture",
    });
    const observation = reviewEvidence.observations.find(
      (o) => o.attempt.id === DEMO_IDS.supportedRoot,
    )!;
    assert.ok(observation);
    const now = new Date().toISOString();
    const reviewQuestion = (prompt: string) => ({
      ...getCuratedQuestion(curated, "NP-TX-01"),
      origin: "generated",
      question_id: randomUUID(),
      sequence_id: null,
      prompt_text: prompt,
      concept_ids: [reviewEvidence.concept.id],
      source_passage_ids: reviewEvidence.sources.map(
        (source) => source.passage_id,
      ),
      embedded_scaffolding: [],
      generation: {
        model: "authored-synthetic-fixture",
        prompt_template_version: "notebook-test",
        generated_at: now,
      },
    });
    const draft = InterventionDraftSchema.parse({
      id: randomUUID(),
      assignment_id: DEMO_IDS.assignmentId,
      revision: 1,
      status: "private_draft",
      created_at: now,
      updated_at: now,
      evidence: reviewEvidence,
      provenance: {
        model: "authored-synthetic-fixture",
        response_id: randomUUID(),
        prompt_template_version: "teacher-intervention-v4",
        generated_at: now,
        usage: null,
      },
      activity: {
        title: "Synthetic assigned review",
        learning_objective: reviewEvidence.concept.objectives[0],
        strategy: "self_explanation",
        rationale: "PRIVATE_TEACHER_REASON",
        explanation: "DISPLAYED_REVIEW_ONLY",
        exercise_text: "Compare the transmission and propagation delays.",
        practice_questions: [
          reviewQuestion("Explain how bandwidth affects transmission delay."),
        ],
        fresh_check: reviewQuestion(
          "Explain why a larger message takes longer to transmit at the same bandwidth.",
        ),
        source_references: reviewEvidence.sources.slice(0, 1).map((s) => ({
          passage_id: s.passage_id,
          quote: s.text.slice(0, 2500),
        })),
        evidence_references: [
          {
            attempt_id: observation.attempt.id,
            evaluation_id: observation.evaluation.id,
            response_quote: observation.attempt.response_text,
            role: observation.role,
          },
        ],
        suggested_recipients: [],
        uncertainty: "PRIVATE_TEACHER_UNCERTAINTY",
      },
    });
    await db.query(
      "INSERT INTO teacher_intervention_drafts(id,teacher_id,assignment_id,revision,snapshot) VALUES($1,$2,$3,1,$4)",
      [draft.id, DEMO_IDS.teacher, DEMO_IDS.assignmentId, draft],
    );
    const approved = await applyInterventionAction(teacher.access, draft.id, {
      action: "approve",
      request_id: randomUUID(),
      expected_revision: 1,
      recipient_ids: [DEMO_IDS.studentOne, DEMO_IDS.studentTwo],
    });
    assert.ok(approved.approval);
    const approvalId = approved.approval.id;
    await applyInterventionAction(teacher.access, draft.id, {
      action: "deliver",
      request_id: randomUUID(),
      expected_revision: approved.draft.revision,
      approval_id: approvalId,
    });
    const reviewOnly = await get(DEMO_IDS.supportedSession, one.cookie);
    const ownReview = reviewOnly.pages[0].teacher_reviews.find(
      (review) => review.approval_id === approvalId,
    );
    assert.ok(ownReview);
    assert.equal(ownReview.followup, null);
    assert.equal(ownReview.displayed_at, null);
    assert.ok(!JSON.stringify(reviewOnly).includes("DISPLAYED_REVIEW_ONLY"));
    assert.ok(
      !(await get(DEMO_IDS.correctSession, two.cookie)).pages.some(
        (p) => p.teacher_reviews.length,
      ),
    );
    const notStarted = await readStudentInterventionFollowup(
      one.access,
      approvalId,
    );
    assert.equal(notStarted.started_at, null);
    await markStudentInterventionDisplayed(one.access, approvalId);
    await applyStudentInterventionFollowup(one.access, approvalId, {
      action: "start",
    });
    const links = await db.query(
      "SELECT session_id FROM teacher_intervention_followups WHERE approval_id=$1 AND student_id=$2",
      [approvalId, DEMO_IDS.studentOne],
    );
    const followupId = z.uuid().parse(links.rows[0].session_id);
    const followup = await get(followupId, one.cookie);
    assert.equal(followup.session.kind, "teacher_intervention_followup");
    assert.equal(followup.pages[0].submission, null);
    assert.equal(followup.pages[0].assessment.status, "not_submitted");
    assert.equal(followup.pages[0].events[0].kind, "help_displayed");
    assert.equal((await request(path(followupId), two.cookie)).status, 404);
    assert.ok(!JSON.stringify(followup).includes("PRIVATE_TEACHER"));
    check(
      "D1-15/16: approved own-evidence links, recipient isolation, delivery without completion, read without start, prior display before fresh check.",
    );

    const stable = await fingerprint();
    const sessions = [];
    for (const id of [DEMO_IDS.supportedSession, session.id, followupId]) {
      const view = await get(id, one.cookie);
      sessions.push({ id, snapshot: view.snapshot.id, student: "one" });
    }
    assert.equal(await fingerprint(), stable);
    await writeFile(
      statePath,
      JSON.stringify(State.parse({ sessions, fingerprint: stable }), null, 2),
    );
    check(
      "D1-17/18: all owned evidence tables unchanged by repeated HTTP reads; persistence state recorded; zero model calls.",
    );
  }
} finally {
  await db.end();
}
