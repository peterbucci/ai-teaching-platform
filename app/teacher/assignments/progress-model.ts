import type { z } from "zod";
import type {
  Attempt,
  SessionEvidence,
} from "../../../lib/evidence/contracts.ts";
import {
  calculateClassMetrics,
  type OriginFilterSchema,
} from "../../../lib/teacher/metrics.ts";
import type { readAssignmentEvidence } from "../../../lib/teacher/store.ts";
import type { AssignmentWorkspace } from "./workspace-model.ts";

export type OriginFilter = z.infer<typeof OriginFilterSchema>;
export type AssignmentEvidence = Awaited<
  ReturnType<typeof readAssignmentEvidence>
>;
export type ProgressEvidence = { evidence: SessionEvidence; attempt: Attempt };
export type ProgressListContext = Pick<
  Partial<AssignmentWorkspace>,
  "class" | "status"
>;
export type ProgressView = "grid" | "concepts" | "questions" | "sessions";
export type ProgressPane = "grid" | "details";
export type ProgressFollowup = {
  id: string;
  title: string;
  recipientIds: string[];
};

export function progressEvaluationHistory({
  evidence,
  attempt,
}: ProgressEvidence) {
  return evidence.evaluations
    .filter((item) => item.attempt_id === attempt.id)
    .sort(
      (a, b) =>
        Date.parse(a.evaluated_at) - Date.parse(b.evaluated_at) ||
        a.id.localeCompare(b.id),
    );
}

/** Match the shared metric's accepted pointer before considering a later failure. */
export function progressEvaluation(row: ProgressEvidence) {
  const { evidence, attempt } = row;
  return (
    evidence.evaluations.find(
      (item) => item.id === attempt.current_evaluation_id,
    ) ?? progressEvaluationHistory(row).at(-1)
  );
}

export function progressHref(
  assignment: string,
  origin: OriginFilter,
  selection: { student?: string; concept?: string } = {},
  listContext: ProgressListContext = {},
  navigation: { progressView?: ProgressView; pane?: ProgressPane } = {},
) {
  return `/teacher/assignments?${new URLSearchParams({
    assignment,
    view: "progress",
    origin,
    ...selection,
    ...(listContext.class ? { class: listContext.class } : {}),
    ...(listContext.status ? { status: listContext.status } : {}),
    ...(navigation.progressView
      ? { progressView: navigation.progressView }
      : {}),
    ...(navigation.pane ? { pane: navigation.pane } : {}),
  })}#cell-evidence`;
}

export function progressSelectionId(student?: string, concept?: string) {
  return `ap-selection-${student ?? "all"}-${concept ?? "all"}`;
}

export function progressEvidenceHref(
  row: ProgressEvidence,
  origin: OriginFilter,
  concept?: string,
) {
  return `/teacher/sessions/${row.evidence.session.id}?${new URLSearchParams({
    assignment: row.evidence.session.assignment_id,
    origin,
    student: row.evidence.session.student_id,
    ...(concept ? { concept } : {}),
  })}#attempt-${row.attempt.id}`;
}

/** Saved attempts, not just the newest session: an empty resume cannot hide work. */
export function selectProgressEvidence(
  sessions: readonly SessionEvidence[],
  student?: string,
  concept?: string,
): ProgressEvidence[] {
  return sessions
    .filter((item) => !student || item.session.student_id === student)
    .flatMap((evidence) =>
      evidence.attempts
        .filter(
          (attempt) =>
            !concept || attempt.question.concept_ids.includes(concept),
        )
        .map((attempt) => ({ evidence, attempt })),
    )
    .sort(
      (a, b) =>
        Date.parse(b.attempt.submitted_at ?? b.attempt.presented_at) -
          Date.parse(a.attempt.submitted_at ?? a.attempt.presented_at) ||
        b.attempt.sequence_index - a.attempt.sequence_index ||
        b.attempt.id.localeCompare(a.attempt.id),
    );
}

const resultLabels = {
  correct: "Correct",
  partially_correct: "Partly correct",
  incorrect: "Incorrect",
  uncertain: "Uncertain",
  pending: "Evaluation pending",
  evaluation_failed: "Evaluation failed",
  rejected: "Evaluation rejected",
  no_response: "No answer yet",
} as const;
export type ProgressStatus = keyof typeof resultLabels;
export function progressStatusLabel(status: ProgressStatus) {
  return resultLabels[status];
}

