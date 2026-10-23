import { z } from "zod";
import { apiResponse, requestBody } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { requireOrdinarySession } from "../../../../../../lib/interventions/session-boundary.ts";
import {
  acknowledgeIntervention,
  evidenceAccess,
} from "../../../../../../lib/evidence/store.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; interventionId: string }> },
) {
  return apiResponse(async () => {
    z.strictObject({}).parse(await requestBody(request));
    const { sessionId, interventionId } = await context.params;
    const access = evidenceAccess(await requireActor());
    await requireOrdinarySession(access, sessionId);
    return acknowledgeIntervention(access, sessionId, interventionId);
  });
}
