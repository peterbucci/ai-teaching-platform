import { z } from "zod";
import { apiResponse, requestBody } from "../../../../../lib/api.ts";
import { requireActor } from "../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../lib/evidence/store.ts";
import { createTeachBackFollowup } from "../../../../../lib/dialogue/teach-back-live.ts";

type Context = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const input = z
      .strictObject({ attempt_id: z.uuid() })
      .parse(await requestBody(request));

    return createTeachBackFollowup(
      evidenceAccess(await requireActor()),
      (await context.params).sessionId,
      input.attempt_id,
    );
  });
}