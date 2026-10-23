import { z } from "zod";
import { apiResponse, requestBody } from "../../../../../lib/api.ts";
import { requireActor } from "../../../../../lib/auth.ts";
import {
  EvidenceError,
  evidenceAccess,
} from "../../../../../lib/evidence/store.ts";
import {
  applyInterventionAction,
  readInterventionReview,
} from "../../../../../lib/interventions/approval.ts";

type Context = { params: Promise<{ draftId: string }> };
export async function GET(_request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    return readInterventionReview(
      access,
      z.uuid().parse((await context.params).draftId),
    );
  });
}
export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const draftId = z.uuid().parse((await context.params).draftId);
    const reader = request.body?.getReader();
    if (!reader)
      throw new EvidenceError(400, "An intervention action is required.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128000) {
        await reader.cancel();
        throw new EvidenceError(400, "The edited activity is too large.");
      }
      chunks.push(value);
    }
    const bounded = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    });
    return applyInterventionAction(access, draftId, await requestBody(bounded));
  });
}
