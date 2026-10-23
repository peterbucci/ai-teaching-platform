import "server-only";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  LessonDraftContentSchema,
  type LessonDraftContent,
} from "../lessons/contracts.ts";
import type { QuestionSnapshot } from "../evidence/contracts.ts";
import {
  QuestionCalculationSchema,
  type QuestionBankIssue,
  type QuestionCalculation,
} from "./contracts.ts";

/** Reviewed arithmetic only: no model formula, code, or expression is executed. */
export function calculateQuestionAnswer(input: QuestionCalculation): number {
  const calculation = QuestionCalculationSchema.parse(input);
  const [first, ...rest] = calculation.operands;
  const result = rest.reduce((value, operand) => {
    switch (calculation.operation) {
      case "add":
        return value + operand;
      case "subtract":
        return value - operand;
      case "multiply":
        return value * operand;
      case "divide": {
        if (operand === 0)
          throw new Error("Division by zero is not supported.");
        return value / operand;
      }
    }
  }, first);
  if (!Number.isFinite(result))
    throw new Error("The calculation result is not finite.");
  return result;
}

function normalizedWords(text: string) {
  return text
    .toLocaleLowerCase("en-US")
    .replace(/\d+(?:[.,]\d+)*/g, " number ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Conservative mechanical check; passing is not proof of educational novelty. */
export function areQuestionsTooSimilar(first: string, second: string): boolean {
  const a = normalizedWords(first);
  const b = normalizedWords(second);
  if (a.join(" ") === b.join(" ")) return true;
  const left = new Set(a);
  const right = new Set(b);
  const overlap = [...left].filter((word) => right.has(word)).length;
  return (
    Math.min(left.size, right.size) >= 5 &&
    overlap / new Set([...left, ...right]).size >= 0.8
  );
}

function includesNumber(text: string, value: number) {
  const matches =
    text
      .replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, "")
      .match(/(?<![\w.])-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?![\w.])/gi) ?? [];
  return matches.some((match) => Number(match) === value);
}

