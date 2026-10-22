import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireActor } from "../../lib/auth.ts";
import { EvidenceError, evidenceAccess } from "../../lib/evidence/store.ts";
import { OriginFilterSchema } from "../../lib/teacher/metrics.ts";
import {
  readAssignmentEvidence,
  teacherAssignments,
} from "../../lib/teacher/store.ts";

export type TeacherParams = {
  assignment?: string;
  origin?: string;
  concept?: string;
};

export async function loadTeacherEvidence(params: TeacherParams) {
  try {
    const access = evidenceAccess(await requireActor());
    const assignments = await teacherAssignments(access);
    const origin = OriginFilterSchema.parse(params.origin ?? "all");
    const assignmentId = params.assignment ?? assignments[0]?.id;
    const data = assignmentId
      ? await readAssignmentEvidence(access, assignmentId, origin)
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
