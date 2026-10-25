import assert from "node:assert/strict";
import test from "node:test";
import type { AssistanceSnapshot } from "../lib/evidence/contracts.ts";
import { buildDemoFixture } from "../lib/evidence/demo.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { deriveAssistance } from "../lib/evidence/rules.ts";
import { interventionAssistanceLabels } from "../app/teacher/interventions/assistance.ts";

const content = loadApprovedContent();
const fixture = buildDemoFixture(content);
const attempt = fixture.sessions[0].attempts[0];
const concept = attempt.question.concept_ids[0];
const otherConcept = [...content.concept_ids].find((id) => id !== concept)!;
const plain: AssistanceSnapshot = {
  intervention_ids: [],
  assistance_level: "none_recorded",
  scaffolding_types: [],
  independent_retrieval_eligible_by_concept: { [concept]: true },
  most_recent_content_assistance_at: null,
  elapsed_since_content_assistance_seconds: null,
};

test("a multi-concept response can record help while remaining independent for a different concept", () => {
  const question = {
    ...attempt.question,
    concept_ids: [concept, otherConcept],
  };
  const source = fixture.sessions.flatMap((item) => item.interventions)[0];
  assert.ok(source && attempt.submitted_at);
  for (const type of [
    "hint",
    "reading",
    "worked_example",
    "corrective_feedback",
  ] as const) {
    const assistance = deriveAssistance(
      question,
      "initial_retrieval",
      attempt.presented_at,
      attempt.submitted_at,
      [
        {
          ...source,
          type,
          concept_ids: [otherConcept],
          delivery_status: "displayed",
          visible_at: attempt.submitted_at,
        },
      ],
    );
    const labels = interventionAssistanceLabels(
      { ...attempt, assistance },
      concept,
    );
    assert.match(labels.support, new RegExp(type.replaceAll("_", " ")));
    assert.doesNotMatch(labels.support, /No recorded help/);
    assert.equal(
      labels.independence,
      "Independent retrieval eligible for this concept",
    );
  }
});

test("a displayed hint for the selected concept is recorded and prevents independent retrieval", () => {
  const source = fixture.sessions.flatMap((item) => item.interventions)[0];
  assert.ok(source && attempt.submitted_at);
  const assistance = deriveAssistance(
    attempt.question,
    "initial_retrieval",
    attempt.presented_at,
    attempt.submitted_at,
    [
      {
        ...source,
        type: "hint",
        concept_ids: [concept],
        delivery_status: "displayed",
        visible_at: attempt.submitted_at,
      },
    ],
  );
  assert.deepEqual(assistance.intervention_ids, [source.id]);
  assert.deepEqual(
    interventionAssistanceLabels({ ...attempt, assistance }, concept),
    {
      support: "Recorded help: hint",
      independence: "Not an independent retrieval for this concept",
    },
  );
});

test("a submitted retrieval without displayed assistance shows no recorded help and remains independent", () => {
  assert.ok(attempt.submitted_at);
  const assistance = deriveAssistance(
    attempt.question,
    "initial_retrieval",
    attempt.presented_at,
    attempt.submitted_at,
    [],
  );
  assert.deepEqual(
    interventionAssistanceLabels({ ...attempt, assistance }, concept),
    {
      support: "No recorded help",
      independence: "Independent retrieval eligible for this concept",
    },
  );
});

test("created or failed hints that were never displayed do not count as assistance", () => {
  const source = fixture.sessions.flatMap((item) => item.interventions)[0];
  assert.ok(source && attempt.submitted_at);
  for (const delivery_status of ["created", "failed"] as const) {
    const assistance = deriveAssistance(
      attempt.question,
      "initial_retrieval",
      attempt.presented_at,
      attempt.submitted_at,
      [
        {
          ...source,
          type: "hint",
          concept_ids: [concept],
          delivery_status,
          visible_at: null,
        },
      ],
    );
    assert.deepEqual(assistance.intervention_ids, []);
    assert.deepEqual(
      interventionAssistanceLabels({ ...attempt, assistance }, concept),
      {
        support: "No recorded help",
        independence: "Independent retrieval eligible for this concept",
      },
    );
  }
});

test("lack of independent eligibility does not invent assistance", () => {
  const labels = interventionAssistanceLabels(
    {
      ...attempt,
      assistance: {
        ...plain,
        independent_retrieval_eligible_by_concept: { [concept]: false },
      },
    },
    concept,
  );
  assert.equal(labels.support, "No recorded help");
  assert.equal(
    labels.independence,
    "Not an independent retrieval for this concept",
  );
});

test("missing and incomplete assistance remain unknown", () => {
  for (const value of [
    { ...attempt, assistance: null },
    { ...attempt, assistance: plain, response_text: null, submitted_at: null },
  ]) {
    const labels = interventionAssistanceLabels(value, concept);
    assert.equal(labels.support, "Assistance not recorded");
    assert.equal(
      labels.independence,
      "Independence not recorded for this concept",
    );
  }
  assert.equal(
    interventionAssistanceLabels(
      {
        ...attempt,
        assistance: { ...plain, independent_retrieval_eligible_by_concept: {} },
      },
      concept,
    ).independence,
    "Independence not recorded for this concept",
  );
});

test("scaffolding, displayed tutor interactions and question content are not labelled no help", () => {
  for (const assistance of [
    { ...plain, scaffolding_types: ["neutral_clarification" as const] },
    {
      ...plain,
      intervention_ids: [
        fixture.sessions.flatMap((item) => item.interventions)[0].id,
      ],
    },
    { ...plain, assistance_level: "prompt_supplied_content" as const },
  ]) {
    const labels = interventionAssistanceLabels(
      { ...attempt, assistance },
      concept,
    );
    assert.doesNotMatch(labels.support, /No recorded help/);
  }
});
