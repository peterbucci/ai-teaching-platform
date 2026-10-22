import assert from "node:assert/strict";
import test from "node:test";
import type { StudentHistoryEntry } from "../lib/tutoring/history-model.ts";
import { sourceLocationKey } from "../app/study/assignments/presentation.ts";
import {
  filterJournalEntries,
  formatJournalDate,
  groupJournalMonths,
  journalCategory,
  journalScopeOptions,
  journalStatusLabel,
  matchesJournalEntry,
  normalizeJournalScope,
  scopeJournalEntries,
  type JournalFilters,
  type JournalScope,
} from "../app/study/history/presentation.ts";

const all: JournalScope = { classId: "", sourceKey: "", locationKey: "" };
const filters: JournalFilters = {
  ...all,
  search: "",
  status: "All",
  period: "all",
};
const now = "2026-10-22T12:00:00.000Z";
const path: StudentHistoryEntry["sourcePath"] = [
  { number: "1", title: "Foundation", kind: "chapter" },
  { number: "1.5", title: "Performance", kind: "section" },
  { number: "1.5.1", title: "Bandwidth and Latency", kind: "section" },
];
function entry(
  id: string,
  overrides: Partial<StudentHistoryEntry> = {},
): StudentHistoryEntry {
  return {
    id,
    assignment_id: "assignment-a",
    title: "Packet delays",
    status: "active",
    started_at: "2026-10-21T12:00:00.000Z",
    ended_at: null,
    response_count: 1,
    reading_opened: false,
    classId: "class-a",
    className: "Networks",
    sourceKey: "book-a",
    sourceTitle: "A networking textbook",
    sourceSection: "1.5.1 Bandwidth and Latency",
    sourcePath: path,
    topics: [{ id: "transmission", title: "Transmission delay" }],
    ...overrides,
  };
}

test("journal scopes distinguish classes and sources, retain sessions sharing a reading, and match chapter descendants", () => {
  const entries = [
    entry("one"),
    entry("two", {
      sourcePath: [
        ...path.slice(0, 2),
        {
          number: "1.5.2",
          title: "Delay × Bandwidth Product",
          kind: "section",
        },
      ],
    }),
    entry("three", { classId: "class-b" }),
    entry("four", { sourceKey: "book-b" }),
    entry("five", {
      sourcePath: [{ number: "2", title: "Direct Links", kind: "chapter" }],
    }),
  ];
  const scope = {
    classId: "class-a",
    sourceKey: "book-a",
    locationKey: sourceLocationKey(path.slice(0, 1)),
  };
  assert.deepEqual(
    scopeJournalEntries(entries, scope).map(({ id }) => id),
    ["one", "two"],
  );
  assert.deepEqual(
    scopeJournalEntries(entries, {
      ...scope,
      locationKey: sourceLocationKey(path),
    }).map(({ id }) => id),
    ["one"],
  );
  assert.equal(journalScopeOptions(entries, all).classes.length, 2);
  assert.deepEqual(
    journalScopeOptions(entries, { ...all, classId: "class-b" }).sources,
    [{ value: "book-a", label: "A networking textbook" }],
  );
  assert.deepEqual(
    journalScopeOptions(entries, scope).locations.map(({ label, depth }) => [
      label,
      depth,
    ]),
    [
      ["Chapter 1: Foundation", 0],
      ["1.5 Performance", 1],
      ["1.5.1 Bandwidth and Latency", 2],
      ["1.5.2 Delay × Bandwidth Product", 2],
      ["Chapter 2: Direct Links", 0],
    ],
  );
  assert.deepEqual(
    scopeJournalEntries(entries, { ...all, locationKey: scope.locationKey }),
    entries,
  );
  assert.deepEqual(
    normalizeJournalScope(entries, { ...scope, classId: "missing" }),
    all,
  );
  assert.deepEqual(
    normalizeJournalScope(entries, {
      classId: "class-b",
      sourceKey: "book-b",
      locationKey: scope.locationKey,
    }),
    { ...all, classId: "class-b" },
  );
  assert.deepEqual(
    normalizeJournalScope(entries, { ...scope, locationKey: "missing" }),
    { ...scope, locationKey: "" },
  );
});

test("journal categories preserve actual pending/support states without inferring completion from answers or reading", () => {
  const entries = [
    entry("active", { response_count: 10, reading_opened: true }),
    entry("complete", { status: "completed", response_count: 0 }),
    entry("pending", { status: "pending_evaluation" }),
    entry("support", { status: "unevaluated" }),
  ];
  assert.deepEqual(entries.map(journalCategory), [
    "In progress",
    "Completed",
    "Needs attention",
    "Needs attention",
  ]);
  assert.deepEqual(
    filterJournalEntries(
      entries,
      { ...filters, status: "Needs attention" },
      now,
    ).map(({ id }) => id),
    ["support", "pending"],
  );
  assert.deepEqual(
    filterJournalEntries(
      entries,
      { ...filters, status: "In progress" },
      now,
    ).map(({ id }) => id),
    ["active"],
  );
  assert.deepEqual(
    filterJournalEntries(entries, { ...filters, status: "Completed" }, now).map(
      ({ id }) => id,
    ),
    ["complete"],
  );
  assert.equal(journalStatusLabel(entries[2]), "Evaluation pending");
  assert.equal(journalStatusLabel(entries[3]), "Teacher support needed");
});

