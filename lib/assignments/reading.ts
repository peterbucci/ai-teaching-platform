import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadApprovedContent,
  validateContentRef,
  type ApprovedContent,
} from "../evidence/content.ts";

/** Project only public reading text; preserve curated editorial notes separately. */
export function assignedReading(
  reference: unknown,
  content: ApprovedContent = loadApprovedContent(),
) {
  validateContentRef(content, reference);
  if (!("source_commit" in content.content_ref)) {
    return {
      content_ref: content.content_ref,
      attribution: content.attribution,
      sections: [...content.passages.values()].map((passage) => ({
        id: passage.id,
        title: passage.section ?? passage.id,
        text: passage.text,
      })),
    };
  }
  const text = readFileSync(
    join(process.cwd(), "content/network-performance-v1/reading.md"),
    "utf8",
  );
  const sections = [
    ...text.matchAll(/^## (P\d+) (.+)\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm),
  ].map((match) => ({
    id: match[1],
    title: match[2],
    text: match[3].trim(),
  }));
  if (
    sections.length !== content.passage_ids.size ||
    new Set(sections.map((section) => section.id)).size !== sections.length ||
    sections.some((section) => !content.passage_ids.has(section.id))
  )
    throw new Error(
      "The prepared reading does not match its assigned passages.",
    );
  return {
    content_ref: content.content_ref,
    attribution: content.attribution,
    sections,
  };
}
