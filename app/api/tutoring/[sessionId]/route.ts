import { continueApplicationTutoring } from "../../../../lib/dialogue/application.ts";
import { apiResponse, requestBody } from "../../../../lib/api.ts";
import { requireActor } from "../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../lib/evidence/store.ts";
import { tutorView } from "../../../../lib/tutoring/store.ts";

type Context = { params: Promise<{ sessionId: string }> };
export async function GET(_request: Request, context: Context) {
  return apiResponse(async () =>
    tutorView(
      evidenceAccess(await requireActor()),
      (await context.params).sessionId,
    ),
  );
}
export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const input = await requestBody(request);
    return continueApplicationTutoring(
      evidenceAccess(await requireActor()),
      (await context.params).sessionId,
      input,
    );
  });
}
