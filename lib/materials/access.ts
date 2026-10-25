import "server-only";
import { requireActor } from "../auth.ts";
import { getPool } from "../db.ts";
import { EvidenceError, evidenceAccess } from "../evidence/store.ts";

export async function requireMaterialTeacher() {
  const actor = await requireActor();
  const result = await getPool().query(
    "SELECT 1 FROM classes WHERE teacher_id = $1 LIMIT 1",
    [actor.profileId],
  );
  if (!result.rowCount)
    throw new EvidenceError(
      404,
      "Teacher materials are not available for this account.",
    );
  return evidenceAccess(actor);
}
