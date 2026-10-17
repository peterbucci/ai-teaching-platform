import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireActor } from "../../lib/auth.ts";
import { loadApprovedContent } from "../../lib/evidence/content.ts";
import { EvidenceError, evidenceAccess } from "../../lib/evidence/store.ts";
import { OriginFilterSchema } from "../../lib/teacher/metrics.ts";
import { calculatePatterns } from "../../lib/teacher/patterns.ts";
import { Patterns } from "./patterns.tsx";
import {
  readAssignmentEvidence,
  teacherAssignments,
} from "../../lib/teacher/store.ts";
import {
  TeacherFrame,
  ResultSummary,
  date,
  label,
  originLabel,
  ratio,
} from "./presentation.tsx";

export const dynamic = "force-dynamic";
async function load(params: {
  assignment?: string;
  origin?: string;
  concept?: string;
}) {
  try {
    const access = evidenceAccess(await requireActor());
    const assignments = await teacherAssignments(access);
    const origin = OriginFilterSchema.parse(params.origin ?? "all");
    const assignmentId = params.assignment ?? assignments[0]?.id;
    const data = assignmentId
      ? await readAssignmentEvidence(access, assignmentId, origin)
      : null;
    if (
      params.concept &&
      !data?.metrics.concepts.some((c) => c.concept_id === params.concept)
    )
      notFound();
    return { assignments, origin, data };
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    if (
      error instanceof z.ZodError ||
      (error instanceof EvidenceError && [403, 404].includes(error.status))
    )
      notFound();
    throw error;
  }
}

