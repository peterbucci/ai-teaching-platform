// Explicit, zero-provider-call setup for the isolated Roster browser suite.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { evidenceAccess, startSession } from "../lib/evidence/store.ts";
import { readAssignmentEvidence } from "../lib/teacher/store.ts";
import { buildInterventionEvidence } from "../lib/interventions/evidence.ts";
import { generateInterventionDraft } from "../lib/interventions/store.ts";
import { applyInterventionAction } from "../lib/interventions/approval.ts";
import { applyStudentInterventionFollowup } from "../lib/interventions/outcomes.ts";
import {
  approveAssignment,
  assignmentReview,
} from "../lib/assignments/store.ts";
import type { ModelIntervention } from "../lib/interventions/contracts.ts";

assert.equal(process.env.PGDATABASE, "roster_test");
assert.equal(process.env.PGHOST, "127.0.0.1");
assert.ok(
  !process.env.OPENAI_API_KEY,
  "No paid provider configuration permitted",
);
const db = getPool();
try {
  const identity = await db.query<{ id: string; auth_user_id: string }>(
    "SELECT id,auth_user_id FROM profiles WHERE id=ANY($1::uuid[])",
    [[DEMO_IDS.teacher, DEMO_IDS.studentOne]],
  );
  const actor = (id: string) => {
    const row = identity.rows.find((r) => r.id === id)!;
    return evidenceAccess({ profileId: row.id, userId: row.auth_user_id });
  };
  const teacher = actor(DEMO_IDS.teacher),
    student = actor(DEMO_IDS.studentOne);
  const approval = await assignmentReview(teacher, DEMO_IDS.assignmentId);
  await approveAssignment(
    teacher,
    DEMO_IDS.assignmentId,
    approval.review_token,
  );
  const selection = {
    assignment_id: DEMO_IDS.assignmentId,
    concept_id: "transmission_delay",
    misconception_id: null,
    attempt_ids: [DEMO_IDS.supportedRoot, DEMO_IDS.correctRoot],
    origin: "synthetic_fixture" as const,
  };
  const bundle = buildInterventionEvidence(
    await readAssignmentEvidence(
      teacher,
      DEMO_IDS.assignmentId,
      "synthetic_fixture",
    ),
    loadApprovedContent(),
    selection,
  );
  const source =
    bundle.sources.find((s) => s.passage_id === "P07") ?? bundle.sources[0];
  const excerpt = source.text.slice(0, 1800);
  const examples = bundle.observations.filter((o) => o.role !== "context");
  const supporting = examples.find((o) => o.role === "supporting")!;
  const guidance = {
    concept_ids: [bundle.concept.id],
    source_passage_ids: [source.passage_id],
    answer_guidance: excerpt,
    criteria: [excerpt.slice(0, 120)],
  };
  const model: ModelIntervention = {
    content_ref: bundle.content_ref,
    title: "Fictional review: transmission and distance",
    learning_objective: bundle.concept.objectives[0],
    strategy: "predict_then_explain",
    exercise_text:
      "Sketch a packet being placed onto a link. Explain separately how size, bandwidth and distance affect the observed delays.",
    source_references: [{ passage_id: source.passage_id, quote: excerpt }],
    practice_questions: [
      {
        ...guidance,
        prompt_text:
          "A sender replaces a short message with a longer message on the same link. Predict how transmission time changes and explain the role of bandwidth.",
      },
    ],
    fresh_check: {
      ...guidance,
      prompt_text:
        "Compare sending the same packet on a long high bandwidth link and a short low bandwidth link. Which takes longer to put the packet on the link, and why?",
    },
    evidence_references: examples.map((o) => ({
      evidence_id: o.evidence_id,
      response_quote: o.attempt.response_text!.slice(0, 200),
      role: o.role,
    })),
    suggested_recipients: [
      {
        pseudonym: supporting.pseudonym,
        evidence_ids: [supporting.evidence_id],
      },
    ],
  };
  for (const status of ["private", "approved", "delivered"] as const) {
    const generated = await generateInterventionDraft(
      teacher,
      {
        request_id: randomUUID(),
        draft_id: randomUUID(),
        expected_revision: 0,
        selection,
      },
      async () => ({
        ok: true,
        result: {
          ...model,
          title: `Fictional ${status} review: transmission and distance`,
        },
        model: "authored-roster-fixture",
        responseId: randomUUID(),
        latencyMs: 0,
        usage: null,
      }),
    );
    assert.equal(generated.status, "completed", JSON.stringify(generated));
    const draft = generated.draft!;
    if (status === "private") continue;
    const approved = await applyInterventionAction(teacher, draft.id, {
      action: "approve",
      request_id: randomUUID(),
      expected_revision: draft.revision,
      recipient_ids: [DEMO_IDS.studentOne],
    });
    if (status === "delivered") {
      await applyInterventionAction(teacher, draft.id, {
        action: "deliver",
        request_id: randomUUID(),
        expected_revision: approved.draft.revision,
        approval_id: approved.approval!.id,
      });
      await applyStudentInterventionFollowup(student, approved.approval!.id, {
        action: "start",
      });
    }
  }
  await startSession(student, DEMO_IDS.assignmentId, "synthetic_fixture");
  console.log(
    "Three authored intervention fixtures, linked follow-up and newer empty session ready. Zero model calls.",
  );
} finally {
  await db.end();
}
