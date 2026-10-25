"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import type {
  TeacherWorkspaceContext,
  TeacherWorkspaceParams,
} from "../../lib/teacher/workspace-contracts.ts";
import { Workspace, type WorkspaceLink } from "../components/workspace.tsx";
import {
  resolveTeacherNavigationContext,
  teacherNavigationHref,
} from "./navigation-context.ts";

const destinations = [
  { href: "/teacher", text: "Teaching Desk", icon: "home" },
  { href: "/teacher/evidence", text: "Evidence", icon: "chart" },
  { href: "/teacher/interventions", text: "Interventions", icon: "assignment" },
  { href: "/teacher/lessons", text: "Lessons", icon: "book" },
  { href: "/teacher/assignments", text: "Assignments", icon: "assignment" },
  { href: "/teacher/students", text: "Students", icon: "users" },
  { href: "/teacher/materials", text: "Materials", icon: "book" },
  { href: "/teacher/objectives", text: "Objectives", icon: "book" },
] as const satisfies readonly WorkspaceLink[];

export function TeacherWorkspace({
  children,
  section,
  context,
  contextIsAuthoritative = false,
}: {
  children: ReactNode;
  section: string;
  context?: TeacherWorkspaceContext;
  contextIsAuthoritative?: boolean;
}) {
  const search = useSearchParams();
  const pathname = usePathname();
  const params: TeacherWorkspaceParams = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    params[key] = values.length > 1 ? values : values[0];
  }
  const selected = resolveTeacherNavigationContext(
    context,
    params,
    contextIsAuthoritative,
  );
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
    // Each destination receives its supported scope, never editor identities.
    href: teacherNavigationHref(item.href, selected),
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
