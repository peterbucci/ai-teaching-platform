import { z } from "zod";
import { apiResponse } from "../../../../lib/api.ts";
import { requireActor } from "../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../lib/evidence/store.ts";
import { listStudentInterventions } from "../../../../lib/interventions/approval.ts";
export async function GET(request: Request) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const assignment = new URL(request.url).searchParams.get("assignment");
    return {
      interventions: await listStudentInterventions(
        access,
        assignment === null ? undefined : z.uuid().parse(assignment),
      ),
    };
  });
}
