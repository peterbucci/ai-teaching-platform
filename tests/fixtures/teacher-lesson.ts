import { createHash } from "node:crypto";
import {
  LessonContentSchema,
  type LessonContent,
} from "../../lib/lessons/contracts.ts";
import type { UploadedSourceReference } from "../../lib/lessons/source-contracts.ts";

/** Original synthetic teacher material; no networking identifiers or content. */
export const teacherSourcePassages = [
  {
    passage_id: "water-01",
    text: "Evaporation changes liquid water into water vapor, a gas. A puddle can shrink as water evaporates into the air. The water has changed state; it has not disappeared.",
    section: "Evaporation",
  },
  {
    passage_id: "water-02",
    text: "Condensation changes water vapor into liquid water. When water vapor in air cools near a cold surface, liquid droplets can form on the surface. Evaporation and condensation describe opposite changes of state.",
    section: "Condensation",
  },
];
export const teacherSourceDocument = teacherSourcePassages
  .map((passage) => passage.text)
  .join("\n\n");
export const teacherSourceAttribution = {
  title: "Water changing state",
  authors: ["Fictional demo teacher"],
  copyright: "2026 Fictional demo teacher",
  section: "Evaporation and condensation",
  url: null,
  license: "Original synthetic material; permitted for this demo",
  license_url: null,
  cautions: [
    "This short reading does not cover boiling, freezing, or weather prediction.",
  ],
};

export function makeTeacherSourceReference(
  sourceId: string,
  teacherId: string,
  sourceVersion = 1,
): UploadedSourceReference {
  return {
    source_kind: "uploaded",
    source_id: sourceId,
    source_version: sourceVersion,
    document_sha256: createHash("sha256")
      .update(teacherSourceDocument)
      .digest("hex"),
    excerpt_sha256: createHash("sha256")
      .update(JSON.stringify(teacherSourcePassages))
      .digest("hex"),
    attribution: teacherSourceAttribution,
    access_scope: { teacher_id: teacherId },
  };
}

