import { ContentRefSchema } from "../evidence/contracts.ts";
import type { ApprovedContent } from "../evidence/content.ts";
import type { StudentIntervention } from "./approval-contracts.ts";

/** Public labels only, from an already authorized, pinned assignment resolver. */
export function freshCheckConceptNames(
  content: Pick<ApprovedContent, "content_ref" | "concepts">,
  intervention: Pick<StudentIntervention, "content_ref" | "activity">,
): Record<string, string> {
  const resolved = ContentRefSchema.safeParse(content.content_ref);
  const saved = ContentRefSchema.safeParse(intervention.content_ref);
  // Normalize field order and compare the complete identity, including source
  // hashes, attribution, owner scope, source version and lesson version.
  if (
    !resolved.success ||
    !saved.success ||
    JSON.stringify(resolved.data) !== JSON.stringify(saved.data)
  )
    return {};

  return Object.fromEntries(
    intervention.activity.fresh_check.concept_ids.flatMap((id) => {
      const title = content.concepts.get(id)?.title.trim();
      return title ? [[id, title]] : [];
    }),
  );
}
