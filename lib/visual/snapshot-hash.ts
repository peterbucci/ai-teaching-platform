import { createHash } from "node:crypto";
import type { VisualActivitySnapshot } from "./tool-contract.ts";

// Server-only: uses node:crypto, so do not import this from client code.

// Sorts object keys so the hash does not depend on key order.
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function activitySnapshotSha256(snapshot: VisualActivitySnapshot) {
  return createHash("sha256")
    .update(JSON.stringify(sortKeys(snapshot)))
    .digest("hex");
}

export function verifyActivitySnapshotSha256(
  snapshot: VisualActivitySnapshot,
  sha256: string,
) {
  return activitySnapshotSha256(snapshot) === sha256;
}
