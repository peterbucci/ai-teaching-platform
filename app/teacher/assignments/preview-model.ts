import "server-only";
import { assignedReading } from "../../../lib/assignments/reading.ts";
import {
  validateContentRef,
  type ApprovedContent,
} from "../../../lib/evidence/content.ts";
import type { ContentRef } from "../../../lib/evidence/contracts.ts";

/** Counts the resolved published questions, including sequence-only questions. */
export function assignmentLessonCoverage(
  content: ApprovedContent,
  contentRef: ContentRef,
) {
  validateContentRef(content, contentRef);
  const sequenceIds = new Set([
    content.sequence.initial_question_id,
    ...content.sequence.nodes.map((node) => node.node_id),
  ]);
  const questions = [...content.questions.entries()];
  return {
    questionCount: questions.length,
    sequenceQuestionCount: questions.filter(([id]) => sequenceIds.has(id))
      .length,
    passageCount: content.passages.size,
    concepts: [...content.concepts.values()].map((concept) => ({
      id: concept.id,
      title: concept.title,
      objectives: [...concept.objectives],
      passageIds: [...concept.source_passage_ids],
      questionCount: questions.filter(([, question]) =>
        question.concept_ids.includes(concept.id),
      ).length,
    })),
  };
}

/**
 * An explicit allowlist for a read-only preview. Never pass the resolved lesson
 * or sequence to a client component: both include unrevealed private content.
 */
export function projectStudentLearningPreview(
  content: ApprovedContent,
  contentRef: ContentRef,
) {
  const reference = validateContentRef(content, contentRef);
  const kinds = new Set(content.sequence.nodes.map((node) => node.kind));
  const actions = new Set(content.activity_policy.allowed_actions);
  const interactions = [
    "Read the approved material and explore the learning goals.",
    "Explain your reasoning in a question selected from this lesson.",
  ];
  if (kinds.has("neutral_clarification"))
    interactions.push("Clarify your reasoning when more detail is needed.");
  if (
    kinds.has("diagnostic_followup") &&
    actions.has("ASK_DIAGNOSTIC_FOLLOWUP")
  )
    interactions.push(
      "Respond to a follow-up question when the tutor needs more evidence.",
    );
  if (actions.has("GIVE_CORRECTIVE_FEEDBACK"))
    interactions.push("Review feedback grounded in the assigned reading.");
  if (kinds.has("immediate_retest") && actions.has("RETEST_CONCEPT"))
    interactions.push(
      "Try a fresh question after feedback; this is recorded as assisted practice.",
    );
  return {
    contentRef: reference,
    reading: assignedReading(reference, content),
    concepts: [...content.concepts.values()].map((concept) => ({
      id: concept.id,
      title: concept.title,
      objectives: [...concept.objectives],
      passageIds: [...concept.source_passage_ids],
    })),
    interactions,
  };
}
