import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  materialFields,
  materialFormData,
  materialInput,
  MAX_IMPORT_REQUEST_BYTES,
  textField,
} from "../lib/materials/request.ts";

const origin = new URL(process.env.AUTH_URL ?? "http://localhost:3000").origin;

function request(form: FormData) {
  return new Request(`${origin}/api/teacher/materials/preview`, {
    method: "POST",
    headers: { Origin: origin },
    body: form,
  });
}

function pasted(text = "Fictional source text.") {
  const form = new FormData();
  form.set("text", text);
  return form;
}

test("same-origin multipart extraction retains exact UTF-8 source bytes and hashes", async () => {
  const source = "Fictional notes: café.\r\nSecond line.";
  const received = await materialFormData(request(pasted(source)));
  const result = await materialInput(received, false);
  assert.deepEqual(result.input, { kind: "paste", text: source });
  assert.deepEqual(result.bytes, new TextEncoder().encode(source));
  assert.equal(
    result.contentHash,
    createHash("sha256").update(new TextEncoder().encode(source)).digest("hex"),
  );

  const fileSource = `\ufeff${source}`;
  const uploaded = new FormData();
  uploaded.set(
    "file",
    new File([fileSource], "fictional-notes.md", { type: "text/markdown" }),
  );
  const fileResult = await materialInput(
    await materialFormData(request(uploaded)),
    false,
  );
  assert.deepEqual(fileResult.input, {
    kind: "file",
    filename: "fictional-notes.md",
    mediaType: "text/markdown",
    bytes: new TextEncoder().encode(fileSource),
  });
  assert.equal(
    fileResult.contentHash,
    createHash("sha256")
      .update(new TextEncoder().encode(fileSource))
      .digest("hex"),
  );
});

test("multipart requests require an explicit matching origin and valid form encoding", async () => {
  for (const value of [null, "https://foreign.example.invalid", "null"]) {
    const req = request(pasted());
    if (value === null) req.headers.delete("origin");
    else req.headers.set("origin", value);
    await assert.rejects(() => materialFormData(req), { status: 403 });
  }
  const json = new Request(`${origin}/api/teacher/materials/preview`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Source" }),
  });
  await assert.rejects(() => materialFormData(json), { status: 403 });
  const malformed = new Request(`${origin}/api/teacher/materials/preview`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "multipart/form-data; boundary=fixture-boundary",
    },
    body: "not a multipart body",
  });
  await assert.rejects(() => materialFormData(malformed), { status: 400 });
});

test("unsupported and duplicate fields and ambiguous input sources are rejected", () => {
  const unknown = pasted();
  unknown.set("owner_teacher_id", "spoofed-owner");
  const duplicate = pasted();
  duplicate.append("text", "Second source");
  const both = pasted();
  both.set("file", new File(["Source"], "fixture.txt"));
  const textFile = new FormData();
  textFile.set("text", new File(["Source"], "fixture.txt"));
  const fileText = new FormData();
  fileText.set("file", "Source");
  const previewReceipt = pasted();
  previewReceipt.set("receipt", "not allowed on preview");
  for (const form of [
    unknown,
    duplicate,
    both,
    new FormData(),
    textFile,
    fileText,
    previewReceipt,
  ]) {
    assert.throws(() => materialFields(form, false), { status: 400 });
  }
  const save = pasted();
  save.set("receipt", "fixture-receipt");
  save.set("review", "{}");
  assert.equal(materialFields(save, true).text, "Fictional source text.");
  save.append("review", "{}");
  assert.throws(() => materialFields(save, true), { status: 400 });
});

test("declared oversized or malformed lengths fail before decoding the request", async () => {
  for (const length of [
    String(MAX_IMPORT_REQUEST_BYTES + 1),
    "-1",
    "invalid",
    "1.5",
  ]) {
    const req = request(pasted());
    req.headers.set("content-length", length);
    await assert.rejects(() => materialFormData(req), { status: 400 });
    assert.equal(req.bodyUsed, false);
  }
});

test("preview renewal accepts the original source plus one receipt but never review changes", async () => {
  const form = pasted();
  form.set("receipt", "fixture-receipt");
  const received = await materialFormData(request(form));
  assert.equal(
    (await materialInput(received, false, true)).input.kind,
    "paste",
  );
  assert.equal(textField(received, "receipt", 1_000), "fixture-receipt");
  assert.throws(() => materialFields(received, false), { status: 400 });
  received.set("review", "{}");
  assert.throws(() => materialFields(received, false, true), { status: 400 });
  received.delete("review");
  received.append("receipt", "duplicate-receipt");
  assert.throws(() => materialFields(received, false, true), { status: 400 });
});

test("chunked and under-declared requests are bounded by received bytes and cancelled", async () => {
  for (const declared of [null, "1"]) {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_IMPORT_REQUEST_BYTES));
        controller.enqueue(new Uint8Array(1));
      },
      cancel() {
        cancelled = true;
      },
    });
    const options: RequestInit & { duplex: "half" } = {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "multipart/form-data; boundary=fixture-boundary",
        ...(declared ? { "Content-Length": declared } : {}),
      },
      body,
      duplex: "half",
    };
    await assert.rejects(
      () =>
        materialFormData(
          new Request(`${origin}/api/teacher/materials/preview`, options),
        ),
      { status: 400, message: /too large/ },
    );
    assert.equal(cancelled, true);
  }
});

test("source limit counts UTF-8 bytes and save metadata must be bounded text", async () => {
  const boundary = pasted("é".repeat(2_500_000));
  assert.equal(
    (await materialInput(boundary, false)).bytes.byteLength,
    5_000_000,
  );
  await assert.rejects(
    () => materialInput(pasted("é".repeat(2_500_000) + "a"), false),
    { status: 400 },
  );
  await assert.rejects(() => materialInput(pasted(""), false), { status: 400 });
  const uploaded = new FormData();
  uploaded.set("file", new File([new Uint8Array(5_000_001)], "fixture.txt"));
  await assert.rejects(() => materialInput(uploaded, false), { status: 400 });

  const metadata = new FormData();
  assert.throws(() => textField(metadata, "receipt", 5), { status: 400 });
  metadata.set("receipt", "12345");
  assert.equal(textField(metadata, "receipt", 5), "12345");
  for (const value of ["", "123456", new File(["123"], "receipt.txt")]) {
    metadata.set("receipt", value);
    assert.throws(() => textField(metadata, "receipt", 5), { status: 400 });
  }
});
