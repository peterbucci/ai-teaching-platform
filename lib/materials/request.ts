import { createHash } from "node:crypto";
import { EvidenceError } from "../evidence/store.ts";

export const MAX_IMPORT_REQUEST_BYTES = 6_500_000;

/** Bound allocation before multipart decoding, including chunked requests. */
export async function materialFormData(request: Request): Promise<FormData> {
  const expectedOrigin = new URL(process.env.AUTH_URL ?? request.url).origin;
  if (
    request.headers.get("origin") !== expectedOrigin ||
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("multipart/form-data;")
  ) {
    throw new EvidenceError(403, "A same-origin material upload is required.");
  }
  const declared = request.headers.get("content-length");
  if (
    declared &&
    (!/^\d+$/u.test(declared) || Number(declared) > MAX_IMPORT_REQUEST_BYTES)
  )
    throw new EvidenceError(
      400,
      "The upload is too large. Files are limited to 5 MB.",
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new EvidenceError(400, "Choose a file or paste source text.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void reader.cancel();
      reject(new EvidenceError(400, "The upload timed out. Please try again."));
    }, 30_000);
  });
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), timeout]);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_IMPORT_REQUEST_BYTES)
        throw new EvidenceError(
          400,
          "The upload is too large. Files are limited to 5 MB.",
        );
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return await new Response(bytes, {
        headers: { "Content-Type": request.headers.get("content-type")! },
      }).formData();
    } catch {
      throw new EvidenceError(
        400,
        "The upload could not be read. Choose a file or paste text again.",
      );
    }
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => undefined);
  }
}

export function materialFields(
  form: FormData,
  saving: boolean,
  renewing = false,
) {
  const allowed = saving
    ? ["text", "file", "receipt", "review"]
    : renewing
      ? ["text", "file", "receipt"]
      : ["text", "file"];
  for (const key of form.keys()) {
    if (!allowed.includes(key) || form.getAll(key).length !== 1)
      throw new EvidenceError(400, "Unexpected or duplicate upload field.");
  }
  const text = form.get("text"),
    file = form.get("file");
  if ((text !== null) === (file !== null))
    throw new EvidenceError(400, "Choose one file or paste text, not both.");
  if (text !== null && typeof text !== "string")
    throw new EvidenceError(400, "Pasted source must be text.");
  if (file !== null && !(file instanceof File))
    throw new EvidenceError(400, "Choose a supported source file.");
  return { text, file };
}

export async function materialInput(
  form: FormData,
  saving: boolean,
  renewing = false,
) {
  const { text, file } = materialFields(form, saving, renewing);
  const bytes =
    file instanceof File
      ? new Uint8Array(await file.arrayBuffer())
      : new TextEncoder().encode(String(text));
  if (!bytes.byteLength || bytes.byteLength > 5_000_000)
    throw new EvidenceError(
      400,
      "Sources must be nonempty and no larger than 5 MB.",
    );
  const input =
    file instanceof File
      ? {
          kind: "file" as const,
          bytes,
          filename: file.name,
          mediaType: file.type,
        }
      : { kind: "paste" as const, text: String(text) };
  return {
    input,
    bytes,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function textField(form: FormData, key: string, max: number) {
  const value = form.get(key);
  if (typeof value !== "string" || !value.length || value.length > max)
    throw new EvidenceError(400, `The ${key} field is missing or too large.`);
  return value;
}
