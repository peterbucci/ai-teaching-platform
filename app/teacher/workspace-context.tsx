"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkspaceAssignment } from "./workspace-model.ts";

const Assignments = createContext<WorkspaceAssignment[]>([]);

export function TeacherWorkspaceMetadata({
  assignments,
  children,
}: {
  assignments: WorkspaceAssignment[];
  children: ReactNode;
}) {
  return (
    <Assignments.Provider value={assignments}>{children}</Assignments.Provider>
  );
}

export function useWorkspaceAssignments() {
  return useContext(Assignments);
}
