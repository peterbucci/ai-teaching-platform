import Link from "next/link";
import type { ReactNode } from "react";
import type { ClassMetrics } from "../../lib/teacher/metrics.ts";

export function TeacherFrame({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-slate-900 sm:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <Link href="/" className="font-semibold text-teal-800">
          Learning Pulse
        </Link>
        <nav className="flex gap-5 text-sm">
          <Link href="/teacher" className="underline">
            Class overview
          </Link>
          <Link href="/login" className="underline">
            Account / sign out
          </Link>
        </nav>
      </header>
      {children}
    </main>
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
    <div className="space-y-1 text-sm">
      <p>
        <strong>{ratio(results.correct_rate)}</strong> correct among assessed
        students
      </p>
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