test("journal date filters use exact rolling cutoffs and the actual session start", () => {
  const entries = [
    entry("now", { started_at: now }),
    entry("seven", { started_at: "2026-10-15T12:00:00.000Z" }),
    entry("before-seven", {
      started_at: "2026-10-15T11:59:59.999Z",
      ended_at: now,
    }),
    entry("thirty", { started_at: "2026-09-22T12:00:00.000Z" }),
    entry("before-thirty", {
      started_at: "2026-09-22T11:59:59.999Z",
      ended_at: now,
    }),
    entry("future", { started_at: "2026-10-22T12:00:00.001Z" }),
  ];
  assert.deepEqual(
    filterJournalEntries(entries, { ...filters, period: "7" }, now).map(
      ({ id }) => id,
    ),
    ["now", "seven"],
  );
  assert.deepEqual(
    filterJournalEntries(entries, { ...filters, period: "30" }, now).map(
      ({ id }) => id,
    ),
    ["now", "seven", "before-seven", "thirty"],
  );
  assert.equal(
    filterJournalEntries(entries, filters, now).length,
    entries.length,
  );
});

test("journal search uses real assignment, class, source, hierarchy and submitted topics and handles empty sources", () => {
  const item = entry("one");
  for (const search of [
    " PACKET ",
    "networks",
    "networking",
    "chapter 1",
    "Foundation",
    "1.5 performance",
    "Transmission",
    "Bandwidth and Latency",
    "",
  ])
    assert.equal(matchesJournalEntry(item, search), true);
  assert.equal(matchesJournalEntry(item, "fictional learning score"), false);
  assert.deepEqual(
    filterJournalEntries([item], { ...filters, search: "missing" }, now),
    [],
  );
  const article = entry("article", {
    sourcePath: [],
    sourceTitle: "A standalone article",
    topics: [],
  });
  assert.deepEqual(
    journalScopeOptions([article], { ...all, sourceKey: article.sourceKey })
      .locations,
    [],
  );
  assert.deepEqual(journalScopeOptions([], all), {
    classes: [],
    sources: [],
    locations: [],
  });
  assert.deepEqual(
    normalizeJournalScope([], {
      classId: "missing",
      sourceKey: "missing",
      locationKey: "missing",
    }),
    all,
  );
  assert.deepEqual(filterJournalEntries([], filters, now), []);
  assert.deepEqual(groupJournalMonths([]), []);
});

test("journal month groups support explicit UTC and stable newest-first ordering without changing input", () => {
  const entries = [
    entry("a"),
    entry("september", { started_at: "2026-10-01T00:30:00+02:00" }),
    entry("b"),
    entry("october", { started_at: "2026-10-01T00:00:00Z" }),
  ];
  const before = structuredClone(entries);
  const groups = groupJournalMonths(entries, "UTC");
  assert.deepEqual(
    groups.map(({ key, label, entries: rows }) => ({
      key,
      label,
      ids: rows.map(({ id }) => id),
    })),
    [
      { key: "2026-10", label: "October 2026", ids: ["b", "a", "october"] },
      { key: "2026-09", label: "September 2026", ids: ["september"] },
    ],
  );
  assert.deepEqual(groupJournalMonths([...entries].reverse(), "UTC"), groups);
  filterJournalEntries(entries, filters, now);
  assert.deepEqual(entries, before);
});

test("journal month groups and displayed dates agree at a local month boundary", () => {
  const entries = [
    entry("earlier", { started_at: "2026-10-01T03:59:59Z" }),
    entry("later", { started_at: "2026-10-01T04:00:00Z" }),
  ];
  assert.deepEqual(
    groupJournalMonths(entries).map(({ key, label, entries: rows }) => ({
      key,
      label,
      ids: rows.map(({ id }) => id),
    })),
    [
      { key: "2026-10", label: "October 2026", ids: ["later"] },
      { key: "2026-09", label: "September 2026", ids: ["earlier"] },
    ],
  );
  assert.equal(formatJournalDate(entries[0].started_at).day, "30");
  assert.equal(formatJournalDate(entries[0].started_at).month, "Sep");
  assert.equal(formatJournalDate(entries[1].started_at).day, "1");
  assert.equal(formatJournalDate(entries[1].started_at).month, "Oct");
  assert.deepEqual(
    groupJournalMonths(entries, "Asia/Tokyo").map(({ key, entries: rows }) => ({
      key,
      ids: rows.map(({ id }) => id),
    })),
    [{ key: "2026-10", ids: ["later", "earlier"] }],
  );
});

test("journal Eastern fallback observes daylight saving and valid browser time zones", () => {
  const winter = formatJournalDate("2026-01-15T15:05:00Z");
  const summer = formatJournalDate("2026-07-15T15:05:00Z");
  assert.deepEqual(
    { day: winter.day, month: winter.month, time: winter.time },
    { day: "15", month: "Jan", time: "10:05 AM" },
  );
  assert.match(winter.label, /January 15, 2026.*10:05 AM EST/);
  assert.deepEqual(
    { day: summer.day, month: summer.month, time: summer.time },
    { day: "15", month: "Jul", time: "11:05 AM" },
  );
  assert.match(summer.label, /July 15, 2026.*11:05 AM EDT/);
  assert.equal(
    formatJournalDate("2026-07-15T15:05:00Z", "Asia/Tokyo").day,
    "16",
  );
  assert.equal(
    formatJournalDate("2026-07-15T15:05:00Z", "Asia/Tokyo").time,
    "12:05 AM",
  );
  assert.deepEqual(
    formatJournalDate("2026-07-15T15:05:00Z", "invalid"),
    summer,
  );
});
