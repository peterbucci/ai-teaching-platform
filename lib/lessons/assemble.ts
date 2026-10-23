import "server-only";
import {
  LessonContentSchema,
  LessonDraftContentSchema,
  projectLessonDraftContent,
  type LessonDraftContent,
} from "./contracts.ts";
import { getReviewedQuestionBank } from "../question-bank/validation.ts";

/** Assemble only the existing tutor's bounded authored sequence. All questions,
 * rubrics, feedback and citations come from the teacher-reviewed bank. */
export function assembleReviewedLesson(
  input: LessonDraftContent,
  familyId?: string,
): LessonDraftContent {
  const draft = LessonDraftContentSchema.parse(input);
  const bank = getReviewedQuestionBank(draft);
  if (!draft.scoring_policy)
    throw new Error("Review the scoring policy before assembling this lesson.");
  if (!draft.content_ref || !draft.assignment_key)
    throw new Error("The lesson and source identity are required.");
  const selectedFamily = familyId ?? bank.items[0]?.family_id;
  const items = bank.items.filter((item) => item.family_id === selectedFamily);
  if (!items.length)
    throw new Error("The selected question family is unavailable.");
  const initial = items.find((item) => item.role === "initial");
  const diagnostics = items.filter((item) => item.role === "diagnostic");
  const retests = items.filter((item) => item.role === "retest");
  if (!initial || !diagnostics.length || !retests.length)
    throw new Error(
      "Select a reviewed family with an initial question, diagnostic and retest.",
    );
  if (!initial.feedback_guidance.trim())
    throw new Error(
      "Review feedback for the initial question before assembling this lesson.",
    );
  const questions = new Map(
    bank.questions.map((question) => [question.question_id, question]),
  );
  const first = questions.get(initial.question_id)!;
  const selected = [initial, ...diagnostics, ...retests];
  const selectedIds = new Set(selected.map((item) => item.question_id));
  for (const item of selected) {
    const question = questions.get(item.question_id)!;
    if (!question.concept_ids.every((id) => first.concept_ids.includes(id)))
      throw new Error(
        "Every sequence question must assess the selected family's learning objectives.",
      );
  }
  const sequenceId = `${draft.content_ref.package_id}:${selectedFamily}:practice`;
  const helpId = (kind: string) => `${sequenceId}:${kind}`;
  for (const kind of ["corrective", "arithmetic", "closing", "fallback"])
    if (questions.has(helpId(kind)))
      throw new Error(
        "A question identifier conflicts with an assembled activity.",
      );
  const passages = [...new Set(first.source_passage_ids)];
  const misconceptions = new Map(
    (draft.misconceptions ?? []).map((item) => [item.id, item]),
  );
  const guidance = new Map(
    bank.question_guidance.map((item) => [item.question_id, item]),
  );
  const sequence: NonNullable<LessonDraftContent["sequence"]> = {
    assignment_id: draft.assignment_key,
    sequence_id: sequenceId,
    status: "approved",
    concept_ids: [...first.concept_ids],
    initial_question_id: first.question_id!,
    hypothesis_id: null,
    diagnostic_options: diagnostics.map((item) => {
      const question = questions.get(item.question_id)!;
      // Reasoning-error prose never creates a misconception category. A mapped
      // hypothesis must already be approved and assessed by this diagnostic.
      const mapped = guidance
        .get(item.question_id)
        ?.misconception_ids.find((id) => {
          const concept = misconceptions.get(id)?.concept_id;
          return !!concept && question.concept_ids.includes(concept);
        });
      return {
        misconception_id: mapped ?? null,
        question_id: item.question_id,
      };
    }),
    interpretation_rules: [draft.misconception_policy ?? ""],
    bounds: {
      max_neutral_clarifications: 0,
      max_diagnostic_prompts: 1,
      max_immediate_retest_prompts: retests.length,
      max_unsupported_input_retries_total: 1,
      max_student_response_prompts: 1 + 1 + retests.length + 1,
    },
    nodes: [
      {
        node_id: initial.question_id,
        kind: "initial_retrieval",
        prompt: first.prompt_text,
      },
      ...diagnostics.map((item) => ({
        node_id: item.question_id,
        kind: "diagnostic_followup",
        prompt: questions.get(item.question_id)!.prompt_text,
      })),
      ...retests.map((item, index) => ({
        node_id: item.question_id,
        kind: "immediate_retest",
        prompt: questions.get(item.question_id)!.prompt_text,
        ...(retests[index + 1]
          ? { next_node_id: retests[index + 1].question_id }
          : {}),
      })),
      ...(["corrective", "arithmetic"] as const).map((kind) => ({
        node_id: helpId(kind),
        kind: `${kind}_feedback`,
        feedback: initial.feedback_guidance,
        source_passage_ids: passages,
        next_node_id: retests[0].question_id,
      })),
      {
        node_id: helpId("closing"),
        kind: "closing_feedback_and_review",
        source_passage_ids: passages,
        feedback_variants: bank.delivery.closing_feedback,
      },
      {
        node_id: helpId("fallback"),
        kind: "unsupported_input_or_evaluation_fallback",
        feedback_variants: {
          unrelated_or_empty: bank.delivery.fallback_message,
        },
      },
    ],
  };
  const assembled = {
    ...draft,
    sequence,
    questions: bank.questions.map((question) => ({
      ...question,
      sequence_id: selectedIds.has(question.question_id!) ? sequenceId : null,
    })),
  };
  delete assembled.approval;
  // Assembly cannot fill missing educational policy or turn an incomplete bank
  // into approved content. Whole-lesson approval remains a separate operation.
  LessonContentSchema.omit({ approval: true }).parse(
    projectLessonDraftContent(assembled),
  );
  return assembled;
}
