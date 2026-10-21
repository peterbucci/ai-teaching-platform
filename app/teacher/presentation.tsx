import type { ReactNode } from "react";
import type { ClassMetrics } from "../../lib/teacher/metrics.ts";
import { Workspace } from "../components/workspace.tsx";

export function TeacherFrame({
  children,
  section = "Class overview",
}: {
  children: ReactNode;
  section?: string;
}) {
  return (
    <Workspace area="teacher" section={section}>
      {children}
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
  return (
    <div className="lp-result-summary">
      <p>
        <strong>{ratio(results.correct_rate)}</strong> correct among assessed
        students
      </p>
      {results.correct_rate.denominator > 0 && (
        <progress
          className="lp-progress"
          aria-label="Correct among assessed students"
          max={results.correct_rate.denominator}
          value={results.correct_rate.numerator}
        />
      )}
      <p className="text-slate-600">
        {results.partially_correct} partial · {results.incorrect} incorrect ·{" "}
        {results.uncertain} uncertain
      </p>
      <p className="text-slate-600">
        {results.pending} pending · {results.evaluation_failed} failed ·{" "}
        {results.rejected} rejected · {results.no_response} without a submitted
        response
      </p>
    </div>
  );
}
