import Link from "next/link";
import {
  listTeacherLessons,
  lessonPublishingReview,
} from "../../../lib/lessons/publishing.ts";
import { listSourceVersions } from "../../../lib/lessons/sources.ts";
import { TeacherFrame } from "../presentation.tsx";
import { loadTeacherLesson } from "./load.ts";
import { lessonStepHref, resumeLessonStep } from "./authoring-state.ts";
import { ObjectiveLibrary } from "../objectives/library.tsx";
import "./authoring.css";

export const dynamic = "force-dynamic";

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    new?: string;
    source?: string;
    version?: string;
  }>;
}) {
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q.slice(0, 200) : "";
  const requestedPage = Number(query.page ?? 1);
  const { lessons, sources, count, page } = await loadTeacherLesson(
    async (access) => {
      const [summaries, versions] = await Promise.all([
        listTeacherLessons(access),
        listSourceVersions(access),
      ]);
      const filtered = summaries.filter((lesson) =>
        lesson.title.toLowerCase().includes(search.toLowerCase()),
      );
      const page = Math.min(
        Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1),
        Math.max(1, Math.ceil(filtered.length / 12)),
      );
      // Existing owned draft reads, bounded to the visible page.
      const lessons = await Promise.all(
        filtered.slice((page - 1) * 12, page * 12).map(async (summary) => {
          const review = await lessonPublishingReview(access, summary.id);
          return {
            ...summary,
            draft: review.lesson.draft,
            assignments: review.assignments,
          };
        }),
      );
      return {
        lessons,
        sources: versions.filter(
          (source) => source.version === source.latest_version,
        ),
        count: filtered.length,
        page,
      };
    },
  );
  const pageHref = (value: number) =>
    `/teacher/lessons?${new URLSearchParams({ q: search, page: String(value) })}`;
  return (
    <TeacherFrame section="Lessons">
      <div className="la-workspace ll-workspace">
        <header className="lp-page-heading ll-heading">
          <div className="ll-heading-row">
            <div>
              <h1 className="lp-title">Lessons</h1>
              <p className="la-muted">
                {count} {count === 1 ? "lesson" : "lessons"}
                {search ? " found" : ""}
              </p>
            </div>
            <Link
              href="/teacher/lessons?new=true"
              className="lp-button lp-button-primary"
            >
              New lesson
            </Link>
          </div>
          <nav className="la-actions ll-secondary" aria-label="Library actions">
            <Link href="/teacher/materials" className="lp-text-link">
              Add teaching material
            </Link>
            <Link href="/teacher/assignments" className="lp-text-link">
              Class assignments →
            </Link>
          </nav>
        </header>
        {query.new === "true" && (
          <section className="la-new-lesson">
            <div className="la-section-heading">
              <h2>New lesson</h2>
              <Link href="/teacher/lessons">Cancel</Link>
            </div>
            <ObjectiveLibrary
              compact
              sourceId={query.source}
              sourceVersion={query.version}
            />
          </section>
        )}
        <form
          className="la-search ll-search"
          role="search"
          action="/teacher/lessons"
        >
          <label className="lp-field">
            <span className="sr-only">Find a lesson</span>
            <input
              className="lp-input"
              name="q"
              defaultValue={search}
              maxLength={200}
              placeholder="Search lesson titles"
            />
          </label>
          <button className="lp-button">Search</button>
          {search && (
            <Link className="lp-button" href="/teacher/lessons">
              Clear
            </Link>
          )}
        </form>
        <section aria-labelledby="lesson-library-heading">
          <h2 id="lesson-library-heading" className="sr-only">
            Lesson library
          </h2>
          {lessons.length ? (
            <ul className="ll-list">
              {lessons.map((lesson) => {
                const approved = lesson.approved_revision === lesson.revision;
                const step = resumeLessonStep(lesson.draft, approved);
                const ref = lesson.draft?.content_ref;
                const sourceVersion =
                  ref && "source_version" in ref ? ref.source_version : null;
                const sourceTitle =
                  lesson.draft?.attribution?.title ?? "Source not yet prepared";
                const objectiveCount =
                  lesson.draft?.objective_workflow?.items.length ??
                  lesson.draft?.concepts?.length ??
                  0;
                const questionCount = lesson.draft?.questions?.length ?? 0;
                const latest = lesson.published_versions[0];
                const classCount = new Set(
                  lesson.assignments.map((item) => item.class_id),
                ).size;
                const publishedHref = (version: string) =>
                  `/teacher/lessons/${encodeURIComponent(lesson.id)}?version=${encodeURIComponent(version)}`;
                return (
                  <li key={lesson.id}>
                    <article
                      className="ll-row"
                      aria-labelledby={`lesson-${lesson.id}`}
                    >
                      <div className="ll-identity">
                        <h3 id={`lesson-${lesson.id}`}>
                          <Link
                            className="la-lesson-name"
                            href={lessonStepHref(lesson.id, step)}
                          >
                            {lesson.title}
                          </Link>
                        </h3>
                        <p className="ll-source la-muted">
                          {sourceTitle}
                          {sourceVersion !== null
                            ? ` · source v${sourceVersion}`
                            : ""}
                        </p>
                        <p className="ll-counts la-muted">
                          {objectiveCount}{" "}
                          {objectiveCount === 1 ? "objective" : "objectives"}
                          <span aria-hidden="true"> · </span>
                          {questionCount}{" "}
                          {questionCount === 1 ? "question" : "questions"}
                        </p>
                      </div>
                      <div className="ll-draft">
                        <span
                          className={`la-tag ${approved ? "la-tag-approved" : ""}`}
                        >
                          {approved ? "Approved" : "In progress"}
                        </span>
                        <p className="ll-revision la-muted">
                          Revision {lesson.revision} · lesson v
                          {lesson.content_version ?? "—"}
                        </p>
                        <Link
                          className="lp-text-link ll-resume"
                          href={lessonStepHref(lesson.id, step)}
                        >
                          Continue{" "}
                          {step === "questions" ? "question bank" : step}
                          <span aria-hidden="true"> →</span>
                        </Link>
                      </div>
                      <div className="ll-publication">
                        {latest ? (
                          <Link
                            className="lp-text-link"
                            href={publishedHref(latest)}
                          >
                            Published v{latest}
                          </Link>
                        ) : (
                          <span className="la-muted">Not published</span>
                        )}
                        <details className="ll-details">
                          <summary>
                            Details
                            <span className="sr-only"> for {lesson.title}</span>
                          </summary>
                          <dl>
                            <div>
                              <dt>Source</dt>
                              <dd>
                                {sourceTitle}
                                {sourceVersion !== null
                                  ? ` · source v${sourceVersion}`
                                  : ""}
                              </dd>
                            </div>
                            <div>
                              <dt>Draft</dt>
                              <dd>
                                Revision {lesson.revision} · lesson v
                                {lesson.content_version ?? "—"}
                              </dd>
                            </div>
                            <div>
                              <dt>Publication history</dt>
                              <dd>
                                {lesson.published_versions.length ? (
                                  <ul>
                                    {lesson.published_versions.map(
                                      (version) => (
                                        <li key={version}>
                                          <Link
                                            className="lp-text-link"
                                            href={publishedHref(version)}
                                          >
                                            Version {version}
                                          </Link>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                ) : (
                                  "No published version yet"
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt>Assigned to</dt>
                              <dd>
                                {classCount ? (
                                  <Link
                                    className="lp-text-link"
                                    href="/teacher/assignments"
                                  >
                                    {classCount}{" "}
                                    {classCount === 1 ? "class" : "classes"}
                                  </Link>
                                ) : (
                                  "Not assigned"
                                )}
                              </dd>
                            </div>
                          </dl>
                        </details>
                      </div>
                      <div className="ll-assigned la-muted">
                        {classCount ? (
                          <Link
                            className="lp-text-link"
                            href="/teacher/assignments"
                          >
                            {classCount}{" "}
                            {classCount === 1 ? "class" : "classes"}
                          </Link>
                        ) : (
                          "Not assigned"
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="la-empty">
              <h3>
                {search
                  ? "No lessons match this search"
                  : "Your first lesson starts with teaching material"}
              </h3>
              <p>
                {search
                  ? "Try another title or clear the search to browse your drafts."
                  : "Import a permitted reading or choose an approved source. Build objectives and questions manually, and return to unfinished work here."}
              </p>
              <Link
                className="lp-button"
                href={search ? "/teacher/lessons" : "/teacher/materials"}
              >
                {search ? "Show all lessons" : "Add teaching material"}
              </Link>
            </div>
          )}
          {count > 12 && (
            <nav className="la-bottom-nav" aria-label="Lesson pages">
              {page > 1 && <Link href={pageHref(page - 1)}>← Previous</Link>}
              <span>
                Page {page} of {Math.ceil(count / 12)}
              </span>
              {page * 12 < count && (
                <Link href={pageHref(page + 1)}>Next →</Link>
              )}
            </nav>
          )}
        </section>
        <section
          className="la-section"
          aria-labelledby="material-library-heading"
        >
          <div className="la-section-heading">
            <h2 id="material-library-heading">Teaching material</h2>
            <Link className="lp-text-link" href="/teacher/materials">
              Manage material →
            </Link>
          </div>
          <p className="la-muted">
            Private to you. Each lesson keeps its exact source version.
            Classroom assignments are managed separately.
          </p>
          {sources.length ? (
            <ul className="la-source-list">
              {sources.map((source) => (
                <li key={source.document_id}>
                  <div>
                    <Link
                      href={`/teacher/materials/${source.document_id}?version=${source.version}`}
                    >
                      {source.attribution.title}
                    </Link>
                    <p className="la-muted">
                      {source.attribution.authors.join(", ")} ·{" "}
                      {source.attribution.license}
                    </p>
                  </div>
                  <div className="la-muted">
                    Version {source.version} · {source.passages.length} passages
                    <br />
                    {source.review_status === "approved"
                      ? "Reviewed source"
                      : "Review required"}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="la-notice">
              No teaching material has been saved yet. Supported imports: pasted
              text, UTF-8 text/Markdown and text-only PDFs.
            </p>
          )}
        </section>
      </div>
    </TeacherFrame>
  );
}
