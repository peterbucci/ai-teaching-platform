import { z } from "zod";
import {
  GenerationTargetSchema,
  GeneratedQuestionProposalSchema,
  type QuestionBankProvider,
} from "../../lib/question-bank/generate.ts";
import { QuestionBankPreferencesSchema } from "../../lib/question-bank/contracts.ts";

/** Deterministic synthetic water-lesson provider. This is not evidence of live AI quality. */
export function createFixtureQuestionBankProvider() {
  const requests: Parameters<QuestionBankProvider>[0][] = [];
  const provider: QuestionBankProvider = async (input) => {
    requests.push(input);
    const context = z
      .object({
        targets: z.array(GenerationTargetSchema),
        preferences: QuestionBankPreferencesSchema,
        passages: z.array(z.object({ id: z.string(), text: z.string() })),
      })
      .parse(JSON.parse(input.input));
    const questions = context.targets.map((target) => {
      const first = context.passages.find(
        (passage) => passage.id === "water-01",
      );
      const second = context.passages.find(
        (passage) => passage.id === "water-02",
      );
      if (!first || !second)
        throw new Error(
          "The synthetic provider requires the approved water fixture.",
        );
      const prompts = {
        initial:
          "Compare a shrinking puddle and droplets on a cold glass. Explain water's starting and ending state in each observation.",
        alternative:
          "Describe an example of evaporation and an example of condensation. Explain why the two changes go in opposite directions.",
        diagnostic:
          "A classmate says that drying water disappears and droplets come from inside a glass. Explain what you would ask about the starting and ending states to investigate these possible errors.",
        retest:
          "Evaluate this claim: a wet tabletop drying and water forming on a chilled window represent the same direction of change. Give the name of each change and justify your decision using states of matter.",
      };
      const multipleChoice =
        "\nA. Both observations change liquid to gas.\nB. The first changes liquid to gas; the second changes gas to liquid.\nC. Both observations change gas to liquid.\nD. Water disappears in the first and is created in the second.\nChoose the best explanation and justify your choice.";
      const format = target.format ?? context.preferences.format;
      return GeneratedQuestionProposalSchema.parse({
        question_id: target.question_id,
        prompt_text:
          prompts[target.role] +
          (format === "multiple_choice"
            ? multipleChoice
            : format === "calculation"
              ? " A dish starts with 12 units of water, and 4 units evaporate. Calculate how many units remain."
              : ""),
        concept_ids: target.concept_ids,
        source_passage_ids: [first.id, second.id],
        rubric: {
          answer_guidance:
            "Evaporation changes liquid water into water vapor. Condensation changes water vapor into liquid. The changes are opposite." +
            (format === "multiple_choice"
              ? " B is correct."
              : format === "calculation"
                ? " 12 minus 4 equals 8 units remaining."
                : ""),
          criteria: [
            "Explain evaporation as liquid changing to gas.",
            "Explain condensation as gas changing to liquid.",
          ],
          acceptable_variations: [
            "Equivalent language that identifies the starting and ending states.",
          ],
          partial_credit_guidance:
            "Credit each correct direction separately; note missing or reversed explanations.",
        },
        format,
        difficulty: target.difficulty ?? context.preferences.difficulty,
        feedback_guidance:
          "Evaporation is liquid becoming vapor; condensation is vapor becoming liquid. Compare the starting and ending states.",
        reasoning_error:
          "Possible confusion about water disappearing is tentative, not a confirmed student misconception.",
        source_support: [
          {
            passage_id: first.id,
            quote: "Evaporation changes liquid water into water vapor, a gas.",
            criterion: "Explain evaporation as liquid changing to gas.",
          },
          {
            passage_id: second.id,
            quote: "Condensation changes water vapor into liquid water.",
            criterion: "Explain condensation as gas changing to liquid.",
          },
        ],
        calculation:
          format === "calculation"
            ? {
                operation: "subtract",
                operands: [12, 4],
                expected: 8,
                unit: "units",
              }
            : null,
        assumptions: [],
        misconception_ids: [],
      });
    });
    return {
      ok: true,
      stage: input.stage,
      result:
        input.stage === "generation"
          ? { questions }
          : {
              reviews: context.targets.map((target) => ({
                question_id: target.question_id,
                issues: [],
              })),
            },
      model: "synthetic-question-bank-fixture",
      responseId: `fixture_${requests.length}`,
      latencyMs: 0,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  };
  return { provider, requests };
}

export const fixtureQuestionBankProvider: QuestionBankProvider = async (
  input,
) => createFixtureQuestionBankProvider().provider(input);