/** Validate the authoring bank without requiring whole-lesson publication fields. */
export function validateQuestionBank(input: unknown): QuestionBankIssue[] {
  const parsed = LessonDraftContentSchema.safeParse(input);
  if (!parsed.success)
    return parsed.error.issues.map((issue) => ({
      question_id: null,
      message: `${issue.path.join(".") || "Question bank"}: ${issue.message}`,
    }));
  const draft = parsed.data;
  const issues: QuestionBankIssue[] = [];
  const add = (message: string, question_id: string | null = null) => {
    if (
      !issues.some(
        (issue) =>
          issue.question_id === question_id && issue.message === message,
      )
    )
      issues.push({ question_id, message });
  };
  if (!draft.question_bank) {
    add("Question-bank preferences and review metadata are missing.");
    return issues;
  }
  if (!draft.content_ref)
    add("An exact lesson and source version is required.");
  if (!draft.concepts?.length)
    add("Approve learning objectives before generating questions.");
  if (!draft.passages?.length) add("Approved source passages are required.");
  if (!draft.questions?.length)
    add("Add at least one complete question family.");
  if (!draft.question_guidance) add("Private question guidance is missing.");
  const { items, preferences } = draft.question_bank;
  const questions = draft.questions ?? [];
  const concepts = new Map(
    (draft.concepts ?? []).map((value) => [value.id, value]),
  );
  const passages = new Map(
    (draft.passages ?? []).map((value) => [value.id, value]),
  );
  const misconceptions = new Map(
    (draft.misconceptions ?? []).map((value) => [value.id, value]),
  );
  const questionMap = new Map(
    questions.map((question) => [question.question_id, question]),
  );
  const itemMap = new Map(items.map((item) => [item.question_id, item]));
  const guidance = new Map(
    (draft.question_guidance ?? []).map((value) => [value.question_id, value]),
  );
  if (concepts.size !== draft.concepts?.length)
    add("Concept identifiers must be unique.");
  if (passages.size !== draft.passages?.length)
    add("Passage identifiers must be unique.");
  if (misconceptions.size !== (draft.misconceptions ?? []).length)
    add("Misconception identifiers must be unique.");
  if (questionMap.size !== questions.length || questionMap.has(null))
    add("Question snapshots require unique stable identifiers.");
  if (itemMap.size !== items.length)
    add("Question review metadata contains duplicate identifiers.");
  if (guidance.size !== (draft.question_guidance ?? []).length)
    add("Private question guidance contains duplicate identifiers.");
  for (const id of preferences.emphasized_concept_ids)
    if (!concepts.has(id)) add(`Unknown emphasized concept: ${id}.`);
  for (const id of preferences.misconception_ids)
    if (!misconceptions.has(id))
      add(
        `Unknown misconception preference: ${id}. Keep unconfirmed reasoning errors as hypotheses.`,
      );

  for (const passage of passages.values()) {
    if (
      !draft.content_ref ||
      passage.source_id !== draft.content_ref.source_id ||
      ("source_kind" in draft.content_ref
        ? passage.source_version !== draft.content_ref.source_version ||
          passage.source_commit !== undefined
        : passage.source_commit !== draft.content_ref.source_commit)
    )
      add(`Passage ${passage.id} does not match the exact source version.`);
    if (
      passage.sha256 !== createHash("sha256").update(passage.text).digest("hex")
    )
      add(`Passage ${passage.id} has a mismatched text hash.`);
  }
  for (const concept of concepts.values()) {
    if (
      new Set(concept.source_passage_ids).size !==
      concept.source_passage_ids.length
    )
      add(`Concept ${concept.id} contains duplicate passage references.`);
    for (const id of concept.source_passage_ids)
      if (!passages.has(id))
        add(`Concept ${concept.id} cites an unknown passage: ${id}.`);
    for (const misconception of concept.common_misconceptions)
      if (misconceptions.get(misconception.id)?.concept_id !== concept.id)
        add(
          `Concept ${concept.id} contains an unapproved misconception: ${misconception.id}.`,
        );
  }
  for (const misconception of misconceptions.values())
    if (
      misconception.concept_id !== null &&
      !concepts.has(misconception.concept_id)
    )
      add(`Misconception ${misconception.id} refers to an unknown concept.`);
  for (const item of items)
    if (!questionMap.has(item.question_id))
      add("Review metadata refers to a missing question.", item.question_id);
  for (const row of guidance.values())
    if (!questionMap.has(row.question_id))
      add("Private guidance refers to a missing question.", row.question_id);

  for (const question of questions) {
    const id = question.question_id;
    const item = id ? itemMap.get(id) : undefined;
    if (!isDeepStrictEqual(question.content_ref, draft.content_ref))
      add("Question belongs to a different lesson or source version.", id);
    if (
      !question.rubric.criteria.length ||
      question.rubric.criteria.some((criterion) => !criterion.trim())
    )
      add("At least one nonempty expected-answer criterion is required.", id);
    if (!question.rubric.partial_credit_guidance?.trim())
      add("Partial-answer guidance is required.", id);
    for (const conceptId of question.concept_ids) {
      const concept = concepts.get(conceptId);
      if (!concept) add(`Unknown question concept: ${conceptId}.`, id);
      else if (
        !concept.source_passage_ids.some((passageId) =>
          question.source_passage_ids.includes(passageId),
        )
      )
        add(`Question does not cite support for concept ${conceptId}.`, id);
    }
    for (const passageId of question.source_passage_ids)
      if (!passages.has(passageId))
        add(`Unknown question passage: ${passageId}.`, id);
    for (const scaffolding of question.embedded_scaffolding) {
      if (
        scaffolding.concept_ids.some(
          (conceptId) => !question.concept_ids.includes(conceptId),
        )
      )
        add("Embedded assistance targets a concept outside this question.", id);
      if (
        scaffolding.affected_rubric_criteria.some(
          (criterion) => !question.rubric.criteria.includes(criterion),
        )
      )
        add("Embedded assistance refers to an unknown rubric criterion.", id);
    }
    const privateGuidance = id ? guidance.get(id) : undefined;
    if (!privateGuidance) add("Private question guidance is missing.", id);
    else
      for (const misconceptionId of privateGuidance.misconception_ids) {
        const misconception = misconceptions.get(misconceptionId);
        if (
          !misconception ||
          (misconception.concept_id !== null &&
            !question.concept_ids.includes(misconception.concept_id))
        )
          add(`Unknown or out-of-scope misconception: ${misconceptionId}.`, id);
      }
    if (!item) {
      add("Question format, package role and review metadata are missing.", id);
      continue;
    }
    for (const concern of item.quality_issues)
      add(`Educational review: ${concern}`, id);
    if (item.role === "initial" && !item.feedback_guidance.trim())
      add(
        "Initial questions need source-grounded feedback guidance for the lesson fallback.",
        id,
      );
    for (const support of item.source_support) {
      const passage = passages.get(support.passage_id);
      if (!passage || !question.source_passage_ids.includes(support.passage_id))
        add(
          `Supporting quote cites an unknown or unused passage: ${support.passage_id}.`,
          id,
        );
      else if (!passage.text.includes(support.quote))
        add(
          `Supporting quote does not occur verbatim in passage ${support.passage_id}.`,
          id,
        );
      if (!question.rubric.criteria.includes(support.criterion))
        add("Supporting quote refers to an unknown answer criterion.", id);
    }
    for (const criterion of question.rubric.criteria)
      if (
        !item.source_support.some((support) => support.criterion === criterion)
      )
        add(
          `Answer criterion has no supporting source quote: ${criterion}`,
          id,
        );
    if (item.format === "multiple_choice") {
      const choices = [
        ...question.prompt_text.matchAll(/(?:^|\n)\s*([A-D])[.)]\s+([^\n]+)/g),
      ];
      if (
        choices.length < 2 ||
        new Set(choices.map((choice) => choice[1])).size !== choices.length ||
        new Set(choices.map((choice) => choice[2].trim().toLowerCase()))
          .size !== choices.length
      )
        add(
          "Multiple-choice prompts need at least two distinct labeled choices (A., B., C., D.) on separate lines.",
          id,
        );
    }
    if (item.format === "calculation" && !item.calculation)
      add(
        "Calculation questions require a supported, code-verifiable calculation.",
        id,
      );
    if (item.format !== "calculation" && item.calculation)
      add("Calculation metadata requires the calculation question format.", id);
    if (item.calculation) {
      try {
        const actual = calculateQuestionAnswer(item.calculation);
        if (
          Math.abs(actual - item.calculation.expected) >
          Math.max(1, Math.abs(actual)) * 1e-10
        )
          add(
            `Incorrect expected calculation result; reviewed arithmetic gives ${actual}.`,
            id,
          );
        if (
          !includesNumber(
            question.rubric.answer_guidance,
            item.calculation.expected,
          )
        )
          add(
            "Expected-answer guidance must include the checked numerical result.",
            id,
          );
        if (
          item.calculation.operands.some(
            (operand) => !includesNumber(question.prompt_text, operand),
          )
        )
          add(
            "Every calculation operand must be stated in the student question.",
            id,
          );
      } catch (error) {
        add(
          error instanceof Error ? error.message : "Unsupported calculation.",
          id,
        );
      }
    }
  }
  const families = new Map<string, typeof items>();
  for (const item of items)
    families.set(item.family_id, [
      ...(families.get(item.family_id) ?? []),
      item,
    ]);
  for (const family of families.values()) {
    const initial = family.filter((item) => item.role === "initial");
    if (initial.length !== 1)
      add(
        "Each question family requires exactly one initial question.",
        family[0].question_id,
      );
    for (const role of ["alternative", "diagnostic", "retest"] as const)
      if (!family.some((item) => item.role === role))
        add(`Question family needs a ${role} question.`, family[0].question_id);
    const initialQuestion = questionMap.get(initial[0]?.question_id);
    for (const item of family) {
      const question = questionMap.get(item.question_id);
      if (
        question &&
        initialQuestion &&
        item.role !== "diagnostic" &&
        !isDeepStrictEqual(
          [...question.concept_ids].sort(),
          [...initialQuestion.concept_ids].sort(),
        )
      )
        add(
          "Initial, alternative and retest questions must assess the same approved concepts.",
          item.question_id,
        );
      if (item.role !== "retest" || !question) continue;
      for (const other of family) {
        const otherQuestion = questionMap.get(other.question_id);
        if (
          other.question_id !== item.question_id &&
          otherQuestion &&
          areQuestionsTooSimilar(
            question.prompt_text,
            otherQuestion.prompt_text,
          )
        )
          add(
            "Retest is too similar to another question in its family; change the reasoning task or scenario.",
            item.question_id,
          );
      }
    }
  }
  return issues;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  return value;
}

