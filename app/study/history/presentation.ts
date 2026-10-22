import type { StudentHistoryEntry } from "../../../lib/tutoring/history-model.ts";
import { DEFAULT_TIME_ZONE, resolveTimeZone } from "../../../lib/date-time.ts";
import {
  assignmentScopeOptions as journalScopeOptions,
  normalizeAssignmentScope as normalizeJournalScope,
  scopeAssignments as scopeJournalEntries,
  type AssignmentScope,
} from "../assignments/presentation.ts";
import { sourceHeading } from "../reading/presentation.ts";

export { journalScopeOptions, normalizeJournalScope, scopeJournalEntries };

export function formatJournalDate(ISO: string, timeZone = DEFAULT_TIME_ZONE) {
  const date = new Date(ISO);
  const zone = resolveTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: zone,
  }).formatToParts(date);
  return {
    day: parts.find((part) => part.type === "day")!.value,
    month: parts.find((part) => part.type === "month")!.value,
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: zone,
    }).format(date),
    label: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: zone,
    }).format(date),
  };
}

export type JournalScope = AssignmentScope;
export const journalStatuses = [
  "All",
  "In progress",
  "Completed",
  "Needs attention",
] as const;
export type JournalStatus = (typeof journalStatuses)[number];
export type JournalPeriod = "all" | "7" | "30";
export type JournalFilters = JournalScope & {
  search: string;
  status: JournalStatus;
  period: JournalPeriod;
};

export function matchesJournalEntry(
  entry: StudentHistoryEntry,
  search: string,
) {
  const text = [
    entry.title,
    entry.className,
    entry.sourceTitle,
    entry.sourceSection,
    ...entry.sourcePath.map(sourceHeading),
    ...entry.topics.map((topic) => topic.title),
  ]
    .join(" ")
    .toLocaleLowerCase();
  return text.includes(search.trim().toLocaleLowerCase());
}

export function journalCategory(
  entry: Pick<StudentHistoryEntry, "status">,
): Exclude<JournalStatus, "All"> {
  switch (entry.status) {
    case "active":
      return "In progress";
    case "completed":
      return "Completed";
    case "pending_evaluation":
    case "unevaluated":
      return "Needs attention";
  }
}

export function journalStatusLabel(entry: Pick<StudentHistoryEntry, "status">) {
  switch (entry.status) {
    case "active":
      return "In progress";
    case "completed":
      return "Practice session complete";
    case "pending_evaluation":
      return "Evaluation pending";
    case "unevaluated":
      return "Teacher support needed";
  }
}

function newestFirst(a: StudentHistoryEntry, b: StudentHistoryEntry) {
  return (
    Date.parse(b.started_at) - Date.parse(a.started_at) ||
    b.id.localeCompare(a.id)
  );
}

/** Use the server's timestamp so the initial render and client filters agree. */
export function filterJournalEntries(
  entries: StudentHistoryEntry[],
  filters: JournalFilters,
  nowISO: string,
) {
  const now = Date.parse(nowISO);
  if (!Number.isFinite(now))
    throw new RangeError("A valid journal timestamp is required.");
  const cutoff =
    filters.period === "all" ? null : now - Number(filters.period) * 86_400_000;
  return scopeJournalEntries(entries, normalizeJournalScope(entries, filters))
    .filter((entry) => {
      const started = Date.parse(entry.started_at);
      return (
        matchesJournalEntry(entry, filters.search) &&
        (filters.status === "All" ||
          journalCategory(entry) === filters.status) &&
        (cutoff === null || (started >= cutoff && started <= now))
      );
    })
    .sort(newestFirst);
}

export function groupJournalMonths(
  entries: StudentHistoryEntry[],
  timeZone = DEFAULT_TIME_ZONE,
): {
  key: string;
  label: string;
  entries: StudentHistoryEntry[];
}[] {
  const groups = new Map<
    string,
    { key: string; label: string; entries: StudentHistoryEntry[] }
  >();
  const zone = resolveTimeZone(timeZone);
  const monthKey = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    timeZone: zone,
  });
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: zone,
  });
  for (const entry of [...entries].sort(newestFirst)) {
    const date = new Date(entry.started_at);
    const parts = monthKey.formatToParts(date);
    const key = `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}`;
    const group = groups.get(key);
    if (group) group.entries.push(entry);
    else
      groups.set(key, {
        key,
        label: monthLabel.format(date),
        entries: [entry],
      });
  }
  return [...groups.values()];
}
