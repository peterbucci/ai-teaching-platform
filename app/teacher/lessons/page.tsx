import Link from "next/link";
import { listTeacherLessons } from "../../../lib/lessons/publishing.ts";
import { TeacherFrame } from "../presentation.tsx";
import { loadTeacherLesson } from "./load.ts";

export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const lessons = await loadTeacherLesson(listTeacherLessons);
  return (
    <TeacherFrame section="Lessons">
      <header className="lp-page-heading">
        <p className="lp-eyebrow">Prepare learning</p>
        <h1 className="lp-title">Your lessons</h1>
        <p className="lp-intro">
          Review your material, learning goals, and questions. Publish an
          approved version, then choose a class and activate its assignment.
        </p>
        <Link href="/teacher/assignments" className="lp-button">
          Class assignments
        </Link>
      </header>
      {lessons.length ? (
        <div className="space-y-4">
          {lessons.map((lesson) => (
            <article key={lesson.id} className="lp-panel">
              <h2>{lesson.title}</h2>
              <p>
                Revision {lesson.revision} ·{" "}
                {lesson.approved_revision === lesson.revision
                  ? "Approved draft"
                  : "Review required"}
              </p>
              <p>
                {lesson.published_versions.length
                  ? `Published versions: ${lesson.published_versions.join(", ")}`
                  : "No published version yet"}
              </p>
              <Link
                className="lp-button lp-button-primary mt-4"
                href={`/teacher/lessons/${encodeURIComponent(lesson.id)}`}
              >
                Review lesson
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <section className="lp-panel">
          <h2>No lesson drafts yet</h2>
          <p>
            Lessons appear here after material, objectives, and questions have
            been saved in the lesson editor. A complete reviewed lesson is
            required before publication.
          </p>
        </section>
      )}
    </TeacherFrame>
  );
}
