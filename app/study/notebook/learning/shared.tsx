import type { ReactNode } from "react";
import type { DashboardLesson } from "../../../../lib/tutoring/dashboard-model.ts";
import {
  learningCategory,
  learningStatus,
  practiceCoverage,
} from "./presentation.ts";
import styles from "./learning.module.css";

export function LearningStatus({ lesson }: { lesson: DashboardLesson }) {
  return (
    <span className={styles.status} data-category={learningCategory(lesson)}>
      {learningStatus(lesson)}
    </span>
  );
}

export function PracticeCoverage({ lesson }: { lesson: DashboardLesson }) {
  const { practiced, total } = practiceCoverage(lesson);
  if (!total)
    return <p className={styles.small}>Practice topics are unavailable.</p>;
  return (
    <div className={styles.coverage}>
      <span className={styles.dots} aria-hidden="true">
        {lesson.topics.map((topic) => (
          <span
            key={topic.id}
            className={topic.practiced ? styles.practiced : undefined}
          />
        ))}
      </span>
      <span>
        {practiced} of {total} practice topics with submitted responses
      </span>
    </div>
  );
}

export function LearningNotice({
  title,
  children,
  loading = false,
}: {
  title: string;
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <section
      className={styles.notice}
      role={loading ? "status" : "alert"}
      aria-busy={loading || undefined}
    >
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}

export function WorkVisibility() {
  return (
    <section className={styles.sideCard} aria-label="Who sees your work">
      <h2>Who sees your work</h2>
      <p>
        Your teachers can review submitted work and recorded help in their
        classes.
      </p>
      <p className={styles.small}>
        Other students cannot see your responses. Unsent text is not a submitted
        answer.
      </p>
    </section>
  );
}
