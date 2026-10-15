import { z } from "zod";
import { apiResponse, requestBody } from "../../../lib/api.ts";
import { requireActor } from "../../../lib/auth.ts";
import { evidenceAccess, startSession } from "../../../lib/evidence/store.ts";

export async function POST(request: Request) {
  return apiResponse(async () => {
    const input = z
      .strictObject({ assignment_id: z.uuid() })
      .parse(await requestBody(request));
    const session = await startSession(
      evidenceAccess(await requireActor()),
      input.assignment_id,
    );
    return { session: { id: session.id, status: session.status } };
  });
}
