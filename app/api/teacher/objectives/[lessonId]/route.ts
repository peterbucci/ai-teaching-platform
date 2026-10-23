import { apiResponse } from "../../../../../lib/api.ts";
import { requireActor } from "../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../lib/evidence/store.ts";
import { SaveObjectiveDraftSchema } from "../../../../../lib/objectives/contracts.ts";
import {
  readObjectiveDraft,
  saveObjectiveDraft,
} from "../../../../../lib/objectives/store.ts";
import { objectiveRequestBody } from "../../../../../lib/objectives/http.ts";
type Context = { params: Promise<{ lessonId: string }> };
export async function GET(_request: Request, context: Context) {
  return apiResponse(async () =>
    readObjectiveDraft(
      evidenceAccess(await requireActor()),
      (await context.params).lessonId,
    ),
  );
}
export async function PATCH(request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const lessonId = (await context.params).lessonId;
    const input = SaveObjectiveDraftSchema.omit({ lesson_id: true }).parse(
      await objectiveRequestBody(request),
    );
    await saveObjectiveDraft(access, { ...input, lesson_id: lessonId });
    return readObjectiveDraft(access, lessonId);
  });
}
