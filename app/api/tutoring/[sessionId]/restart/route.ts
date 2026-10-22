import { z } from "zod";
import { apiResponse, requestBody } from "../../../../../lib/api.ts";
import { requireActor } from "../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../lib/evidence/store.ts";
import { restartTutoring } from "../../../../../lib/tutoring/store.ts";

type Context = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    z.strictObject({}).parse(await requestBody(request));
    return restartTutoring(
      evidenceAccess(await requireActor()),
      (await context.params).sessionId,
    );
  });
}
