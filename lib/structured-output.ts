import "server-only";

/** Only adapt the provider wire schema; canonical Zod validation stays unchanged. */
export function omitUnsupportedUriFormat(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const child of value) omitUnsupportedUriFormat(child);
    return;
  }
  // This is SDK-generated JSON Schema, never model output or source data.
  const schema = value as Record<string, unknown>;
  // Structured Outputs supports UUID and other formats, but not URI. Uploaded
  // attribution URLs must still pass the canonical Zod schema after transport.
  if (schema.type === "string" && schema.format === "uri") delete schema.format;
  for (const child of Object.values(schema)) omitUnsupportedUriFormat(child);
}