export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<{
    assignment?: string;
    origin?: string;
    concept?: string;
  }>;
}) {
  const params = await searchParams;
  const { assignments, origin, data } = await load(params);
  if (!data)
    return (
      <TeacherFrame>
        <h1 className="text-3xl font-semibold">No teaching assignments yet</h1>
        <p className="mt-4">
          This account has no class assignments to inspect. Check that you’re
          signed in with your teacher account.
        </p>
      </TeacherFrame>
    );
  const content = loadApprovedContent();
  const { metrics } = data;
  const href = (concept?: string) =>
    `/teacher?${new URLSearchParams({ assignment: data.assignment_id, origin, ...(concept ? { concept } : {}) })}`;
  return (
    <TeacherFrame>
      <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
        Teacher evidence
      </p>
      <h1 className="mt-2 text-3xl font-semibold">
        What are students showing us?
      </h1>
      <p className="mt-3 max-w-3xl text-slate-600">
        Inspect observed answers and the evidence behind each judgment. These
        are learning signals, not labels for students or proof of lasting
        mastery.
      </p>
      <form
        action="/teacher"
        className="my-7 flex flex-wrap items-end gap-4 rounded-xl bg-slate-50 p-4"
      >
        <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
          Assignment
          <select
            name="assignment"
            defaultValue={data.assignment_id}
            className="max-w-full rounded border border-slate-400 bg-white p-2"
          >
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.class_name} — {a.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Evidence
          <select
            name="origin"
            defaultValue={origin}
            className="rounded border border-slate-400 bg-white p-2"
          >
            <option value="all">All evidence</option>
            <option value="live_demo">Live demo only</option>
            <option value="synthetic_fixture">Synthetic histories only</option>
          </select>
        </label>
        <button className="rounded bg-teal-800 px-4 py-2 text-white">
          Refresh overview
        </button>
      </form>
      <h2 className="text-xl font-semibold">{data.title}</h2>
      <p className="mt-1 text-slate-600">
        {data.class_name} · All recorded time ·{" "}
        {origin === "all" ? "Both evidence sources" : originLabel(origin)}
      </p>
      <div className="my-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-5">
          <p className="text-3xl font-semibold">
            {ratio(metrics.participation)}
          </p>
          <p className="mt-2">students submitted an answer</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-5">
          <p className="text-3xl font-semibold">
            {metrics.no_activity_students}
          </p>
          <p className="mt-2">without a submitted answer in this view</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-5">
          <p>
            <strong>{metrics.origins.live_demo}</strong> students with live demo
            responses
          </p>
          <p className="mt-2">
            <strong>{metrics.origins.synthetic_fixture}</strong> with synthetic
            histories
          </p>
          <p className="mt-2 text-xs text-slate-600">
            These groups may overlap. Synthetic histories are invented examples,
            not measured learning outcomes.
          </p>
        </div>
      </div>
      <h2 className="text-2xl font-semibold">Concept results</h2>
      <p className="my-3 text-sm text-slate-600">
        Each view uses the latest submitted answer per student and concept.
        Pending and failed judgments stay visible. Correct fractions include
        uncertain assessed answers in their denominator.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {metrics.concepts.map((c) => (
          <section
            key={c.concept_id}
            className="rounded-xl border border-slate-200 p-5"
          >
            <h3 className="mb-3 text-lg font-semibold">
              <Link
                className="text-teal-800 underline"
                href={href(c.concept_id) + "#responses"}
              >
                {content.concepts.get(c.concept_id)?.title ?? c.concept_id}
              </Link>
            </h3>
            <ResultSummary results={c.latest} />
            <p className="mt-3 text-sm">
              Repeated partial or incorrect answers:{" "}
              <strong>{ratio(c.repeated_difficulty)}</strong> students with
              assessed responses.
            </p>
            <details className="mt-4 border-t border-slate-200 pt-3">
              <summary className="cursor-pointer font-medium text-teal-800">
                Compare independent answers and later practice
              </summary>
              <div className="mt-4 space-y-4">
                {(
                  [
                    ["Independent retrieval", c.independent],
                    ["After content assistance", c.content_assisted],
                    ["Immediate retest", c.immediate_retest],
                    ["Delayed review", c.delayed_review],
                  ] as const
                ).map(([name, result]) => (
                  <div key={name}>
                    <h4 className="mb-1 font-medium">{name}</h4>
                    <ResultSummary results={result} />
                  </div>
                ))}
                <p className="text-sm text-slate-600">
                  An immediate improvement after help does not establish
                  long-term retention. Synthetic delayed reviews are
                  illustrative only.
                </p>
              </div>
            </details>
          </section>
        ))}
      </div>
      <Patterns
        groups={calculatePatterns(
          data.students.map((s) => s.student_id),
          new Set(data.approved_misconception_ids),
          data.evidence,
        )}
        students={data.students}
        content={content}
      />
      <section id="responses" className="mt-10 scroll-mt-4">
        <h2 className="text-2xl font-semibold">
          Responses behind the overview
        </h2>
        <p className="my-3 text-slate-600">
          {params.concept
            ? `Showing ${content.concepts.get(params.concept)?.title ?? params.concept}.`
            : "All assigned concepts."}{" "}
          Open a session to inspect original answers, possible
          misunderstandings, uncertainty, help, and retests.{" "}
          {params.concept && (
            <Link href={href() + "#responses"} className="underline">
              Show all concepts
            </Link>
          )}
        </p>
        <ul className="divide-y divide-slate-200">
          {data.students.map((student) => {
            const sessions = data.evidence
              .filter(
                (e) =>
                  e.session.student_id === student.student_id &&
                  (!params.concept ||
                    e.attempts.some((a) =>
                      a.question.concept_ids.includes(params.concept!),
                    )),
              )
              .sort((a, b) =>
                b.session.started_at.localeCompare(a.session.started_at),
              );
            return (
              <li key={student.student_id} className="py-4">
                <h3 className="font-semibold">{student.display_name}</h3>
                {sessions.length ? (
                  <ul className="mt-2 space-y-2">
                    {sessions.map(({ session, attempts }) => (
                      <li key={session.id} className="text-sm">
                        <Link
                          href={`/teacher/sessions/${session.id}`}
                          className="font-medium text-teal-800 underline"
                        >
                          Inspect session · {date(session.started_at)}
                        </Link>
                        <span className="mt-1 block text-slate-600">
                          {originLabel(session.data_origin)} ·{" "}
                          {label(session.status)} ·{" "}
                          {attempts.filter((a) => a.submitted_at).length}{" "}
                          responses
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">
                    No recorded sessions in this view.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </TeacherFrame>
  );
}
