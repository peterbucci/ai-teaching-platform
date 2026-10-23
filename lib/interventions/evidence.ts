import "server-only";
import type { ApprovedContent } from "../evidence/content.ts";
import { validateContentRef } from "../evidence/content.ts";
import { validateSessionEvidence } from "../evidence/rules.ts";
import { calculateClassMetrics } from "../teacher/metrics.ts";
import { calculatePatterns } from "../teacher/patterns.ts";
import type { readAssignmentEvidence } from "../teacher/store.ts";
import {
  InterventionEvidenceSchema,
  InterventionSelectionSchema,
  type InterventionEvidence,
} from "./contracts.ts";

/** Authorization belongs to readAssignmentEvidence, which must precede this pure
 * builder. Explicit examples expand to that student's same-concept history so a
 * teacher cannot accidentally hide a contradictory follow-up by selecting a root. */
export function buildInterventionEvidence(
  snapshot: Awaited<ReturnType<typeof readAssignmentEvidence>>,
  content: ApprovedContent,
  selectionInput: unknown,
): InterventionEvidence {
  const selection = InterventionSelectionSchema.parse(selectionInput);
  if (selection.assignment_id !== snapshot.assignment_id)
    throw new Error("Evidence belongs to another assignment.");
  const concept = content.concepts.get(selection.concept_id);
  if (
    !concept ||
    !snapshot.metrics.concepts.some((c) => c.concept_id === concept.id)
  )
    throw new Error("Concept is outside the authorized assignment.");
  const roster = new Map(snapshot.students.map((s) => [s.student_id, s]));
  if (roster.size !== snapshot.students.length)
    throw new Error("Duplicate roster student.");
  const sessions = snapshot.evidence
    .map((e) => validateSessionEvidence(content, e))
    .filter(
      (e) =>
        selection.origin === "all" ||
        e.session.data_origin === selection.origin,
    );
  for (const e of sessions) {
    if (
      e.session.assignment_id !== snapshot.assignment_id ||
      e.session.class_id !== snapshot.class_id ||
      !roster.has(e.session.student_id)
    )
      throw new Error(
        "Evidence is outside the authorized class or assignment.",
      );
    for (const a of e.attempts)
      validateContentRef(content, a.question.content_ref);
  }
  const groups = calculatePatterns(
    [...roster.keys()],
    new Set(snapshot.approved_misconception_ids),
    sessions,
  );
  const pattern = selection.misconception_id
    ? groups.find(
        (g) =>
          g.concept_id === concept.id &&
          g.misconception_id === selection.misconception_id,
      )
    : null;
  if (selection.misconception_id && !pattern)
    throw new Error(
      "Class insight is unavailable for this authorized concept.",
    );
  const observations = sessions
    .flatMap((e) =>
      e.attempts.flatMap((attempt) => {
        if (
          !attempt.question.concept_ids.includes(concept.id) ||
          attempt.response_text === null ||
          !attempt.assistance
        )
          return [];
        const evaluation = e.evaluations.find(
          (v) => v.id === attempt.current_evaluation_id,
        );
        if (
          !evaluation ||
          evaluation.validation_status !== "accepted" ||
          !evaluation.result
        )
          return [];
        const judgment = evaluation.result.per_concept_results.find(
          (r) => r.concept_id === concept.id,
        );
        if (!judgment)
          throw new Error("Accepted evidence is missing the selected concept.");
        const contrary = pattern?.students.some((s) =>
          s.history.some((h) =>
            h.contradicting_evaluation_ids.includes(evaluation.id),
          ),
        );
        const role =
          contrary || judgment.correctness === "correct"
            ? ("contradictory" as const)
            : judgment.correctness === "incorrect" ||
                judgment.correctness === "partially_correct"
              ? ("supporting" as const)
              : ("context" as const);
        return [
          {
            student_id: e.session.student_id,
            student_name: roster.get(e.session.student_id)!.display_name,
            session_id: e.session.id,
            data_origin: e.session.data_origin,
            attempt,
            evaluation,
            role,
          },
        ];
      }),
    )
    .sort(
      (a, b) =>
        a.attempt.submitted_at!.localeCompare(b.attempt.submitted_at!) ||
        a.attempt.id.localeCompare(b.attempt.id),
    );
  if (
    new Set(observations.map((o) => o.attempt.id)).size !== observations.length
  )
    throw new Error("Duplicate response evidence.");
  const requested = new Set(selection.attempt_ids);
  if (
    [...requested].some((id) => !observations.some((o) => o.attempt.id === id))
  )
    throw new Error(
      "Selected response is unavailable, unaccepted, or outside this concept.",
    );
  const students = requested.size
    ? new Set(
        observations
          .filter((o) => requested.has(o.attempt.id))
          .map((o) => o.student_id),
      )
    : pattern
      ? new Set(pattern.students.map((s) => s.student_id))
      : new Set(observations.map((o) => o.student_id));
  const selected = observations.filter((o) => students.has(o.student_id));
  if (!selected.length)
    throw new Error("No accepted responses are available for this selection.");
  if (selected.length > 60)
    throw new Error(
      "This selection has too much evidence. Select fewer students' responses.",
    );
  if (
    selected.some(
      (o) =>
        (o.attempt.response_text?.length ?? 0) > 4000 ||
        o.attempt.question.prompt_text.length > 4000,
    )
  )
    throw new Error(
      "A response or question exceeds the generation context limit; no evidence was truncated.",
    );
  const aliases = new Map(
    [...students].sort().map((id, index) => [id, `Learner ${index + 1}`]),
  );
  const result = InterventionEvidenceSchema.parse({
    selection,
    content_ref: content.content_ref,
    concept: {
      id: concept.id,
      title: concept.title,
      objectives: concept.objectives,
      boundaries: concept.boundaries,
      source_passage_ids: concept.source_passage_ids,
    },
    related_concepts: [...content.concepts.values()]
      .filter(
        (related) =>
          related.id !== concept.id &&
          snapshot.metrics.concepts.some((c) => c.concept_id === related.id) &&
          related.source_passage_ids.some((id) =>
            concept.source_passage_ids.includes(id),
          ),
      )
      .map((related) => ({
        id: related.id,
        title: related.title,
        objectives: related.objectives,
        boundaries: related.boundaries,
        source_passage_ids: related.source_passage_ids,
      })),
    metrics: calculateClassMetrics(
      [...roster.keys()],
      snapshot.metrics.concepts.map((c) => c.concept_id),
      sessions,
      selection.origin,
    ),
    observations: selected.map((o, index) => ({
      ...o,
      evidence_id: `E${index + 1}`,
      pseudonym: aliases.get(o.student_id)!,
    })),
    pattern: pattern
      ? {
          misconception_id: pattern.misconception_id,
          counts: pattern.counts,
          denominator: pattern.denominator,
          observations: pattern.students.flatMap((s) =>
            s.history.map((h) => ({
              student_id: s.student_id,
              evaluation_id: h.evaluation_id,
              attempt_id: h.attempt_id,
              status: h.status,
              reason: h.reason,
              supporting_evaluation_ids: h.supporting_evaluation_ids,
              contradicting_evaluation_ids: h.contradicting_evaluation_ids,
            })),
          ),
        }
      : null,
    counts: {
      selected_students: students.size,
      selected_responses: selected.length,
      enrolled_students: roster.size,
    },
    sources: concept.source_passage_ids.map((id) => {
      const p = content.passages.get(id);
      if (!p) throw new Error("Approved source passage missing.");
      return { passage_id: p.id, text: p.text, url: p.url };
    }),
    scope_note:
      "Counts describe recorded responses, not ability or enduring mastery. Class metrics and class-insight counts use distinct enrolled students; selected counts describe only the included examples. Explicit response selection includes the selected students' other accepted responses for this concept, including contrary evidence. Supporting means an accepted response indicates an opportunity for review; contradictory means correct or explicitly contrary evidence, not proof of retention. Uncertain answers do not establish a misconception.",
  });
  return result;
}
