import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireActor } from "../../lib/auth.ts";
import { EvidenceError, evidenceAccess } from "../../lib/evidence/store.ts";
import { readAssignmentContent } from "../../lib/lessons/store.ts";
import { OriginFilterSchema } from "../../lib/teacher/metrics.ts";
import { parseTeacherWorkspaceContext } from "../../lib/teacher/workspace-contracts.ts";
import {
  readAssignmentEvidence,
  teacherAssignments,
} from "../../lib/teacher/store.ts";

export type TeacherFilters = {
  assignment?: string;
  origin?: string;
  concept?: string;
};

// Every teacher view uses the same authorized, origin-filtered evidence snapshot.
export async function loadTeacherView(params: TeacherFilters) {
  try {
    const context = parseTeacherWorkspaceContext(params);
    const access = evidenceAccess(await requireActor());
    const assignments = await teacherAssignments(access);
    const origin = OriginFilterSchema.parse(context.origin);
    const assignmentId = context.assignment ?? assignments[0]?.id;
    const data = assignmentId
      ? {
          ...(await readAssignmentEvidence(access, assignmentId, origin)),
          content: await readAssignmentContent(access, assignmentId, "teacher"),
        }
      : null;
    if (
      params.concept &&
      !data?.metrics.concepts.some((c) => c.concept_id === params.concept)
    )
      notFound();
    return { assignments, origin, data };
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/login");
    if (
      error instanceof z.ZodError ||
      (error instanceof EvidenceError && [403, 404].includes(error.status))
    )
      notFound();
    throw error;
  }
}

export function evidenceDescription(origin: string) {
  return origin === "live_demo"
    ? "Live test sessions from fictional student accounts."
    : origin === "synthetic_fixture"
      ? "Prepared class examples and software-test histories."
      : "Live test sessions and prepared class examples, shown together.";
}

export function teacherViewHref(
  path: string,
  assignment: string,
  origin: string,
) {
  return `${path}?${new URLSearchParams({ assignment, origin })}`;
}
