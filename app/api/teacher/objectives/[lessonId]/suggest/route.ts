import { apiResponse } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../lib/evidence/store.ts";
import {
  readObjectiveProposal,
  requestObjectiveSuggestions,
} from "../../../../../../lib/objectives/proposals.ts";
import { objectiveRequestBody } from "../../../../../../lib/objectives/http.ts";
export const maxDuration = 90;
type Context = { params: Promise<{ lessonId: string }> };
export async function GET(request: Request, context: Context) {
  return apiResponse(async () =>
    readObjectiveProposal(
      evidenceAccess(await requireActor()),
      (await context.params).lessonId,
      new URL(request.url).searchParams.get("request_id") ?? "",
    ),
  );
}
export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    return requestObjectiveSuggestions(
      access,
      (await context.params).lessonId,
      await objectiveRequestBody(request),
    );
  });
}
