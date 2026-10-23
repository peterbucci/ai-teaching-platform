"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type {
  DashboardLesson,
  StudentDashboard,
} from "../../../lib/tutoring/dashboard-model.ts";
import { Icon } from "../../components/icons.tsx";
import { LocalTime } from "../../components/local-time.tsx";
import { AssignmentAction } from "./action.tsx";
import { sourceHeading } from "../reading/presentation.ts";
import {
  assignmentFilters,
  assignmentScopeOptions,
  matchesAssignment,
  normalizeAssignmentScope,
  practiceCategory,
  practiceStatus,
  scopeAssignments,
  sourceLocationKey,
  type AssignmentFilter,
  type AssignmentScope,
} from "./presentation.ts";

function ScopeSelect({
  label,
  value,
  allLabel,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  allLabel: string;
  options: { value: string; label: string; depth?: number }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="assignment-scope-field">
      <span>{label}</span>
      <span className="assignment-select-control">
        <select
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
        <ChevronDown aria-hidden="true" focusable="false" size={16} />
      </span>
    </label>
  );
}

function sourceContext(lesson: DashboardLesson) {
  return lesson.sourcePath.length
    ? lesson.sourcePath.map(sourceHeading).join(" › ")
    : lesson.sourceSection;
}

export function AssignmentList({ dashboard }: { dashboard: StudentDashboard }) {
  const lessons = dashboard.lessons;
  const [scope, setScope] = useState<AssignmentScope>(() => {
    const options = assignmentScopeOptions(lessons, {
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
  const [filter, setFilter] = useState<AssignmentFilter>("All");
  const [search, setSearch] = useState("");
  const selection = normalizeAssignmentScope(lessons, scope);
  const options = assignmentScopeOptions(lessons, selection);
  const scoped = scopeAssignments(lessons, selection);
  const searched = scoped.filter((lesson) => matchesAssignment(lesson, search));
  const visible = searched.filter(
    (lesson) => filter === "All" || practiceCategory(lesson) === filter,
  );
  const first = visible[0];
  const sharedSource =
    first && visible.every((lesson) => lesson.sourceKey === first.sourceKey)
      ? first
      : null;
  const sharedPath = sharedSource
    ? sharedSource.sourcePath.filter((_, index) =>
        visible.every(
          (lesson) =>
            sourceLocationKey(lesson.sourcePath.slice(0, index + 1)) ===
            sourceLocationKey(sharedSource.sourcePath.slice(0, index + 1)),
        ),
      )
    : [];
  const sharedReading =
    first &&
    visible.every(
      (lesson) =>
        lesson.sourceKey === first.sourceKey &&
        lesson.sourceSection === first.sourceSection &&
        sourceLocationKey(lesson.sourcePath) ===
          sourceLocationKey(first.sourcePath),
    )
      ? first
      : null;
  const showClass = !selection.classId && options.classes.length > 1;
  const groups = [
    ["In progress", "In progress"],
    ["To start", "Up next"],
    ["Completed", "Completed"],
  ] as const;

  function resetFilters() {
    setScope({ classId: "", sourceKey: "", locationKey: "" });
    setFilter("All");
    setSearch("");
  }

  return (
    <section
      className="lp-panel assignments-browser"
      aria-label="Browse assignments"
    >
      <div className="assignment-scope-controls">
        <ScopeSelect
          label="Class"
          value={selection.classId}
          allLabel="All classes"
          options={options.classes}
          onChange={(classId) =>
            setScope({ classId, sourceKey: "", locationKey: "" })
          }
        />
        <ScopeSelect
          label="Source"
          value={selection.sourceKey}
          allLabel="All sources"
          options={options.sources}
          onChange={(sourceKey) =>
            setScope({ ...selection, sourceKey, locationKey: "" })
          }
        />
        <ScopeSelect
          label="Chapter / section"
          value={selection.locationKey}
          allLabel={
            !selection.sourceKey
              ? "Choose a source first"
              : options.locations.length
                ? "All assigned chapters / sections"
                : "No chapter or section metadata"
          }
          options={options.locations}
          disabled={!selection.sourceKey || !options.locations.length}
          onChange={(locationKey) => setScope({ ...selection, locationKey })}
        />
      </div>
      <div className="assignment-controls">
        <div
          className="assignment-filter-buttons"
          role="group"
          aria-label="Filter by practice status"
        >
          {assignmentFilters.map((value) => (
            <button
              key={value}
              type="button"
              className={`assignment-filter${filter === value ? " active" : ""}`}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value}{" "}
              <span>
                {value === "All"
                  ? searched.length
                  : searched.filter(
                      (lesson) => practiceCategory(lesson) === value,
                    ).length}
              </span>
            </button>
          ))}
        </div>
        <div className="assignment-search-wrap">
          <Icon name="search" />
          <input
            type="search"
            aria-label="Find an assignment"
            placeholder="Find an assignment"
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="assignment-list-content">
        <div className="assignment-results-summary">
          <p role="status" aria-live="polite">
            {visible.length}{" "}
            {visible.length === 1 ? "assignment" : "assignments"} shown
          </p>
          {(selection.classId ||
            selection.sourceKey ||
            selection.locationKey ||
            search ||
            filter !== "All") && (
            <button
              type="button"
              className="assignment-ghost"
              onClick={resetFilters}
            >
              Clear filters
            </button>
          )}
        </div>
        {sharedSource ? (
          <div className="assignment-shared-reading">
            <Icon name="book" />
            <div>
              <h2>{sharedSource.sourceTitle}</h2>
              {sharedPath.length > 0 ? (
                <p>{sharedPath.map(sourceHeading).join(" › ")}</p>
              ) : sharedReading ? (
                <p>{sharedReading.sourceSection}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <h2 className="sr-only">Matching assignments</h2>
        )}
        {visible.length ? (
          groups.map(([category, label]) => {
            const rows = visible.filter(
              (lesson) => practiceCategory(lesson) === category,
            );
            return rows.length ? (
              <section key={category} aria-label={label}>
                <h3 className="assignment-section-label">{label}</h3>
                {rows.map((lesson) => (
                  <article
                    key={lesson.id}
                    className={`assignment-entry${lesson.id === dashboard.currentAssignmentId ? " is-current" : ""}`}
                  >
                    <div className="assignment-entry-content">
                      {showClass && (
                        <p className="assignment-entry-class">
                          {lesson.className}
                        </p>
                      )}
                      <h4>{lesson.title}</h4>
                      {lesson.instructions && (
                        <details className="assignment-entry-instructions">
                          <summary>Instructions from your teacher</summary>
                          <p>{lesson.instructions}</p>
                        </details>
                      )}
                      {!sharedReading && (
                        <p className="assignment-entry-source">
                          {!sharedSource && (
                            <>
                              {lesson.sourceTitle}
                              <br />
                            </>
                          )}
                          {sharedSource
                            ? lesson.sourcePath
                                .slice(sharedPath.length)
                                .map(sourceHeading)
                                .join(" › ") || lesson.sourceSection
                            : sourceContext(lesson)}
                        </p>
                      )}
                      <p className="assignment-entry-progress">
                        {
                          lesson.topics.filter((topic) => topic.practiced)
                            .length
                        }{" "}
                        of {lesson.topics.length} topics practiced
                        <span aria-hidden="true"> · </span>
                        {lesson.lastCompletedAt ? (
                          <LocalTime
                            value={lesson.lastCompletedAt}
                            prefix="Last completed on "
                          />
                        ) : category === "In progress" ? (
                          "Not Completed"
                        ) : (
                          practiceStatus(lesson)
                        )}
                      </p>
                    </div>
                    <div className="assignment-entry-actions">
                      <AssignmentAction lesson={lesson} />
                      <div className="assignment-entry-links">
                        <Link
                          href={`/study/assignments/${lesson.id}`}
                          className="assignment-ghost"
                          aria-label={`Details: ${lesson.title}`}
                        >
                          Details
                        </Link>
                        <Link
                          href={`/study/reading?assignment=${lesson.id}`}
                          className="assignment-ghost"
                          aria-label={`Reading: ${lesson.title}`}
                        >
                          Reading <Icon name="arrow" />
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            ) : null;
          })
        ) : (
          <div className="assignment-empty">
            <h3>No matching assignments</h3>
            <p>
              {filter === "To start" && !search
                ? "You have no assignments waiting to be started in this selection."
                : "Try another class, source, section, search, or practice status."}
            </p>
            <button type="button" className="lp-button" onClick={resetFilters}>
              Show all assignments
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
