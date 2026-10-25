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
) {
  return `/teacher/assignments?${new URLSearchParams({
    assignment,
    view: "progress",
    origin,
    ...selection,
    ...(listContext.class ? { class: listContext.class } : {}),
    ...(listContext.status ? { status: listContext.status } : {}),
  })}#cell-evidence`;
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
  return {
    sessions,
    metrics,
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
          };
        }),
      };
    }),
  };
}
