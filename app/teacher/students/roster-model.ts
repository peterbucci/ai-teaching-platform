import type {
  Attempt,
  Evaluation,
  SessionEvidence,
  Intervention,
} from "../../../lib/evidence/contracts.ts";
import type { InterventionReview } from "../../../lib/interventions/approval-contracts.ts";
import type { RosterContext } from "./roster-context.ts";

export type RosterSnapshot = {
  assignment_id: string;
  class_id: string;
  students: { student_id: string; display_name: string }[];
  evidence: SessionEvidence[];
};
export function authorizedRosterSelection(
  data: RosterSnapshot,
  context: RosterContext,
) {
  if (
    data.evidence.some(
      ({ session }) =>
        session.assignment_id !== data.assignment_id ||
        session.class_id !== data.class_id ||
        !data.students.some((s) => s.student_id === session.student_id),
    )
  )
    return false;
  if (
    context.student &&
    !data.students.some((s) => s.student_id === context.student)
  )
    return false;
  const sessions = data.evidence.filter(
    (e) => !context.student || e.session.student_id === context.student,
  );
  const session = context.session
    ? sessions.find((e) => e.session.id === context.session)
    : undefined;
  if (context.session && !session) return false;
  const attempt = context.attempt
    ? (session ? [session] : sessions)
        .flatMap((e) => e.attempts)
        .find((a) => a.id === context.attempt)
    : undefined;
  if (
    context.attempt &&
    (!attempt ||
      (context.concept &&
        !attempt.question.concept_ids.includes(context.concept)))
  )
    return false;
  if (
    context.evaluation &&
    (!attempt ||
      !(session ? [session] : sessions).some((e) =>
        e.evaluations.some(
          (v) => v.id === context.evaluation && v.attempt_id === attempt.id,
        ),
      ))
  )
    return false;
  return true;
}

export function evaluationFor(
  evidence: SessionEvidence,
  attempt: Attempt,
): Evaluation | undefined {
  // Only the exact accepted pointer can supply an educational judgment. A later
  // failed retry must never erase it; a historical accepted row cannot replace it.
  const accepted = evidence.evaluations.find(
    (e) =>
      e.id === attempt.current_evaluation_id &&
      e.attempt_id === attempt.id &&
      e.validation_status === "accepted",
  );
  return (
    accepted ??
    evidence.evaluations
      .filter(
        (e) =>
          e.attempt_id === attempt.id && e.validation_status !== "accepted",
      )
      .sort(
        (a, b) =>
          Date.parse(a.evaluated_at) - Date.parse(b.evaluated_at) ||
          a.id.localeCompare(b.id),
      )
      .at(-1)
  );
}

export function responseMark(
  evidence: SessionEvidence,
  attempt: Attempt,
  concept: string,
) {
  const evaluation = evaluationFor(evidence, attempt);
  const result =
    evaluation?.validation_status === "accepted"
      ? evaluation.result?.per_concept_results.find(
          (r) => r.concept_id === concept,
        )
      : undefined;
  const state = !attempt.submitted_at
    ? "missing"
    : (result?.correctness ??
      (evaluation?.validation_status === "evaluation_failed"
        ? "failed"
        : evaluation?.validation_status === "rejected"
          ? "rejected"
          : "pending"));
  const labels = {
    correct: "Correct",
    partially_correct: "Partly correct",
    incorrect: "Incorrect",
    uncertain: "Uncertain",
    missing: "Shown, not answered",
    failed: "Evaluation failed",
    rejected: "Evaluation rejected",
    pending: "Evaluation pending",
  };
  const symbols = {
    correct: "✓",
    partially_correct: "◐",
    incorrect: "×",
    uncertain: "?",
    missing: "—",
    failed: "!",
    rejected: "!",
    pending: "…",
  };
  const assistance = attempt.assistance;
  const linked = linkedAssistance(evidence, attempt);
  const relevant = linked.flatMap(({ record }) =>
    record?.concept_ids.includes(concept) ? [record] : [],
  );
  const supplied = attempt.question.embedded_scaffolding.some((s) =>
    s.concept_ids.includes(concept),
  );
  const contentHelp = relevant.some((h) =>
    ["hint", "worked_example", "corrective_feedback"].includes(h.type),
  );
  const reading = relevant.some((h) => h.type === "reading");
  const eligible =
    assistance?.independent_retrieval_eligible_by_concept[concept] === true;
  const unavailable = linked.some((item) => !item.record);
  const help =
    !assistance || eligible
      ? "none"
      : supplied || contentHelp
        ? "help"
        : reading
          ? "reading"
          : "none";
  const condition = !assistance
    ? "Assistance at submission unavailable"
    : eligible
      ? "Eligible independent retrieval"
      : unavailable
        ? "Linked assistance details unavailable"
        : help === "reading"
          ? "Reading only before submission for this idea"
          : help === "help"
            ? "Help or supplied content before submission for this idea"
            : "No content assistance recorded for this idea; not independent retrieval";
  return {
    state,
    symbol: symbols[state],
    label: labels[state],
    condition,
    help,
    evaluation,
  };
}

