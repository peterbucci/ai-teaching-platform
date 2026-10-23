import { z } from "zod";
import { requestBody } from "../../../lib/api.ts";
import { AuthError, requireActor } from "../../../lib/auth.ts";
import {
  evidenceAccess,
  EvidenceError,
  readSession,
} from "../../../lib/evidence/store.ts";
import { synthesizeFeedback } from "../../../lib/speech/provider.ts";
import { SAMPLE_FEEDBACK } from "../../../lib/speech/sample.ts";

const Input = z.union([
  z.strictObject({ sample: z.literal(true) }),
  z.strictObject({ session_id: z.uuid(), intervention_id: z.uuid() }),
]);

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const input = Input.parse(await requestBody(request, 1024));
    let text = SAMPLE_FEEDBACK;
    if (!("sample" in input)) {
      const evidence = await readSession(
        evidenceAccess(actor),
        input.session_id,
        "student",
      );
      const feedback = evidence.interventions.find(
        (item) =>
          item.id === input.intervention_id &&
          item.delivery_status === "displayed" &&
          item.type !== "reading",
      );
      if (!feedback)
        throw new EvidenceError(404, "Displayed feedback not found.");
      text = feedback.text_shown;
    }
    const audio = await synthesizeFeedback(text);
    return new Response(
      new Blob([Uint8Array.from(audio)], { type: "audio/wav" }),
      {
        headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const status =
      error instanceof AuthError || error instanceof EvidenceError
        ? error.status
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : 503;
    return Response.json(
      {
        error:
          error instanceof AuthError || error instanceof EvidenceError
            ? error.message
            : "Audio is unavailable. You can keep reading.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
