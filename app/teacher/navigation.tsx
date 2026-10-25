"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  parseTeacherWorkspaceContext,
  teacherWorkspaceHref,
  type TeacherWorkspaceContext,
  type TeacherWorkspaceParams,
} from "../../lib/teacher/workspace-contracts.ts";
import { Workspace, type WorkspaceLink } from "../components/workspace.tsx";

const destinations = [
  { href: "/teacher", text: "Teaching Desk", icon: "home" },
  { href: "/teacher/evidence", text: "Evidence", icon: "chart" },
  { href: "/teacher/interventions", text: "Interventions", icon: "assignment" },
  { href: "/teacher/lessons", text: "Lessons", icon: "book" },
  { href: "/teacher/assignments", text: "Assignments", icon: "assignment" },
  { href: "/teacher/students", text: "Students", icon: "users" },
  { href: "/teacher/materials", text: "Materials", icon: "book" },
  { href: "/teacher/objectives", text: "Objectives", icon: "book" },
] satisfies WorkspaceLink[];

export function TeacherWorkspace({
  children,
  section,
  context,
}: {
  children: ReactNode;
  section: string;
  context?: TeacherWorkspaceContext;
}) {
  const search = useSearchParams();
  const pathname = usePathname();
  const params: TeacherWorkspaceParams = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    params[key] = values.length > 1 ? values : values[0];
  }
  let selected = context;
  try {
    // Resolved server defaults supply the current assignment. URL updates from
    // selection controls take precedence without requiring another data store.
    selected = parseTeacherWorkspaceContext({
      ...context,
      ...params,
      seedAttempt: search.getAll("seedAttempt"),
    });
  } catch {
    /* Invalid input is rejected by the destination loader. */
  }
  const active =
    pathname === "/teacher"
      ? "Teaching Desk"
      : pathname.startsWith("/teacher/insights") ||
          pathname.startsWith("/teacher/sessions") ||
          pathname.startsWith("/teacher/patterns")
        ? "Evidence"
        : destinations.find(
            (item) =>
              item.href !== "/teacher" && pathname.startsWith(item.href),
          )?.text;
  const links = destinations.map((item) => ({
    ...item,
    // Draft/request identities belong to their own editor. Navigation carries
    // investigation filters but never replays a mutation or implies recipients.
    href: teacherWorkspaceHref(item.href, selected ?? {}),
  }));
  return (
    <Workspace
      area="teacher"
      section={section}
      navigationLinks={links}
      activeNavigation={active}
    >
      {children}
    </Workspace>
  );
}
