import type { QuestionSnapshot } from "../../../../../lib/evidence/contracts.ts";
import type { QuestionBankItem } from "../../../../../lib/question-bank/contracts.ts";

/** Contextual reading changes presentation order only; IDs and saved order stay intact. */
export function questionReadingPassages<
  Passage extends { id: string; text: string },
>(
  passages: readonly Passage[],
  questions: readonly QuestionSnapshot[],
  concepts: readonly { title: string; source_passage_ids: string[] }[],
  selectedId: string | null,
  metadata: readonly QuestionBankItem[],
) {
  const selected = questions.find(
    (question) => question.question_id === selectedId,
  );
  const support =
    metadata.find((item) => item.question_id === selectedId)?.source_support ??
    [];
  return passages
    .map((passage, index) => ({
      passage,
      index,
      linked: Boolean(
        selected?.source_passage_ids.includes(passage.id) ||
        support.some((item) => item.passage_id === passage.id),
      ),
      quotes: support
        .filter((item) => item.passage_id === passage.id)
        .map((item) => item.quote),
      uses: [
        ...concepts.flatMap((concept, conceptIndex) =>
          concept.source_passage_ids.includes(passage.id)
            ? [`O${conceptIndex + 1}`]
            : [],
        ),
        ...questions.flatMap((question, questionIndex) =>
          question.source_passage_ids.includes(passage.id)
            ? [`Q${questionIndex + 1}`]
            : [],
        ),
      ],
    }))
    .sort((a, b) => Number(b.linked) - Number(a.linked) || a.index - b.index);
}

/** Highlight only exact supported text. Return text segments for React escaping. */
export function exactQuoteSegments(text: string, quotes: readonly string[]) {
  const spans = quotes
    .flatMap((quote) => {
      const value = quote.trim();
      const start = value ? text.indexOf(value) : -1;
      return start < 0 ? [] : [{ start, end: start + value.length }];
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: { start: number; end: number }[] = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  const parts: { text: string; marked: boolean }[] = [];
  let position = 0;
  for (const span of merged) {
    if (span.start > position)
      parts.push({ text: text.slice(position, span.start), marked: false });
    parts.push({ text: text.slice(span.start, span.end), marked: true });
    position = span.end;
  }
  if (position < text.length || !parts.length)
    parts.push({ text: text.slice(position), marked: false });
  return parts;
}

/** Each bank entry appears once. Multi-concept membership remains on its snapshot. */
export function groupBankQuestions(
  questions: readonly QuestionSnapshot[],
  concepts: readonly { id: string; title: string }[],
) {
  const groups = concepts.map((concept) => ({
    id: concept.id,
    title: concept.title,
    questions: [] as { question: QuestionSnapshot; index: number }[],
  }));
  const unassigned = {
    id: "unassigned",
    title: "Check concept references",
    questions: [] as { question: QuestionSnapshot; index: number }[],
  };
  for (const [index, question] of questions.entries()) {
    const group = groups.find((entry) =>
      question.concept_ids.includes(entry.id),
    );
    (group ?? unassigned).questions.push({ question, index });
  }
  return [...groups, unassigned].filter((group) => group.questions.length);
}

/** Missing/deleted selection falls back without changing the saved question order. */
export function currentBankQuestion(
  questions: readonly QuestionSnapshot[],
  requested: string | null,
) {
  return (
    questions.find((question) => question.question_id === requested) ??
    questions[0] ??
    null
  );
}

/** Downloads and new-tab inspection leave the current editor intact. */
export function shouldGuardBankNavigation(input: {
  href: string;
  currentHref: string;
  target: string;
  download: boolean;
  modified: boolean;
  button: number;
}) {
  if (
    input.download ||
    input.modified ||
    input.button !== 0 ||
    (input.target && input.target !== "_self")
  )
    return false;
  const current = new URL(input.currentHref);
  const destination = new URL(input.href, current);
  if (!["http:", "https:"].includes(destination.protocol)) return false;
  return (
    destination.origin !== current.origin ||
    destination.pathname !== current.pathname ||
    destination.search !== current.search
  );
}

export function bankNavigationWarning(hasRecoveryCopy: boolean) {
  return hasRecoveryCopy
    ? "Leave with unsaved question-bank changes? Your browser recovery copy stays in this tab; save the draft to keep changes on the server."
    : "Leave with unsaved question-bank changes? Browser recovery is unavailable, so your edits will be lost. Save the draft or download your edits before leaving.";
}
