import type { QuestionSnapshot } from "../../../../../lib/evidence/contracts.ts";

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