export function makeTeacherLesson(
  source: UploadedSourceReference,
  lessonId: string,
  version: string,
): LessonContent {
  const content_ref = {
    ...source,
    package_id: lessonId,
    content_version: version,
  };
  const conceptIds = ["evaporation", "condensation"];
  const passageIds = teacherSourcePassages.map((passage) => passage.passage_id);
  const sequenceId = "water-state-practice";
  const prompts = [
    {
      id: "WC-01",
      kind: "initial_retrieval",
      prompt:
        "A puddle becomes smaller, while droplets appear on the outside of a cold glass. Name and explain the change of state in each case.",
      answer:
        "The puddle's liquid water becomes vapor by evaporation. Water vapor from the air becomes liquid droplets by condensation near the cold glass.",
    },
    {
      id: "WC-CLARIFY",
      kind: "neutral_clarification",
      prompt:
        "For each observation, describe the water's state before and after the change. Then explain the name you chose for that change.",
      answer:
        "Puddle water changes from liquid to gas, evaporation. Water near the cold glass changes from gas to liquid, condensation.",
    },
    {
      id: "WC-DIAGNOSTIC",
      kind: "diagnostic_followup",
      prompt:
        "Wet cloth dries in air, and a cold mirror gains water droplets. Compare the direction of the water's change of state in these two observations.",
      answer:
        "Liquid water in the cloth becomes gas through evaporation. Water vapor becomes liquid on the cold mirror through condensation. The directions are opposite.",
    },
    {
      id: "WC-RETEST-1",
      kind: "immediate_retest",
      prompt:
        "A shallow dish of water loses liquid over time, and water vapor forms droplets near a cool lid. Explain the two changes of state and give their names.",
      answer:
        "Water in the dish changes from liquid to vapor through evaporation. Vapor near the cool lid changes to liquid through condensation.",
    },
    {
      id: "WC-RETEST-2",
      kind: "immediate_retest",
      prompt:
        "A wet tabletop dries while a chilled window gathers droplets. Which observation shows gas becoming liquid, and which shows liquid becoming gas? Explain.",
      answer:
        "The chilled window gathers liquid from water vapor by condensation. Liquid on the tabletop becomes water vapor by evaporation.",
    },
  ];
  const feedback =
    "Evaporation is liquid water becoming water vapor. Condensation is water vapor becoming liquid water. Compare the starting and ending states in each observation.";
  return LessonContentSchema.parse({
    content_ref,
    attribution: source.attribution,
    assignment_key: lessonId,
    approval: {
      status: "approved",
      approved_by: source.access_scope.teacher_id,
      approved_at: "2026-10-22T12:00:00Z",
      approval_type: "synthetic_fixture",
      approval_note:
        "Original fixture material reviewed for deterministic integration checks.",
    },
    concepts: conceptIds.map((id, index) => ({
      id,
      title: index === 0 ? "Evaporation" : "Condensation",
      objectives: [
        index === 0
          ? "Explain liquid water changing to water vapor."
          : "Explain water vapor changing to liquid water.",
      ],
      boundaries: ["Use only the changes of state described in the reading."],
      review_status: "approved",
      source_passage_ids: [passageIds[index]],
      common_misconceptions: [],
    })),
    passages: teacherSourcePassages.map((passage) => ({
      id: passage.passage_id,
      source_id: source.source_id,
      source_version: source.source_version,
      text: passage.text,
      url: null,
      start_line: null,
      end_line: null,
      sha256: createHash("sha256").update(passage.text).digest("hex"),
      section: passage.section,
    })),
    misconceptions: [],
    scope:
      "Qualitative changes between liquid water and water vapor in the approved reading.",
    terminology_policy:
      "Accept water vapor or water gas when the direction of the state change is clear.",
    misconception_policy:
      "Record the exact response; this lesson defines no reviewed misconception categories.",
    scoring_policy: {
      allowed_correctness: [
        "correct",
        "partially_correct",
        "incorrect",
        "uncertain",
      ],
      correct: "Both changes of state and their names are explained correctly.",
      partially_correct:
        "Some relevant reasoning is correct but at least one requested change is missing or incorrect.",
      incorrect:
        "The response explicitly reverses or misidentifies the changes of state.",
      uncertain:
        "There is insufficient clear reasoning to assess the intended answer.",
      misconception_handling:
        "Do not invent a stable misconception or an unapproved category.",
      terminology_handling:
        "Accept equivalent ordinary-language descriptions of the two state changes.",
      numeric_handling:
        "This qualitative lesson has no numerical requirements.",
      assistance_handling:
        "Use the server's assistance record and preserve the original independent response.",
      example_response_handling:
        "Synthetic examples are fixture data, not evidence about a real student.",
      grounding:
        "Use only the versioned source passages and approved objectives.",
    },
    sequence: {
      assignment_id: lessonId,
      sequence_id: sequenceId,
      status: "approved",
      concept_ids: conceptIds,
      initial_question_id: prompts[0].id,
      hypothesis_id: null,
      diagnostic_options: [
        { misconception_id: null, question_id: "WC-DIAGNOSTIC" },
      ],
      interpretation_rules: [
        "Compare state-change reasoning without assigning a misconception category.",
        "An immediate retest after feedback is assisted evidence, not lasting mastery.",
      ],
      bounds: {
        max_neutral_clarifications: 1,
        max_diagnostic_prompts: 1,
        max_immediate_retest_prompts: 2,
        max_unsupported_input_retries_total: 1,
        max_student_response_prompts: 6,
      },
      nodes: [
        ...prompts.map((prompt) => ({
          node_id: prompt.id,
          kind: prompt.kind,
          prompt: prompt.prompt,
          expected_answer: prompt.answer,
          source_passage_ids: passageIds,
          ...(prompt.id === "WC-RETEST-1"
            ? { next_node_id: "WC-RETEST-2" }
            : {}),
        })),
        {
          node_id: "WC-FEEDBACK",
          kind: "corrective_feedback",
          feedback,
          source_passage_ids: passageIds,
          next_node_id: "WC-RETEST-1",
        },
        {
          node_id: "WC-WORKED",
          kind: "arithmetic_feedback",
          feedback,
          source_passage_ids: passageIds,
          next_node_id: "WC-RETEST-1",
        },
        {
          node_id: "WC-CLOSE",
          kind: "closing_feedback_and_review",
          source_passage_ids: passageIds,
          feedback_variants: {
            correct_after_feedback:
              "Your retests correctly distinguish the state changes after feedback. A later independent question would provide different evidence.",
            uncertain_after_feedback:
              "Some reasoning remains unclear. Your teacher can review the saved responses.",
            partial_after_feedback_arithmetic_or_units:
              "Your state-change reasoning is saved along with the remaining uncertainty. Review the source with your teacher.",
            partial_or_incorrect_after_feedback:
              "Review the starting and ending states with your teacher. Your original responses remain saved.",
          },
        },
        {
          node_id: "WC-FALLBACK",
          kind: "unsupported_input_or_evaluation_fallback",
          feedback_variants: {
            unrelated_or_empty:
              "Please answer the current question about the approved water reading. Your saved work is preserved.",
          },
        },
      ],
    },
    questions: prompts.map((prompt) => ({
      origin: "curated",
      question_id: prompt.id,
      sequence_id: sequenceId,
      prompt_text: prompt.prompt,
      content_ref,
      concept_ids: conceptIds,
      source_passage_ids: passageIds,
      rubric: {
        version,
        answer_guidance: prompt.answer,
        criteria: [
          "Explain liquid changing to gas as evaporation.",
          "Explain gas changing to liquid as condensation.",
        ],
        acceptable_variations: [
          "Equivalent descriptions that name the starting and ending states.",
        ],
        partial_credit_guidance:
          "Credit each correctly explained change separately.",
      },
      embedded_scaffolding: [],
      generation: null,
    })),
    question_guidance: prompts.map((prompt) => ({
      question_id: prompt.id,
      assumptions: [],
      misconception_ids: [],
    })),
    activity_policy: {
      allowed_actions: [
        "ASK_RETRIEVAL_QUESTION",
        "ASK_SELF_EXPLANATION",
        "ASK_DIAGNOSTIC_FOLLOWUP",
        "GIVE_CORRECTIVE_FEEDBACK",
        "RETEST_CONCEPT",
        "SCHEDULE_REVIEW",
        "END_SESSION",
      ],
      allow_runtime_generation: false,
    },
  });
}
