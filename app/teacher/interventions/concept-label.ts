import {
  ContentRefSchema,
  type ContentRef,
  type QuestionSnapshot,
} from "../../../lib/evidence/contracts.ts";
import type { InterventionEvidence } from "../../../lib/interventions/contracts.ts";

type SavedConceptScope = Pick<
  InterventionEvidence,
  "content_ref" | "concept" | "related_concepts"
>;

function sameSource(left: ContentRef, right: ContentRef) {
  // Normalize field order and include the complete saved identity, including
  // uploaded-source hashes, attribution and owner scope.
  return (
    JSON.stringify(ContentRefSchema.parse(left)) ===
    JSON.stringify(ContentRefSchema.parse(right))
  );
}

/** Display only names in this authorized comparison's exact saved version. */
export function followupConceptLabel(
  comparison: {
    content_ref: ContentRef;
    original_evidence: SavedConceptScope;
  },
  question: Pick<QuestionSnapshot, "content_ref" | "concept_ids"> | null,
  conceptId: string,
) {
  const evidence = comparison.original_evidence;
  if (
    !question ||
    !question.concept_ids.includes(conceptId) ||
    !sameSource(comparison.content_ref, evidence.content_ref) ||
    !sameSource(question.content_ref, evidence.content_ref)
  )
    return "Concept name unavailable";

  const concept = [evidence.concept, ...evidence.related_concepts].find(
    (item) => item.id === conceptId,
  );
  return concept?.title.trim() || "Concept name unavailable";
}
