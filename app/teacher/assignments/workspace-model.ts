import { z } from "zod";
import type { TeacherLessonSummary } from "../../../lib/lessons/publishing-contracts.ts";

export const AssignmentWorkspaceSchema = z.object({
  assignment: z.uuid().optional(),
  class: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.uuid().optional(),
  ),
  status: z.enum(["all", "active", "inactive", "unavailable"]).default("all"),
  view: z.enum(["review", "progress", "preview"]).default("review"),
  origin: z.enum(["all", "synthetic_fixture", "live_demo"]).default("all"),
  student: z.uuid().optional(),
  concept: z.string().min(1).max(160).optional(),
  progressView: z
    .enum(["grid", "concepts", "questions", "sessions"])
    .default("grid"),
  pane: z.enum(["grid", "details"]).optional(),
});
export type AssignmentWorkspace = z.infer<typeof AssignmentWorkspaceSchema>;
export type AssignmentStatus = "active" | "inactive" | "unavailable";

export function assignmentHref(
  context: Partial<AssignmentWorkspace>,
  patch: Partial<AssignmentWorkspace> = {},
) {
  const merged = { ...context, ...patch };
  // A new assignment has a different roster and exact concept scope.
  if ("assignment" in patch && patch.assignment !== context.assignment) {
    merged.student = undefined;
    merged.concept = undefined;
    merged.pane = undefined;
  }
  const params = AssignmentWorkspaceSchema.parse(merged);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined) query.set(key, value);
  return `/teacher/assignments?${query}`;
}

export function assignmentListHref(context: Partial<AssignmentWorkspace>) {
  const query = new URLSearchParams();
  if (context.class) query.set("class", context.class);
  if (context.status && context.status !== "all")
    query.set("status", context.status);
  return `/teacher/assignments${query.size ? `?${query}` : ""}`;
}

/** Preserve lesson and version identities; titles never determine grouping. */
export function assignmentTree<
  T extends {
    lesson_id: string;
    lesson_title: string;
    lesson_version: string;
  },
>(
  assignments: readonly T[],
  catalog: readonly TeacherLessonSummary[] = [],
  { includeUnassigned = true }: { includeUnassigned?: boolean } = {},
) {
  type Lesson = {
    id: string;
    title: string;
    owned: boolean;
    draftRevision?: number;
    versions: { version: string; assignments: T[] }[];
  };
  const lessons = new Map<string, Lesson>();
  for (const lesson of catalog) {
    lessons.set(lesson.id, {
      id: lesson.id,
      title: lesson.title,
      owned: true,
      draftRevision:
        lesson.content_version &&
        !lesson.published_versions.includes(lesson.content_version)
          ? lesson.revision
          : undefined,
      versions: lesson.published_versions.map((version) => ({
        version,
        assignments: [],
      })),
    });
  }
  for (const assignment of assignments) {
    let lesson = lessons.get(assignment.lesson_id);
    if (!lesson) {
      lesson = {
        id: assignment.lesson_id,
        title: assignment.lesson_title,
        owned: false,
        versions: [],
      };
      lessons.set(assignment.lesson_id, lesson);
    }
    let version = lesson.versions.find(
      (item) => item.version === assignment.lesson_version,
    );
    if (!version) {
      version = { version: assignment.lesson_version, assignments: [] };
      lesson.versions.push(version);
    }
    version.assignments.push(assignment);
  }
  const tree = [...lessons.values()];
  if (includeUnassigned) return tree;
  // Retain ownership and publication metadata while showing only matching rows.
  return tree
    .map((lesson) => ({
      ...lesson,
      versions: lesson.versions.filter((version) => version.assignments.length),
    }))
    .filter((lesson) => lesson.versions.length);
}

export function filterAssignments<
  T extends { class_id: string; status: AssignmentStatus },
>(
  assignments: readonly T[],
  context: Pick<AssignmentWorkspace, "class" | "status">,
) {
  return assignments.filter(
    (item) =>
      (!context.class || item.class_id === context.class) &&
      (context.status === "all" || item.status === context.status),
  );
}
