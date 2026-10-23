import { apiResponse, requestBody } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../lib/evidence/store.ts";
import { startLessonVersion } from "../../../../../../lib/lessons/publishing.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    return startLessonVersion(
      access,
      (await context.params).lessonId,
      await requestBody(request, 2000),
    );
  });
}
