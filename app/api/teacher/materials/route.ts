import { getAuthConfig } from "../../../../lib/auth-config.ts";
import {
  createSourceVersion,
  listSourceVersions,
} from "../../../../lib/lessons/sources.ts";
import { requireMaterialTeacher } from "../../../../lib/materials/access.ts";
import { materialResponse } from "../../../../lib/materials/api.ts";
import {
  materialFormData,
  materialInput,
  textField,
} from "../../../../lib/materials/request.ts";
import {
  reviewedPassages,
  verifyPreviewReceipt,
} from "../../../../lib/materials/review.ts";

export const runtime = "nodejs";
export async function GET() {
  return materialResponse(async () =>
    listSourceVersions(await requireMaterialTeacher()),
  );
}
export async function POST(request: Request) {
  return materialResponse(async () => {
    const access = await requireMaterialTeacher();
    const form = await materialFormData(request);
    const original = await materialInput(form, true);
    const receipt = verifyPreviewReceipt(
      textField(form, "receipt", 1_000_000),
      access.actor.profileId,
      original.contentHash,
      getAuthConfig().secret,
    );
    const { review, passages } = reviewedPassages(
      receipt.preview,
      JSON.parse(textField(form, "review", 600_000)),
    );
    const saved = await createSourceVersion(access, {
      request_id: receipt.requestId,
      document_id: review.document_id,
      expected_latest_version: review.expected_latest_version,
      original_bytes: original.bytes,
      file_name: receipt.preview.originalFilename ?? "pasted-source.txt",
      mime_type: receipt.preview.mediaType,
      attribution: { ...review.attribution, title: review.title },
      passages,
      extraction: receipt.preview.passages,
      review_status: "approved",
      permitted_use: true,
    });
    return { document_id: saved.document_id, version: saved.version };
  });
}
