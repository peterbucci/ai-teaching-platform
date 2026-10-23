import { z } from "zod";
import { readSourceVersion } from "../../../../../lib/lessons/sources.ts";
import { requireMaterialTeacher } from "../../../../../lib/materials/access.ts";
import { materialResponse } from "../../../../../lib/materials/api.ts";

export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  return materialResponse(async () => {
    const access = await requireMaterialTeacher();
    const documentId = z.uuid().parse((await context.params).documentId);
    const version = z.coerce
      .number()
      .int()
      .positive()
      .parse(new URL(request.url).searchParams.get("version"));
    return readSourceVersion(access, documentId, version);
  });
}
