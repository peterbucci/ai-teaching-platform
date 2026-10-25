import { z } from "zod";
import { apiResponse, requestBody } from "../../../../lib/api.ts";
import { requireActor } from "../../../../lib/auth.ts";
import {
  EvidenceError,
  evidenceAccess,
} from "../../../../lib/evidence/store.ts";
import {
  generateInterventionDraft,
  readInterventionDraft,
  readInterventionDrafts,
  readInterventionRequest,
} from "../../../../lib/interventions/store.ts";

export async function GET(request: Request) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const query = new URL(request.url).searchParams;
    const assignment = z.uuid().parse(query.get("assignment"));
    if (query.has("request"))
      return readInterventionRequest(
        access,
        assignment,
        z.uuid().parse(query.get("request")),
      );
    const drafts = await readInterventionDrafts(access, assignment);
    const draft = query.has("draft")
      ? await readInterventionDraft(access, z.uuid().parse(query.get("draft")))
      : null;
    if (draft && draft.assignment_id !== assignment)
      throw new EvidenceError(404, "Draft not found.");
    return { drafts, draft };
  });
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const reader = request.body?.getReader();
    if (!reader)
      throw new EvidenceError(400, "A generation request is required.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16000) {
        await reader.cancel();
        throw new EvidenceError(400, "The draft request is too large.");
      }
      chunks.push(value);
    }
    const bounded = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    });
    return generateInterventionDraft(access, await requestBody(bounded));
  });
}
