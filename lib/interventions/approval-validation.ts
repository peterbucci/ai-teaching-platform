import { isDeepStrictEqual } from "node:util";
import {
  InterventionActivitySchema,
  type InterventionActivity,
} from "./contracts.ts";
import type { InterventionDraft } from "./drafts.ts";

function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const plain = (value: string) => !/[<>]|javascript:|```/i.test(value);

/** Teacher prose is explicitly reviewed; source quotations, scope and identity
 * remain mechanically checked. This is not a semantic correctness evaluator. */
export function validateEditedIntervention(
  raw: unknown,
  draft: InterventionDraft,
): InterventionActivity {
  const activity = InterventionActivitySchema.parse(raw);
  const original = draft.activity;
  for (const key of [
    "strategy",
    "rationale",
    "evidence_references",
    "suggested_recipients",
    "uncertainty",
  ] as const)
    requireRule(
      isDeepStrictEqual(activity[key], original[key]),
      "Original recommendation, evidence and uncertainty must be preserved.",
    );
  const evidence = draft.evidence;
  requireRule(
    evidence.concept.objectives.includes(activity.learning_objective),
    "Choose an approved learning objective.",
  );
  const sources = new Map(
    evidence.sources.map((source) => [source.passage_id, source.text]),
  );
  const concepts = new Map(
    [evidence.concept, ...evidence.related_concepts].map((concept) => [
      concept.id,
      concept,
    ]),
  );
  requireRule(
    new Set(activity.source_references.map((ref) => ref.passage_id)).size ===
      activity.source_references.length,
    "Duplicate source reference.",
  );
  for (const ref of activity.source_references)
    requireRule(
      sources.get(ref.passage_id)?.includes(ref.quote),
      "Source references must quote the exact authorized source.",
    );
  requireRule(
    [
      activity.title,
      activity.learning_objective,
      activity.explanation,
      activity.exercise_text,
    ].every(plain),
    "Use plain text, without markup or executable content.",
  );
  requireRule(
    activity.practice_questions.length === original.practice_questions.length,
    "Preserve the existing question identities and count.",
  );
  const questions = [...activity.practice_questions, activity.fresh_check];
  const originals = [...original.practice_questions, original.fresh_check];
  requireRule(
    new Set(questions.map((q) => q.question_id)).size === questions.length,
    "Question identities must be unique.",
  );
  for (const [index, q] of questions.entries()) {
    const prior = originals[index];
    for (const key of [
      "question_id",
      "origin",
      "sequence_id",
      "generation",
      "embedded_scaffolding",
    ] as const)
      requireRule(
        isDeepStrictEqual(q[key], prior[key]),
        "Question identity and original generation provenance must be preserved.",
      );
    requireRule(
      q.question_id && isDeepStrictEqual(q.content_ref, evidence.content_ref),
      "Question source or lesson version changed.",
    );
    requireRule(
      q.rubric.version === prior.rubric.version,
      "Preserve the original rubric version; edits are recorded in the draft revision.",
    );
    requireRule(
      q.prompt_text.length <= 2000 &&
        q.rubric.answer_guidance.length <= 6000 &&
        q.rubric.criteria.length > 0 &&
        q.rubric.criteria.length <= 12 &&
        q.rubric.criteria.every((c) => c.length <= 1500) &&
        q.rubric.acceptable_variations.length <= 12 &&
        q.rubric.acceptable_variations.every((c) => c.length <= 1500) &&
        (q.rubric.partial_credit_guidance?.length ?? 0) <= 3000,
      "Question or private guidance exceeds the allowed size.",
    );
    requireRule(
      [
        q.prompt_text,
        q.rubric.answer_guidance,
        ...q.rubric.criteria,
        ...q.rubric.acceptable_variations,
        q.rubric.partial_credit_guidance ?? "",
      ].every(plain),
      "Questions and private guidance must use plain text.",
    );
    requireRule(
      q.concept_ids.includes(evidence.concept.id) &&
        q.concept_ids.every((id) => concepts.has(id)),
      "Question concepts must stay within the approved draft scope.",
    );
    requireRule(
      q.source_passage_ids.every((id) => sources.has(id)),
      "Question cites an unauthorized source.",
    );
    requireRule(
      q.concept_ids.every((id) =>
        q.source_passage_ids.some((passageId) =>
          concepts.get(id)!.source_passage_ids.includes(passageId),
        ),
      ),
      "Each assessed concept needs its approved source citation.",
    );
  }
  requireRule(
    new Set(questions.map((q) => q.prompt_text.trim().toLowerCase())).size ===
      questions.length,
    "Practice and follow-up questions must be distinct.",
  );
  return activity;
}
