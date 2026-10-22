import { z } from "zod";
import { apiResponse, requestBody } from "../../../lib/api.ts";
import { requireActor } from "../../../lib/auth.ts";
import { evidenceAccess } from "../../../lib/evidence/store.ts";
import { assignedLessons, startTutoring } from "../../../lib/tutoring/store.ts";

export async function GET() {
  return apiResponse(async () =>
    assignedLessons(evidenceAccess(await requireActor())),
  );
}
export async function POST(request: Request) {
  return apiResponse(async () => {
    const input = z
      .strictObject({ assignment_id: z.uuid() })
      .parse(await requestBody(request));
    return startTutoring(
      evidenceAccess(await requireActor()),
      input.assignment_id,
    );
  });
}
