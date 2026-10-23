import { getAuthConfig } from "../../../../../lib/auth-config.ts";
import { requireMaterialTeacher } from "../../../../../lib/materials/access.ts";
import { materialResponse } from "../../../../../lib/materials/api.ts";
import { extractMaterial } from "../../../../../lib/materials/extract.ts";
import {
  materialFormData,
  materialInput,
  textField,
} from "../../../../../lib/materials/request.ts";
import {
  createPreviewReceipt,
  renewPreviewReceipt,
} from "../../../../../lib/materials/review.ts";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return materialResponse(async () => {
    const access = await requireMaterialTeacher();
    const form = await materialFormData(request);
    const renewing = form.has("receipt");
    const { input, contentHash } = await materialInput(form, false, renewing);
    if (renewing)
      return renewPreviewReceipt(
        textField(form, "receipt", 1_000_000),
        access.actor.profileId,
        contentHash,
        getAuthConfig().secret,
      );
    const preview = await extractMaterial(input);
    return {
      preview,
      receipt: createPreviewReceipt(
        access.actor.profileId,
        preview,
        getAuthConfig().secret,
      ),
    };
  });
}
