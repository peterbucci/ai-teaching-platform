import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { EvidenceError, evidenceAccess } from "../lib/evidence/store.ts";
import { readAssignmentEvidence } from "../lib/teacher/store.ts";
import { buildInterventionEvidence } from "../lib/interventions/evidence.ts";
import { validateInterventionActivity } from "../lib/interventions/generate.ts";
import type {
  InterventionEvidence,
  ModelIntervention,
} from "../lib/interventions/contracts.ts";
import type { InterventionGenerationRequest } from "../lib/interventions/drafts.ts";
import {
  generateInterventionDraft,
  readInterventionDraft,
  readInterventionDrafts,
  readInterventionRequest,
} from "../lib/interventions/store.ts";

// Service/database integration only: actor identities are fictional fixture IDs.
// Authentication and browser behavior require separate HTTP/UI verification.
// The default run makes zero paid calls. --live explicitly adds ONE model call;
// --live-only checks recorded evidence and makes one call without fixture runs.
const args = process.argv.slice(2);
assert.ok(
  args.every((arg) => arg === "--live" || arg === "--live-only"),
  "Usage: interventions:check -- [--live | --live-only]",
);
assert.ok(args.length <= 1, "Choose one live option, at most once.");
const liveOnly = args.includes("--live-only");
const live = liveOnly || args.includes("--live");
const teacher = evidenceAccess({
  profileId: DEMO_IDS.teacher,
  userId: "fictional-service-test-teacher",
});
const student = evidenceAccess({
  profileId: DEMO_IDS.studentOne,
  userId: "fictional-service-test-student",
});
const foreignTeacherId = randomUUID();
const foreignClassId = randomUUID();
const otherTeacher = evidenceAccess({
  profileId: foreignTeacherId,
  userId: "fictional-service-test-other-teacher",
});
const selection = {
  assignment_id: DEMO_IDS.assignmentId,
  concept_id: "transmission_delay",
  misconception_id: null,
  attempt_ids: [DEMO_IDS.supportedRoot, DEMO_IDS.correctRoot],
  origin: "synthetic_fixture" as const,
};
type Provider = NonNullable<Parameters<typeof generateInterventionDraft>[2]>;
const checks: string[] = [];
let providerCalls = 0;
let foreignProfileCreated = false;
let foreignClassCreated = false;
let fixtureDraftId: string | null = null;

function operation(
  draftId: string = randomUUID(),
  expectedRevision = 0,
): InterventionGenerationRequest {
  return {
    request_id: randomUUID(),
    draft_id: draftId,
    expected_revision: expectedRevision,
    selection,
    revision_instructions: "",
  };
}

/** Deliberately authored fixture output, never presented as real AI generation. */
function fixtureActivity(bundle: InterventionEvidence): ModelIntervention {
  const source =
    bundle.sources.find((row) => row.passage_id === "P07") ?? bundle.sources[0];
  const excerpt = source.text.slice(0, Math.min(1800, source.text.length));
  const examples = (["supporting", "contradictory"] as const)
    .map((role) => bundle.observations.find((row) => row.role === role))
    .filter((row) => row !== undefined);
  assert.equal(
    examples.length,
    2,
    "Seed the fictional supporting and correct histories before running this check.",
  );
  const supporting = examples.find((row) => row.role === "supporting")!;
  const guidance = {
    concept_ids: [bundle.concept.id],
    source_passage_ids: [source.passage_id],
    answer_guidance: excerpt,
    criteria: [excerpt.slice(0, 120)],
  };
  return {
    content_ref: bundle.content_ref,
    title: "Investigating what changes transmission delay",
    learning_objective: bundle.concept.objectives[0],
    strategy: "predict_then_explain",
    exercise_text:
      "Sketch a packet being placed onto a link. Annotate which parts of the transfer depend on packet size, link bandwidth, and physical distance. Explain the distinction in your own words.",
    source_references: [{ passage_id: source.passage_id, quote: excerpt }],
    practice_questions: [
      {
        ...guidance,
        prompt_text:
          "A sender replaces a short message with a longer message on the same link. Predict how the time needed to transmit the message changes, and explain what role bandwidth plays.",
      },
    ],
    fresh_check: {
      ...guidance,
      prompt_text:
        "Compare sending an identical packet on a long high bandwidth link and a short low bandwidth link. Which link needs more time to put the packet onto the link? Explain what information determines this transmission delay.",
    },
    evidence_references: examples.map((row) => ({
      evidence_id: row.evidence_id,
      response_quote: row.attempt.response_text!.slice(0, 200),
      role: row.role,
    })),
    suggested_recipients: [
      {
        pseudonym: supporting.pseudonym,
        evidence_ids: [supporting.evidence_id],
      },
    ],
  };
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    release = resolvePromise;
  });
  return { promise, release };
}

