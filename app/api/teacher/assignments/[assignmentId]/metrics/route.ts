import { apiResponse } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../lib/evidence/store.ts";
import { OriginFilterSchema } from "../../../../../../lib/teacher/metrics.ts";
import { readAssignmentMetrics } from "../../../../../../lib/teacher/store.ts";

export async function GET(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  return apiResponse(async () =>
    readAssignmentMetrics(
      evidenceAccess(await requireActor()),
      (await context.params).assignmentId,
      OriginFilterSchema.parse(
        new URL(request.url).searchParams.get("origin") ?? "all",
      ),
    ),
  );
}
