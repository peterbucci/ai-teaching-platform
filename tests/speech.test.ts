import { test } from "node:test";
import assert from "node:assert/strict";
import { synthesizeFeedback } from "../lib/speech/provider.ts";

test("speech rejects unavailable/invalid requests, does not cache failures, and reuses valid audio", async (t) => {
  const previous = process.env.SPEECH_URL;
  t.after(() => {
    if (previous === undefined) delete process.env.SPEECH_URL;
    else process.env.SPEECH_URL = previous;
  });
  delete process.env.SPEECH_URL;
  await assert.rejects(synthesizeFeedback("Example"), /not enabled/);
  await assert.rejects(synthesizeFeedback("x".repeat(4001)), /too long/);
  process.env.SPEECH_URL = "http://speech:5000";
  let calls = 0;
  const wav = new Uint8Array(48);
  wav.set(new TextEncoder().encode("RIFF"));
  wav.set(new TextEncoder().encode("WAVE"), 8);
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init: RequestInit) => {
      calls++;
      assert.equal(init.body, JSON.stringify({ text: "Fixture feedback" }));
      if (calls === 1) return new Response("invalid audio");
      return new Response(wav);
    },
  );
  await assert.rejects(
    synthesizeFeedback("Fixture feedback"),
    /could not be generated/,
  );
  assert.deepEqual(await synthesizeFeedback("Fixture feedback"), wav);
  assert.deepEqual(await synthesizeFeedback("Fixture feedback"), wav);
  assert.equal(calls, 2);
});