async function rejected(operationPromise: Promise<unknown>, status: number) {
  await assert.rejects(
    operationPromise,
    (error: unknown) =>
      error instanceof EvidenceError && error.status === status,
  );
}

try {
  const original = await readAssignmentEvidence(
    teacher,
    selection.assignment_id,
    selection.origin,
  );
  const bundle = buildInterventionEvidence(
    original,
    loadApprovedContent(),
    selection,
  );
  assert.ok(
    bundle.observations.every((row) => row.data_origin === "synthetic_fixture"),
  );
  assert.equal(
    bundle.counts.selected_students,
    new Set(bundle.observations.map((row) => row.student_id)).size,
  );
  assert.equal(bundle.counts.selected_responses, bundle.observations.length);
  assert.ok(
    bundle.observations.some(
      (row) =>
        row.attempt.assistance?.independent_retrieval_eligible_by_concept[
          selection.concept_id
        ],
    ),
  );
  assert.ok(
    bundle.observations.some(
      (row) =>
        !row.attempt.assistance?.independent_retrieval_eligible_by_concept[
          selection.concept_id
        ],
    ),
  );
  for (const role of ["supporting", "contradictory"] as const)
    assert.ok(bundle.observations.some((row) => row.role === role));
  checks.push(
    "recorded fictional evidence includes supporting, contrary, independent and assisted examples with distinct-student counts",
  );

  if (!liveOnly) {
    const fixture = fixtureActivity(bundle);
    validateInterventionActivity(fixture, bundle, {
      model: "synthetic-integration-provider",
      generated_at: new Date().toISOString(),
    });
    const valid: Provider = async () => {
      providerCalls += 1;
      return {
        ok: true,
        result: structuredClone(fixture),
        model: "synthetic-integration-provider",
        responseId: `synthetic-${randomUUID()}`,
        latencyMs: 0,
        usage: null,
      };
    };
    await getPool().query(
      "INSERT INTO profiles(id,display_name) VALUES($1,$2)",
      [foreignTeacherId, "Fictional isolation-check teacher"],
    );
    foreignProfileCreated = true;
    await getPool().query(
      "INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)",
      [foreignClassId, foreignTeacherId, "Fictional isolation-check class"],
    );
    foreignClassCreated = true;
    for (const access of [student, otherTeacher]) {
      await rejected(
        generateInterventionDraft(access, operation(), valid),
        404,
      );
      await rejected(
        readInterventionDrafts(access, selection.assignment_id),
        404,
      );
    }
    assert.equal(providerCalls, 0);
    checks.push(
      "student and different class teacher are denied before any provider call",
    );

    const initialRequest = operation();
    const entered = deferred();
    const released = deferred();
    const first = generateInterventionDraft(
      teacher,
      initialRequest,
      async (input) => {
        entered.release();
        await released.promise;
        return valid(input);
      },
    );
    await Promise.race([
      entered.promise,
      first.then(() => {
        throw new Error(
          "Generation ended before reaching the injected provider.",
        );
      }),
    ]);
    try {
      const replayWhilePending = await generateInterventionDraft(
        teacher,
        initialRequest,
        valid,
      );
      assert.equal(replayWhilePending.status, "pending");
      const persistedPending = await readInterventionRequest(
        teacher,
        selection.assignment_id,
        initialRequest.request_id,
      );
      assert.equal(persistedPending.status, "pending");
      await rejected(
        generateInterventionDraft(teacher, operation(), valid),
        409,
      );
    } finally {
      released.release();
    }
    const completed = await first;
    assert.equal(completed.status, "completed");
    assert.ok(completed.draft);
    const firstDraft = completed.draft;
    assert.equal(firstDraft.revision, 1);
    assert.equal(providerCalls, 1);
    assert.deepEqual(
      await generateInterventionDraft(teacher, initialRequest, valid),
      completed,
    );
    assert.deepEqual(
      await readInterventionDraft(teacher, firstDraft.id),
      firstDraft,
    );
    assert.ok(
      (await readInterventionDrafts(teacher, selection.assignment_id)).some(
        (draft) => draft.id === firstDraft.id,
      ),
    );
    for (const access of [student, otherTeacher]) {
      await rejected(readInterventionDraft(access, firstDraft.id), 404);
      await rejected(
        readInterventionRequest(
          access,
          selection.assignment_id,
          initialRequest.request_id,
        ),
        404,
      );
    }
    checks.push(
      "concurrent duplicate and completed replay execute once; one pending teacher request; saved draft is inspectable only by its owner",
    );

    await rejected(
      generateInterventionDraft(
        teacher,
        {
          ...initialRequest,
          revision_instructions:
            "Changed payload under a reused request identity",
        },
        valid,
      ),
      409,
    );
    await rejected(
      generateInterventionDraft(teacher, operation(firstDraft.id, 0), valid),
      409,
    );
    assert.equal(providerCalls, 1);
    checks.push(
      "changed request payload and stale revision reject before provider invocation",
    );

    const invalidRequest = operation(firstDraft.id, firstDraft.revision);
    const invalid = await generateInterventionDraft(
      teacher,
      invalidRequest,
      async (input) => {
        const outcome = await valid(input);
        return {
          ...outcome,
          result: {
            ...fixture,
            source_references: [
              {
                passage_id: "UNAUTHORIZED",
                quote: "This quotation has no approved source support.",
              },
            ],
          },
        };
      },
    );
    assert.equal(invalid.status, "failed");
    assert.deepEqual(invalid.draft, firstDraft);
    assert.deepEqual(
      await readInterventionDraft(teacher, firstDraft.id),
      firstDraft,
    );
    assert.deepEqual(
      await generateInterventionDraft(teacher, invalidRequest, valid),
      invalid,
    );
    assert.equal(providerCalls, 2);
    checks.push(
      "invalid source generation is rejected, replays without another call and preserves the previous valid draft",
    );

    const failedRequest = operation(firstDraft.id, firstDraft.revision);
    const failed = await generateInterventionDraft(
      teacher,
      failedRequest,
      async () => {
        providerCalls += 1;
        return {
          ok: false,
          code: "timeout",
          message: "Synthetic timeout; no real provider request was made.",
          model: "synthetic-integration-provider",
          latencyMs: 0,
        };
      },
    );
    assert.equal(failed.status, "failed");
    assert.deepEqual(failed.draft, firstDraft);
    assert.deepEqual(
      await generateInterventionDraft(teacher, failedRequest, valid),
      failed,
    );
    assert.equal(providerCalls, 3);
    checks.push(
      "provider uncertainty retains prior draft and never automatically reissues the same request",
    );

    const revisionRequest = operation(firstDraft.id, firstDraft.revision);
    revisionRequest.revision_instructions =
      "Ask for the learner's own explanation before the fresh check.";
    const revised = await generateInterventionDraft(
      teacher,
      revisionRequest,
      valid,
    );
    assert.equal(revised.status, "completed");
    assert.ok(revised.draft);
    assert.equal(revised.draft.revision, firstDraft.revision + 1);
    assert.deepEqual(
      await generateInterventionDraft(teacher, initialRequest, valid),
      completed,
    );
    assert.deepEqual(
      await readInterventionDraft(teacher, firstDraft.id),
      revised.draft,
    );
    assert.equal(providerCalls, 4);
    checks.push(
      "a successful revision advances once while earlier completed requests retain their immutable result",
    );

    // Emulate a future #45 teacher edit while a proposal is outstanding. This
    // changes only this check's private draft, never an assignment or evidence.
    const lateRequest = operation(firstDraft.id, revised.draft.revision);
    const lateEntered = deferred();
    const lateRelease = deferred();
    const late = generateInterventionDraft(
      teacher,
      lateRequest,
      async (input) => {
        lateEntered.release();
        await lateRelease.promise;
        return valid(input);
      },
    );
    await Promise.race([
      lateEntered.promise,
      late.then(() => {
        throw new Error(
          "Late-generation check did not reach its injected provider.",
        );
      }),
    ]);
    const teacherEdit = {
      ...revised.draft,
      revision: revised.draft.revision + 1,
      updated_at: new Date().toISOString(),
      activity: {
        ...revised.draft.activity,
        title: "Fictional teacher edit saved during generation",
      },
    };
    try {
      await getPool().query(
        "UPDATE teacher_intervention_drafts SET revision=$2,snapshot=$3,updated_at=clock_timestamp() WHERE id=$1 AND revision=$4",
        [
          firstDraft.id,
          teacherEdit.revision,
          teacherEdit,
          revised.draft.revision,
        ],
      );
    } finally {
      lateRelease.release();
    }
    const staleCompletion = await late;
    assert.equal(staleCompletion.status, "failed");
    assert.deepEqual(
      await readInterventionDraft(teacher, firstDraft.id),
      teacherEdit,
    );
    assert.equal(providerCalls, 5);
    checks.push(
      "a late model result cannot overwrite a newer teacher draft revision",
    );
    fixtureDraftId = firstDraft.id;
  }

  assert.deepEqual(
    await readAssignmentEvidence(
      teacher,
      selection.assignment_id,
      selection.origin,
    ),
    original,
  );
  checks.push(
    "original responses, accepted evaluations, assistance, sources and class metrics remain unchanged",
  );

  if (live) {
    const liveRequest = operation();
    liveRequest.revision_instructions =
      "Prepare a useful qualitative review of the observed relationship between distance and transmission delay; preserve the counterevidence and distinguish assisted follow-up from independent understanding.";
    const startedAt = new Date().toISOString();
    const actual = await generateInterventionDraft(teacher, liveRequest);
    const saved = actual.draft
      ? await readInterventionDraft(teacher, actual.draft.id)
      : null;
    const report = {
      issue: 44,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      verification:
        "service/database integration with one actual model-generation request; authentication/browser checked separately",
      evidence_origin:
        "recorded fictional synthetic_fixture responses and authored accepted evaluations, not real classroom data",
      actual_model_requests_requested: 1,
      synthetic_generation_scenarios: liveOnly ? "skipped" : "executed",
      deterministic_checks: checks,
      deterministic_provider_calls: providerCalls,
      request: liveRequest,
      result: {
        status: actual.status,
        request_id: actual.request_id,
        ...(actual.error ? { error: actual.error } : {}),
        draft: actual.draft
          ? {
              id: actual.draft.id,
              assignment_id: actual.draft.assignment_id,
              revision: actual.draft.revision,
              status: actual.draft.status,
              activity: actual.draft.activity,
              provenance: actual.draft.provenance,
              created_at: actual.draft.created_at,
              updated_at: actual.draft.updated_at,
            }
          : null,
      },
      // The database retains the full immutable evidence. This review artifact
      // omits unrelated class metrics and duplicated original private rubrics.
      evidence: actual.draft
        ? {
            selection: actual.draft.evidence.selection,
            content_ref: actual.draft.evidence.content_ref,
            counts: actual.draft.evidence.counts,
            sources: actual.draft.evidence.sources,
            observations: actual.draft.evidence.observations.map((row) => ({
              evidence_id: row.evidence_id,
              student_id: row.student_id,
              session_id: row.session_id,
              attempt_id: row.attempt.id,
              evaluation_id: row.evaluation.id,
              original_question: row.attempt.question.prompt_text,
              original_question_concepts: row.attempt.question.concept_ids,
              original_question_sources:
                row.attempt.question.source_passage_ids,
              original_response: row.attempt.response_text,
              accepted_per_concept_judgments:
                row.evaluation.result?.per_concept_results,
              reasoning: row.evaluation.result?.reasoning_observed,
              uncertainty: row.evaluation.result?.uncertainty_reason,
              assistance: row.attempt.assistance,
              intent: row.attempt.intent,
              role: row.role,
              origin: row.data_origin,
            })),
          }
        : null,
      saved_draft_matches:
        saved !== null &&
        JSON.stringify(saved) === JSON.stringify(actual.draft),
      educational_review: {
        status: "pending_manual_review",
        notes:
          "A valid schema and exact references do not establish educational usefulness. Inspect the saved original responses, source excerpts, activity, fresh check and private guidance.",
      },
    };
    const output = resolve(
      process.env.CHECK_INTERVENTION_REPORT ??
        "evals/results/intervention-draft-live.json",
    );
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    assert.equal(
      actual.status,
      "completed",
      actual.error ??
        "The actual model request did not produce a saved draft; inspect the report before any explicit retry.",
    );
    assert.deepEqual(saved, actual.draft);
    assert.deepEqual(
      await readAssignmentEvidence(
        teacher,
        selection.assignment_id,
        selection.origin,
      ),
      original,
    );
    console.log(
      JSON.stringify({
        status: "passed",
        mode: "actual-model-service-check",
        report: output,
        draft_id: actual.draft!.id,
        model: actual.draft!.provenance.model,
        manual_review: "pending",
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        status: "passed",
        mode: "injected-provider-service-check",
        checks,
        fixture_provider_calls: providerCalls,
        paid_requests: 0,
        saved_draft_id: fixtureDraftId,
      }),
    );
  }
} finally {
  try {
    if (foreignClassCreated)
      await getPool().query(
        "DELETE FROM classes WHERE id=$1 AND teacher_id=$2",
        [foreignClassId, foreignTeacherId],
      );
    if (foreignProfileCreated)
      await getPool().query("DELETE FROM profiles WHERE id=$1", [
        foreignTeacherId,
      ]);
  } finally {
    await getPool().end();
  }
}
