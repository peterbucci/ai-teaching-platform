import { z } from "zod";
import { apiResponse } from "../../../../../../lib/api.ts";
import { requireActor } from "../../../../../../lib/auth.ts";
import { evidenceAccess } from "../../../../../../lib/evidence/store.ts";
import { readStudentNotebook } from "../../../../../../lib/evidence/student-notebook.ts";
import { NotebookError } from "../../../../../../lib/evidence/student-notebook-project.ts";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const actor = await requireActor();
    const { sessionId } = await context.params;
    const params = new URL(request.url).searchParams;
    // Reject duplicate selectors instead of accepting an ambiguous first/last value.
    for (const key of params.keys())
      if (params.getAll(key).length !== 1) z.never().parse(key);
    return Response.json(
      await readStudentNotebook(
        evidenceAccess(actor),
        sessionId,
        Object.fromEntries(params),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof NotebookError)
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    return apiResponse(async () => {
      throw error;
    });
  }
}