export function studentSessions(data: RosterSnapshot, student: string) {
  return data.evidence
    .filter((e) => e.session.student_id === student)
    .sort(
      (a, b) =>
        Date.parse(a.session.started_at) - Date.parse(b.session.started_at) ||
        a.session.id.localeCompare(b.session.id),
    );
}
export function participation(sessions: SessionEvidence[]) {
  return sessions.some((e) => e.attempts.some((a) => a.submitted_at))
    ? "submitted"
    : sessions.length
      ? "opened"
      : "missing";
}
export function conceptTrail(sessions: SessionEvidence[], concept: string) {
  return sessions
    .flatMap((evidence) =>
      evidence.attempts
        .filter((a) => a.question.concept_ids.includes(concept))
        .map((attempt) => ({ evidence, attempt })),
    )
    .sort(
      (a, b) =>
        Date.parse(a.attempt.submitted_at ?? a.attempt.presented_at) -
          Date.parse(b.attempt.submitted_at ?? b.attempt.presented_at) ||
        a.attempt.id.localeCompare(b.attempt.id),
    );
}
export type WorkEvent =
  | { at: string; kind: "answer"; attempt: Attempt }
  | { at: string; kind: "help"; help: Intervention };
export function workEvents(
  evidence: SessionEvidence,
  concept?: string,
): WorkEvent[] {
  const answers: WorkEvent[] = evidence.attempts
    .filter((a) => !concept || a.question.concept_ids.includes(concept))
    .map((attempt) => ({
      at: attempt.submitted_at ?? attempt.presented_at,
      kind: "answer",
      attempt,
    }));
  const help: WorkEvent[] = evidence.interventions
    .filter(
      (h) =>
        h.delivery_status === "displayed" &&
        h.visible_at &&
        (!concept ||
          h.concept_ids.includes(concept) ||
          evidence.attempts.some(
            (a) =>
              a.question.concept_ids.includes(concept) &&
              a.assistance?.intervention_ids.includes(h.id),
          )),
    )
    .map((h) => ({ at: h.visible_at!, kind: "help", help: h }));
  return [...answers, ...help].sort(
    (a, b) =>
      Date.parse(a.at) - Date.parse(b.at) ||
      (a.kind === b.kind ? 0 : a.kind === "help" ? -1 : 1),
  );
}
export function linkedAssistance(evidence: SessionEvidence, attempt: Attempt) {
  return (attempt.assistance?.intervention_ids ?? []).map((id) => ({
    id,
    record: evidence.interventions.find(
      (h) =>
        h.id === id &&
        h.session_id === attempt.session_id &&
        h.delivery_status === "displayed" &&
        h.visible_at &&
        attempt.submitted_at &&
        Date.parse(h.visible_at) <= Date.parse(attempt.submitted_at),
    ),
  }));
}
export function studentInterventions(
  reviews: InterventionReview[],
  student: string,
) {
  return reviews.flatMap((review) => {
    const recipient = review.approval?.recipient_ids.includes(student) ?? false;
    const inEvidence = review.draft.evidence.observations.some(
      (o) => o.student_id === student,
    );
    if (!recipient && !inEvidence) return [];
    const delivered =
      recipient &&
      review.delivery?.approval_id === review.approval?.id &&
      review.delivery?.recipient_ids.includes(student);
    return [
      {
        review,
        recipient,
        inEvidence,
        status: delivered
          ? "Delivered"
          : recipient
            ? "Approved · not delivered"
            : review.draft.status === "dismissed"
              ? "Dismissed"
              : "Evidence only · not a recipient",
      },
    ];
  });
}
