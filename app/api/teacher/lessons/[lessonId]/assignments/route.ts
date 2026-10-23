import { z } from "zod";
import { apiResponse, requestBody } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../lib/evidence/store.ts";
import { createLessonAssignment } from "../../../../../../lib/lessons/store.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const input = z
      .strictObject({
        request_id: z.uuid(),
        class_id: z.uuid(),
        version: z.string().min(1).max(100),
        title: z.string().trim().min(1).max(300),
        instructions: z.string().trim().max(5000),
      })
      .parse(await requestBody(request));
    return createLessonAssignment(access, {
      ...input,
      lesson_id: (await context.params).lessonId,
    });
  });
}
