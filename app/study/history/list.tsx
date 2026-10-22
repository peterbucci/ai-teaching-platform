"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { StudentHistoryEntry } from "../../../lib/tutoring/history-model.ts";
import { assignmentStudyHref } from "../../../lib/tutoring/navigation.ts";
import { Icon } from "../../components/icons.tsx";
import { useUserTimeZone } from "../../components/local-time.tsx";
import { sourceHeading } from "../reading/presentation.ts";
import {
  filterJournalEntries,
  formatJournalDate,
  groupJournalMonths,
  journalCategory,
  journalScopeOptions,
  journalStatuses,
  journalStatusLabel,
  normalizeJournalScope,
  type JournalPeriod,
  type JournalScope,
  type JournalStatus,
} from "./presentation.ts";

function JournalSelect({
  label,
  value,
  options,
  allLabel,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; depth?: number }[];
  allLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="journal-field">
      <span>{label}</span>
      <span className="journal-select-control">
        <select
          aria-label={label}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{allLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.depth ? `${"– ".repeat(option.depth)}` : ""}
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden="true" focusable="false" />
      </span>
    </label>
  );
}

export function JournalList({
  entries,
  nowISO,
}: {
  entries: StudentHistoryEntry[];
  nowISO: string;
}) {
  const timeZone = useUserTimeZone();
  const [scope, setScope] = useState<JournalScope>(() => {
    const options = journalScopeOptions(entries, {
      classId: "",
      sourceKey: "",
      locationKey: "",
    });
    return {
      classId: options.classes.length === 1 ? options.classes[0].value : "",
      sourceKey: options.sources.length === 1 ? options.sources[0].value : "",
      locationKey: "",
    };
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<JournalStatus>("All");
  const [period, setPeriod] = useState<JournalPeriod>("all");
  const selection = normalizeJournalScope(entries, scope);
  const options = journalScopeOptions(entries, selection);
  const matching = filterJournalEntries(
    entries,
    { ...selection, search, status: "All", period },
    nowISO,
  );
  const visible = matching.filter(
    (entry) => status === "All" || journalCategory(entry) === status,
  );
  const groups = groupJournalMonths(visible, timeZone);
  const filtered = Boolean(
    selection.classId ||
    selection.sourceKey ||
    selection.locationKey ||
    search ||
    status !== "All" ||
    period !== "all",
  );
  function clearFilters() {
    setScope({ classId: "", sourceKey: "", locationKey: "" });
    setSearch("");
    setStatus("All");
    setPeriod("all");
  }
  return (
    <section className="lp-panel journal-browser" aria-label="Study history">
      <div className="journal-scope-controls">
        <JournalSelect
          label="Class"
          value={selection.classId}
          options={options.classes}
          allLabel="All classes"
          onChange={(classId) =>
            setScope({ classId, sourceKey: "", locationKey: "" })
          }
        />
        <JournalSelect
          label="Source"
          value={selection.sourceKey}
          options={options.sources}
          allLabel="All sources"
          onChange={(sourceKey) =>
            setScope({ ...selection, sourceKey, locationKey: "" })
          }
        />
        <JournalSelect
          label="Chapter / section"
          value={selection.locationKey}
          options={options.locations}
          allLabel={
            !selection.sourceKey
              ? "Choose a source first"
              : options.locations.length
                ? "All chapters / sections"
                : "No chapter or section metadata"
          }
          disabled={!selection.sourceKey || !options.locations.length}
          onChange={(locationKey) => setScope({ ...selection, locationKey })}
        />
      </div>
      <div className="journal-tools">
        <label className="journal-search">
          <span className="sr-only">Search study sessions</span>
          <Icon name="search" />
          <input
            type="search"
            placeholder="Search assignments or topics"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="journal-field">
          <span>When</span>
          <span className="journal-select-control">
            <select
              aria-label="When"
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
            <ChevronDown size={16} aria-hidden="true" focusable="false" />
          </span>
        </label>
      </div>
      <div
        className="journal-status-filters"
        role="group"
        aria-label="Filter by session status"
      >
        {journalStatuses.map((value) => (
          <button
            key={value}
            type="button"
            className={`journal-filter${status === value ? " active" : ""}`}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {value}{" "}
            <span>
              {value === "All"
                ? matching.length
                : matching.filter((entry) => journalCategory(entry) === value)
                    .length}
            </span>
          </button>
        ))}
      </div>
      <div className="journal-content">
        <div className="journal-results">
          <p role="status" aria-live="polite">
            {visible.length} saved{" "}
            {visible.length === 1 ? "session" : "sessions"}
          </p>
          {filtered && (
            <button
              type="button"
              className="journal-link"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
        {groups.length ? (
          groups.map((group) => (
            <section
              className="journal-month"
              key={group.key}
              aria-labelledby={`journal-month-${group.key}`}
            >
              <h2 id={`journal-month-${group.key}`}>{group.label}</h2>
              <ol className="journal-session-list">
                {group.entries.map((entry) => {
                  const date = formatJournalDate(entry.started_at, timeZone);
                  const action =
                    entry.status === "active"
                      ? "Continue session"
                      : "Review session";
                  const context = [
                    !selection.classId ? entry.className : "",
                    !selection.sourceKey ? entry.sourceTitle : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const sourceSection = entry.sourcePath.at(-1);
                  return (
                    <li key={entry.id}>
                      <article className="journal-session-row">
                        <time
                          dateTime={entry.started_at}
                          className="journal-date"
                          aria-label={date.label}
                          title={date.label}
                        >
                          <strong>{date.day}</strong>
                          <span>{date.month}</span>
                        </time>
                        <div className="journal-session-main">
                          {context && (
                            <p className="journal-context">{context}</p>
                          )}
                          <h3>{entry.title}</h3>
                          <p className="journal-source">
                            {sourceSection
                              ? sourceHeading(sourceSection)
                              : entry.sourceSection}
                          </p>
                          <p className="journal-session-meta">
                            <span>{date.time}</span>
                            <span>
                              {entry.response_count
                                ? `${entry.response_count} saved ${entry.response_count === 1 ? "response" : "responses"}`
                                : "No answers submitted yet"}
                            </span>
                            <span
                              className={`journal-state${entry.status === "completed" ? " complete" : journalCategory(entry) === "Needs attention" ? " attention" : ""}`}
                            >
                              {journalStatusLabel(entry)}
                            </span>
                          </p>
                          {entry.topics.length > 0 && (
                            <div
                              className="journal-topics"
                              aria-label="Topics practiced in submitted responses"
                            >
                              {entry.topics.map((topic) => (
                                <span key={topic.id}>{topic.title}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <Link
                          className="journal-session-open"
                          href={assignmentStudyHref(
                            entry.assignment_id,
                            entry.id,
                          )}
                          prefetch={false}
                          aria-label={`${action}: ${entry.title}, ${date.label}`}
                        >
                          {action} <Icon name="arrow" />
                        </Link>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))
        ) : (
          <div className="journal-empty">
            <h2>No matching sessions</h2>
            <p>Try another class, source, chapter, search, or time period.</p>
            <button type="button" className="lp-button" onClick={clearFilters}>
              Show all sessions
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
