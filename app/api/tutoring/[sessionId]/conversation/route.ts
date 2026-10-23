import { apiResponse, requestBody } from "../../../../../lib/api.ts";
import { requireActor } from "../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../lib/evidence/store.ts";
import {
  actConversation,
  loadConversation,
} from "../../../../../lib/dialogue/store.ts";

type Context = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, context: Context) {
  return apiResponse(async () =>
    loadConversation(
      evidenceAccess(await requireActor()),
      (await context.params).sessionId,
    ),
  );
}

export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const input = await requestBody(request);
    return actConversation(access, (await context.params).sessionId, input);
  });
}