/** Covers the reviewed source/objectives/content and delivery policy, never server receipts. */
export function fingerprintQuestionBank(input: LessonDraftContent): string {
  const draft = LessonDraftContentSchema.parse(input);
  const bank = draft.question_bank;
  return createHash("sha256")
    .update(
      JSON.stringify(
        canonical({
          content_ref: draft.content_ref,
          attribution: draft.attribution,
          concepts: draft.concepts,
          passages: draft.passages,
          misconceptions: draft.misconceptions,
          scope: draft.scope,
          terminology_policy: draft.terminology_policy,
          misconception_policy: draft.misconception_policy,
          scoring_policy: draft.scoring_policy,
          // #52 may attach reviewed snapshots to the assembled fallback sequence.
          // That routing identifier does not alter question wording or private criteria.
          questions: draft.questions?.map((question) => ({
            ...question,
            sequence_id: undefined,
          })),
          question_guidance: draft.question_guidance,
          activity_policy: draft.activity_policy,
          preferences: bank?.preferences,
          items: bank?.items,
          delivery: bank?.delivery,
        }),
      ),
    )
    .digest("hex");
}

/** #52 consumes this after ownership/revision checks; it does not publish or assign. */
export function getReviewedQuestionBank(input: LessonDraftContent) {
  const draft = LessonDraftContentSchema.parse(input);
  const issues = validateQuestionBank(draft);
  if (issues.length)
    throw new Error(issues.map((issue) => issue.message).join("\n"));
  const bank = draft.question_bank!;
  if (bank.items.some((item) => item.review_status !== "reviewed"))
    throw new Error("Review every question before approving the bank.");
  if (
    !bank.approval ||
    bank.approval.content_fingerprint !== fingerprintQuestionBank(draft)
  )
    throw new Error(
      "The current question bank needs explicit teacher approval.",
    );
  return {
    questions: structuredClone(draft.questions!),
    question_guidance: structuredClone(draft.question_guidance!),
    items: structuredClone(bank.items),
    preferences: structuredClone(bank.preferences),
    delivery: structuredClone(bank.delivery),
    activity_policy: draft.activity_policy
      ? structuredClone(draft.activity_policy)
      : undefined,
  };
}

export type ReviewedQuestionBank = ReturnType<typeof getReviewedQuestionBank>;
export type QuestionBankSnapshot = QuestionSnapshot;
