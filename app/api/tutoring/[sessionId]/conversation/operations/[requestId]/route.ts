import { recoverApplicationConversation } from "../../../../../../../lib/dialogue/application.ts";
import { apiResponse, requestBody } from "../../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../../lib/evidence/store.ts";
import { readConversationOperation } from "../../../../../../../lib/dialogue/store.ts";

type Context = {
  params: Promise<{ sessionId: string; requestId: string }>;
};

export async function GET(_request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const { sessionId, requestId } = await context.params;
    return readConversationOperation(access, sessionId, requestId);
  });
}

/** Explicitly commit only already-recorded successful work; never spend or retry. */
export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const input = await requestBody(request);
    const { sessionId, requestId } = await context.params;
    return recoverApplicationConversation(access, sessionId, requestId, input);
  });
}
