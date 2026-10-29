import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AuthError, requireActor } from "../../lib/auth.ts";
import { evidenceAccess } from "../../lib/evidence/store.ts";
import { teacherAssignments } from "../../lib/teacher/store.ts";
import { assignmentReview } from "../../lib/assignments/store.ts";
import { TeacherWorkspaceMetadata } from "./workspace-context.tsx";
import { workspaceAssignmentMetadata } from "./workspace-metadata.ts";

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
      owned.map((assignment) =>
        workspaceAssignmentMetadata(assignment, () =>
          assignmentReview(access, assignment.id),
        ),
      ),
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
