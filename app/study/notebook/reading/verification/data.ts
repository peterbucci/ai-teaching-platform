/** Fictional assignment metadata over the actual approved public reading. */
import { assignedReading } from "../../../../../lib/assignments/reading.ts";
import { loadApprovedContent } from "../../../../../lib/evidence/content.ts";
import type { StudentReaderView } from "../../../../../lib/reading/model.ts";

export function readingFixture(): StudentReaderView {
  const content = loadApprovedContent();
  const reading = assignedReading(content.content_ref);
  const assignment = {
    id: "10000000-0000-4000-8000-000000000001",
    title: "Bandwidth and latency",
    classId: "40000000-0000-4000-8000-000000000001",
    className: "Fictional networking class",
  };
  return {
    readings: [
      {
        ...assignment,
        sourceTitle: reading.attribution.title,
        sourceSection: reading.attribution.section,
        sourceChapter: null,
        contentVersion: reading.content_ref.content_version,
        passageIds: reading.sections.map((section) => section.id),
      },
    ],
    assignment,
    reading: {
      ...reading,
      sourcePath: [
        { kind: "section", number: "1.5.1", title: "Bandwidth and Latency" },
      ],
      concepts: [],
      sections: reading.sections.map((section) => ({
        ...section,
        url: content.passages.get(section.id)?.url ?? null,
        conceptIds: [],
      })),
    },
    selectedPassageId: "P07",
    session: null,
    bookmarkedPassageIds: [],
  };
}
