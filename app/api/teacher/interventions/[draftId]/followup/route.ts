import { z } from "zod";
import { apiResponse } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../lib/evidence/store.ts";
import { readInterventionComparison } from "../../../../../../lib/interventions/outcomes.ts";
export async function GET(
  _request: Request,
  context: { params: Promise<{ draftId: string }> },
) {
  return apiResponse(async () =>
    readInterventionComparison(
      evidenceAccess(await requireActor()),
      z.uuid().parse((await context.params).draftId),
    ),
  );
}
