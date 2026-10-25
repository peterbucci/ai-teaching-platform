"use client";

import { useId, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { StudentHistoryEntry } from "../../../../lib/tutoring/history-model.ts";
import type { NotebookRecordsProps } from "../contracts.ts";
import { NotebookRecordIndex } from "../records/index.ts";
import {
  filterJournalEntries,
  journalScopeOptions,
  journalStatuses,
  normalizeJournalScope,
  scopeJournalEntries,
  type JournalPeriod,
  type JournalScope,
  type JournalStatus,
} from "../../history/presentation.ts";
import styles from "./notebook-history.module.css";

type HistoryState = NotebookRecordsProps["history"];
const emptyScope: JournalScope = {
  classId: "",
  sourceKey: "",
  locationKey: "",
};

function SelectField({
  label,
  value,
  options,
  allLabel,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string; depth?: number }[];
  allLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.depth ? "– ".repeat(option.depth) : ""}
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Only supplied history metadata is filtered. N3 keeps all record links and identities. */
export function NotebookHistory({
  history,
  nowISO,
}: {
  history: HistoryState;
  nowISO: string;
}) {
  const entries =
    history.status === "ready" || history.status === "pending"
      ? history.data
      : null;
  return (
    <section className={styles.root} data-n7-notebook-index>
      <header className={styles.heading}>
        <p className={styles.kicker}>Your saved sessions</p>
        <h1>Notebook</h1>
        <p>
          Revisit your questions and original answers, grouped by saved session.
        </p>
      </header>
      {entries?.length ? (
        <LoadedHistory
          history={history}
          entries={[...entries]}
          nowISO={nowISO}
        />
      ) : (
        <>
          <NotebookRecordIndex history={history} />
          {history.status === "unavailable" && (
            <a className={styles.clear} href="/study/history">
              Try again
            </a>
          )}
        </>
      )}
    </section>
  );
}

function LoadedHistory({
  history,
  entries,
  nowISO,
}: {
  history: HistoryState;
  entries: StudentHistoryEntry[];
  nowISO: string;
}) {
  const [scope, setScope] = useState<JournalScope>(emptyScope);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<JournalStatus>("All");
  const [period, setPeriod] = useState<JournalPeriod>("all");
  const [topic, setTopic] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const id = useId();
  const selection = normalizeJournalScope(entries, scope);
  const options = journalScopeOptions(entries, selection);
  const topicOptions = new Map<string, string>();
  const scopedEntries = scopeJournalEntries(entries, selection);
  const multipleSources =
    new Set(scopedEntries.map((entry) => entry.sourceKey)).size > 1;
  const topicKey = (entry: StudentHistoryEntry, conceptId: string) =>
    JSON.stringify([entry.sourceKey, conceptId]);
  for (const entry of scopedEntries)
    for (const item of entry.topics) {
      topicOptions.set(
        topicKey(entry, item.id),
        multipleSources ? item.title + " · " + entry.sourceTitle : item.title,
      );
    }
  const selectedTopic = topicOptions.has(topic) ? topic : "";
  const matchingIds = new Set(
    filterJournalEntries(
      entries,
      { ...selection, search, status, period },
      nowISO,
    ).map((entry) => entry.id),
  );
  // Reapply membership to the authorized input rather than sorting its server order.
  const visible = entries.filter(
    (entry) =>
      matchingIds.has(entry.id) &&
      (!selectedTopic ||
        entry.topics.some(
          (item) => topicKey(entry, item.id) === selectedTopic,
        )),
  );
  const filterCount = [
    selection.classId,
    selection.sourceKey,
    selection.locationKey,
    search.trim(),
    selectedTopic,
    status !== "All",
    period !== "all",
  ].filter(Boolean).length;
  const filteredHistory: HistoryState =
    history.status === "pending"
      ? { ...history, data: visible }
      : { status: "ready", data: visible };
  function clearFilters() {
    setScope(emptyScope);
    setSearch("");
    setStatus("All");
    setPeriod("all");
    setTopic("");
  }
  return (
    <div className={styles.columns}>
      <aside className={styles.filters} aria-label="Filter saved sessions">
        <button
          className={styles.toggle}
          type="button"
          aria-expanded={filtersOpen}
          aria-controls={id + "-filters"}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal aria-hidden="true" size={16} /> Filters
          {filterCount ? " · " + filterCount + " on" : ""}
        </button>
        <div
          className={styles.fields}
          id={id + "-filters"}
          data-open={filtersOpen}
        >
          <label className={styles.field}>
            <span>Search</span>
            <input
              type="search"
              value={search}
              placeholder="Session, source or idea"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <SelectField
            label="Class"
            value={selection.classId}
            options={options.classes}
            allLabel="All classes"
            onChange={(classId) => {
              setScope({ classId, sourceKey: "", locationKey: "" });
              setTopic("");
            }}
          />
          <SelectField
            label="Source"
            value={selection.sourceKey}
            options={options.sources}
            allLabel="All sources"
            onChange={(sourceKey) => {
              setScope({ ...selection, sourceKey, locationKey: "" });
              setTopic("");
            }}
          />
          <SelectField
            label="Chapter / section"
            value={selection.locationKey}
            options={options.locations}
            allLabel={
              !selection.sourceKey
                ? "Choose a source first"
                : options.locations.length
                  ? "All chapters / sections"
                  : "No section metadata"
            }
            disabled={!selection.sourceKey || !options.locations.length}
            onChange={(locationKey) => setScope({ ...selection, locationKey })}
          />
          <SelectField
            label="Idea"
            value={selectedTopic}
            options={[...topicOptions].map(([value, label]) => ({
              value,
              label,
            }))}
            allLabel="All recorded ideas"
            onChange={setTopic}
          />
          <label className={styles.field}>
            <span>Session status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  journalStatuses.find(
                    (value) => value === event.target.value,
                  ) ?? "All",
                )
              }
            >
              {journalStatuses.map((value) => (
                <option key={value} value={value}>
                  {value === "All" ? "All sessions" : value}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>When started</span>
            <select
              value={period}
              onChange={(event) =>
                setPeriod(
                  event.target.value === "7"
                    ? "7"
                    : event.target.value === "30"
                      ? "30"
                      : "all",
                )
              }
            >
              <option value="all">Any time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
          <button className={styles.clear} type="button" onClick={clearFilters}>
            Clear filters
          </button>
          <p className={styles.note}>
            Search covers session details. Open saved work for exact submitted
            answers. Results and help history aren’t available in this index.
          </p>
        </div>
      </aside>
      <div className={styles.results}>
        <p className={styles.count} role="status">
          {visible.length} saved {visible.length === 1 ? "session" : "sessions"}
          {filterCount ? " match your filters" : " in your notebook"}
        </p>
        {visible.length ? (
          <NotebookRecordIndex history={filteredHistory} />
        ) : (
          <section className={styles.empty}>
            {history.status === "pending" && (
              <p role="status">{history.message}</p>
            )}
            <h2>No saved sessions match</h2>
            <p>
              Try another search or clear your filters. Your saved work has not
              changed.
            </p>
            <button
              className={styles.clear}
              type="button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
