import type { SourceVersion } from "../../../lib/lessons/sources.ts";

export function sourceReviewPassages(
  source: Pick<SourceVersion, "extraction" | "passages">,
) {
  const approved = new Map(
    source.passages.map((passage) => [passage.passage_id, passage]),
  );
  return source.extraction.map((original, index) => {
    const reviewed = approved.get(original.passage_id);
    return {
      id: original.passage_id,
      number: index + 1,
      original,
      reviewed,
      status: !reviewed
        ? ("excluded" as const)
        : reviewed.text === original.text
          ? ("unchanged" as const)
          : ("corrected" as const),
    };
  });
}
