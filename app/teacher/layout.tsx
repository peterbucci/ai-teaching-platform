import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AuthError, requireActor } from "../../lib/auth.ts";
import { evidenceAccess } from "../../lib/evidence/store.ts";
import { teacherAssignments } from "../../lib/teacher/store.ts";
import { assignmentReview } from "../../lib/assignments/store.ts";
import { EvidenceError } from "../../lib/evidence/store.ts";
import type { WorkspaceAssignment } from "./workspace-model.ts";
import { TeacherWorkspaceMetadata } from "./workspace-context.tsx";

export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  let assignments;
  try {
    const access = evidenceAccess(await requireActor());
    const owned = await teacherAssignments(access);
    assignments = await Promise.all(
      owned.map(async (assignment): Promise<WorkspaceAssignment> => {
        try {
          const review = await assignmentReview(access, assignment.id);
          return {
            ...assignment,
            version: review.content_ref.content_version,
            availability: review.teacher_approved_at ? "active" : "inactive",
          };
        } catch (error) {
          // A damaged pinned version must not remove every other workspace link.
          if (
            error instanceof EvidenceError &&
            [403, 404, 409].includes(error.status)
          )
            return { ...assignment, availability: "unavailable" };
          throw error;
        }
      }),
    );
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    throw error;
  }
  return (
    <TeacherWorkspaceMetadata assignments={assignments}>
      {children}
    </TeacherWorkspaceMetadata>
  );
}
