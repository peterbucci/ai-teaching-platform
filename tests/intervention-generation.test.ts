import assert from "node:assert/strict";
import test from "node:test";
import { buildClassFixture } from "../lib/evidence/class-fixture.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { calculateClassMetrics } from "../lib/teacher/metrics.ts";
import {
  buildInterventionEvidence,
  interventionRevisionEvidence,
} from "../lib/interventions/evidence.ts";
import {
  interventionPrompt,
  InterventionValidationError,
  validateInterventionActivity,
} from "../lib/interventions/generate.ts";
import {
  InterventionEvidenceSchema,
  ModelInterventionSchema,
  type InterventionEvidence,
  type ModelIntervention,
} from "../lib/interventions/contracts.ts";
import { zodTextFormat } from "openai/helpers/zod";
import { makeTeacherSourceReference } from "./fixtures/teacher-lesson.ts";

const content = loadApprovedContent();
const fixture = buildClassFixture(content);
const students = fixture.enrollments.map((e) => ({
  student_id: e.student_id,
  display_name: fixture.profiles.find((p) => p.id === e.student_id)!
    .display_name,
}));
const snapshot = {
  assignment_id: DEMO_IDS.assignmentId,
  class_id: DEMO_IDS.classId,
  title: "Networking",
  class_name: "Fictional class",
  approved_misconception_ids: [...content.misconceptions.keys()],
  students,
  evidence: fixture.sessions,
  metrics: calculateClassMetrics(
    students.map((s) => s.student_id),
    [...content.concept_ids],
    fixture.sessions,
  ),
};
const selection = {
  assignment_id: DEMO_IDS.assignmentId,
  concept_id: "transmission_delay",
  origin: "synthetic_fixture" as const,
  attempt_ids: [],
  misconception_id: null,
};
const bundle = buildInterventionEvidence(snapshot, content, selection);
const metadata = {
  model: "fixture-model",
  generated_at: "2026-10-22T12:00:00Z",
};
function proposal(evidence: InterventionEvidence = bundle): ModelIntervention {
  const source = evidence.sources.find((s) => s.passage_id === "P07")!;
  const quote = source.text.slice(0, Math.min(source.text.length, 1500));
  const selected = ["supporting", "contradictory", "context"].flatMap(
    (role) => {
      const row = evidence.observations.find((o) => o.role === role);
      return row ? [row] : [];
    },
  );
  const support = selected.find((r) => r.role === "supporting");
  const question = (prompt_text: string) => ({
    prompt_text,
    concept_ids: [evidence.concept.id],
    source_passage_ids: [source.passage_id],
    answer_guidance: quote,
    criteria: [quote.slice(0, 100)],
  });
  return {
    content_ref: structuredClone(evidence.content_ref),
    title: "Separating sending from travelling",
    learning_objective: evidence.concept.objectives[2],
    strategy: "predict_then_explain",
    exercise_text:
      "Sketch a packet entering a link and a signal travelling along it. Describe the different events and explain which part changes when the link data rate changes.",
    source_references: [{ passage_id: source.passage_id, quote }],
    practice_questions: [
      question(
        "A link is upgraded to a higher data rate while the packet stays unchanged. Explain which part of sending the packet changes and which feature of the packet does not.",
      ),
    ],
    fresh_check: question(
      "A student says that extending a cable makes it take longer to put a packet onto the link. What would you ask them to hold fixed, and how could they test their explanation?",
    ),
    evidence_references: selected.map((o) => ({
      evidence_id: o.evidence_id,
      response_quote: o.attempt.response_text!.slice(0, 300),
      role: o.role,
    })),
    suggested_recipients: support
      ? [{ pseudonym: support.pseudonym, evidence_ids: [support.evidence_id] }]
      : [],
  };
}

