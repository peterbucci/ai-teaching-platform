import { apiResponse, requestBody } from "../../../../../lib/api.ts";
import { requireActor } from "../../../../../lib/auth.ts";
import { requireOrdinarySession } from "../../../../../lib/interventions/session-boundary.ts";
import {
  evidenceAccess,
  submitAnswer,
} from "../../../../../lib/evidence/store.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  return apiResponse(async () => {
    const input = await requestBody(request);
    const access = evidenceAccess(await requireActor());
    const sessionId = (await context.params).sessionId;
    await requireOrdinarySession(access, sessionId);
    return submitAnswer(access, sessionId, input);
  });
}
