import { apiResponse } from "../../../../lib/api.ts";
import { requireActor } from "../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../lib/evidence/store.ts";
import { listSourceVersions } from "../../../../lib/lessons/sources.ts";
import {
  createObjectiveDraft,
  listObjectiveDrafts,
  readObjectiveDraft,
} from "../../../../lib/objectives/store.ts";
import { objectiveRequestBody } from "../../../../lib/objectives/http.ts";
export async function GET() {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const drafts = await listObjectiveDrafts(access);
    const sources = (await listSourceVersions(access)).filter(
      (source) => source.review_status === "approved",
    );
    return { drafts, sources };
  });
}
export async function POST(request: Request) {
  return apiResponse(async () => {
    const access = evidenceAccess(await requireActor());
    const lesson = await createObjectiveDraft(
      access,
      await objectiveRequestBody(request),
    );
    return readObjectiveDraft(access, lesson.id);
  });
}
