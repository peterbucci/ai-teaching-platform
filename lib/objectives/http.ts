import "server-only";
import { EvidenceError } from "../evidence/store.ts";

/** Bound JSON before parsing, including chunked requests without Content-Length. */
export async function objectiveRequestBody(request: Request): Promise<unknown> {
  const expected = new URL(process.env.AUTH_URL ?? request.url).origin;
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== expected) ||
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  )
    throw new EvidenceError(403, "A same-origin JSON request is required.");
  const reader = request.body?.getReader();
  if (!reader) throw new EvidenceError(400, "A JSON request body is required.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 300_000) {
        await reader.cancel();
        throw new EvidenceError(
          400,
          "This objective draft is too large. Use shorter excerpts or fewer objectives.",
        );
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new EvidenceError(
      400,
      "The request body must contain valid UTF-8 JSON.",
    );
  }
}
