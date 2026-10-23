import "server-only";
import { z } from "zod";
import {
  EvidenceError,
  transaction,
  type EvidenceAccess,
} from "../evidence/store.ts";
/** Generic session endpoints must not bypass approved-recipient follow-up actions. */
export async function requireOrdinarySession(
  access: EvidenceAccess,
  sessionId: string,
) {
  z.uuid().parse(sessionId);
  await transaction(async (client) => {
    const result = await client.query(
      `SELECT s.id FROM sessions s JOIN profiles p ON p.id=s.student_id
      JOIN enrollments e ON e.student_id=s.student_id AND e.class_id=s.class_id
      WHERE s.id=$1 AND s.student_id=$2 AND p.auth_user_id=$3
      AND NOT EXISTS(SELECT 1 FROM teacher_intervention_followups f WHERE f.session_id=s.id)`,
      [sessionId, access.actor.profileId, access.actor.userId],
    );
    if (!result.rows[0])
      throw new EvidenceError(
        404,
        "Study session not found. Open assigned reviews from your assignments page.",
      );
  });
}
