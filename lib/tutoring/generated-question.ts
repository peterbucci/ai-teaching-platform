import { isDeepStrictEqual } from "node:util";
import type { ApprovedContent } from "../evidence/content.ts";
import { validateQuestionSnapshot } from "../evidence/content.ts";
import type {
  Attempt,
  QuestionSnapshot,
  SessionEvidence,
} from "../evidence/contracts.ts";
import {
  GeneratedDialogueSchema,
  type GeneratedDialogue,
} from "../dialogue/contracts.ts";
import type { TutorDecision } from "./decide.ts";

/** Runtime identities remain immutable; this server-owned binding only selects the
 * reviewed authored activity whose existing transition semantics apply. */
export function controllerNode(content: ApprovedContent, attempt: Attempt) {
  const question = validateQuestionSnapshot(content, attempt.question);
  const nodeId =
    question.origin === "generated"
      ? question.controller_node_id
      : question.question_id;
  const node = content.sequence.nodes.find((item) => item.node_id === nodeId);
  if (!node || question.sequence_id !== content.sequence.sequence_id)
    throw new Error("Question has no approved controller activity binding");
  if (question.origin === "generated") {
    const authored = content.questions.get(node.node_id);
    if (
      !authored ||
      ![
        "diagnostic_followup",
        "neutral_clarification",
        "immediate_retest",
      ].includes(node.kind) ||
      attempt.intent !== node.kind ||
      !sameConcepts(question.concept_ids, authored.concept_ids)
    )
      throw new Error(
        "Generated question differs from its approved activity scope",
      );
  }
  return node;
}

function sameConcepts(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

/** Called only after reviewed generation, inside the controller commit. The model
 * cannot choose a slot, replace the rubric later, or bypass the controller's bounds. */
export function bindGeneratedQuestion(
  content: ApprovedContent,
  evidence: SessionEvidence,
  decision: TutorDecision,
  input: Extract<GeneratedDialogue, { kind: "question" }>,
): QuestionSnapshot {
  const generated = GeneratedDialogueSchema.parse(input);
  if (generated.kind !== "question")
    throw new Error("Expected an assessed question");
  const expectedIntent =
    decision.applied.action === "ASK_DIAGNOSTIC_FOLLOWUP"
      ? "diagnostic_followup"
      : decision.applied.action === "ASK_SELF_EXPLANATION"
        ? "neutral_clarification"
        : decision.applied.action === "RETEST_CONCEPT"
          ? "immediate_retest"
          : null;
  const slot = content.sequence.nodes.find(
    (node) => node.node_id === decision.nextQuestionId,
  );
  const authored = decision.nextQuestionId
    ? content.questions.get(decision.nextQuestionId)
    : null;
  const question = validateQuestionSnapshot(content, generated.question);
  if (
    !expectedIntent ||
    generated.intent !== expectedIntent ||
    !slot ||
    !authored ||
    slot.kind !== expectedIntent ||
    question.origin !== "generated" ||
    question.question_id !== generated.content_id ||
    question.controller_node_id !== undefined ||
    question.sequence_id !== null ||
    // Prompt-supplied assistance needs a question-display receipt before enabling it.
    question.embedded_scaffolding.length !== 0 ||
    !sameConcepts(question.concept_ids, authored.concept_ids) ||
    !isDeepStrictEqual(question.content_ref, authored.content_ref) ||
    evidence.attempts.some(
      (attempt) => attempt.question.question_id === question.question_id,
    )
  )
    throw new Error(
      "Generated question is not authorized for this controller activity",
    );
  const normalized = (text: string) =>
    text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (
    evidence.attempts.some(
      (attempt) =>
        normalized(attempt.question.prompt_text) ===
        normalized(question.prompt_text),
    )
  )
    throw new Error("Generated question repeats an earlier assessment");
  return {
    ...question,
    sequence_id: content.sequence.sequence_id,
    controller_node_id: slot.node_id,
  };
}
