import { apiResponse } from "../../../../../../../lib/api.ts";
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
