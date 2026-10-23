import "server-only";
import { z } from "zod";
import { AuthError } from "./auth.ts";
import { EvidenceError } from "./evidence/store.ts";
import { DatabaseConfigurationError } from "./db.ts";

export async function apiResponse(
  operation: () => Promise<unknown>,
): Promise<Response> {
  try {
    return Response.json(await operation(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status =
      error instanceof AuthError || error instanceof EvidenceError
        ? error.status
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : 503;
    const message =
      error instanceof AuthError || error instanceof EvidenceError
        ? error.message
        : error instanceof DatabaseConfigurationError
          ? "The demo environment is not configured."
          : status === 400
            ? "Invalid request."
            : "Evidence is temporarily unavailable.";
    return Response.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function requestBody(
  request: Request,
  maxBytes?: number,
): Promise<unknown> {
  const origin = request.headers.get("origin");
  // Next.js may construct request.url with the container's bind address. Compare
  // the browser Origin with the configured public origin, not that internal URL.
  const expectedOrigin = new URL(process.env.AUTH_URL ?? request.url).origin;
  if (
    (origin && origin !== expectedOrigin) ||
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw new EvidenceError(403, "A same-origin JSON request is required.");
  }
  if (maxBytes === undefined) return request.json();
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw new Error("The request body limit must be a positive integer.");
  const tooLarge = () =>
    new EvidenceError(400, "This request exceeds the permitted size.");
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > maxBytes
  ) {
    await request.body?.cancel().catch(() => undefined);
    throw tooLarge();
  }
  if (!request.body) throw new SyntaxError("A JSON body is required.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytesRead += chunk.value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      try {
        body += decoder.decode(chunk.value, { stream: true });
      } catch {
        await reader.cancel().catch(() => undefined);
        throw new EvidenceError(
          400,
          "The request body must be valid UTF-8 JSON.",
        );
      }
    }
    try {
      body += decoder.decode();
    } catch {
      throw new EvidenceError(
        400,
        "The request body must be valid UTF-8 JSON.",
      );
    }
    return JSON.parse(body);
  } finally {
    reader.releaseLock();
  }
}
