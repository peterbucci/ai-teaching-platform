import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import type { ResolvedLessonContent } from "../lessons/contracts.ts";
import {
  ContentRefSchema,
  ActionSchema,
  EmbeddedScaffoldingSchema,
  QuestionSnapshotSchema,
} from "./contracts.ts";
import type { ContentRef, QuestionSnapshot } from "./contracts.ts";

// This identifies the merged, approved package; schema_version is not a content version.
export const CONTENT_VERSION = "3bd292c1476f5becb658418b70ee36153cfce830";
const text = z.string().min(1);
const refs = z.array(text).min(1);
const ManifestSchema = z.object({
  package_id: text,
  assignment_id: text,
  source_id: text,
  source_commit: text,
  excerpt_sha256: text,
  assigned_passage_ids: refs,
  source_title: text,
  authors: refs,
  copyright: text,
  source_section: text,
  source_url: z.url(),
  license_id: text,
  license_url: z.url(),
  source_cautions: refs,
  teacher_review: z.object({
    status: z.literal("approved"),
    approved_by: text,
    approved_at: text,
    approval_type: text,
    approval_note: text,
  }),
});
export const ConceptsSchema = z.object({
  assignment_id: text,
  review_status: z.literal("approved"),
  scope: text,
  terminology_policy: text,
  misconception_policy: text,
  global_misconceptions: z.array(
    z.object({ id: text, definition: text, handling: text }),
  ),
  concepts: z
    .array(
      z.object({
        id: text,
        title: text,
        objectives: refs,
        boundaries: refs,
        review_status: z.literal("approved"),
        source_passage_ids: refs,
        common_misconceptions: z.array(
          z.object({
            id: text,
            definition: text,
            evidence_that_may_support: text,
            diagnostic_caution: text,
          }),
        ),
      }),
    )
    .min(1),
});
const PassagesSchema = z.object({
  assignment_id: text,
  source_id: text,
  source_commit: text,
  passages: z
    .array(
      z.object({
        id: text,
        source_id: text,
        source_commit: text,
        text,
        url: z.url(),
        start_line: z.number().int().positive(),
        end_line: z.number().int().positive(),
        sha256: text,
      }),
    )
    .min(1),
});
const ExpectedAnswerSchema = z.union([text, z.record(z.string(), z.unknown())]);
export const BankSchema = z.object({
  assignment_id: text,
  scoring_policy: z.object({
    allowed_correctness: refs,
    correct: text,
    partially_correct: text,
    incorrect: text,
    uncertain: text,
    misconception_handling: text,
    terminology_handling: text,
    numeric_handling: text,
    assistance_handling: text,
    example_response_handling: text,
    grounding: text,
  }),
  questions: z
    .array(
      z.object({
        id: text,
        concept_id: text,
        review_status: z.literal("approved"),
        prompt: text,
        expected_answer: ExpectedAnswerSchema,
        required_reasoning: z.array(text),
        acceptable_variations: z.array(text),
        partial_credit_guidance: text,
        source_passage_ids: refs,
        misconception_ids: refs,
        assumptions: z.array(text),
        embedded_scaffolding: z.array(EmbeddedScaffoldingSchema),
      }),
    )
    .min(1),
});
export const SequenceSchema = z.object({
  assignment_id: text,
  sequence_id: text,
  status: z.literal("approved"),
  concept_ids: refs,
  initial_question_id: text,
  hypothesis_id: text.nullable(),
  diagnostic_options: z
    .array(
      z.strictObject({ misconception_id: text.nullable(), question_id: text }),
    )
    .default([]),
  interpretation_rules: refs,
  bounds: z.object({
    max_neutral_clarifications: z.number().int().nonnegative(),
    max_diagnostic_prompts: z.number().int().nonnegative(),
    max_immediate_retest_prompts: z.number().int().positive(),
    max_unsupported_input_retries_total: z.number().int().nonnegative(),
    max_student_response_prompts: z.number().int().positive(),
  }),
  nodes: z.array(
    z.object({
      node_id: text,
      kind: text,
      prompt: text.optional(),
      expected_answer: ExpectedAnswerSchema.optional(),
      source_passage_ids: refs.optional(),
      feedback: text.optional(),
      feedback_variants: z.record(text, text).optional(),
      next_node_id: text.optional(),
    }),
  ),
});

function readJson(directory: string, name: string): unknown {
  return JSON.parse(readFileSync(join(directory, name), "utf8"));
}

function assertKnown(
  values: string[],
  known: ReadonlySet<string>,
  label: string,
): void {
  if (values.some((value) => !known.has(value)))
    throw new Error(`Unknown ${label}`);
  if (new Set(values).size !== values.length)
    throw new Error(`Duplicate ${label}`);
}

function answerText(answer: z.infer<typeof ExpectedAnswerSchema>): string {
  return typeof answer === "string" ? answer : JSON.stringify(answer);
}