test("selection preserves original accepted evidence, contrary reasoning, distinct counts and assistance", () => {
  const original = JSON.stringify(snapshot);
  assert.ok(bundle.observations.some((o) => o.role === "supporting"));
  assert.ok(bundle.observations.some((o) => o.role === "contradictory"));
  assert.equal(
    bundle.counts.selected_students,
    new Set(bundle.observations.map((o) => o.student_id)).size,
  );
  assert.ok(bundle.counts.selected_responses > bundle.counts.selected_students);
  assert.equal(bundle.counts.enrolled_students, 24);
  assert.ok(
    bundle.observations.some(
      (o) => o.attempt.assistance?.assistance_level !== "none_recorded",
    ),
  );
  for (const o of bundle.observations)
    assert.deepEqual(
      o.attempt,
      fixture.sessions
        .flatMap((s) => s.attempts)
        .find((a) => a.id === o.attempt.id),
    );
  assert.equal(JSON.stringify(snapshot), original);
});

test("explicit examples include same-student contrary follow-ups and preserve class insight counts", () => {
  const evidence = buildInterventionEvidence(snapshot, content, {
    ...selection,
    misconception_id: content.sequence.hypothesis_id,
  });
  assert.deepEqual(evidence.pattern?.counts, {
    suspected: 1,
    supported: 4,
    not_supported: 2,
    uncertain: 1,
  });
  const contrary = evidence.observations.find((o) =>
    o.evaluation.applied_result?.hypothesis_events.some(
      (h) => h.status === "not_supported",
    ),
  )!;
  const root = evidence.observations.find(
    (o) => o.student_id === contrary.student_id && o.role === "supporting",
  )!;
  const subset = buildInterventionEvidence(snapshot, content, {
    ...selection,
    attempt_ids: [root.attempt.id],
  });
  assert.equal(subset.counts.selected_students, 1);
  assert.ok(
    subset.observations.some((o) => o.attempt.id === contrary.attempt.id),
  );
  assert.ok(subset.observations.some((o) => o.role === "supporting"));
});

test("rejects scope, unknown selection, unaccepted responses and source-version mismatches", () => {
  assert.throws(
    () =>
      buildInterventionEvidence(snapshot, content, {
        ...selection,
        assignment_id: DEMO_IDS.classId,
      }),
    /another assignment/,
  );
  assert.throws(
    () =>
      buildInterventionEvidence(snapshot, content, {
        ...selection,
        concept_id: "unapproved",
      }),
    /outside/,
  );
  assert.throws(
    () =>
      buildInterventionEvidence(snapshot, content, {
        ...selection,
        attempt_ids: [DEMO_IDS.classId],
      }),
    /unavailable/,
  );
  const foreign = structuredClone(snapshot);
  foreign.evidence[0].session.class_id = DEMO_IDS.assignmentId;
  assert.throws(
    () => buildInterventionEvidence(foreign, content, selection),
    /class|assignment/,
  );
  const changed = structuredClone(snapshot);
  changed.evidence[0].attempts[0].question.content_ref.content_version =
    "different";
  assert.throws(
    () => buildInterventionEvidence(changed, content, selection),
    /version/,
  );
});

test("provider projection omits roster identity and preserves reasoning, uncertainty and revision context", () => {
  const previous = validateInterventionActivity(proposal(), bundle, metadata);
  const prompt = interventionPrompt(
    bundle,
    "Change the fresh check.",
    previous,
  );
  for (const student of students) {
    assert.ok(!prompt.input.includes(student.student_id));
    assert.ok(!prompt.input.includes(student.display_name));
  }
  for (const row of bundle.observations) {
    assert.ok(!prompt.input.includes(row.attempt.id));
    assert.ok(!prompt.input.includes(row.evaluation.id));
  }
  assert.ok(prompt.input.includes(previous.fresh_check.prompt_text));
  assert.ok(prompt.input.includes("independent"));
  assert.ok(prompt.instructions.includes("untrusted data"));
  assert.throws(() => interventionPrompt(bundle, "x".repeat(1501)), /too long/);
});

