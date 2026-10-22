import assert from "node:assert/strict";
import test from "node:test";
import {
  readingHref,
  readingMatches,
  readingChapterLabel,
  readingSelectorOptions,
  sourceHeading,
  readerPassageText,
} from "../app/study/reading/presentation.ts";

test("reading search matches authorized text and titles with useful excerpts", () => {
  const sections = [
    {
      id: "P01",
      title: "Bandwidth",
      text: "A link's **data rate** is measured in bits per second.",
    },
    {
      id: "P02",
      title: "Latency",
      text: "A packet travels through a network. [Source lines](https://example.com/pinned#L1-L2)",
    },
  ];
  assert.deepEqual(
    readingMatches(sections, " DATA RATE ").map((item) => item.id),
    ["P01"],
  );
  assert.equal(
    readingMatches(sections, "data rate")[0].excerpt,
    "A link's data rate is measured in bits per second.",
  );
  assert.deepEqual(
    readingMatches(sections, "latency").map((item) => item.id),
    ["P02"],
  );
  assert.deepEqual(readingMatches(sections, "not assigned"), []);
  assert.deepEqual(readingMatches(sections, "  "), []);
  assert.deepEqual(readingMatches(sections, "example.com"), []);
});

test("source navigation preserves real numbering and differentiates assigned excerpts", () => {
  assert.equal(
    sourceHeading({ number: "1", title: "Foundation", kind: "chapter" }),
    "Chapter 1: Foundation",
  );
  assert.equal(
    sourceHeading({ number: "1.5", title: "Performance" }),
    "1.5 Performance",
  );
  assert.equal(
    sourceHeading({ number: null, title: "An unnumbered article" }),
    "An unnumbered article",
  );
  const first = {
    id: "a",
    classId: "class-a",
    sourceTitle: "A real textbook",
    sourceSection: "1.5.1 Bandwidth and Latency",
    sourceChapter: { number: "1", title: "Foundation" },
    contentVersion: "v1",
    passageIds: ["P01", "P03"],
  };
  const second = { ...first, id: "b", passageIds: ["P01", "P04"] };
  assert.equal(readingChapterLabel(first, [first]), "Chapter 1: Foundation");
  assert.match(
    readingChapterLabel(first, [first, second]),
    /Passages P01, P03$/,
  );
  assert.match(
    readingChapterLabel(second, [first, second]),
    /Passages P01, P04$/,
  );
  const revised = { ...first, id: "c", contentVersion: "v2" };
  assert.match(readingChapterLabel(revised, [first, revised]), /Version v2$/);
  const article = {
    ...first,
    sourceChapter: null,
    sourceSection: "An unnumbered article",
  };
  assert.equal(
    readingChapterLabel(article, [article]),
    "An unnumbered article",
  );
  const otherChapter = {
    ...first,
    id: "chapter-2",
    sourceChapter: { number: "2", title: "Another assigned chapter" },
  };
  const otherSource = {
    ...article,
    id: "article",
    sourceTitle: "A separate article",
  };
  const otherClass = { ...first, id: "other-class", classId: "class-b" };
  const choices = [
    first,
    second,
    revised,
    otherChapter,
    otherSource,
    otherClass,
  ];
  const options = readingSelectorOptions(choices, "class-a", first.sourceTitle);
  assert.deepEqual(options.sources, ["A real textbook", "A separate article"]);
  assert.deepEqual(
    options.chapters.map((item) => item.id),
    ["a", "b", "c", "chapter-2"],
  );
  assert.deepEqual(
    readingSelectorOptions(choices, "class-a", otherSource.sourceTitle)
      .chapters,
    [otherSource],
  );
  assert.deepEqual(
    readingSelectorOptions(choices, "class-b", first.sourceTitle).chapters,
    [otherClass],
  );
  assert.deepEqual(
    readingSelectorOptions(choices, "unavailable", first.sourceTitle),
    { sources: [], chapters: [] },
  );
});

test("reader hides only standalone source-line references without altering prose or teaching notes", () => {
  const paragraphs = [
    "Network **bandwidth** is measured in bits per second.",
    "[Source lines 94 to 107](https://example.com/pinned#L94-L107)",
    "**Project teaching note:** Keep this clarification.",
    "Read the [original explanation](https://example.com/explanation).",
  ];
  assert.equal(
    readerPassageText(paragraphs.join("\r\n\r\n")),
    [paragraphs[0], paragraphs[2], paragraphs[3]].join("\n\n"),
  );
});

test("reading links retain the exact assignment, version, passage and optional session", () => {
  const link = readingHref({
    assignmentId: "assignment-a",
    contentVersion: "pinned/version",
    passageId: "P04",
    sessionId: "session-a",
    fromStudy: true,
  });
  const parsed = new URL(link, "https://example.com");
  assert.equal(parsed.pathname, "/study/reading");
  assert.equal(parsed.searchParams.get("assignment"), "assignment-a");
  assert.equal(parsed.searchParams.get("version"), "pinned/version");
  assert.equal(parsed.searchParams.get("passage"), "P04");
  assert.equal(parsed.searchParams.get("session"), "session-a");
  assert.equal(parsed.searchParams.get("from"), "study");
  assert.equal(parsed.searchParams.has("citation"), false);
  // A session can track reading from main navigation without a return link.
  assert.equal(
    new URL(
      readingHref({
        assignmentId: "assignment-a",
        contentVersion: "version",
        sessionId: "session-a",
      }),
      "https://example.com",
    ).searchParams.has("from"),
    false,
  );
  assert.equal(
    new URL(
      readingHref({
        assignmentId: "assignment-a",
        contentVersion: "version",
        fromStudy: true,
      }),
      "https://example.com",
    ).searchParams.has("session"),
    false,
  );
  assert.equal(
    new URL(
      readingHref({
        assignmentId: "assignment-a",
        contentVersion: "version",
        fromStudy: true,
      }),
      "https://example.com",
    ).searchParams.has("from"),
    false,
  );
});
