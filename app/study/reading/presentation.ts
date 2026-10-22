/** The reader has one source link in its footer; keep approved prose untouched. */
export function readerPassageText(text: string) {
  return text
    .split(/\r?\n\r?\n/)
    .filter(
      (paragraph) =>
        !/^\[Source lines \d+ to \d+\]\(https:\/\/[^)\r\n]+\)$/.test(
          paragraph.trim(),
        ),
    )
    .join("\n\n");
}

/** Search only the approved reading projection supplied by the server. */
export function readingMatches(
  sections: { id: string; title: string; text: string }[],
  query: string,
) {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [];
  return sections.flatMap((section) => {
    const text = readerPassageText(section.text)
      .replace(/\[([^\]]+)\]\(https:\/\/[^)]+\)/g, "$1")
      .replace(/<\/?sup>|\*|`/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const position = text.toLocaleLowerCase().indexOf(term);
    if (position < 0 && !section.title.toLocaleLowerCase().includes(term))
      return [];
    const start = Math.max(0, position - 55);
    const excerpt = text.slice(start, start + 175);
    return [
      {
        id: section.id,
        title: section.title,
        excerpt: `${start ? "…" : ""}${excerpt}${start + 175 < text.length ? "…" : ""}`,
      },
    ];
  });
}

export function readingHref({
  assignmentId,
  contentVersion,
  passageId,
  sessionId,
  fromStudy,
}: {
  assignmentId: string;
  contentVersion: string;
  passageId?: string;
  sessionId?: string;
  fromStudy?: boolean;
}) {
  const query = new URLSearchParams({
    assignment: assignmentId,
    version: contentVersion,
  });
  if (passageId) query.set("passage", passageId);
  if (sessionId) query.set("session", sessionId);
  if (sessionId && fromStudy) query.set("from", "study");
  return `/study/reading?${query}`;
}

type ReadingChoice = {
  id: string;
  classId: string;
  sourceTitle: string;
  sourceSection: string;
  sourceChapter: { number: string | null; title: string } | null;
  contentVersion: string;
  passageIds: string[];
};

/** Select only readings already authorized for this class. */
export function readingSelectorOptions(
  choices: ReadingChoice[],
  classId: string,
  sourceTitle: string,
) {
  const inClass = choices.filter((item) => item.classId === classId);
  return {
    sources: [...new Set(inClass.map((item) => item.sourceTitle))],
    chapters: inClass.filter((item) => item.sourceTitle === sourceTitle),
  };
}

/** Distinguish approved excerpts without turning assignment names into source titles. */
export function readingChapterLabel(
  choice: ReadingChoice,
  choices: ReadingChoice[],
) {
  const heading = (item: ReadingChoice) =>
    item.sourceChapter
      ? sourceHeading({ ...item.sourceChapter, kind: "chapter" })
      : item.sourceSection;
  const label = heading(choice);
  const sameSource = choices.filter(
    (item) =>
      item.sourceTitle === choice.sourceTitle &&
      heading(item) === heading(choice),
  );
  if (sameSource.length < 2) return label;
  if (
    !sameSource.some(
      (item) =>
        item.id !== choice.id && item.sourceSection === choice.sourceSection,
    )
  )
    return `${label} · ${choice.sourceSection}`;
  const scope = choice.passageIds.join(", ");
  const sameScope = sameSource.filter(
    (item) =>
      [...item.passageIds].sort().join(",") ===
      [...choice.passageIds].sort().join(","),
  );
  return `${label} · Passages ${scope}${sameScope.length > 1 ? ` · Version ${choice.contentVersion}` : ""}`;
}

export function sourceHeading(part: {
  number: string | null;
  title: string;
  kind?: "chapter" | "section";
}) {
  if (part.kind === "chapter" && part.number)
    return `Chapter ${part.number}: ${part.title}`;
  return part.number ? `${part.number} ${part.title}` : part.title;
}
