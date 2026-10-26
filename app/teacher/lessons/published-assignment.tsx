import Link from "next/link";
import type { ReactNode } from "react";
import { publishedLessonAssignmentHref } from "./published-assignment-href.ts";

export function PublishedAssignmentHandoff({
  lessonId,
  publishedVersion,
  classId,
  children,
}: {
  lessonId: string;
  publishedVersion: string;
  classId?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className="la-assignment-handoff"
      aria-labelledby="published-assignment-heading"
    >
      <h3 id="published-assignment-heading">Use this lesson in a class</h3>
      <p className="la-muted">
        Choose a class and review the assignment before creating it. It stays
        inactive until you activate it in Assignments.
      </p>
      <div className="la-actions">
        <Link
          className="lp-button lp-button-primary"
          href={publishedLessonAssignmentHref({
            lessonId,
            publishedVersion,
            classId,
          })}
        >
          Prepare assignment from version {publishedVersion}
        </Link>
        <Link className="lp-text-link" href="/teacher/assignments">
          Browse class assignments
        </Link>
      </div>
      {children}
    </section>
  );
}
