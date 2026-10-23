import { apiResponse } from "../../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../../lib/evidence/store.ts";
import { acceptObjectiveSuggestions } from "../../../../../../../lib/objectives/proposals.ts";
import { objectiveRequestBody } from "../../../../../../../lib/objectives/http.ts";
export async function POST(
  request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    return acceptObjectiveSuggestions(
      access,
      (await context.params).lessonId,
      await objectiveRequestBody(request),
    );
  });
}
