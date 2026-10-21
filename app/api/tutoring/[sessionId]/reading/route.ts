import { apiResponse, requestBody } from "../../../../../lib/api.ts";
import { requireActor } from "../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../lib/evidence/store.ts";
import {
  openPassage,
  studentReading,
} from "../../../../../lib/assignments/student-reading.ts";

type Context = { params: Promise<{ sessionId: string }> };
export async function GET(_request: Request, context: Context) {
  return apiResponse(async () =>
    studentReading(
      evidenceAccess(await requireActor()),
      (await context.params).sessionId,
    ),
  );
}
export async function POST(request: Request, context: Context) {
  return apiResponse(async () =>
    openPassage(
      evidenceAccess(await requireActor()),
      (await context.params).sessionId,
      await requestBody(request),
    ),
  );
}
