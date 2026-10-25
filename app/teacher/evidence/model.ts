import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
  type TeacherWorkspaceParams,
} from "../../../lib/teacher/workspace-contracts.ts";
import type {
  Attempt,
  Evaluation,
  SessionEvidence,
} from "../../../lib/evidence/contracts.ts";
import type { ClassMetrics } from "../../../lib/teacher/metrics.ts";

export type EvidenceSnapshot = {
  students: { student_id: string; display_name: string }[];
  evidence: SessionEvidence[];
  metrics: ClassMetrics;
};
export type EvidenceRow = {
  student_id: string;
  student_name: string;
  session_id: string;
  data_origin: SessionEvidence["session"]["data_origin"];
  attempt: Attempt;
  evaluation: Evaluation | undefined;
};

/** Display saved attempts, including unresolved evaluations; a new empty session
 * never hides an older submitted response. Counts remain owned by ClassMetrics. */
export function teacherEvidenceRows(snapshot: EvidenceSnapshot): EvidenceRow[] {
  const students = new Map(
    snapshot.students.map((student) => [
      student.student_id,
      student.display_name,
    ]),
  );
  return snapshot.evidence
    .flatMap((evidence) =>
      evidence.attempts
        .filter((attempt) => attempt.submitted_at !== null)
        .map((attempt) => ({
          student_id: evidence.session.student_id,
          student_name:
            students.get(evidence.session.student_id) ?? "Enrolled student",
          session_id: evidence.session.id,
          data_origin: evidence.session.data_origin,
          attempt,
          evaluation:
            evidence.evaluations.find(
              (evaluation) => evaluation.id === attempt.current_evaluation_id,
            ) ??
            evidence.evaluations
              .filter((evaluation) => evaluation.attempt_id === attempt.id)
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
        Date.parse(b.attempt.submitted_at!) -
          Date.parse(a.attempt.submitted_at!) ||
        b.attempt.sequence_index - a.attempt.sequence_index ||
        b.attempt.id.localeCompare(a.attempt.id),
    );
}

export function canPrepareFromRow(row: EvidenceRow, concept: string): boolean {
  return (
    row.attempt.question.concept_ids.includes(concept) &&
    row.evaluation?.id === row.attempt.current_evaluation_id &&
    row.evaluation?.validation_status === "accepted" &&
    Boolean(
      row.evaluation.result?.per_concept_results.some(
        (result) => result.concept_id === concept,
      ),
    )
  );
}

export function evidenceResult(row: EvidenceRow, concept?: string): string {
  if (row.evaluation?.validation_status === "accepted") {
    const judgments = row.evaluation.result?.per_concept_results ?? [];
    return (
      concept
        ? judgments.filter((item) => item.concept_id === concept)
        : judgments
    )
      .map((item) => item.correctness.replaceAll("_", " "))
      .join(" / ");
  }
  if (row.evaluation?.validation_status === "evaluation_failed")
    return "Evaluation failed";
  if (row.evaluation?.validation_status === "rejected")
    return "Evaluation rejected";
  return "Awaiting evaluation";
}

export type TeachingPriority = {
  concept_id: string;
  kind: "review" | "uncertain" | "evaluation" | "followup";
  count: number;
  denominator: number;
  row: EvidenceRow | undefined;
  metric: ClassMetrics["concepts"][number];
};

/** A transparent queue of recorded concerns, not an AI ranking or diagnosis. */
export function teachingPriorities(
  snapshot: EvidenceSnapshot,
): TeachingPriority[] {
  const rows = teacherEvidenceRows(snapshot);
  return snapshot.metrics.concepts
    .flatMap((metric): TeachingPriority[] => {
      const latest = new Map<string, EvidenceRow>();
      const difficultAttempts = new Map<string, Set<string>>();
      for (const row of rows) {
        if (!row.attempt.question.concept_ids.includes(metric.concept_id))
          continue;
        if (!latest.has(row.student_id)) latest.set(row.student_id, row);
        const judgment =
          row.evaluation?.validation_status === "accepted"
            ? row.evaluation.result?.per_concept_results.find(
                (item) => item.concept_id === metric.concept_id,
              )
            : undefined;
        if (
          judgment &&
          (judgment.correctness === "incorrect" ||
            judgment.correctness === "partially_correct")
        ) {
          const attempts =
            difficultAttempts.get(row.student_id) ?? new Set<string>();
          attempts.add(row.attempt.id);
          difficultAttempts.set(row.student_id, attempts);
        }
      }
      const latestRows = [...latest.values()];
      const difficulty =
        metric.latest.incorrect + metric.latest.partially_correct;
      const unresolved =
        metric.latest.pending +
        metric.latest.evaluation_failed +
        metric.latest.rejected;
      const kinds: TeachingPriority["kind"][] = [];
      if (difficulty) kinds.push("review");
      else if (metric.latest.uncertain) kinds.push("uncertain");
      // Operational recovery must remain visible alongside a learning concern.
      if (unresolved) kinds.push("evaluation");
      if (!kinds.length && metric.repeated_difficulty.numerator)
        kinds.push("followup");
      return kinds.map((kind) => {
        const row = latestRows.find((item) => {
          const result =
            item.evaluation?.validation_status === "accepted"
              ? item.evaluation.result?.per_concept_results.find(
                  (judgment) => judgment.concept_id === metric.concept_id,
                )?.correctness
              : undefined;
          return kind === "review"
            ? result === "incorrect" || result === "partially_correct"
            : kind === "uncertain"
              ? result === "uncertain"
              : kind === "evaluation"
                ? item.evaluation?.validation_status !== "accepted"
                : (difficultAttempts.get(item.student_id)?.size ?? 0) >= 2;
        });
        return {
          concept_id: metric.concept_id,
          kind,
          count:
            kind === "review"
              ? difficulty
              : kind === "uncertain"
                ? metric.latest.uncertain
                : kind === "evaluation"
                  ? unresolved
                  : metric.repeated_difficulty.numerator,
          denominator:
            kind === "followup"
              ? metric.repeated_difficulty.denominator
              : snapshot.metrics.enrolled_students,
          row,
          metric,
        };
      });
    })
    .sort((a, b) => {
      const order = { review: 0, uncertain: 1, evaluation: 2, followup: 3 };
      return (
        order[a.kind] - order[b.kind] ||
        b.count - a.count ||
        a.concept_id.localeCompare(b.concept_id)
      );
    });
}

/** The current URL is authoritative even when all selection values were cleared.
 * Explicit actions such as Prepare from this response keep their own seed set. */
export function evidenceNavigationHref(
  href: string,
  currentSeedAttempt: string[],
  preserveSelection = true,
): string {
  if (!preserveSelection) return href;
  const target = new URL(href, "https://learning-pulse.invalid");
  if (target.origin !== "https://learning-pulse.invalid")
    throw new Error("Expected an internal evidence link.");
  const params: TeacherWorkspaceParams = {};
  for (const key of new Set(target.searchParams.keys())) {
    const values = target.searchParams.getAll(key);
    params[key] = values.length > 1 ? values : values[0];
  }
  params.seedAttempt = currentSeedAttempt;
  return (
    teacherWorkspaceHref(
      target.pathname,
      parseTeacherWorkspaceContext(params),
    ) + target.hash
  );
}