/** Server-side filesystem loader. Public routes must return an explicit student projection. */
export function loadApprovedContent(
  directory = join(process.cwd(), "content", "network-performance-v1"),
): ApprovedContent {
  const manifest = ManifestSchema.parse(readJson(directory, "manifest.json"));
  const concepts = ConceptsSchema.parse(readJson(directory, "concepts.json"));
  const passages = PassagesSchema.parse(readJson(directory, "passages.json"));
  const bank = BankSchema.parse(readJson(directory, "question-bank.json"));
  const sequence = SequenceSchema.parse(
    readJson(directory, "diagnostic-sequence.json"),
  );
  const content_ref = ContentRefSchema.parse({
    package_id: manifest.package_id,
    content_version: CONTENT_VERSION,
    source_id: manifest.source_id,
    source_commit: manifest.source_commit,
    excerpt_sha256: manifest.excerpt_sha256,
  });
  if (
    [concepts, passages, bank, sequence].some(
      (item) => item.assignment_id !== manifest.assignment_id,
    )
  ) {
    throw new Error("Content assignment references disagree");
  }
  if (
    passages.source_id !== manifest.source_id ||
    passages.source_commit !== manifest.source_commit
  ) {
    throw new Error("Passage source version disagrees with the manifest");
  }
  const concept_ids = new Set(concepts.concepts.map((concept) => concept.id));
  const passage_ids = new Set(passages.passages.map((passage) => passage.id));
  assertKnown(
    concepts.concepts.map((concept) => concept.id),
    concept_ids,
    "concept ID",
  );
  assertKnown(
    passages.passages.map((passage) => passage.id),
    passage_ids,
    "passage ID",
  );
  assertKnown(
    manifest.assigned_passage_ids,
    passage_ids,
    "assigned passage ID",
  );
  if (passage_ids.size !== manifest.assigned_passage_ids.length)
    throw new Error("Unassigned passages in content");
  for (const passage of passages.passages) {
    if (
      passage.source_id !== manifest.source_id ||
      passage.source_commit !== manifest.source_commit
    ) {
      throw new Error("Passage has a different source version");
    }
  }
  const misconception_concepts = new Map<string, string | null>();
  type MisconceptionDefinition = {
    id: string;
    concept_id: string | null;
    definition: string;
    handling?: string;
    evidence_that_may_support?: string;
    diagnostic_caution?: string;
  };
  const misconceptions = new Map<string, MisconceptionDefinition>();
  function addMisconception(
    misconception: Omit<MisconceptionDefinition, "concept_id">,
    concept_id: string | null,
  ) {
    if (misconception_concepts.has(misconception.id))
      throw new Error("Duplicate misconception ID");
    misconception_concepts.set(misconception.id, concept_id);
    misconceptions.set(misconception.id, { ...misconception, concept_id });
  }
  for (const misconception of concepts.global_misconceptions)
    addMisconception(misconception, null);
  for (const concept of concepts.concepts) {
    assertKnown(concept.source_passage_ids, passage_ids, "concept passage ID");
    for (const misconception of concept.common_misconceptions)
      addMisconception(misconception, concept.id);
  }
  const misconception_ids = new Set(misconception_concepts.keys());
  assertKnown(sequence.concept_ids, concept_ids, "sequence concept ID");
  assertKnown(
    sequence.hypothesis_id ? [sequence.hypothesis_id] : [],
    misconception_ids,
    "sequence misconception ID",
  );
  const questions = new Map<string, QuestionSnapshot>();
  const question_guidance = new Map<
    string,
    { assumptions: string[]; misconception_ids: string[] }
  >();
  for (const question of bank.questions) {
    if (questions.has(question.id)) throw new Error("Duplicate question ID");
    assertKnown([question.concept_id], concept_ids, "question concept ID");
    assertKnown(
      question.source_passage_ids,
      passage_ids,
      "question passage ID",
    );
    assertKnown(
      question.misconception_ids,
      misconception_ids,
      "question misconception ID",
    );
    for (const scaffolding of question.embedded_scaffolding)
      assertKnown(
        scaffolding.concept_ids,
        concept_ids,
        "scaffolding concept ID",
      );
    question_guidance.set(question.id, {
      assumptions: question.assumptions,
      misconception_ids: question.misconception_ids,
    });
    questions.set(
      question.id,
      QuestionSnapshotSchema.parse({
        origin: "curated",
        question_id: question.id,
        sequence_id:
          question.id === sequence.initial_question_id
            ? sequence.sequence_id
            : null,
        prompt_text: question.prompt,
        content_ref,
        concept_ids:
          question.id === sequence.initial_question_id
            ? sequence.concept_ids
            : [question.concept_id],
        source_passage_ids: question.source_passage_ids,
        rubric: {
          version: CONTENT_VERSION,
          answer_guidance: answerText(question.expected_answer),
          criteria: question.required_reasoning,
          acceptable_variations: question.acceptable_variations,
          partial_credit_guidance: question.partial_credit_guidance,
        },
        embedded_scaffolding: question.embedded_scaffolding,
        generation: null,
      }),
    );
  }
  if (!questions.has(sequence.initial_question_id))
    throw new Error("Initial sequence question is missing");
  const node_ids = new Set(sequence.nodes.map((node) => node.node_id));
  assertKnown(
    sequence.nodes.map((node) => node.node_id),
    node_ids,
    "sequence node ID",
  );
  for (const node of sequence.nodes) {
    if (node.source_passage_ids)
      assertKnown(node.source_passage_ids, passage_ids, "node passage ID");
    if (
      ![
        "neutral_clarification",
        "diagnostic_followup",
        "immediate_retest",
      ].includes(node.kind)
    )
      continue;
    if (!node.prompt || !node.expected_answer || !node.source_passage_ids)
      throw new Error("Sequence question is incomplete");
    if (questions.has(node.node_id))
      throw new Error("Question and sequence IDs collide");
    const expected = node.expected_answer;
    const reasoning =
      typeof expected === "object" && typeof expected.reasoning === "string"
        ? [expected.reasoning]
        : [];
    const alternative =
      typeof expected === "object" &&
      typeof expected.acceptable_alternative === "string"
        ? [expected.acceptable_alternative]
        : [];
    // Sequence assumptions live in the prompt and interpretation rules; do not
    // fabricate a separate authored assumptions list for these nodes.
    question_guidance.set(node.node_id, {
      assumptions: [],
      misconception_ids: [
        ...(sequence.hypothesis_id ? [sequence.hypothesis_id] : []),
        ...concepts.global_misconceptions.map((item) => item.id),
      ],
    });
    questions.set(
      node.node_id,
      QuestionSnapshotSchema.parse({
        origin: "curated",
        question_id: node.node_id,
        sequence_id: sequence.sequence_id,
        prompt_text: node.prompt,
        content_ref,
        concept_ids: sequence.concept_ids,
        source_passage_ids: node.source_passage_ids,
        rubric: {
          version: CONTENT_VERSION,
          answer_guidance: answerText(expected),
          criteria: reasoning,
          acceptable_variations: alternative,
          partial_credit_guidance: null,
        },
        embedded_scaffolding: [],
        generation: null,
      }),
    );
  }
  if (!sequence.diagnostic_options.length && sequence.hypothesis_id) {
    const diagnostic = sequence.nodes.find(
      (node) => node.kind === "diagnostic_followup",
    );
    if (diagnostic)
      sequence.diagnostic_options.push({
        misconception_id: sequence.hypothesis_id,
        question_id: diagnostic.node_id,
      });
  }
  return {
    activity_policy: {
      allowed_actions: [...ActionSchema.options],
      allow_runtime_generation: false,
    },
    content_ref,
    attribution: {
      title: manifest.source_title,
      authors: manifest.authors,
      copyright: manifest.copyright,
      section: manifest.source_section,
      url: manifest.source_url,
      license: manifest.license_id,
      license_url: manifest.license_url,
      cautions: manifest.source_cautions,
    },
    assignment_key: manifest.assignment_id,
    approval: manifest.teacher_review,
    concept_ids,
    passage_ids,
    misconception_concepts,
    misconceptions,
    concepts: new Map(
      concepts.concepts.map((concept) => [concept.id, concept]),
    ),
    scope: concepts.scope,
    terminology_policy: concepts.terminology_policy,
    misconception_policy: concepts.misconception_policy,
    scoring_policy: bank.scoring_policy,
    sequence_id: sequence.sequence_id,
    sequence,
    sequence_interpretation_rules: sequence.interpretation_rules,
    questions,
    question_guidance,
    passages: new Map(
      passages.passages.map((passage) => [passage.id, passage]),
    ),
  };
}
export type ApprovedContent = ResolvedLessonContent;

