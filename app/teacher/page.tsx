import Link from "next/link";
import { Icon } from "../components/icons.tsx";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireActor } from "../../lib/auth.ts";
import { loadApprovedContent } from "../../lib/evidence/content.ts";
import { EvidenceError, evidenceAccess } from "../../lib/evidence/store.ts";
import { OriginFilterSchema } from "../../lib/teacher/metrics.ts";
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
      <header className="lp-page-heading">
        <p className="lp-eyebrow">Your classroom</p>
        <h1 className="lp-title">Class overview</h1>
        <p className="lp-intro">
          Inspect observed answers and the evidence behind each judgment. These
          are learning signals, not labels for students or proof of lasting
          mastery.
        </p>
      </header>
      <form action="/teacher" className="lp-filter-bar">
        <label className="lp-field">
          Assignment
          <select
            name="assignment"
            defaultValue={data.assignment_id}
            className="lp-input"
          >
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.class_name} — {a.title}
              </option>
            ))}
          </select>
        </label>
        <label className="lp-field">
          Evidence
          <select name="origin" defaultValue={origin} className="lp-input">
            <option value="all">All evidence</option>
            <option value="live_demo">Live demo only</option>
            <option value="synthetic_fixture">Synthetic histories only</option>
          </select>
        </label>
        <button className="lp-button lp-button-primary">
          Refresh overview
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-3">
        <span className="lp-badge">
          <Icon name="book" />
          {data.class_name}
        </span>
        <h2 className="text-sm font-semibold">{data.title}</h2>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {data.class_name} · All recorded time ·{" "}
        {origin === "all" ? "Both evidence sources" : originLabel(origin)}
      </p>
      <div className="lp-stats">
        <div className="lp-panel lp-stat">
          <p className="lp-stat-label">
            <Icon name="users" />
            Participation
          </p>
          <p className="lp-stat-number">{ratio(metrics.participation)}</p>
          <p className="lp-stat-caption">students submitted an answer</p>
        </div>
        <div className="lp-panel lp-stat">
          <p className="lp-stat-label">
            <Icon name="clock" />
            Not yet participating
          </p>
          <p className="lp-stat-number">{metrics.no_activity_students}</p>
          <p className="lp-stat-caption">
            without a submitted answer in this view
          </p>
        </div>
        <div className="lp-panel lp-stat">
          <p className="lp-stat-label">
            <Icon name="chat" />
            Live demo
          </p>
          <p className="lp-stat-number">{metrics.origins.live_demo}</p>
          <p className="lp-stat-caption">students with live demo responses</p>
        </div>
        <div className="lp-panel lp-stat">
          <p className="lp-stat-label">
            <Icon name="book" />
            Synthetic histories
          </p>
          <p className="lp-stat-number">{metrics.origins.synthetic_fixture}</p>
          <p className="lp-stat-caption">
            students with invented example histories
          </p>
        </div>
      </div>
      <div className="lp-overview-grid">
        <section className="lp-panel">
          <div className="lp-panel-heading">
            <h2>Understanding by concept</h2>
            <span className="lp-badge lp-badge-neutral">Latest answers</span>
          </div>
          <p className="lp-panel-description">
            Each view uses the latest submitted answer per student and concept.
            Pending and failed judgments stay visible. Correct fractions include
            uncertain assessed answers in their denominator.
          </p>
          <div>
            {metrics.concepts.map((c) => (
              <section key={c.concept_id} className="lp-concept-row">
                <h3>
                  <Link
                    className="hover:underline"
                    href={href(c.concept_id) + "#responses"}
                  >
                    {content.concepts.get(c.concept_id)?.title ?? c.concept_id}
                  </Link>
                </h3>
                <ResultSummary results={c.latest} />
                <p className="mt-3 text-xs text-slate-600">
                  Repeated partial or incorrect answers:{" "}
                  <strong>{ratio(c.repeated_difficulty)}</strong> students with
                  assessed responses.
                </p>
                <details className="mt-4 border-t border-slate-200 pt-3">
                  <summary className="lp-detail-summary">
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
        </section>
        <aside className="lp-panel">
          <h2>Reading the learning signals</h2>
          <p className="lp-panel-description">
            A starting point for a closer look.
          </p>
          <div className="lp-insight">
            <h3>Look beyond the latest answer</h3>
            <p>
              Expand a concept to compare independent retrieval, answers after
              help, and later practice. Immediate improvement is not proof of
              lasting mastery.
            </p>
          </div>
          <div className="lp-insight">
            <h3>Keep the gaps in view</h3>
            <p>
              Uncertain answers and pending, failed, or rejected evaluations
              remain separate. Missing activity does not mean a student is
              incorrect.
            </p>
          </div>
          <div className="lp-insight">
            <h3>Know where the evidence came from</h3>
            <p>
              Live demo and synthetic student groups may overlap. Synthetic
              histories are invented examples, not measured learning outcomes.
            </p>
          </div>
          <a href="#responses" className="lp-text-link mt-5">
            Inspect original responses
            <Icon name="arrow" />
          </a>
        </aside>
      </div>
      <section id="responses" className="lp-panel lp-responses">
        <h2>Responses behind the overview</h2>
        <p className="lp-panel-description mb-5">
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
        <ul>
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
              <li key={student.student_id} className="lp-student-row">
                <h3 className="lp-student-name">
                  <span className="lp-avatar" aria-hidden="true">
                    {student.display_name
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span>{student.display_name}</span>
                </h3>
                {sessions.length ? (
                  <ul>
                    {sessions.map(({ session, attempts }) => (
                      <li key={session.id} className="lp-session-row">
                        <div>
                          <span
                            className={`lp-badge${session.data_origin === "synthetic_fixture" ? " lp-badge-neutral" : ""}`}
                          >
                            {originLabel(session.data_origin)}
                          </span>
                          <small>
                            {label(session.status)} ·{" "}
                            {attempts.filter((a) => a.submitted_at).length}{" "}
                            responses · {date(session.started_at)}
                          </small>
                        </div>
                        <Link
                          href={`/teacher/sessions/${session.id}`}
                          className="lp-text-link"
                        >
                          Inspect session
                          <Icon name="arrow" />
                        </Link>
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
