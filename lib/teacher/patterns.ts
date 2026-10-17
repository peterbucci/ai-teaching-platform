import type {
  AppliedResult,
  EvidenceQuote,
  SessionEvidence,
} from "../evidence/contracts.ts";

type Status = AppliedResult["hypothesis_events"][number]["status"];
export type PatternObservation = {
  student_id: string;
  session_id: string;
  data_origin: SessionEvidence["session"]["data_origin"];
  attempt_id: string;
  evaluation_id: string;
  concept_id: string;
  misconception_id: string;
  status: Status;
  basis:
    "applied_hypothesis" | "tentative_candidate" | "uncategorized_response";
  at: string;
  reason: string;
  quotes: EvidenceQuote[];
  supporting_evaluation_ids: string[];
  contradicting_evaluation_ids: string[];
};
export type PatternGroup = {
  concept_id: string;
  misconception_id: string;
  counts: Record<Status, number>;
  students: {
    student_id: string;
    current: PatternObservation;
    history: PatternObservation[];
  }[];
  denominator: number;
};

/** Called only with authorized, validated assignment evidence. No new inference:
 * applied hypothesis statuses are preserved; uninvestigated model candidates are
 * explicitly tentative. Latest observation per student/category wins, not the
 * number of answers. Earlier supporting/contradicting evidence remains visible. */
export function calculatePatterns(
  students: readonly string[],
  approvedIds: ReadonlySet<string>,
  sessions: readonly SessionEvidence[],
): PatternGroup[] {
  const roster = new Set(students);
  if (
    roster.size !== students.length ||
    new Set(sessions.map((e) => e.session.id)).size !== sessions.length
  )
    throw new Error("Duplicate roster or session");
  if (sessions.some((e) => !roster.has(e.session.student_id)))
    throw new Error("Evidence is outside the roster");
  const observations: PatternObservation[] = [];
  const unclassified = new Map<
    string,
    { at: string; id: string; observation: PatternObservation | null }
  >();
  for (const evidence of sessions) {
    for (const evaluation of evidence.evaluations) {
      if (evaluation.validation_status !== "accepted" || !evaluation.result)
        continue;
      const attempt = evidence.attempts.find(
        (a) => a.id === evaluation.attempt_id,
      );
      if (!attempt) throw new Error("Missing pattern attempt");
      const events = evaluation.applied_result?.hypothesis_events ?? [];
      const candidates = evaluation.result.misconception_candidates ?? [];
      const common = {
        student_id: evidence.session.student_id,
        session_id: evidence.session.id,
        data_origin: evidence.session.data_origin,
        attempt_id: attempt.id,
        evaluation_id: evaluation.id,
      };
      for (const event of events)
        observations.push({
          ...common,
          concept_id: event.concept_id,
          misconception_id: event.misconception_id,
          status: event.status,
          basis: "applied_hypothesis",
          at: event.created_at,
          reason: event.reason,
          quotes: event.supporting_response_quotes,
          supporting_evaluation_ids: event.evidence_evaluation_ids,
          contradicting_evaluation_ids: event.contradicting_evaluation_ids,
        });
      for (const candidate of candidates) {
        if (
          events.some(
            (h) =>
              h.concept_id === candidate.concept_id &&
              h.misconception_id === candidate.misconception_id,
          )
        )
          continue;
        observations.push({
          ...common,
          concept_id: candidate.concept_id,
          misconception_id: candidate.misconception_id,
          status:
            candidate.misconception_id === "other_or_uncertain"
              ? "uncertain"
              : "suspected",
          basis: "tentative_candidate",
          at: evaluation.evaluated_at,
          reason: candidate.uncertainty_reason,
          quotes: candidate.evidence_quotes,
          supporting_evaluation_ids: [evaluation.id],
          contradicting_evaluation_ids: [],
        });
      }
      // A vague response without a named hypothesis stays visible. Do not turn
      // every wrong answer (or a failed evaluation) into a misconception.
      if (attempt.current_evaluation_id !== evaluation.id) continue;
      for (const judgment of evaluation.result.per_concept_results) {
        const key = JSON.stringify([common.student_id, judgment.concept_id]);
        const at = attempt.submitted_at!;
        const previous = unclassified.get(key);
        if (
          previous &&
          (Date.parse(previous.at) > Date.parse(at) ||
            (Date.parse(previous.at) === Date.parse(at) &&
              previous.id > attempt.id))
        )
          continue;
        const unknown =
          judgment.correctness === "uncertain" &&
          ![...events, ...candidates].some(
            (h) => h.concept_id === judgment.concept_id,
          );
        unclassified.set(key, {
          at,
          id: attempt.id,
          observation: unknown
            ? {
                ...common,
                concept_id: judgment.concept_id,
                misconception_id: "other_or_uncertain",
                status: "uncertain",
                basis: "uncategorized_response",
                at: evaluation.evaluated_at,
                reason:
                  evaluation.result.uncertainty_reason ??
                  "No assessable explanation or named hypothesis was recorded.",
                quotes: evaluation.result.evidence_quotes,
                supporting_evaluation_ids: [],
                contradicting_evaluation_ids: [],
              }
            : null,
        });
      }
    }
  }
  for (const row of unclassified.values())
    if (row.observation) observations.push(row.observation);
  const groups = new Map<string, PatternGroup>();
  observations.sort(
    (a, b) =>
      Date.parse(a.at) - Date.parse(b.at) ||
      a.evaluation_id.localeCompare(b.evaluation_id),
  );
  for (const observation of observations) {
    if (!approvedIds.has(observation.misconception_id))
      throw new Error("Unapproved misconception category");
    const key = JSON.stringify([
      observation.concept_id,
      observation.misconception_id,
    ]);
    let group = groups.get(key);
    if (!group) {
      group = {
        concept_id: observation.concept_id,
        misconception_id: observation.misconception_id,
        denominator: students.length,
        counts: { suspected: 0, supported: 0, not_supported: 0, uncertain: 0 },
        students: [],
      };
      groups.set(key, group);
    }
    const student = group.students.find(
      (s) => s.student_id === observation.student_id,
    );
    if (student) {
      student.history.push(observation);
      student.current = observation;
    } else
      group.students.push({
        student_id: observation.student_id,
        current: observation,
        history: [observation],
      });
  }
  for (const group of groups.values())
    for (const student of group.students)
      group.counts[student.current.status]++;
  return [...groups.values()].sort(
    (a, b) =>
      a.concept_id.localeCompare(b.concept_id) ||
      a.misconception_id.localeCompare(b.misconception_id),
  );
}