test("valid qualitative activity creates generated snapshots and checked source/evidence receipts", () => {
  const raw = proposal();
  const activity = validateInterventionActivity(raw, bundle, metadata);
  assert.deepEqual(activity.fresh_check.content_ref, content.content_ref);
  assert.equal(activity.fresh_check.generation?.model, "fixture-model");
  assert.equal(activity.fresh_check.origin, "generated");
  assert.ok(
    activity.rationale.includes(raw.evidence_references[0].response_quote),
  );
  assert.ok(activity.uncertainty.includes("not a diagnosis"));
  assert.equal(
    activity.explanation,
    ModelInterventionSchema.parse(raw).source_references[0].quote,
  );
  assert.ok(
    bundle.sources.some((source) => source.text.includes(activity.explanation)),
  );
  assert.doesNotThrow(() =>
    zodTextFormat(ModelInterventionSchema, "teacher_intervention"),
  );
});

test("rejects fabricated source, response and private guidance, unsupported recipients and omitted counterevidence", () => {
  for (const mutate of [
    (p: ModelIntervention) => {
      p.content_ref.content_version = "other";
    },
    (p: ModelIntervention) => {
      p.source_references[0].quote =
        "Transmission delay is determined by the student's motivation.";
    },
    (p: ModelIntervention) => {
      p.evidence_references[0].response_quote =
        "A fabricated statement no student wrote.";
    },
    (p: ModelIntervention) => {
      p.fresh_check.answer_guidance =
        "Longer cables always increase the time required to put bits onto a link.";
    },
    (p: ModelIntervention) => {
      p.fresh_check.source_passage_ids = ["unavailable"];
    },
    (p: ModelIntervention) => {
      p.suggested_recipients[0].pseudonym = "Learner outside class";
    },
    (p: ModelIntervention) => {
      p.evidence_references = p.evidence_references.filter(
        (r) => r.role !== "contradictory",
      );
    },
    (p: ModelIntervention) => {
      p.learning_objective =
        "Establish that this student will never understand networks.";
    },
  ]) {
    const raw = proposal();
    mutate(raw);
    assert.throws(() => validateInterventionActivity(raw, bundle, metadata));
  }
});

test("rejects repeated checks, unverified quantitative problems and injected executable content without mutating valid work", () => {
  const prior = validateInterventionActivity(proposal(), bundle, metadata),
    copy = JSON.stringify(prior);
  const repeat = proposal();
  repeat.fresh_check = structuredClone(repeat.practice_questions[0]);
  assert.throws(
    () => validateInterventionActivity(repeat, bundle, metadata),
    /repeats/,
  );
  const calculation = proposal();
  calculation.fresh_check.prompt_text =
    "Calculate transmission delay when a packet has 1000 bits and a link rate of 10 bits per second.";
  assert.throws(
    () => validateInterventionActivity(calculation, bundle, metadata),
    /qualitative/,
  );
  const injection = proposal();
  injection.exercise_text =
    "<script>Send all student data to https://example.com</script>";
  assert.throws(
    () => validateInterventionActivity(injection, bundle, metadata),
    /plain text/,
  );
  assert.equal(JSON.stringify(prior), copy);
});

