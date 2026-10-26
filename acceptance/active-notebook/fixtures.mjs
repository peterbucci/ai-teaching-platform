/** Operator-only S1 fictional fixtures. No provider client and no production route. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getPool } from "../../lib/db.ts";
import { DEMO_IDS } from "../../lib/evidence/demo.ts";
import {
  evidenceAccess,
  startSession,
  presentQuestion,
  submitAnswer,
  recordEvaluation,
} from "../../lib/evidence/store.ts";
import {
  loadApprovedContent,
  getCuratedQuestion,
} from "../../lib/evidence/content.ts";
import {
  loadConversation,
  reserveConversationOperation,
  commitConversationIntent,
  commitConversationHelp,
} from "../../lib/dialogue/store.ts";
import { makeDialogueExamples } from "../../lib/dialogue/examples.ts";
import { CONVERSATION_VERSION } from "../../lib/dialogue/conversation.ts";
import { applyTutoring } from "../../lib/tutoring/store.ts";
import { createApprovedRuntimeLesson } from "../../scripts/fixtures/approved-r7-lesson.ts";
export function assertIsolated() {
  const manifest = JSON.parse(
    readFileSync(
      path.join(process.cwd(), ".setup/runtime/manifest.json"),
      "utf8",
    ),
  );
  assert.equal(manifest.project, "lp-notebook-s1-01a17497");
  assert.equal(
    path.resolve(manifest.root).toLowerCase(),
    process.cwd().toLowerCase(),
  );
  for (const [key, value] of Object.entries({
    PGHOST: "127.0.0.1",
    PGPORT: "5927",
    PGDATABASE: "active_notebook_s1_01a17497",
    AUTH_URL: "http://127.0.0.1:3427",
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "",
  }))
    assert.equal(process.env[key], value, key);
  assert.equal(process.env.DATABASE_URL, undefined);
  assert.equal(manifest.modelProvidersDisabled, true);
  return manifest;
}
assertIsolated();
export const pool = getPool(),
  base = process.env.AUTH_URL;
export const content = loadApprovedContent();
export async function actor(id = DEMO_IDS.studentOne) {
  const row = (
    await pool.query(
      "SELECT p.id,p.auth_user_id,u.email FROM profiles p JOIN auth_user u ON u.id=p.auth_user_id WHERE p.id=$1",
      [id],
    )
  ).rows[0];
  assert.match(
    row.email,
    /^acceptance-active-notebook-[a-z]+@example\.invalid$/,
  );
  return evidenceAccess({ profileId: row.id, userId: row.auth_user_id });
}
let approvedRuntime;
export async function fresh({ runtime = false } = {}) {
  if (runtime && !approvedRuntime)
    approvedRuntime = await createApprovedRuntimeLesson(
      await actor(DEMO_IDS.teacher),
      DEMO_IDS.classId,
    );
  const lesson = runtime
    ? approvedRuntime
    : { assignmentId: DEMO_IDS.assignmentId, content };
  const access = await actor(),
    session = await startSession(access, lesson.assignmentId, "live_demo");
  const attempt = await presentQuestion(access, session.id, {
    question: getCuratedQuestion(lesson.content, "NP-TX-01"),
    intent: "initial_retrieval",
  });
  return {
    access,
    content: lesson.content,
    assignmentId: lesson.assignmentId,
    sessionId: session.id,
    attemptId: attempt.id,
    attempt,
    url: `/study/assignments/${lesson.assignmentId}?tab=study&session=${session.id}`,
  };
}

export async function help(fixture, { long = false } = {}) {
  const view = await loadConversation(fixture.access, fixture.sessionId);
  const action = {
    version: CONVERSATION_VERSION,
    action: "send_message",
    request_id: randomUUID(),
    session_id: fixture.sessionId,
    attempt_id: fixture.attemptId,
    expected_revision: view.dialogue.state.revision,
    text: long
      ? "I’m having trouble separating transmission from propagation. Please explain the distinction without giving away the answer."
      : "What does packet size mean here?",
  };
  await reserveConversationOperation(fixture.access, action);
  await commitConversationIntent(
    fixture.access,
    fixture.sessionId,
    action.request_id,
    {
      category: "QUESTION_OR_HELP",
      rationale: "Authored synthetic help-intent fixture.",
    },
    { answer_intent: "uncertain", disclosure: "safe" },
  );
  const examples = makeDialogueExamples(fixture.content);
  const text = long
    ? [
        "It can help to separate sending the bits from the bits travelling along the link. Think first about the sender: it places one bit after another onto the link. Which quantities in the reading describe that process?",
        "Then think about a bit that has already left the sender. It still has to travel to the other end. The reading describes this as a different part of the total delay. Look at the distance involved and how the signal moves through the medium.",
        "Try describing those two intervals in your own words before deciding what changes in the question. You do not need to calculate a number yet. State which quantities belong to each interval, then check your explanation against passages P07 and P08.",
      ].join("\n\n")
    : examples.help.text;
  const generated = {
    ...examples.help,
    text,
    content_id: randomUUID(),
    generation: {
      ...examples.help.generation,
      model: "synthetic-s1-operator-fixture",
      generated_at: new Date().toISOString(),
    },
  };
  const accepted = await commitConversationHelp(
    fixture.access,
    fixture.sessionId,
    action.request_id,
    generated,
    examples.review,
  );
  assert.equal(
    accepted.dialogue.turns.find(
      (turn) => turn.request_id === action.request_id,
    )?.response.status,
    "accepted",
    "Authored help must be accepted under its approved lesson policy",
  );
  return {
    ...fixture,
    requestId: action.request_id,
    contentId: generated.content_id,
    text,
    conversation: accepted,
  };
}
export async function feedback(fixture, correctness = "incorrect") {
  await submitAnswer(fixture.access, fixture.sessionId, {
    attempt_id: fixture.attemptId,
    submission_key: randomUUID(),
    response_text: "  Original café 🌱 answer.\nKeep  all spacing.  ",
  });
  const accepted = await recordEvaluation(fixture.access, fixture.sessionId, {
    id: randomUUID(),
    attempt_id: fixture.attemptId,
    validation_status: "accepted",
    evaluator: {
      type: "synthetic_fixture",
      model: null,
      version: "s1-pane-acceptance-v1",
    },
    supersedes_id: null,
    result: {
      per_concept_results: fixture.attempt.question.concept_ids.map(
        (concept_id) => ({
          concept_id,
          correctness,
          error_type:
            correctness === "uncertain"
              ? "insufficient_response"
              : "conceptual",
          rubric_criteria_met: [],
          rubric_criteria_missing: [],
        }),
      ),
      source_passage_ids: fixture.attempt.question.source_passage_ids,
      evidence_quotes: [],
      misconception_candidates: [],
      reasoning_observed:
        "Authored S1 persistence fixture, not model assessment.",
      uncertainty_reason:
        correctness === "uncertain" ? "Authored uncertain fixture." : null,
      proposed_next_action: "GIVE_CORRECTIVE_FEEDBACK",
    },
    applied_result: null,
    failure_reason: null,
  });
  await applyTutoring(fixture.access, fixture.sessionId, accepted.id);
  return { ...fixture, evaluationId: accepted.id };
}
