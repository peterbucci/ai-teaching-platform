import "server-only";
import {
  validateContentRef,
  type ApprovedContent,
} from "../evidence/content.ts";
import { EvidenceError } from "../evidence/store.ts";
import type { DashboardTopic } from "./dashboard-model.ts";

type PracticeAssignment = {
  content_ref: unknown;
  approved_concept_ids: string[];
  approved_passage_ids: string[];
};

/** The activity defines practice scope; teacher approval bounds that scope.
 * Reading can cover more concepts than the assignment's configured sequence. */
export function assignmentPracticeTopics(
  content: ApprovedContent,
  assignment: PracticeAssignment,
): Pick<DashboardTopic, "id" | "title" | "objectives" | "passageIds">[] {
  const unavailable = () =>
    new EvidenceError(
      503,
      "This assignment's practice topics are unavailable.",
    );
  try {
    validateContentRef(content, assignment.content_ref);
  } catch {
    throw unavailable();
  }
  const validIds = (ids: string[], known: ReadonlySet<string>) =>
    ids.length > 0 &&
    new Set(ids).size === ids.length &&
    ids.every((id) => known.has(id));
  if (
    !validIds(assignment.approved_concept_ids, content.concept_ids) ||
    !validIds(assignment.approved_passage_ids, content.passage_ids) ||
    !validIds(
      content.sequence.concept_ids,
      new Set(assignment.approved_concept_ids),
    )
  )
    throw unavailable();

  const approvedPassages = new Set(assignment.approved_passage_ids);
  return content.sequence.concept_ids.map((id) => {
    const concept = content.concepts.get(id);
    if (!concept) throw unavailable();
    return {
      id,
      title: concept.title,
      objectives: concept.objectives,
      passageIds: concept.source_passage_ids.filter((passageId) =>
        approvedPassages.has(passageId),
      ),
    };
  });
}
