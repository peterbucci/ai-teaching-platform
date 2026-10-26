import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EvidenceError } from "../../../../lib/evidence/store.ts";
import type { ApprovedContent } from "../../../../lib/evidence/content.ts";
import {
  listTeacherLessons,
  readPublishedLessonForReview,
} from "../../../../lib/lessons/publishing.ts";
import { readAssignmentContent } from "../../../../lib/lessons/store.ts";
import { hydrateLessonContent } from "../../../../lib/lessons/validate.ts";
import { TeacherFrame } from "../../presentation.tsx";
import { assignmentIndex, withAssignmentAccess } from "../load.ts";
import { AssignmentLessonReview } from "../lesson-review.tsx";
import { CreateAssignment } from "../create.tsx";
import {
  NewAssignmentSelectionSchema,
  publishedAssignmentHref,
  selectPublishedLesson,
} from "./selection.ts";
import "../assignments.css";

export const dynamic = "force-dynamic";
export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const data = await withAssignmentAccess(async (access) => {
    const params = NewAssignmentSelectionSchema.parse(raw);
    const index = await assignmentIndex(access);
    if (params.class && !index.classes.some((c) => c.id === params.class))
      notFound();
    const lessons = index.classes.length
      ? await listTeacherLessons(access)
      : [];
    const choices = lessons.flatMap((lesson) =>
      lesson.published_versions.map((version) => ({
        lesson: lesson.id,
        title: lesson.title,
        version,
        assignment: undefined as string | undefined,
      })),
    );
    // The shared curated package is not in the owned-lesson catalog. Resolve it
    // only through an assignment already authorized for this teacher.
    const curated = new Map<string, ApprovedContent>();
    for (const item of index.assignments) {
      if (
        item.lesson_id !== "network-performance-v1" ||
        choices.some(
          (c) =>
            c.lesson === item.lesson_id && c.version === item.lesson_version,
        )
      )
        continue;
      try {
        curated.set(
          item.id,
          await readAssignmentContent(access, item.id, "teacher"),
        );
      } catch (error) {
        if (
          error instanceof z.ZodError ||
          (error instanceof EvidenceError && [404, 409].includes(error.status))
        )
          continue;
        throw error;
      }
      choices.push({
        lesson: item.lesson_id,
        title: item.lesson_title,
        version: item.lesson_version,
        assignment: item.id,
      });
    }
    const selected = selectPublishedLesson(choices, params);
    if ((params.lesson || params.version) && !selected) notFound();
    let content: ApprovedContent | null = null;
    let unavailable = false;
    if (selected) {
      try {
        content = selected.assignment
          ? (curated.get(selected.assignment) ?? null)
          : hydrateLessonContent(
              await readPublishedLessonForReview(
                access,
                selected.lesson,
                selected.version,
              ),
            );
      } catch (error) {
        if (
          error instanceof z.ZodError ||
          (error instanceof EvidenceError && [404, 409].includes(error.status))
        )
          unavailable = true;
        else throw error;
      }
    }
    return {
      params,
      choices,
      selected,
      content,
      unavailable,
      actorId: access.actor.profileId,
      classes: index.classes,
    };
  });
  const { params, choices, selected, content, actorId, classes, unavailable } =
    data;
  return (
    <TeacherFrame section="Assignments">
      <div className="awa-workspace">
        <header className="awa-heading">
          <div>
            <Link
              href={`/teacher/assignments${params.class ? `?class=${params.class}` : ""}`}
            >
              ← Class assignments
            </Link>
            <p className="lp-eyebrow">
              Published lesson → classroom assignment
            </p>
            <h1 className="lp-title">Create an assignment</h1>
            <p className="lp-intro">
              Choose an immutable lesson version. Save it for classroom review,
              then activate it separately.
            </p>
          </div>
        </header>
        <section className="lp-panel">
          <h2>1. Choose a published lesson version</h2>
          {choices.length ? (
            <nav
              className="awa-version-options"
              aria-label="Published lesson versions"
            >
              {choices.map((item) => (
                <Link
                  key={`${item.lesson}:${item.version}`}
                  aria-current={item === selected ? "true" : undefined}
                  href={publishedAssignmentHref(item, params.class)}
                >
                  <strong>{item.title}</strong>
                  <span>Published version {item.version}</span>
                </Link>
              ))}
            </nav>
          ) : (
            <p>
              No published lesson versions are available. Publish a reviewed
              lesson before creating its classroom assignment.
            </p>
          )}
          <Link href="/teacher/lessons">Open Lessons →</Link>
        </section>
        {unavailable && (
          <section className="lp-panel" role="status">
            <h2>This published version is unavailable</h2>
            <p>
              Its exact approved source could not be resolved. Choose another
              version or review the source in Lessons before creating an
              assignment.
            </p>
          </section>
        )}
        {selected && content && (
          <div className="awa-review-layout">
            <div>
              <AssignmentLessonReview
                content={content}
                contentRef={content.content_ref}
              />
            </div>
            <aside className="lp-panel awa-activation">
              <h2>2. Save for classroom review</h2>
              <p>
                <strong>{selected.title}</strong> · Version {selected.version}
              </p>
              <p>
                The reading, learning objectives and prepared tutoring sequence
                shown here belong to this exact published version.
              </p>
              <CreateAssignment
                key={JSON.stringify([
                  actorId,
                  selected.lesson,
                  selected.version,
                  params.class,
                ])}
                actorId={actorId}
                lessonId={selected.lesson}
                version={selected.version}
                title={selected.title}
                classes={classes}
                initialClassId={params.class}
              />
            </aside>
          </div>
        )}
      </div>
    </TeacherFrame>
  );
}
