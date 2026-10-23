import { z } from "zod";
import { apiResponse, requestBody } from "../../../../../lib/api.ts";
import { requireActor } from "../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../lib/evidence/store.ts";
import {
  readStudentIntervention,
  markStudentInterventionDisplayed,
} from "../../../../../lib/interventions/approval.ts";
type Context = { params: Promise<{ approvalId: string }> };
export async function GET(_request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    return readStudentIntervention(
      access,
      z.uuid().parse((await context.params).approvalId),
    );
  });
}
export async function POST(request: Request, context: Context) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    z.strictObject({ action: z.literal("displayed") }).parse(
      await requestBody(request),
    );
    return markStudentInterventionDisplayed(
      access,
      z.uuid().parse((await context.params).approvalId),
    );
  });
}
