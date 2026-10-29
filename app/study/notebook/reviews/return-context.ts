import { parseNotebookHref } from "../route-state.ts";
import { recordedHistoryHref } from "../recorded-history.ts";

export type ReviewReturn = { href: string; label: string };

/** Local navigation context only. Never authorize or load records from a return URL.
 * Retain bounded Notebook filters verbatim after validating their route, but never
 * accept an external destination, a study action, or another review. */
export function reviewReturnContext(value: string | undefined): ReviewReturn {
  const fallback = { href: "/study/assignments", label: "My learning" };
  if (!value) return fallback;
  // The additive recorded-history route is outside frozen N0 v1. Accept only
  // its canonical public identity; the destination still authorizes every read.
  const recorded = /^\/study\/history\/([^/?#]+)(?:\?attempt=([^&#]+))?$/.exec(
    value,
  );
  if (recorded) {
    try {
      if (recordedHistoryHref(recorded[1], recorded[2]) === value)
        return { href: value, label: "Your saved question" };
    } catch {
      return fallback;
    }
  }
  const route = parseNotebookHref(value);
  if (!route) return fallback;
  if (route.kind === "history") return { href: value, label: "Your notebook" };
  if (route.kind === "learning") return { href: value, label: "My learning" };
  if (route.kind === "assignment" && route.tab === "work")
    return { href: value, label: "Your saved work" };
  return fallback;
}
