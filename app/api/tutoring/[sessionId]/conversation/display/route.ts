import { apiResponse, requestBody } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../lib/evidence/store.ts";
import { acknowledgeConversation } from "../../../../../../lib/dialogue/store.ts";

type Context = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const input = await requestBody(request);
    return acknowledgeConversation(
      access,
      (await context.params).sessionId,
      input,
    );
  });
}
