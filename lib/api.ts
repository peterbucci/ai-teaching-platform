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

export async function requestBody(request: Request): Promise<unknown> {
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
  return request.json();
}
