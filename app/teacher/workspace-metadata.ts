import "server-only";
import { z } from "zod";
import { EvidenceError } from "../../lib/evidence/store.ts";
import type { assignmentReview } from "../../lib/assignments/store.ts";
import type { WorkspaceAssignment } from "./workspace-model.ts";

type OwnedAssignment = Pick<WorkspaceAssignment, "id" | "title" | "class_name">;
type Review = Pick<
  Awaited<ReturnType<typeof assignmentReview>>,
  "content_ref" | "teacher_approved_at"
>;

/** Display projection only, after teacherAssignments has authorized ownership. */
export async function workspaceAssignmentMetadata(
  assignment: OwnedAssignment,
  readReview: () => Promise<Review>,
): Promise<WorkspaceAssignment> {
  try {
    const review = await readReview();
    return {
      ...assignment,
      version: review.content_ref.content_version,
      availability: review.teacher_approved_at ? "active" : "inactive",
    };
  } catch (error) {
    // A malformed or unavailable pinned record must not break unrelated teacher
    // pages. Destination loaders still validate the assignment and its version.
    if (
      error instanceof z.ZodError ||
      (error instanceof EvidenceError && [403, 404, 409].includes(error.status))
    )
      return { ...assignment, availability: "unavailable" };
    throw error;
  }
}
