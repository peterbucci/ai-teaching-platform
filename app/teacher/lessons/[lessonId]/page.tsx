import Link from "next/link";
import {
  lessonPublishingReview,
  readPublishedLessonForReview,
} from "../../../../lib/lessons/publishing.ts";
import { TeacherFrame } from "../../presentation.tsx";
import { loadTeacherLesson } from "../load.ts";
import { LessonPreview } from "../preview.tsx";
import {
  AssembleLesson,
  CreateClassAssignment,
  ReviewActions,
} from "../controls.tsx";

export const dynamic = "force-dynamic";
export default async function LessonReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { lessonId } = await params;
  const { version } = await searchParams;
  const { review, published } = await loadTeacherLesson(async (access) => ({
    review: await lessonPublishingReview(access, lessonId),
    published: version
      ? await readPublishedLessonForReview(access, lessonId, version)
      : null,
  }));
  const { lesson, validation } = review;
  const content = published ?? lesson.draft;
  const href = `/teacher/lessons/${encodeURIComponent(lessonId)}`;
  return (
    <TeacherFrame section="Lessons">
      <header className="lp-page-heading">
        <Link href="/teacher/lessons">← Your lessons</Link>
        <p className="lp-eyebrow mt-4">
          {published
            ? `Published version ${version}`
            : `Draft revision ${lesson.revision}`}
        </p>
        <h1 className="lp-title">{lesson.title}</h1>
        <p className="lp-intro">
          {published
            ? "This approved snapshot is immutable. New lesson edits leave its assignments and student work unchanged."
            : "Check the complete lesson before approving it. Edits clear approval and require a new review."}
        </p>
        {published && (
          <Link className="lp-button" href={href}>
            Return to current draft
          </Link>
        )}
      </header>
      <div className="lp-assignment-layout">
        <div className="lp-assignment-main">
          {!published && (
            <section className="lp-panel" aria-labelledby="validation-heading">
              <h2 id="validation-heading">
                {validation.valid
                  ? "Ready for your review"
                  : "Requirements to resolve"}
              </h2>
              {validation.valid ? (
                <p>
                  Required content and source checks passed. Review the
                  educational content and source support before approval.
                </p>
              ) : (
                <ul className="list-disc pl-5 my-3">
                  {validation.issues.map((issue, index) => (
                    <li key={index}>
                      <strong>{issue.path || "Lesson"}:</strong> {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {!published && lesson.draft?.question_bank?.approval && (
            <section className="lp-panel">
              <AssembleLesson
                lessonId={lessonId}
                revision={lesson.revision}
                families={[
                  ...new Set(
                    lesson.draft.question_bank.items.map(
                      (item) => item.family_id,
                    ),
                  ),
                ]}
              />
            </section>
          )}
          <LessonPreview content={content} />
        </div>
        <aside
          className="lp-panel lp-assignment-sidebar"
          aria-label="Lesson publication and assignment"
        >
          {published && version ? (
            <>
              <p className="lp-eyebrow">Published lesson</p>
              <h2>Choose a class</h2>
              <p>
                You are assigning version {version}. Review its reading and
                questions alongside this form.
              </p>
              <CreateClassAssignment
                key={version}
                lessonId={lessonId}
                version={version}
                title={lesson.title}
                classes={review.classes}
              />
            </>
          ) : (
            <>
              <p className="lp-eyebrow">
                {lesson.approved_revision === lesson.revision
                  ? "Approved draft"
                  : "Lesson review"}
              </p>
              <h2>
                {lesson.approved_revision === lesson.revision
                  ? "Publish this version"
                  : "Approve reviewed content"}
              </h2>
              <ReviewActions
                key={`${lesson.revision}:${lesson.approved_revision}`}
                lessonId={lessonId}
                revision={lesson.revision}
                approved={lesson.approved_revision === lesson.revision}
                valid={validation.valid}
              />
            </>
          )}
          <h3 className="font-semibold mt-6">Published versions</h3>
          {review.published_versions.length ? (
            <ul className="space-y-2 my-3">
              {review.published_versions.map((item) => (
                <li key={item.version}>
                  <Link
                    href={`${href}?version=${encodeURIComponent(item.version)}`}
                  >
                    Review version {item.version} and assign
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>No published versions yet.</p>
          )}
          <h3 className="font-semibold mt-6">Class assignments</h3>
          {review.assignments.length ? (
            <ul className="space-y-3 my-3">
              {review.assignments.map((item) => (
                <li key={item.id}>
                  <Link href={`/teacher/assignments?assignment=${item.id}`}>
                    {item.title} · {item.class_name}
                  </Link>
                  <p>
                    Version {item.lesson_version} ·{" "}
                    {item.teacher_approved_at
                      ? "Active"
                      : "Awaiting activation"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No classes assigned yet.</p>
          )}
        </aside>
      </div>
    </TeacherFrame>
  );
}
