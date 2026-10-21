import { z } from "zod";
import { apiResponse, requestBody } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../lib/evidence/store.ts";
import {
  assignmentReview,
  approveAssignment,
} from "../../../../../../lib/assignments/store.ts";

type Context = { params: Promise<{ assignmentId: string }> };
export async function GET(_request: Request, context: Context) {
  return apiResponse(async () =>
    assignmentReview(
      evidenceAccess(await requireActor()),
      (await context.params).assignmentId,
    ),
  );
}
export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const input = z
      .strictObject({ review_token: z.string() })
      .parse(await requestBody(request));
    return approveAssignment(
      access,
      (await context.params).assignmentId,
      input.review_token,
    );
  });
}
