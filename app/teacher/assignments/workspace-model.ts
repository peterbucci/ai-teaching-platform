import { z } from "zod";

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
});
export type AssignmentWorkspace = z.infer<typeof AssignmentWorkspaceSchema>;
export type AssignmentStatus = "active" | "inactive" | "unavailable";

export function assignmentHref(
  context: Partial<AssignmentWorkspace>,
  patch: Partial<AssignmentWorkspace> = {},
) {
  const merged = { ...context, ...patch };
  // A new assignment has a different roster and exact concept scope.
  if (patch.assignment && patch.assignment !== context.assignment) {
    merged.student = undefined;
    merged.concept = undefined;
  }
  const params = AssignmentWorkspaceSchema.parse(merged);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined) query.set(key, value);
  return `/teacher/assignments?${query}`;
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
