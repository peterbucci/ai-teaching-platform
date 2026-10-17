import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  EvaluationResultSchema,
  EvidenceQuoteSchema,
  MisconceptionCandidateSchema,
} from "../evidence/contracts.ts";
import type { Attempt, EvidenceQuote } from "../evidence/contracts.ts";
import type { ApprovedContent } from "../evidence/content.ts";
import { validateEvaluationReferences } from "../evidence/rules.ts";

// The model selects exact quotations. Code supplies identity and offsets instead
// of asking a language model to count Unicode characters or invent record IDs.
const QuoteSelectionSchema = z.strictObject({
  quote: EvidenceQuoteSchema.shape.quote,
  interpretation: EvidenceQuoteSchema.shape.interpretation,
});
export const ModelEvaluationSchema = EvaluationResultSchema.extend({
  evidence_quotes: z.array(QuoteSelectionSchema),
  misconception_candidates: z.array(
    z.strictObject({
      ...MisconceptionCandidateSchema.shape,
      evidence_quotes: z.array(QuoteSelectionSchema).min(1),
    }),
  ),
});

function locateQuote(
  selection: z.infer<typeof QuoteSelectionSchema>,
  attempt: Attempt,
): EvidenceQuote {
  const response = attempt.response_text;
  if (response === null) throw new Error("Attempt is not submitted");
  const start = response.indexOf(selection.quote);
  if (start < 0 || response.indexOf(selection.quote, start + 1) >= 0)
    throw new Error("Evidence quotation must identify one exact response span");
  const startCharacter = Array.from(response.slice(0, start)).length;
  return {
    ...selection,
    response_id: attempt.id,
    start_character: startCharacter,
    end_character: startCharacter + Array.from(selection.quote).length,
  };
}

/** Reference validation is not a guarantee of educational correctness. */
export function validateModelResult(
  content: ApprovedContent,
  attempt: Attempt,
  input: unknown,
) {
  const selected = ModelEvaluationSchema.parse(input);
  const result = EvaluationResultSchema.parse({
    ...selected,
    evidence_quotes: selected.evidence_quotes.map((quote) =>
      locateQuote(quote, attempt),
    ),
    misconception_candidates: selected.misconception_candidates.map(
      (candidate) => ({
        ...candidate,
        evidence_quotes: candidate.evidence_quotes.map((quote) =>
          locateQuote(quote, attempt),
        ),
      }),
    ),
  });
  if (!result.reasoning_observed.trim())
    throw new Error(
      "Evaluation must explain the observed evidence or its absence",
    );
  if (
    result.per_concept_results.some(
      (item) => item.correctness !== "uncertain",
    ) &&
    !result.evidence_quotes.length
  )
    throw new Error("Interpreted judgments require explicit response evidence");
  validateEvaluationReferences(
    content,
    {
      id: randomUUID(),
      attempt_id: attempt.id,
      validation_status: "accepted",
      evaluator: {
        type: "language_model",
        model: "validation",
        version: "validation",
      },
      evaluated_at: new Date().toISOString(),
      supersedes_id: null,
      result,
      applied_result: null,
      failure_reason: null,
    },
    attempt,
    [attempt],
  );
  return result;
}
