import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../../", import.meta.url));
export const generated = path.join(
  root,
  ".setup",
  "reader-visibility-portable",
);
export const routeDirectory = path.join(
  root,
  "app",
  "study",
  "reader-visibility-check",
);

export function localConfiguration() {
  const origin = process.env.AUTH_URL;
  assert.ok(origin, "Set AUTH_URL to the exact isolated application's origin.");
  const url = new URL(origin);
  assert.ok(
    origin === url.origin &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.port,
    "AUTH_URL must be an exact HTTP loopback origin with an explicit port.",
  );
  assert.ok(
    process.env.PGDATABASE?.startsWith("reader_visibility"),
    "Use a dedicated PGDATABASE beginning with reader_visibility.",
  );
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(
      process.env.PGHOST || "127.0.0.1",
    ),
    "PGHOST must be a loopback address or localhost.",
  );
  assert.ok(
    !process.env.OPENAI_API_KEY && !process.env.OPENAI_MODEL,
    "Unset OPENAI_API_KEY and OPENAI_MODEL before running this fixture.",
  );
  return { origin, database: process.env.PGDATABASE };
}
