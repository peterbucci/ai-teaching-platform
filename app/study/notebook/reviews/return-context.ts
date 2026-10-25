import { parseNotebookHref } from "../route-state.ts";

export type ReviewReturn = { href: string; label: string };

/** Local navigation context only. Never authorize or load records from a return URL.
 * Retain bounded Notebook filters verbatim after validating their route, but never
 * accept an external destination, a study action, or another review. */
export function reviewReturnContext(value: string | undefined): ReviewReturn {
  const fallback = { href: "/study/assignments", label: "My learning" };
  if (!value) return fallback;
  const route = parseNotebookHref(value);
  if (!route) return fallback;
  if (route.kind === "history") return { href: value, label: "Your notebook" };
  if (route.kind === "learning") return { href: value, label: "My learning" };
  if (route.kind === "assignment" && route.tab === "work")
    return { href: value, label: "Your saved work" };
  return fallback;
}
