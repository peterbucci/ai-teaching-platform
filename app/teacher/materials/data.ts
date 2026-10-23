import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AuthError } from "../../../lib/auth.ts";
import { EvidenceError } from "../../../lib/evidence/store.ts";
import { requireMaterialTeacher } from "../../../lib/materials/access.ts";

export async function materialPage<T>(
  load: (
    access: Awaited<ReturnType<typeof requireMaterialTeacher>>,
  ) => Promise<T>,
) {
  try {
    return await load(await requireMaterialTeacher());
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
