import { z } from "zod";
import { apiResponse, requestBody } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import {
  EvidenceError,
  evidenceAccess,
} from "../../../../../../lib/evidence/store.ts";
import {
  applyStudentInterventionFollowup,
  readStudentInterventionFollowup,
} from "../../../../../../lib/interventions/outcomes.ts";
type Context = { params: Promise<{ approvalId: string }> };
export async function GET(_request: Request, context: Context) {
  return apiResponse(async () =>
    readStudentInterventionFollowup(
      evidenceAccess(await requireActor()),
      z.uuid().parse((await context.params).approvalId),
    ),
  );
}
export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const reader = request.body?.getReader();
    if (!reader)
      throw new EvidenceError(400, "A follow-up action is required.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64000) {
        await reader.cancel();
        throw new EvidenceError(400, "The response is too large.");
      }
      chunks.push(value);
    }
    const bounded = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    });
    return applyStudentInterventionFollowup(
      access,
      z.uuid().parse((await context.params).approvalId),
      await requestBody(bounded),
    );
  });
}
