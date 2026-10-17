import { z } from "zod";
import type {
  Attempt,
  Evaluation,
  SessionEvidence,
} from "../evidence/contracts.ts";

export const OriginFilterSchema = z.enum([
  "all",
  "synthetic_fixture",
  "live_demo",
]);
const count = z.number().int().nonnegative();
const ratio = z.strictObject({ numerator: count, denominator: count });
const results = z.strictObject({
  correct: count,
  partially_correct: count,
  incorrect: count,
  uncertain: count,
  pending: count,
  evaluation_failed: count,
  rejected: count,
  no_response: count,
  accepted_students: count,
  correct_rate: ratio,
});
export const ClassMetricsSchema = z.strictObject({
  definition_version: z.literal("class-evidence-v1"),
  origin_filter: OriginFilterSchema,
  enrolled_students: count,
  participation: ratio,
  no_activity_students: count,
  origins: z.strictObject({ synthetic_fixture: count, live_demo: count }),
  concepts: z.array(
    z.strictObject({
      concept_id: z.string(),
      latest: results,
      independent: results,
      content_assisted: results,
      immediate_retest: results,
      delayed_review: results,
      repeated_difficulty: ratio,
    }),
  ),
});
export type ClassMetrics = z.infer<typeof ClassMetricsSchema>;
type Observation = {
  student: string;
  attempt: Attempt;
  evaluation: Evaluation | undefined;
  evidence: SessionEvidence;
};

/** Latest submitted evidence per student/concept/dimension. Missing or failed
 * latest judgments never silently fall back to an older accepted grade.
 * Rates include uncertain accepted judgments in the denominator; no percentages
 * are fabricated for a zero denominator. This is performance, never mastery. */
export function calculateClassMetrics(
  students: readonly string[],
  conceptIds: readonly string[],
  sessions: readonly SessionEvidence[],
  origin: z.infer<typeof OriginFilterSchema> = "all",
): ClassMetrics {
  const roster = new Set(students);
  if (roster.size !== students.length)
    throw new Error("Duplicate roster student");
  if (sessions.some((e) => !roster.has(e.session.student_id)))
    throw new Error("Evidence is outside the roster");
  if (new Set(sessions.map((e) => e.session.id)).size !== sessions.length)
    throw new Error("Duplicate session");
  const selected = sessions.filter(
    (e) => origin === "all" || e.session.data_origin === origin,
  );
  const observations: Observation[] = selected
    .flatMap((evidence) =>
      evidence.attempts
        .filter((a) => a.submitted_at !== null)
        .map((attempt) => ({
          student: evidence.session.student_id,
          attempt,
          evidence,
          evaluation:
            evidence.evaluations.find(
              (e) => e.id === attempt.current_evaluation_id,
            ) ??
            evidence.evaluations
              .filter((e) => e.attempt_id === attempt.id)
              .sort(
                (a, b) =>
                  Date.parse(a.evaluated_at) - Date.parse(b.evaluated_at) ||
                  a.id.localeCompare(b.id),
              )
              .at(-1),
        })),
    )
    .sort(
      (a, b) =>
        Date.parse(a.attempt.submitted_at!) -
          Date.parse(b.attempt.submitted_at!) ||
        a.attempt.sequence_index - b.attempt.sequence_index ||
        a.attempt.id.localeCompare(b.attempt.id),
    );
  function summarize(rows: Observation[], concept: string) {
    const latest = new Map(rows.map((row) => [row.student, row]));
    const counts = {
      correct: 0,
      partially_correct: 0,
      incorrect: 0,
      uncertain: 0,
      pending: 0,
      evaluation_failed: 0,
      rejected: 0,
      no_response: students.length - latest.size,
    };
    for (const { evaluation } of latest.values()) {
      if (evaluation?.validation_status === "accepted") {
        const judgment = evaluation.result?.per_concept_results.find(
          (j) => j.concept_id === concept,
        );
        if (!judgment)
          throw new Error("Accepted evidence is missing its concept judgment");
        counts[judgment.correctness]++;
      } else if (
        evaluation?.validation_status === "evaluation_failed" ||
        evaluation?.validation_status === "rejected"
      )
        counts[evaluation.validation_status]++;
      else counts.pending++;
    }
    const accepted =
      counts.correct +
      counts.partially_correct +
      counts.incorrect +
      counts.uncertain;
    return {
      ...counts,
      accepted_students: accepted,
      correct_rate: { numerator: counts.correct, denominator: accepted },
    };
  }
  function assisted(row: Observation, concept: string) {
    return (
      row.attempt.question.embedded_scaffolding.some((s) =>
        s.concept_ids.includes(concept),
      ) ||
      row.evidence.interventions.some(
        (i) =>
          row.attempt.assistance?.intervention_ids.includes(i.id) &&
          i.concept_ids.includes(concept) &&
          ["hint", "worked_example", "corrective_feedback"].includes(i.type),
      )
    );
  }
  const participants = new Set(observations.map((o) => o.student)).size;
  return ClassMetricsSchema.parse({
    definition_version: "class-evidence-v1",
    origin_filter: origin,
    enrolled_students: students.length,
    participation: { numerator: participants, denominator: students.length },
    no_activity_students: students.length - participants,
    origins: Object.fromEntries(
      ["synthetic_fixture", "live_demo"].map((kind) => [
        kind,
        new Set(
          selected
            .filter(
              (e) =>
                e.session.data_origin === kind &&
                e.attempts.some((a) => a.submitted_at !== null),
            )
            .map((e) => e.session.student_id),
        ).size,
      ]),
    ),
    concepts: conceptIds.map((concept_id) => {
      const rows = observations.filter((o) =>
        o.attempt.question.concept_ids.includes(concept_id),
      );
      const difficulties = new Map<string, Set<string>>();
      for (const row of rows) {
        const judgment =
          row.evaluation?.validation_status === "accepted"
            ? row.evaluation.result?.per_concept_results.find(
                (j) => j.concept_id === concept_id,
              )
            : undefined;
        if (
          judgment &&
          ["incorrect", "partially_correct"].includes(judgment.correctness)
        ) {
          const ids = difficulties.get(row.student) ?? new Set<string>();
          ids.add(row.attempt.id);
          difficulties.set(row.student, ids);
        }
      }
      return {
        concept_id,
        latest: summarize(rows, concept_id),
        independent: summarize(
          rows.filter(
            (o) =>
              o.attempt.assistance?.independent_retrieval_eligible_by_concept[
                concept_id
              ] === true,
          ),
          concept_id,
        ),
        content_assisted: summarize(
          rows.filter((o) => assisted(o, concept_id)),
          concept_id,
        ),
        immediate_retest: summarize(
          rows.filter((o) => o.attempt.intent === "immediate_retest"),
          concept_id,
        ),
        delayed_review: summarize(
          rows.filter((o) => o.attempt.intent === "delayed_review"),
          concept_id,
        ),
        repeated_difficulty: {
          numerator: [...difficulties.values()].filter((ids) => ids.size >= 2)
            .length,
          denominator: new Set(
            rows
              .filter((o) => o.evaluation?.validation_status === "accepted")
              .map((o) => o.student),
          ).size,
        },
      };
    }),
  });
}
