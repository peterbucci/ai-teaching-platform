import type {
  DashboardLesson,
  StudentDashboard,
} from "../../../../lib/tutoring/dashboard-model.ts";
import {
  continuingAssignment,
  matchesAssignment,
} from "../../assignments/presentation.ts";

export const learningFilters = [
  "All",
  "To start",
  "In progress",
  "Needs attention",
  "Completed",
] as const;
export type LearningFilter = (typeof learningFilters)[number];
export type LearningSelection = {
  classId: string;
  sourceKey: string;
  filter: LearningFilter;
  search: string;
};
export const allLearning: LearningSelection = {
  classId: "",
  sourceKey: "",
  filter: "All",
  search: "",
};

export function learningCategory(
  lesson: Pick<DashboardLesson, "session">,
): Exclude<LearningFilter, "All"> {
  switch (lesson.session?.status) {
    case "completed":
      return "Completed";
    case "pending_evaluation":
    case "unevaluated":
      return "Needs attention";
    case "active":
      return "In progress";
    default:
      return "To start";
  }
}

export function learningStatus(lesson: Pick<DashboardLesson, "session">) {
  switch (lesson.session?.status) {
    case "completed":
      return "Session complete";
    case "pending_evaluation":
      return "Evaluation pending";
    case "unevaluated":
      return "Teacher support needed";
    case "active":
      return "In progress";
    default:
      return "Ready to start";
  }
}

export function learningStatusNote(lesson: Pick<DashboardLesson, "session">) {
  switch (lesson.session?.status) {
    case "pending_evaluation":
      return "Your session is waiting for an evaluation. Open it to check its saved status.";
    case "unevaluated":
      return "An assessment could not be completed. Review the session for the available next step.";
    case "completed":
      return "You can revisit your saved session and responses.";
    case "active":
      return "Continue your existing session from where you left off.";
    default:
      return "Your first session begins only when you choose Start assignment.";
  }
}

export function practiceCoverage(lesson: Pick<DashboardLesson, "topics">) {
  return {
    practiced: lesson.topics.filter((topic) => topic.practiced).length,
    total: lesson.topics.length,
  };
}

export function overviewHref(assignmentId: string) {
  return `/study/assignments/${encodeURIComponent(assignmentId)}?tab=overview`;
}

export function savedWorkHref(assignmentId: string, sessionId?: string) {
  const query = new URLSearchParams({ tab: "work" });
  if (sessionId) query.set("session", sessionId);
  return `/study/assignments/${encodeURIComponent(assignmentId)}?${query}`;
}

/** A display-only projection of already authorized records. No service or storage access. */
export function learningView(
  dashboard: StudentDashboard,
  selection: LearningSelection = allLearning,
) {
  const scoped = dashboard.lessons.filter(
    (lesson) =>
      (!selection.classId || lesson.classId === selection.classId) &&
      (!selection.sourceKey || lesson.sourceKey === selection.sourceKey) &&
      matchesAssignment(lesson, selection.search),
  );
  const filters = learningFilters.filter(
    (filter) =>
      filter === "All" ||
      scoped.some((lesson) => learningCategory(lesson) === filter),
  );
  const visible = scoped.filter(
    (lesson) =>
      selection.filter === "All" ||
      learningCategory(lesson) === selection.filter,
  );
  const groups: {
    classId: string;
    className: string;
    sourceKey: string;
    sourceTitle: string;
    lessons: DashboardLesson[];
  }[] = [];
  for (const lesson of visible) {
    let group = groups.find(
      (entry) =>
        entry.classId === lesson.classId &&
        entry.sourceKey === lesson.sourceKey,
    );
    if (!group) {
      group = {
        classId: lesson.classId,
        className: lesson.className,
        sourceKey: lesson.sourceKey,
        sourceTitle: lesson.sourceTitle,
        lessons: [],
      };
      groups.push(group);
    }
    group.lessons.push(lesson);
  }
  // Only continue actual unfinished sessions. Never fall back from a foreign current ID.
  const current = dashboard.lessons.find(
    (lesson) => lesson.id === dashboard.currentAssignmentId,
  );
  const continuing =
    dashboard.currentAssignmentId && !current
      ? null
      : current?.session && current.session.status !== "completed"
        ? current
        : continuingAssignment(dashboard.lessons);
  return { groups, filters, visibleCount: visible.length, continuing };
}