export function validateContentRef(
  content: ApprovedContent,
  input: unknown,
): ContentRef {
  const reference = ContentRefSchema.parse(input);
  if (
    !isDeepStrictEqual(reference, ContentRefSchema.parse(content.content_ref))
  )
    throw new Error("Unknown content/source version");
  return reference;
}

export function getCuratedQuestion(
  content: ApprovedContent,
  question_id: string,
): QuestionSnapshot {
  const question = content.questions.get(question_id);
  if (!question) throw new Error("Unknown curated question ID");
  return QuestionSnapshotSchema.parse(question);
}

export function validateQuestionSnapshot(
  content: ApprovedContent,
  input: unknown,
): QuestionSnapshot {
  const question = QuestionSnapshotSchema.parse(input);
  validateContentRef(content, question.content_ref);
  assertKnown(question.concept_ids, content.concept_ids, "question concept ID");
  assertKnown(
    question.source_passage_ids,
    content.passage_ids,
    "question passage ID",
  );
  for (const scaffolding of question.embedded_scaffolding)
    assertKnown(
      scaffolding.concept_ids,
      content.concept_ids,
      "scaffolding concept ID",
    );
  if (
    question.sequence_id !== null &&
    question.sequence_id !== content.sequence_id
  )
    throw new Error("Unknown sequence ID");
  if (
    question.origin === "curated" ||
    (question.question_id !== null &&
      content.questions.has(question.question_id))
  ) {
    const curated = question.question_id
      ? content.questions.get(question.question_id)
      : undefined;
    if (!curated || !isDeepStrictEqual(question, curated))
      throw new Error("Curated snapshot differs from the approved question");
  }
  return question;
}
