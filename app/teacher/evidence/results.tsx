"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
  type TeacherWorkspaceContext,
} from "../../../lib/teacher/workspace-contracts.ts";
import {
  canPrepareFromRow,
  evidenceResult,
  type EvidenceRow,
} from "./model.ts";

export function EvidenceResults({
  rows,
  context,
  selectedAttempt,
  totalRows,
}: {
  rows: EvidenceRow[];
  context: TeacherWorkspaceContext;
  selectedAttempt?: string;
  totalRows: number;
}) {
  const search = useSearchParams();
  const selected = parseTeacherWorkspaceContext({
    ...context,
    seedAttempt: search.getAll("seedAttempt"),
  }).seedAttempt;
  const selectedCount = selected.length;
  return (
    <form
      action="/teacher/interventions"
      method="get"
      className="wb-evidence-results"
    >
      {Object.entries({
        ...context,
        returnTo: "evidence",
        seedAttempt: undefined,
      }).map(([name, value]) =>
        value !== undefined && !Array.isArray(value) ? (
          <input key={name} type="hidden" name={name} value={value} />
        ) : null,
      )}
      {selected.map((id) => (
        <input key={id} type="hidden" name="seedAttempt" value={id} />
      ))}
      <div className="wb-results-heading">
        <h2 id="evidence-results" tabIndex={-1}>
          Saved responses
        </h2>
        <p className="wb-meta">
          {rows.length} shown · {totalRows} for this concept
        </p>
      </div>
      <ul className="wb-response-list">
        {rows.map((row) => {
          const eligible = Boolean(
            context.concept && canPrepareFromRow(row, context.concept),
          );
          const checked = selected.includes(row.attempt.id);
          return (
            <li
              key={row.attempt.id}
              className={
                selectedAttempt === row.attempt.id
                  ? "wb-response-item wb-response-selected"
                  : "wb-response-item"
              }
            >
              <Link
                aria-current={
                  selectedAttempt === row.attempt.id ? "true" : undefined
                }
                href={`${teacherWorkspaceHref("/teacher/evidence", context, { attempt: row.attempt.id, evaluation: row.evaluation?.id, session: row.session_id, seedAttempt: selected })}#response-detail-title`}
              >
                <span className="wb-response-head">
                  <strong>{row.student_name}</strong>
                  <span>{evidenceResult(row, context.concept)}</span>
                </span>
                <span className="wb-response-excerpt">
                  {row.attempt.response_text?.slice(0, 120)}
                  {(row.attempt.response_text?.length ?? 0) > 120 ? "…" : ""}
                </span>
                <small>
                  {row.data_origin === "synthetic_fixture"
                    ? "Prepared history"
                    : "Live demo"}{" "}
                  · {row.attempt.intent.replaceAll("_", " ")}
                </small>
              </Link>
              {eligible && (
                <label className="wb-seed-choice">
                  <input
                    type="checkbox"
                    aria-label={`Include response from ${row.student_name}, submitted ${row.attempt.submitted_at}`}
                    checked={checked}
                    disabled={!checked && selectedCount >= 60}
                    onChange={() => {
                      const next = checked
                        ? selected.filter((id) => id !== row.attempt.id)
                        : [...selected, row.attempt.id];
                      // Let Next copy its internal state and notify search-param subscribers.
                      // Reusing history.state marks this as an internal router write.
                      window.history.replaceState(
                        null,
                        "",
                        teacherWorkspaceHref("/teacher/evidence", context, {
                          seedAttempt: next,
                        }) + window.location.hash,
                      );
                    }}
                  />{" "}
                  Include this response
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {!rows.length && (
        <p className="wb-empty">
          No responses match this search. Clear the search or choose another
          concept.
        </p>
      )}
      <div className="wb-prepare-bar">
        <p>
          <strong>
            {selectedCount} starting{" "}
            {selectedCount === 1 ? "response" : "responses"} selected
          </strong>
        </p>
        <p className="wb-meta">
          Related accepted responses from the same students, including
          counterevidence, stay in scope.
        </p>
        <button
          className="lp-button lp-button-primary"
          disabled={!selectedCount}
        >
          Prepare intervention
        </button>
        <p className="wb-meta">
          Opens the evidence review. AI generation, approval and delivery each
          require your action.
        </p>
      </div>
    </form>
  );
}