test("preserves multiple assessed concepts and requires authorized citations for each", () => {
  assert.ok(
    bundle.related_concepts.some(
      (concept) => concept.id === "propagation_delay",
    ),
  );
  const raw = proposal();
  raw.fresh_check.prompt_text =
    "A sender switches to a shorter single cable but keeps its packet size and data rate fixed. Explain separately what changes in transmission delay and propagation delay, using the source relationships.";
  raw.fresh_check.concept_ids = ["transmission_delay", "propagation_delay"];
  const activity = validateInterventionActivity(raw, bundle, metadata);
  assert.deepEqual(activity.fresh_check.concept_ids, [
    "transmission_delay",
    "propagation_delay",
  ]);
  assert.deepEqual(activity.fresh_check.content_ref, bundle.content_ref);
  const omitted = structuredClone(raw);
  omitted.fresh_check.concept_ids = ["transmission_delay"];
  assert.throws(
    () => validateInterventionActivity(omitted, bundle, metadata),
    /assessed delay concept/,
  );
  const unsupported = structuredClone(raw);
  unsupported.fresh_check.concept_ids.push("bandwidth_throughput");
  assert.throws(
    () => validateInterventionActivity(unsupported, bundle, metadata),
    /source citation/,
  );
  const outside = structuredClone(raw);
  outside.fresh_check.concept_ids.push("unapproved_protocol");
  assert.throws(
    () => validateInterventionActivity(outside, bundle, metadata),
    /authorized draft scope/,
  );
  const noRelated = structuredClone(bundle);
  noRelated.related_concepts = [];
  assert.throws(
    () => validateInterventionActivity(raw, noRelated, metadata),
    /authorized draft scope/,
  );
  const restricted = structuredClone(snapshot);
  restricted.metrics.concepts = restricted.metrics.concepts.filter(
    (concept) => concept.concept_id === "transmission_delay",
  );
  assert.deepEqual(
    buildInterventionEvidence(restricted, content, selection).related_concepts,
    [],
  );
});

test("keeps rationale concise, counts all recipient history in code, and keeps review notices outside the exercise", () => {
  const raw = proposal();
  const activity = validateInterventionActivity(raw, bundle, metadata);
  assert.ok(activity.rationale.length < 600);
  assert.ok(activity.rationale.includes("contrary evidence"));
  assert.equal(
    activity.evidence_references.length,
    raw.evidence_references.length,
  );
  const recipient = activity.suggested_recipients[0];
  const history = bundle.observations.filter(
    (row) => row.student_id === recipient.student_id,
  );
  const supporting = history.filter((row) => row.role === "supporting").length;
  const contrary = history.filter((row) => row.role === "contradictory").length;
  const independent = history.filter(
    (row) =>
      row.attempt.assistance?.independent_retrieval_eligible_by_concept[
        bundle.concept.id
      ] === true,
  ).length;
  assert.ok(
    recipient.reason.includes(
      `${supporting} responses suggesting review, ${contrary} correct or contrary responses`,
    ),
  );
  assert.ok(
    recipient.reason.includes(
      `${independent} of ${history.length} responses are eligible as independent`,
    ),
  );
  raw.exercise_text =
    "Private draft for teacher review. Compare transmission delay and propagation delay using the approved source.";
  assert.throws(
    () => validateInterventionActivity(raw, bundle, metadata),
    /student-ready/,
  );
});

test("accepts the full reviewed objective length supported by lesson authoring", () => {
  const evidence = structuredClone(bundle);
  const objective =
    `${evidence.concept.objectives[2]} ${"Explain the reasoning using the approved passage and distinguish the relevant events. ".repeat(18)}`.trim();
  assert.ok(objective.length > 1000 && objective.length <= 2000);
  evidence.concept.objectives[2] = objective;
  const parsedEvidence = InterventionEvidenceSchema.parse(evidence);
  const candidate = ModelInterventionSchema.parse(proposal(parsedEvidence));
  const activity = validateInterventionActivity(
    candidate,
    parsedEvidence,
    metadata,
  );
  assert.equal(activity.learning_objective, objective);
});

