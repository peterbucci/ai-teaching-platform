"use client";

import Link from "next/link";
import type { StudentDashboard } from "../../lib/tutoring/dashboard-model.ts";
import { assignmentStudyHref } from "../../lib/tutoring/navigation.ts";
import { Icon } from "../components/icons.tsx";

export function LearningOverview({
  dashboard,
  busy,
  onStart,
}: {
  dashboard: StudentDashboard;
  busy: boolean;
  onStart: (id: string) => Promise<void>;
}) {
  const featured = dashboard.lessons.find(
    (lesson) => lesson.id === dashboard.currentAssignmentId,
  );

  if (!featured)
    return (
      <section className="lp-panel lp-study-empty">
        <span className="lp-avatar">
          <Icon name="book" />
        </span>
        <h2>Your next lesson starts here</h2>
        <p>
          No assignments are active for this account yet. Your teacher-approved
          assignments will appear here when they’re available.
        </p>
        <Link href="/study/assignments" className="lp-text-link">
          See all assignments <Icon name="arrow" />
        </Link>
      </section>
    );

  const practiced = featured.topics.filter((topic) => topic.practiced).length;
  const session = featured.session;
  const review =
    session?.status === "completed" || session?.status === "unevaluated";
  const pending = session?.status === "pending_evaluation";
  const upNext = dashboard.lessons
    .filter(
      (lesson) =>
        lesson.id !== featured.id && lesson.session?.status !== "completed",
    )
    .slice(0, 3);

  return (
    <>
      <section
        className="lesson-workspace"
        aria-labelledby="current-lesson-heading"
      >
        <div className="lesson-overview">
          <div className="lesson-content">
            <div className="lesson-overline">
              <Icon name="clock" />
              {review
                ? "Your latest work"
                : session
                  ? "Resume current work"
                  : "Ready to begin"}
            </div>
            <div className="lesson-course">
              {featured.sourceTitle} · {featured.sourceSection}
            </div>
            <h2 id="current-lesson-heading">{featured.title}</h2>
            <p>
              {pending
                ? "Your answer is saved and its evaluation is pending. Open your session to check its progress and continue when it is ready."
                : session?.status === "unevaluated"
                  ? "Your work is saved. Revisit your responses and the next steps for getting support from your teacher."
                  : "Work through your teacher-approved reading, explain your thinking, and revisit your saved questions and feedback."}
            </p>
            {session ? (
              <Link
                href={assignmentStudyHref(featured.id, session.id)}
                prefetch={false}
                className="lp-button lp-button-primary lesson-continue"
              >
                {review
                  ? "Review your work"
                  : pending
                    ? "Check saved progress"
                    : "Resume current work"}
                <Icon name="arrow" />
              </Link>
            ) : (
              <button
                type="button"
                className="lp-button lp-button-primary lesson-continue"
                disabled={busy}
                onClick={() => void onStart(featured.id)}
              >
                {busy ? "Opening your session…" : "Start learning"}{" "}
                <Icon name="arrow" />
              </button>
            )}
            <nav className="lesson-links" aria-label="Resources for this work">
              <Link
                href={`/study/reading?assignment=${featured.id}`}
                className="lesson-resource-link"
              >
                <Icon name="book" /> Reading
              </Link>
              <span className="lesson-link-divider" aria-hidden="true" />
              <Link
                href={`/study/assignments/${featured.id}`}
                className="lesson-resource-link"
              >
                <Icon name="book" /> Assignment details
              </Link>
              <span className="lesson-link-divider" aria-hidden="true" />
              <Link href="/study/history" className="lesson-resource-link">
                <Icon name="chart" /> Learning journal
              </Link>
            </nav>
          </div>
        </div>
        <aside
          className="lesson-outline"
          aria-labelledby="lesson-topics-heading"
        >
          <div className="outline-heading">
            <h2 className="outline-overline" id="lesson-topics-heading">
              Topics you have explored
            </h2>
            <span className="outline-count">
              {practiced} of {featured.topics.length} practiced
            </span>
          </div>
          <div
            className="outline-track"
            role="progressbar"
            aria-labelledby="lesson-topics-heading"
            aria-valuemin={0}
            aria-valuemax={featured.topics.length || 1}
            aria-valuenow={practiced}
            aria-valuetext={`${practiced} of ${featured.topics.length} topics with recorded practice`}
          >
            <span
              style={{
                width: `${featured.topics.length ? (practiced / featured.topics.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="outline-explainer">
            A practice record means you explored the topic. It is not a mastery
            score.
          </p>
          <ul className="lesson-topic-list">
            {featured.topics.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={`/study/assignments/${featured.id}#topic-${topic.id}`}
                  className="lesson-topic-link"
                >
                  <span
                    className={`lesson-topic-icon${topic.practiced ? " practiced" : ""}`}
                  >
                    <Icon name={topic.practiced ? "tick" : "spark"} />
                  </span>
                  <span className="lesson-topic-copy">
                    <strong>{topic.title}</strong>
                    <small>
                      {topic.practiced
                        ? "Practice recorded"
                        : "No practice recorded yet"}
                    </small>
                  </span>
                  <span className="lesson-topic-arrow">
                    <Icon name="arrow" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </section>
      {upNext.length ? (
        <section
          className="lp-panel student-up-next"
          aria-labelledby="up-next-heading"
        >
          <h2 id="up-next-heading">Up next</h2>
          <div className="student-work-list">
            {upNext.map((lesson) => (
              <article key={lesson.id}>
                <div>
                  <h3>{lesson.title}</h3>
                  <p>
                    {lesson.approval_label} ·{" "}
                    {lesson.session?.status === "pending_evaluation"
                      ? "Evaluation pending"
                      : lesson.session?.status === "unevaluated"
                        ? "Saved · Teacher support needed"
                        : lesson.session
                          ? "In progress"
                          : "Ready to start"}
                  </p>
                </div>
                <Link
                  href={`/study/assignments/${lesson.id}`}
                  className="lp-button"
                >
                  View assignment <Icon name="arrow" />
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section
          className="lp-panel student-up-next empty-next"
          aria-labelledby="next-work-heading"
        >
          <h2 id="next-work-heading">Up next</h2>
          <p>
            No other assignments to complete right now.{" "}
            {review
              ? "Your saved work is ready to revisit."
              : "Focus on your current work when you’re ready."}{" "}
            New teacher-approved assignments will appear here.
          </p>
        </section>
      )}
      <div className="home-bottom">
        <span>Choose what to work on next.</span>
        <Link href="/study/assignments" className="all-assignments-link">
          See all assignments <Icon name="arrow" />
        </Link>
      </div>
    </>
  );
}
