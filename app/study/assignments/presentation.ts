import {
  currentAssignmentId,
  type DashboardLesson,
} from "../../../lib/tutoring/dashboard-model.ts";
import { sourceHeading } from "../reading/presentation.ts";

export type AssignmentScope = {
  classId: string;
  sourceKey: string;
  locationKey: string;
};

type ScopeEntry = Pick<
  DashboardLesson,
  "classId" | "className" | "sourceKey" | "sourceTitle" | "sourcePath"
>;

export function sourceLocationKey(path: DashboardLesson["sourcePath"]) {
  return JSON.stringify(path);
}

/** Scope only the authorized projection; assignments and saved work stay intact. */
export function scopeAssignments<T extends ScopeEntry>(
  lessons: T[],
  scope: AssignmentScope,
) {
  return lessons.filter(
    (lesson) =>
      (!scope.classId || lesson.classId === scope.classId) &&
      (!scope.sourceKey || lesson.sourceKey === scope.sourceKey) &&
      (!scope.sourceKey ||
        !scope.locationKey ||
        lesson.sourcePath.some(
          (_, index) =>
            sourceLocationKey(lesson.sourcePath.slice(0, index + 1)) ===
            scope.locationKey,
        )),
  );
}

export function assignmentScopeOptions(
  lessons: ScopeEntry[],
  scope: AssignmentScope,
) {
  const classes = new Map<string, string>();
  const sources = new Map<string, string>();
  const paths = new Map<string, DashboardLesson["sourcePath"]>();
  for (const lesson of lessons) {
    classes.set(lesson.classId, lesson.className);
    if (scope.classId && lesson.classId !== scope.classId) continue;
    sources.set(lesson.sourceKey, lesson.sourceTitle);
    if (!scope.sourceKey || lesson.sourceKey !== scope.sourceKey) continue;
    lesson.sourcePath.forEach((_, index) => {
      const prefix = lesson.sourcePath.slice(0, index + 1);
      paths.set(sourceLocationKey(prefix), prefix);
    });
  }
  const options = (values: Map<string, string>) =>
    [...values]
      .map(([value, label]) => ({ value, label }))
      .sort(
        (a, b) =>
          a.label.localeCompare(b.label, "en", { numeric: true }) ||
          a.value.localeCompare(b.value),
      );
  const locations = [...paths]
    .sort(([, a], [, b]) => {
      for (let index = 0; index < Math.min(a.length, b.length); index++) {
        const comparison = sourceHeading(a[index]).localeCompare(
          sourceHeading(b[index]),
          "en",
          { numeric: true },
        );
        if (comparison) return comparison;
      }
      return a.length - b.length;
    })
    .map(([value, path]) => ({
      value,
      label: sourceHeading(path[path.length - 1]),
      depth: path.length - 1,
    }));
  return { classes: options(classes), sources: options(sources), locations };
}

export function normalizeAssignmentScope(
  lessons: ScopeEntry[],
  scope: AssignmentScope,
): AssignmentScope {
  if (
    scope.classId &&
    !lessons.some((lesson) => lesson.classId === scope.classId)
  )
    return { classId: "", sourceKey: "", locationKey: "" };
  const options = assignmentScopeOptions(lessons, scope);
  if (
    !scope.sourceKey ||
    !options.sources.some(({ value }) => value === scope.sourceKey)
  )
    return { classId: scope.classId, sourceKey: "", locationKey: "" };
  return {
    ...scope,
    locationKey: options.locations.some(
      ({ value }) => value === scope.locationKey,
    )
      ? scope.locationKey
      : "",
  };
}

export type AssignmentFilter = "All" | "In progress" | "To start" | "Completed";
export const assignmentFilters: AssignmentFilter[] = [
  "All",
  "In progress",
  "To start",
  "Completed",
];

/** Resume only saved unfinished work; new and completed assignments stay in the list. */
export function continuingAssignment(lessons: DashboardLesson[]) {
  const unfinished = lessons.filter(
    (lesson) => lesson.session && lesson.session.status !== "completed",
  );
  const id = currentAssignmentId(unfinished);
  return unfinished.find((lesson) => lesson.id === id) ?? null;
}

// These categories describe the latest saved tutoring session, not completion
// of the assignment's full scope or mastery of its concepts.
export function practiceCategory(
  lesson: Pick<DashboardLesson, "session">,
): Exclude<AssignmentFilter, "All"> {
  if (!lesson.session) return "To start";
  return lesson.session.status === "completed" ? "Completed" : "In progress";
}

export function practiceStatus(
  lesson: Pick<DashboardLesson, "session">,
): string {
  switch (lesson.session?.status) {
    case "completed":
      return "Completed";
    case "pending_evaluation":
      return "Evaluation pending";
    case "unevaluated":
      return "Teacher support needed";
    case "active":
      return "In progress";
    default:
      return "To start";
  }
}

export function matchesAssignment(
  lesson: DashboardLesson,
  search: string,
): boolean {
  const text = [
    lesson.title,
    lesson.className,
    lesson.sourceTitle,
    lesson.sourceSection,
    ...lesson.sourcePath.map(sourceHeading),
    ...lesson.topics.map((topic) => topic.title),
  ]
    .join(" ")
    .toLocaleLowerCase();
  return text.includes(search.trim().toLocaleLowerCase());
}

export function assignmentDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
