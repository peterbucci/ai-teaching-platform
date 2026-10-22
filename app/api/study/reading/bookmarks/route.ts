import { apiResponse, requestBody } from "../../../../../lib/api.ts";
import { requireActor } from "../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../lib/evidence/store.ts";
import { setReadingBookmark } from "../../../../../lib/reading/student-reader.ts";

export async function PUT(request: Request) {
  return apiResponse(async () =>
    setReadingBookmark(
      evidenceAccess(await requireActor()),
      await requestBody(request),
      true,
    ),
  );
}

export async function DELETE(request: Request) {
  return apiResponse(async () =>
    setReadingBookmark(
      evidenceAccess(await requireActor()),
      await requestBody(request),
      false,
    ),
  );
}
