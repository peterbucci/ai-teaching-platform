import "server-only";
import { createHash } from "node:crypto";
import { EvidenceError } from "../evidence/store.ts";

const cache = new Map<string, Uint8Array>();
let busy = false;

export async function synthesizeFeedback(text: string): Promise<Uint8Array> {
  if (!text.trim() || Array.from(text).length > 4000)
    throw new EvidenceError(
      400,
      "This feedback is too long for audio. Please use the text.",
    );
  const endpoint = process.env.SPEECH_URL;
  if (!endpoint)
    throw new EvidenceError(
      503,
      "Audio is not enabled. You can keep reading and studying.",
    );
  const key = createHash("sha256").update(text).digest("hex");
  const existing = cache.get(key);
  if (existing) return existing;
  if (busy)
    throw new EvidenceError(409, "Audio is busy. Please try again shortly.");
  busy = true;
  try {
    const response = await fetch(new URL("/synthesize", endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Speech failed");
    const audio = new Uint8Array(await response.arrayBuffer());
    if (
      audio.length < 44 ||
      audio.length > 12_000_000 ||
      new TextDecoder().decode(audio.slice(0, 4)) !== "RIFF" ||
      new TextDecoder().decode(audio.slice(8, 12)) !== "WAVE"
    )
      throw new Error("Invalid audio");
    // Small process-local cache, never written to disk. Authorize before every read.
    const oldest = cache.keys().next().value;
    if (cache.size >= 4 && oldest !== undefined) cache.delete(oldest);
    cache.set(key, audio);
    return audio;
  } catch {
    throw new EvidenceError(
      503,
      "Audio could not be generated. The written feedback is still available.",
    );
  } finally {
    busy = false;
  }
}
