"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
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
import {
  evidenceResponseAnchor,
  evidenceResultsNavigationKey,
  evidenceResultsScope,
  evidenceResultsTarget,
  evidenceSeedSelectionHref,
  focusEvidenceResultsTarget,
  readEvidenceResultsMemory,
  responseVisibleScrollTop,
  withEvidenceResultsMemory,
} from "./results-navigation.ts";

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
  const listRef = useRef<HTMLUListElement>(null);
  const restoring = useRef(true);
  const scrollFrame = useRef<number | null>(null);
  const scope = evidenceResultsScope(context);
  const navigationKey = evidenceResultsNavigationKey(search.toString());
  const attemptIdsKey = rows.map((row) => row.attempt.id).join(",");
  const attemptIds = useMemo(
    () => (attemptIdsKey ? attemptIdsKey.split(",") : []),
    [attemptIdsKey],
  );
  const remember = useCallback(
    (attemptId?: string) => {
      const list = listRef.current;
      // A route transition can begin before its new results have rendered.
      if (
        !list ||
        restoring.current ||
        evidenceResultsNavigationKey(window.location.search) !== navigationKey
      )
        return;
      const focused = document.activeElement?.closest<HTMLElement>(
        "[data-evidence-attempt]",
      );
      const bounds = list.getBoundingClientRect();
      const visible = (element: HTMLElement) => {
        const row = element.getBoundingClientRect();
        return row.bottom > bounds.top && row.top < bounds.bottom;
      };
      const focusedRow = focused && list.contains(focused) && visible(focused);
      const anchor = focusedRow
        ? focused
        : Array.from(
            list.querySelectorAll<HTMLElement>("[data-evidence-attempt]"),
          ).find(visible);
      try {
        window.history.replaceState(
          withEvidenceResultsMemory(window.history.state, {
            scope,
            attemptId: attemptId ?? anchor?.dataset.evidenceAttempt,
            scrollTop: list.scrollTop,
            focusRow: Boolean(attemptId || focusedRow),
          }),
          "",
        );
      } catch (error) {
        // Some browsers limit history writes during rapid scrolling. Position
        // recovery is best effort; no student response or draft is stored here.
        if (!(error instanceof DOMException && error.name === "SecurityError"))
          throw error;
      }
    },
    [navigationKey, scope],
  );
  useEffect(() => {
    let frame = 0;
    function restore() {
      window.cancelAnimationFrame(frame);
      restoring.current = true;
      frame = window.requestAnimationFrame(() => {
        const list = listRef.current;
        if (
          !list ||
          evidenceResultsNavigationKey(window.location.search) !== navigationKey
        )
          return;
        const memory = readEvidenceResultsMemory(
          window.history.state,
          scope,
          attemptIds,
        );
        if (memory) list.scrollTop = memory.scrollTop;
        const targetId = evidenceResultsTarget(
          window.location.hash,
          attemptIds,
          selectedAttempt,
          memory,
        );
        const target = targetId ? document.getElementById(targetId) : null;
        const rowAnchor =
          targetId === "response-detail-title"
            ? document.getElementById(evidenceResponseAnchor(selectedAttempt))
            : target;
        const row = rowAnchor?.closest<HTMLElement>("[data-evidence-attempt]");
        if (row && list.contains(row)) {
          const bounds = list.getBoundingClientRect();
          const rowBounds = row.getBoundingClientRect();
          list.scrollTop = responseVisibleScrollTop({
            scrollTop: list.scrollTop,
            viewportHeight: list.clientHeight,
            scrollHeight: list.scrollHeight,
            rowTop: rowBounds.top - bounds.top + list.scrollTop,
            rowHeight: rowBounds.height,
          });
        }
        if (target) focusEvidenceResultsTarget(target);
        restoring.current = false;
      });
    }
    const save = () => remember();
    restore();
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    window.addEventListener("pagehide", save);
    document.addEventListener("focusin", save);
    return () => {
      window.cancelAnimationFrame(frame);
      if (scrollFrame.current !== null) {
        window.cancelAnimationFrame(scrollFrame.current);
        scrollFrame.current = null;
      }
      window.removeEventListener("hashchange", restore);
      window.removeEventListener("popstate", restore);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("focusin", save);
    };
  }, [attemptIds, navigationKey, remember, scope, selectedAttempt]);
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
      <ul
        className="wb-response-list"
        ref={listRef}
        onScroll={() => {
          if (scrollFrame.current !== null) return;
          scrollFrame.current = window.requestAnimationFrame(() => {
            scrollFrame.current = null;
            remember();
          });
        }}
        onFocusCapture={(event) => {
          const row = event.target.closest<HTMLElement>(
            "[data-evidence-attempt]",
          );
          remember(row?.dataset.evidenceAttempt);
        }}
      >
        {rows.map((row) => {
          const eligible = Boolean(
            context.concept && canPrepareFromRow(row, context.concept),
          );
          const checked = selected.includes(row.attempt.id);
          return (
            <li
              key={row.attempt.id}
              data-evidence-attempt={row.attempt.id}
              className={
                selectedAttempt === row.attempt.id
                  ? "wb-response-item wb-response-selected"
                  : "wb-response-item"
              }
            >
              <Link
                id={evidenceResponseAnchor(row.attempt.id)}
                aria-current={
                  selectedAttempt === row.attempt.id ? "true" : undefined
                }
                href={`${teacherWorkspaceHref("/teacher/evidence", context, { attempt: row.attempt.id, evaluation: row.evaluation?.id, session: row.session_id, seedAttempt: selected })}#response-detail-title`}
                scroll={false}
                onClick={(event) => {
                  if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  remember(row.attempt.id);
                  if (row.attempt.id === selectedAttempt) {
                    const detail = document.getElementById(
                      "response-detail-title",
                    );
                    if (detail) focusEvidenceResultsTarget(detail);
                  }
                }}
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
                      parseTeacherWorkspaceContext({
                        ...context,
                        seedAttempt: next,
                      });
                      // Let Next copy its internal state and notify search-param subscribers.
                      // Reusing history.state marks this as an internal router write.
                      window.history.replaceState(
                        null,
                        "",
                        evidenceSeedSelectionHref(window.location.href, next),
                      );
                      remember(row.attempt.id);
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
