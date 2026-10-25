import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireActor } from "../../../lib/auth.ts";
import {
  EvidenceError,
  evidenceAccess,
  type EvidenceAccess,
} from "../../../lib/evidence/store.ts";

export async function loadTeacherLesson<T>(
  operation: (access: EvidenceAccess) => Promise<T>,
): Promise<T> {
  try {
    return await operation(evidenceAccess(await requireActor()));
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