/** Read the saved judgment and displayed assistance; never infer a new grade. */
export function progressMark(row: ProgressEvidence, concept: string) {
  const { attempt, evidence } = row;
  const evaluation = progressEvaluation(row);
  const judgment =
    evaluation?.validation_status === "accepted"
      ? evaluation.result?.per_concept_results.find(
          (item) => item.concept_id === concept,
        )
      : undefined;
  const status: ProgressStatus = !attempt.submitted_at
    ? "no_response"
    : (judgment?.correctness ??
      (evaluation?.validation_status === "evaluation_failed"
        ? "evaluation_failed"
        : evaluation?.validation_status === "rejected"
          ? "rejected"
          : "pending"));
  const shown = evidence.interventions.filter(
    (item) =>
      attempt.assistance?.intervention_ids.includes(item.id) &&
      item.delivery_status === "displayed" &&
      item.visible_at !== null &&
      item.concept_ids.includes(concept),
  );
  const helped =
    attempt.question.embedded_scaffolding.some((item) =>
      item.concept_ids.includes(concept),
    ) ||
    shown.some((item) =>
      ["hint", "worked_example", "corrective_feedback"].includes(item.type),
    );
  const assistance = helped
    ? "help"
    : shown.some((item) => item.type === "reading")
      ? "reading"
      : "none";
  return {
    attemptId: attempt.id,
    status,
    assistance,
    label: `${progressStatusLabel(status)}${assistance === "help" ? "; content help shown before" : assistance === "reading" ? "; reading only before" : "; no content help recorded"}`,
  };
}

export function buildAssignmentProgress(
  data: AssignmentEvidence,
  origin: OriginFilter,
) {
  const sessions = data.evidence.filter(
    (item) => origin === "all" || item.session.data_origin === origin,
  );
  const conceptIds = data.metrics.concepts.map((item) => item.concept_id);
  const metrics = calculateClassMetrics(
    data.students.map((student) => student.student_id),
    conceptIds,
    sessions,
    origin,
  );
  const attempts = selectProgressEvidence(sessions);
  const submitted = attempts.filter(
    ({ attempt }) => attempt.submitted_at !== null,
  );
  const evaluations = submitted.map(progressEvaluation);
  const assistanceSummary = submitted.reduce(
    (counts, row) => {
      const marks = row.attempt.question.concept_ids.map((concept) =>
        progressMark(row, concept),
      );
      if (marks.some((mark) => mark.assistance === "help"))
        counts.helpResponses++;
      else if (marks.some((mark) => mark.assistance === "reading"))
        counts.readingOnlyResponses++;
      return counts;
    },
    { helpResponses: 0, readingOnlyResponses: 0 },
  );
  return {
    sessions,
    metrics,
    assistanceSummary,
    reachedByConcept: Object.fromEntries(
      conceptIds.map((concept) => [
        concept,
        new Set(
          attempts
            .filter((row) => row.attempt.question.concept_ids.includes(concept))
            .map((row) => row.evidence.session.student_id),
        ).size,
      ]),
    ),
    summary: {
      enrolled: data.students.length,
      startedStudents: new Set(sessions.map((item) => item.session.student_id))
        .size,
      studentsAnswered: metrics.participation.numerator,
      completedSessions: sessions.filter(
        (item) => item.session.status === "completed",
      ).length,
      submittedResponses: submitted.length,
      unansweredQuestions: attempts.length - submitted.length,
      pendingEvaluations: evaluations.filter(
        (item) => !item || item.validation_status === "pending_review",
      ).length,
      failedEvaluations: evaluations.filter(
        (item) => item?.validation_status === "evaluation_failed",
      ).length,
      rejectedEvaluations: evaluations.filter(
        (item) => item?.validation_status === "rejected",
      ).length,
    },
    students: data.students.map((student) => {
      const history = sessions.filter(
        (item) => item.session.student_id === student.student_id,
      );
      const studentMetrics = calculateClassMetrics(
        [student.student_id],
        conceptIds,
        history,
        origin,
      );
      return {
        ...student,
        sessionCount: history.length,
        helpShownCount: history.reduce(
          (count, item) =>
            count +
            item.interventions.filter(
              (intervention) =>
                intervention.delivery_status === "displayed" &&
                intervention.visible_at !== null &&
                ["hint", "worked_example", "corrective_feedback"].includes(
                  intervention.type,
                ),
            ).length,
          0,
        ),
        readingShownCount: history.reduce(
          (count, item) =>
            count +
            item.interventions.filter(
              (intervention) =>
                intervention.delivery_status === "displayed" &&
                intervention.visible_at !== null &&
                intervention.type === "reading",
            ).length,
          0,
        ),
        responseCount: history.reduce(
          (total, item) =>
            total +
            item.attempts.filter((attempt) => attempt.submitted_at !== null)
              .length,
          0,
        ),
        cells: studentMetrics.concepts.map((concept) => {
          const evidence = selectProgressEvidence(
            history,
            student.student_id,
            concept.concept_id,
          );
          const latestSubmitted = evidence.find(
            (row) => row.attempt.submitted_at !== null,
          );
          const status =
            (Object.keys(resultLabels) as ProgressStatus[]).find(
              (key) => concept.latest[key] > 0,
            ) ?? "no_response";
          return {
            conceptId: concept.concept_id,
            status,
            evidenceCount: evidence.length,
            latestSubmitted,
            marks: [...evidence]
              .reverse()
              .map((row) => progressMark(row, concept.concept_id)),
          };
        }),
      };
    }),
  };
}
