import { apiResponse } from "../../../../../lib/api.ts";
import { requireActor } from "../../../../../lib/auth.ts";
import {
  evidenceAccess,
  readSession,
} from "../../../../../lib/evidence/store.ts";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  return apiResponse(async () =>
    readSession(
      evidenceAccess(await requireActor()),
      (await context.params).sessionId,
      "teacher",
    ),
  );
}
