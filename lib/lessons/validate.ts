import "server-only";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { LessonContentSchema, type LessonContent } from "./contracts.ts";
import {
  validateQuestionSnapshot,
  type ApprovedContent,
} from "../evidence/content.ts";

function requireRule(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function unique<T extends { id: string }>(items: T[], label: string) {
  const map = new Map(items.map((item) => [item.id, item]));
  requireRule(map.size === items.length, `Duplicate ${label} ID`);
  return map;
}
/** Restore the existing evaluator/controller context from one immutable version. */
export function hydrateLessonContent(input: unknown): ApprovedContent {
  const data = LessonContentSchema.parse(input);
  const concepts = unique(data.concepts, "concept");
  const passages = unique(data.passages, "passage");
  const misconceptions = unique(data.misconceptions, "misconception");
  const questions = new Map(
    data.questions.map((q) => [q.question_id ?? "", q]),
  );
  requireRule(
    questions.size === data.questions.length && !questions.has(""),
    "Published questions require unique stable IDs",
  );
  const question_guidance = new Map(
    data.question_guidance.map(({ question_id, ...guidance }) => [
      question_id,
      guidance,
    ]),
  );
  requireRule(
    question_guidance.size === data.question_guidance.length,
    "Duplicate question guidance",
  );
  const content: ApprovedContent = {
    ...data,
    concepts,
    passages,
    misconceptions,
    questions,
    question_guidance,
    concept_ids: new Set(concepts.keys()),
    passage_ids: new Set(passages.keys()),
    misconception_concepts: new Map(
      data.misconceptions.map((m) => [m.id, m.concept_id]),
    ),
    sequence_id: data.sequence.sequence_id,
    sequence_interpretation_rules: data.sequence.interpretation_rules,
  };
  function known(
    ids: string[],
    set: ReadonlyMap<string, unknown> | ReadonlySet<string>,
    label: string,
  ) {
    requireRule(
      new Set(ids).size === ids.length && ids.every((id) => set.has(id)),
      `Unknown or duplicate ${label}`,
    );
  }
  const ref = data.content_ref;
  for (const passage of data.passages) {
    requireRule(
      passage.source_id === ref.source_id,
      "Mismatched passage source",
    );
    if ("source_kind" in ref) {
      requireRule(
        passage.source_version === ref.source_version &&
          passage.source_commit === undefined,
        "Mismatched uploaded passage version",
      );
      requireRule(
        passage.sha256 ===
          createHash("sha256").update(passage.text).digest("hex"),
        "Mismatched passage hash",
      );
      requireRule(
        isDeepStrictEqual(data.attribution, ref.attribution),
        "Mismatched source attribution",
      );
    } else
      requireRule(
        passage.source_commit === ref.source_commit,
        "Mismatched curated passage version",
      );
  }
  for (const concept of data.concepts) {
    known(concept.source_passage_ids, passages, "concept passage");
    for (const m of concept.common_misconceptions)
      requireRule(
        misconceptions.get(m.id)?.concept_id === concept.id,
        "Mismatched concept misconception",
      );
  }
  for (const m of data.misconceptions)
    if (m.concept_id !== null)
      requireRule(concepts.has(m.concept_id), "Unknown misconception concept");
  for (const question of data.questions) {
    validateQuestionSnapshot(content, question);
    requireRule(
      question_guidance.has(question.question_id!),
      "Missing private question guidance",
    );
  }
  for (const [id, guidance] of question_guidance) {
    requireRule(questions.has(id), "Unknown guidance question");
    known(guidance.misconception_ids, misconceptions, "guidance misconception");
  }
  const sequence = data.sequence;
  known(sequence.concept_ids, concepts, "sequence concept");
  if (sequence.hypothesis_id)
    requireRule(
      misconceptions.has(sequence.hypothesis_id),
      "Unknown sequence hypothesis",
    );
  const nodes = new Map(sequence.nodes.map((n) => [n.node_id, n]));
  requireRule(nodes.size === sequence.nodes.length, "Duplicate sequence node");
  requireRule(
    nodes.get(sequence.initial_question_id)?.kind === "initial_retrieval",
    "Missing initial sequence activity",
  );
  const questionKinds = new Set([
    "initial_retrieval",
    "neutral_clarification",
    "diagnostic_followup",
    "immediate_retest",
  ]);
  const helpKinds = new Set([
    "corrective_feedback",
    "arithmetic_feedback",
    "closing_feedback_and_review",
    "unsupported_input_or_evaluation_fallback",
  ]);
  for (const node of sequence.nodes) {
    requireRule(
      questionKinds.has(node.kind) || helpKinds.has(node.kind),
      "Unsupported sequence activity",
    );
    if (node.source_passage_ids)
      known(node.source_passage_ids, passages, "activity passage");
    if (node.next_node_id)
      requireRule(nodes.has(node.next_node_id), "Unknown next activity");
    if (questionKinds.has(node.kind)) {
      const q = questions.get(node.node_id);
      requireRule(
        !!q && q.sequence_id === sequence.sequence_id,
        "Missing sequence question snapshot",
      );
      requireRule(
        q.concept_ids.every((id) => sequence.concept_ids.includes(id)),
        "Sequence question outside concept scope",
      );
      if (node.prompt)
        requireRule(
          q.prompt_text === node.prompt,
          "Activity prompt differs from question",
        );
    }
  }
  const one = (kind: string) => {
    const matches = sequence.nodes.filter((n) => n.kind === kind);
    requireRule(
      matches.length === 1,
      `Expected one supported ${kind} activity`,
    );
    return matches[0];
  };
  if (sequence.bounds.max_neutral_clarifications > 0)
    one("neutral_clarification");
  for (const kind of ["corrective_feedback", "arithmetic_feedback"]) {
    const feedback = one(kind);
    requireRule(
      !!feedback.feedback &&
        !!feedback.source_passage_ids?.length &&
        nodes.get(feedback.next_node_id ?? "")?.kind === "immediate_retest",
      "Feedback must cite approved passages and lead to a retest",
    );
  }
  requireRule(
    !!one("unsupported_input_or_evaluation_fallback").feedback_variants
      ?.unrelated_or_empty,
    "Missing safe fallback",
  );
  const closing = one("closing_feedback_and_review");
  requireRule(!!closing.source_passage_ids?.length, "Missing closing passages");
  for (const outcome of [
    "correct_after_feedback",
    "partial_after_feedback_arithmetic_or_units",
    "partial_or_incorrect_after_feedback",
    "uncertain_after_feedback",
  ])
    requireRule(
      !!closing.feedback_variants?.[outcome],
      "Missing closing feedback outcome",
    );
  requireRule(
    new Set(sequence.diagnostic_options.map((o) => o.question_id)).size ===
      sequence.diagnostic_options.length,
    "Duplicate diagnostic option",
  );
  for (const option of sequence.diagnostic_options) {
    requireRule(
      option.misconception_id === null ||
        misconceptions.has(option.misconception_id),
      "Unknown diagnostic hypothesis",
    );
    requireRule(
      nodes.get(option.question_id)?.kind === "diagnostic_followup",
      "Diagnostic option is not an approved diagnostic",
    );
    if (option.misconception_id !== null) {
      const conceptId = misconceptions.get(option.misconception_id)?.concept_id;
      requireRule(
        !!conceptId &&
          !!questions.get(option.question_id)?.concept_ids.includes(conceptId),
        "A diagnostic must assess the concept of its mapped misconception",
      );
    }
  }
  // Only the existing bounded sequence is executable. Publication does not enable arbitrary graph code.
  const retests = sequence.nodes.filter((n) => n.kind === "immediate_retest");
  requireRule(
    retests.length === sequence.bounds.max_immediate_retest_prompts,
    "Retest count differs from policy",
  );
  const starts = sequence.nodes
    .filter(
      (n) =>
        n.kind === "corrective_feedback" || n.kind === "arithmetic_feedback",
    )
    .map((n) => n.next_node_id);
  requireRule(
    new Set(retests.map((n) => questions.get(n.node_id)?.prompt_text)).size ===
      retests.length,
    "Retests must ask distinct questions",
  );
  const beforeFeedback = sequence.nodes.filter((n) =>
    [
      "initial_retrieval",
      "neutral_clarification",
      "diagnostic_followup",
    ].includes(n.kind),
  );
  for (const id of starts)
    requireRule(
      !beforeFeedback.some(
        (n) =>
          questions.get(n.node_id)?.prompt_text ===
          questions.get(id ?? "")?.prompt_text,
      ),
      "Feedback retest must differ from every preceding question",
    );
  for (const start of retests) {
    const visited = new Set<string>();
    let current: typeof start | undefined = start;
    while (current) {
      requireRule(!visited.has(current.node_id), "Cyclic retest sequence");
      visited.add(current.node_id);
      const next: typeof start | undefined = current.next_node_id
        ? nodes.get(current.next_node_id)
        : undefined;
      requireRule(
        !next || next.kind === "immediate_retest",
        "Retest must lead to retest or finish",
      );
      current = next;
    }
    if (starts.includes(start.node_id))
      requireRule(
        visited.size === retests.length,
        "Feedback must reach the complete bounded retest sequence",
      );
  }
  const requiredActions = [
    "ASK_RETRIEVAL_QUESTION",
    "GIVE_CORRECTIVE_FEEDBACK",
    "RETEST_CONCEPT",
    "SCHEDULE_REVIEW",
    "END_SESSION",
  ];
  if (sequence.bounds.max_neutral_clarifications > 0)
    requiredActions.push("ASK_SELF_EXPLANATION");
  if (sequence.diagnostic_options.length)
    requiredActions.push("ASK_DIAGNOSTIC_FOLLOWUP");
  requireRule(
    requiredActions.every((action) =>
      data.activity_policy.allowed_actions.some(
        (allowed) => allowed === action,
      ),
    ),
    "Activity policy must permit its deterministic fallback sequence",
  );
  return content;
}
export function serializeLessonContent(
  content: ApprovedContent,
): LessonContent {
  return LessonContentSchema.parse({
    content_ref: content.content_ref,
    attribution: content.attribution,
    assignment_key: content.assignment_key,
    approval: content.approval,
    concepts: [...content.concepts.values()],
    passages: [...content.passages.values()],
    misconceptions: [...content.misconceptions.values()],
    scope: content.scope,
    terminology_policy: content.terminology_policy,
    misconception_policy: content.misconception_policy,
    scoring_policy: content.scoring_policy,
    sequence: content.sequence,
    questions: [...content.questions.values()],
    question_guidance: [...content.question_guidance].map(
      ([question_id, guidance]) => ({ question_id, ...guidance }),
    ),
    activity_policy: content.activity_policy,
  });
}
