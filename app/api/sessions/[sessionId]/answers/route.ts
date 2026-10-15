import { apiResponse, requestBody } from "../../../../../lib/api.ts";
import { requireActor } from "../../../../../lib/auth.ts";
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
    return submitAnswer(
      evidenceAccess(await requireActor()),
      (await context.params).sessionId,
      input,
    );
  });
}
