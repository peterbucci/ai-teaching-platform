import { Suspense, type ReactNode } from "react";
import type { ClassMetrics } from "../../lib/teacher/metrics.ts";
import type { TeacherWorkspaceContext } from "../../lib/teacher/workspace-contracts.ts";
import { TeacherWorkspace } from "./navigation.tsx";
import "./teacher.css";

export { TeacherWorkspacePanes } from "./workspace-panes.tsx";

/** Pages supply computed values and honest labels; the shell never calculates evidence. */
export function TeacherMetricStrip({
  items,
}: {
  items: { label: string; value: ReactNode; note?: ReactNode }[];
}) {
  return (
    <dl className="tw-metric-strip">
      {items.map((item) => (
        <div key={item.label}>
          <dd>{item.value}</dd>
          <dt>{item.label}</dt>
          {item.note && <dd className="tw-metric-note">{item.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function TeacherRuledList({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <ul className="tw-ruled-list" aria-label={label}>
      {children}
    </ul>
  );
}

export function TeacherFrame({
  children,
  section = "Teaching Desk",
  context,
}: {
  children: ReactNode;
  section?: string;
  context?: TeacherWorkspaceContext;
}) {
  return (
    <Suspense
      fallback={
        <div className="tw-shell">
          <header className="tw-header">Learning Pulse</header>
          <main className="tw-main" aria-busy="true">
            <p role="status">Loading workspace…</p>
          </main>
        </div>
      }
    >
      <TeacherWorkspace section={section} context={context}>
        <div className="lp-teacher">{children}</div>
      </TeacherWorkspace>
    </Suspense>
  );
}

export function label(value: string) {
  return value.replaceAll("_", " ");
}
export function date(value: string) {
  return new Date(value)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");
}
export function originLabel(value: string) {
  return value === "synthetic_fixture"
    ? "Synthetic history"
    : "Live demo interaction";
}
export function ratio(value: { numerator: number; denominator: number }) {
  return value.denominator
    ? `${value.numerator} / ${value.denominator}`
    : "No assessed responses";
}

export function ResultSummary({
  results,
}: {
  results: ClassMetrics["concepts"][number]["latest"];
}) {
  const counts = [
    ["Correct", results.correct],
    ["Partly correct", results.partially_correct],
    ["Incorrect", results.incorrect],
    ["Uncertain", results.uncertain],
    ["Awaiting evaluation", results.pending],
    ["Evaluation failed", results.evaluation_failed],
    ["Evaluation rejected", results.rejected],
  ] as const;
  return (
    <div className="lp-result-summary">
      {results.correct_rate.denominator === 0 && (
        <p className="text-slate-600">No assessed answers yet.</p>
      )}
      <dl className="lp-result-counts">
        {counts
          .filter(([, count]) => count > 0)
          .map(([name, count]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{count}</dd>
            </div>
          ))}
      </dl>
      {results.no_response > 0 && (
        <p className="lp-result-note">
          {results.no_response} students without a submitted answer in this
          view.
        </p>
      )}
    </div>
  );
}