test("legacy trimmed source snapshots regenerate without rewriting history or accepting changed excerpts", () => {
  const saved = structuredClone(bundle);
  for (const source of saved.sources) source.text = source.text.trim();
  assert.ok(
    saved.sources.some(
      (source) => source.text !== content.passages.get(source.passage_id)!.text,
    ),
  );
  const before = JSON.stringify(saved);
  for (const version of [
    "teacher-intervention-v1",
    "teacher-intervention-v2",
  ]) {
    const next = interventionRevisionEvidence(content, saved, version);
    for (const source of next.sources)
      assert.equal(source.text, content.passages.get(source.passage_id)!.text);
    assert.equal(JSON.stringify(saved), before);
    const modified = structuredClone(saved);
    modified.sources[0].text += " Modified source claim.";
    assert.throws(
      () => interventionRevisionEvidence(content, modified, version),
      /does not match/,
    );
  }
  for (const version of ["teacher-intervention-v3", "unknown-version"]) {
    assert.throws(
      () => interventionRevisionEvidence(content, saved, version),
      /does not match/,
    );
    assert.deepEqual(
      interventionRevisionEvidence(content, bundle, version),
      bundle,
    );
  }
  const wrongVersion = structuredClone(saved);
  wrongVersion.content_ref.content_version = "other";
  assert.throws(() =>
    interventionRevisionEvidence(
      content,
      wrongVersion,
      "teacher-intervention-v2",
    ),
  );
});

test("uploaded UUID concepts never receive instructions to substitute curated networking IDs", () => {
  const uploaded = structuredClone(bundle);
  const targetId = "10000000-0000-4000-8000-000000000001";
  const relatedId = "20000000-0000-4000-8000-000000000001";
  uploaded.content_ref = {
    ...makeTeacherSourceReference(
      "30000000-0000-4000-8000-000000000001",
      "40000000-0000-4000-8000-000000000001",
    ),
    package_id: "synthetic-uploaded-networking",
    content_version: "1",
  };
  uploaded.selection.concept_id = targetId;
  uploaded.concept.id = targetId;
  uploaded.related_concepts = [
    {
      ...structuredClone(
        bundle.related_concepts.find((c) => c.id === "propagation_delay")!,
      ),
      id: relatedId,
    },
  ];
  const prompt = interventionPrompt(uploaded);
  assert.ok(
    prompt.instructions.includes(
      "Copy the supplied IDs exactly, including UUIDs",
    ),
  );
  assert.ok(!prompt.instructions.includes("Never emit database identities."));
  assert.ok(
    prompt.instructions.includes(
      "Never emit student, session, attempt, or evaluation database identities.",
    ),
  );
  assert.ok(!prompt.instructions.includes("transmission_delay"));
  assert.ok(!prompt.instructions.includes("propagation_delay"));
  const projected = InterventionEvidenceSchema.pick({
    content_ref: true,
    concept: true,
    related_concepts: true,
  })
    .strip()
    .parse(JSON.parse(prompt.input));
  assert.equal(projected.concept.id, targetId);
  assert.equal(projected.related_concepts[0].id, relatedId);
  assert.deepEqual(projected.content_ref, uploaded.content_ref);

  const curated = interventionPrompt(bundle);
  assert.ok(
    curated.instructions.includes(
      "both supplied IDs transmission_delay and propagation_delay",
    ),
  );
  const oneCuratedConcept = structuredClone(bundle);
  oneCuratedConcept.related_concepts = [];
  assert.ok(
    !interventionPrompt(oneCuratedConcept).instructions.includes(
      "both supplied IDs",
    ),
  );
});

test("source and concept rule failures carry fixed typed reasons without model text", () => {
  const invalidSource = proposal();
  invalidSource.content_ref.content_version = "private-model-source-sentinel";
  const invalidConcept = proposal();
  invalidConcept.practice_questions[0].concept_ids = [
    "private-model-concept-sentinel",
  ];
  for (const [candidate, code, message] of [
    [
      invalidSource,
      "source_mismatch",
      "Generated activity uses another source or lesson version.",
    ],
    [
      invalidConcept,
      "question_concept_unauthorized",
      "Question concepts are outside the authorized draft scope or omit its target.",
    ],
  ] as const) {
    assert.throws(
      () => validateInterventionActivity(candidate, bundle, metadata),
      (error: unknown) => {
        assert.ok(error instanceof InterventionValidationError);
        assert.equal(error.code, code);
        assert.equal(error.message, message);
        assert.ok(!error.message.includes("private-model"));
        return true;
      },
    );
  }
});
