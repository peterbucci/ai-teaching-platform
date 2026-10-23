import { apiResponse, requestBody } from "../../../../../lib/api.ts";
import { requireActor } from "../../../../../lib/auth.ts";
import { requireOrdinarySession } from "../../../../../lib/interventions/session-boundary.ts";
import { evidenceAccess } from "../../../../../lib/evidence/store.ts";
import {
  openPassage,
  studentReading,
} from "../../../../../lib/assignments/student-reading.ts";

type Context = { params: Promise<{ sessionId: string }> };
export async function GET(_request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const sessionId = (await context.params).sessionId;
    await requireOrdinarySession(access, sessionId);
    return studentReading(access, sessionId);
  });
}
export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const sessionId = (await context.params).sessionId;
    await requireOrdinarySession(access, sessionId);
    return openPassage(access, sessionId, await requestBody(request));
  });
}
