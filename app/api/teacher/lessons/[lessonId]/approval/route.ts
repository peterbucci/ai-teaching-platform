import { z } from "zod";
import { apiResponse, requestBody } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../lib/evidence/store.ts";
import { approveLessonDraft } from "../../../../../../lib/lessons/store.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const input = z
      .strictObject({
        expected_revision: z.number().int().positive(),
        confirmed: z.literal(true),
      })
      .parse(await requestBody(request));
    return approveLessonDraft(
      access,
      (await context.params).lessonId,
      input.expected_revision,
    );
  });
}
