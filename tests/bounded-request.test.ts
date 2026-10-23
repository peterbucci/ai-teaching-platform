import test from "node:test";
import assert from "node:assert/strict";
import { requestBody } from "../lib/api.ts";

const origin = new URL(process.env.AUTH_URL ?? "https://question-bank.test")
  .origin;
const encoder = new TextEncoder();

function streamed(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  let next = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (next < chunks.length) controller.enqueue(chunks[next++]);
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    body,
    duplex: "half",
    headers: { origin, "content-type": "application/json", ...headers },
  };
  return {
    request: new Request(`${origin}/api/test`, init),
    cancelled: () => cancelled,
  };
}

test("bounded JSON reader rejects actual excess bytes despite missing or false Content-Length", async () => {
  const examples: Record<string, string>[] = [{}, { "content-length": "2" }];
  for (const headers of examples) {
    const body = streamed(
      [
        encoder.encode('{"question":"'),
        encoder.encode("x".repeat(100)),
        encoder.encode('"}'),
      ],
      headers,
    );
    await assert.rejects(() => requestBody(body.request, 30), /permitted size/);
    assert.equal(body.cancelled(), true);
  }
  const declared = streamed([encoder.encode("{}")], {
    "content-length": "10000",
  });
  await assert.rejects(
    () => requestBody(declared.request, 30),
    /permitted size/,
  );
  assert.equal(declared.cancelled(), true);
});

test("bounded JSON reader handles split Unicode and counts bytes rather than characters", async () => {
  const encoded = encoder.encode('{"question":"水?"}');
  const value = streamed([...encoded].map((byte) => Uint8Array.of(byte)));
  assert.deepEqual(await requestBody(value.request, encoded.byteLength), {
    question: "水?",
  });
  await assert.rejects(
    () => requestBody(streamed([encoded]).request, encoded.byteLength - 1),
    /permitted size/,
  );
  await assert.rejects(
    () => requestBody(streamed([Uint8Array.of(0xff)]).request, 10),
    /valid UTF-8 JSON/,
  );
  await assert.rejects(
    () => requestBody(streamed([encoder.encode('{"incomplete":')]).request, 30),
    SyntaxError,
  );
});

test("bounded JSON reader retains origin and content-type checks", async () => {
  await assert.rejects(
    () =>
      requestBody(
        streamed([encoder.encode("{}")], { origin: "https://foreign.test" })
          .request,
        30,
      ),
    /same-origin JSON/,
  );
  await assert.rejects(
    () =>
      requestBody(
        streamed([encoder.encode("{}")], { "content-type": "text/plain" })
          .request,
        30,
      ),
    /same-origin JSON/,
  );
  assert.deepEqual(
    await requestBody(streamed([encoder.encode("{}")]).request),
    {},
  );
});
