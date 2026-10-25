import assert from "node:assert/strict";
import { test } from "node:test";
import { EvidenceError } from "../lib/evidence/store.ts";
import { objectiveRequestBody } from "../lib/objectives/http.ts";

const origin = new URL(process.env.AUTH_URL ?? "https://learning.example")
  .origin;
const endpoint = origin + "/api/teacher/objectives";
function request(body: BodyInit | null, headers: Record<string, string> = {}) {
  return new Request(endpoint, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
    body,
  });
}
const rejected = (status: number, pattern: RegExp) => (error: unknown) =>
  error instanceof EvidenceError &&
  error.status === status &&
  pattern.test(error.message);

test("objective body accepts same-origin JSON and preserves UTF-8 text", async () => {
  const input = { title: "Water 💧", objective: "Explain evaporation." };
  assert.deepEqual(
    await objectiveRequestBody(request(JSON.stringify(input))),
    input,
  );
});

test("objective body rejects foreign origins and non-JSON media types", async () => {
  const cases: Record<string, string>[] = [
    { origin: "https://foreign.example" },
    { "content-type": "text/plain" },
    { "content-type": "application/jsonp" },
  ];
  for (const headers of cases) {
    await assert.rejects(
      objectiveRequestBody(request("{}", headers)),
      rejected(403, /same-origin JSON/),
    );
  }
});

test("malformed JSON, malformed UTF-8 and missing bodies produce client errors", async () => {
  for (const body of ["{broken", new Uint8Array([0xc3, 0x28])]) {
    await assert.rejects(
      objectiveRequestBody(request(body)),
      rejected(400, /valid UTF-8 JSON/),
    );
  }
  await assert.rejects(
    objectiveRequestBody(request(null)),
    rejected(400, /body is required/),
  );
});

test("chunked objective bodies are limited even without a Content-Length header", async () => {
  let cancelled = false;
  let emitted = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(emitted++ === 0 ? 200_000 : 100_001));
    },
    cancel() {
      cancelled = true;
    },
  });
  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body,
    duplex: "half",
  };
  const chunked = new Request(endpoint, init);
  assert.equal(chunked.headers.has("content-length"), false);
  await assert.rejects(
    objectiveRequestBody(chunked),
    rejected(400, /too large/),
  );
  assert.equal(cancelled, true);
});

test("the documented maximum accepts exactly 300,000 UTF-8 bytes", async () => {
  const value = "a".repeat(299_998);
  assert.equal(
    await objectiveRequestBody(request(JSON.stringify(value))),
    value,
  );
});
