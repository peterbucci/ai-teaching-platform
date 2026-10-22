import type { ReactNode } from "react";
import type { ClassMetrics } from "../../lib/teacher/metrics.ts";
import { Workspace } from "../components/workspace.tsx";
import "./teacher.css";

export function TeacherFrame({
  children,
  section = "Class overview",
}: {
  children: ReactNode;
  section?: string;
}) {
  return (
    <Workspace area="teacher" section={section}>
      <div className="lp-teacher">{children}</div>
    </Workspace>
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
