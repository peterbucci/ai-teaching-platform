import { z } from "zod";
import { apiResponse } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../lib/evidence/store.ts";
import {
  approveObjectives,
  readObjectiveDraft,
} from "../../../../../../lib/objectives/store.ts";
import { objectiveRequestBody } from "../../../../../../lib/objectives/http.ts";
export async function POST(
  request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const lessonId = (await context.params).lessonId;
    const input = z
      .strictObject({ expected_revision: z.number().int().positive() })
      .parse(await objectiveRequestBody(request));
    await approveObjectives(access, { ...input, lesson_id: lessonId });
    return readObjectiveDraft(access, lessonId);
  });
}
