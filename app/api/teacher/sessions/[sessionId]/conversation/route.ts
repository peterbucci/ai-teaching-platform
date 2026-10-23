import { apiResponse } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../lib/evidence/store.ts";
import { readTeacherConversation } from "../../../../../../lib/dialogue/store.ts";

type Context = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, context: Context) {
  return apiResponse(async () =>
    readTeacherConversation(
      evidenceAccess(await requireActor()),
      (await context.params).sessionId,
    ),
  );
}
