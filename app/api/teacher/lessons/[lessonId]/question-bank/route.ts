import { apiResponse, requestBody } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../lib/evidence/store.ts";
import {
  readQuestionBank,
  updateQuestionBank,
} from "../../../../../../lib/question-bank/store.ts";

type Context = { params: Promise<{ lessonId: string }> };
export async function GET(_request: Request, context: Context) {
  return apiResponse(async () =>
    readQuestionBank(
      evidenceAccess(await requireActor()),
      (await context.params).lessonId,
    ),
  );
}
export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const body = await requestBody(request, 500_000);
    return updateQuestionBank(access, (await context.params).lessonId, body);
  });
}
