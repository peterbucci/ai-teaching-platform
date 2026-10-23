import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool } from "../lib/db.ts";
import { DEMO_IDS } from "../lib/evidence/demo.ts";
import { SourceVersionSchema } from "../lib/lessons/sources.ts";
import {
  MaterialExtractionPreviewSchema,
  MAX_MATERIAL_BYTES,
} from "../lib/materials/contracts.ts";
import { syntheticPdf } from "../tests/fixtures/materials/synthetic-pdf.ts";
import {
  contentStreamPdf,
  CONTENT_STREAM_PARAGRAPHS,
  INVALID_CONTENT_STREAM_PDF_VARIANTS,
} from "../tests/fixtures/materials/content-stream-pdf.ts";

const base = process.env.AUTH_URL;
if (!base) throw new Error("Configure AUTH_URL for the running application.");
const receiptSecret = process.env.AUTH_SECRET;
if (!receiptSecret)
  throw new Error(
    "Configure AUTH_SECRET for signed-receipt compatibility verification.",
  );
const origin = new URL(base).origin;
const runId = randomUUID();
const fixtureTitle = `Synthetic material verification ${runId}`;
const foreignClassId = randomUUID();
const documentIds = new Set<string>();
const PreviewSchema = z.object({
  preview: MaterialExtractionPreviewSchema,
  receipt: z.string().min(1),
});
const SavedSchema = z.object({
  document_id: z.uuid(),
  version: z.number().int().positive(),
});
type Preview = z.infer<typeof PreviewSchema>;
type Saved = z.infer<typeof SavedSchema>;
type Source =
  { text: string } | { bytes: Uint8Array; filename: string; type: string };

// All inputs are newly generated fictional classroom material. This check makes
// no model calls and intentionally retains append-only source-version evidence.
const firstParagraph =
  "A fictional garden class records how water moves through soil. Students compare equal pots and explain their observations using the same amount of water. "
    .repeat(11)
    .trim();
const secondParagraph =
  "This second synthetic paragraph describes a classroom trial. A fair comparison changes one condition at a time and records the result before drawing a conclusion. "
    .repeat(11)
    .trim();
const source: Source = { text: `${firstParagraph}\n\n${secondParagraph}` };
// Multipart text fields use CRLF line endings on the wire. The server preserves
// those received bytes; uploaded files retain their original byte sequences.
const pastedWireBytes = Buffer.from(
  source.text.replace(/\r\n|\r|\n/g, "\r\n"),
  "utf8",
);
const attribution = {
  title: fixtureTitle,
  authors: ["Fictional materials verification teacher"],
  copyright:
    "Original synthetic verification material; no real classroom records.",
  section: "Synthetic source",
  url: null,
  license:
    "Created for this application's automated verification; permitted demo use.",
  license_url: null,
  cautions: ["Fictional test material, not an approved teaching lesson."],
};

function formFor(input: Source) {
  const form = new FormData();
  if ("text" in input) form.set("text", input.text);
  else
    form.set(
      "file",
      new Blob([new Uint8Array(input.bytes)], { type: input.type }),
      input.filename,
    );
  return form;
}
function reviewFor(preview: Preview, title = fixtureTitle) {
  return {
    title,
    attribution: { ...attribution, title },
    permitted_use: true,
    reviewed: true,
    passages: preview.preview.passages.map(({ passage_id, text }) => ({
      passage_id,
      text,
      included: true,
    })),
  };
}
function saveForm(input: Source, preview: Preview, review: unknown) {
  const form = formFor(input);
  form.set("receipt", preview.receipt);
  form.set("review", JSON.stringify(review));
  return form;
}
async function request(
  path: string,
  cookie = "",
  form?: FormData,
  requestOrigin = origin,
) {
  return fetch(new URL(path, base), {
    method: form ? "POST" : "GET",
    redirect: "manual",
    headers: { Cookie: cookie, Origin: requestOrigin },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
}
async function expectStatus(response: Response, status: number, label: string) {
  if (response.status !== status) {
    const body: unknown = await response.json().catch(() => null);
    const error = z.object({ error: z.string() }).safeParse(body);
    assert.equal(
      response.status,
      status,
      `${label}${error.success ? `: ${error.data.error}` : ""}`,
    );
  }
  assert.match(
    response.headers.get("cache-control") ?? "",
    /no-store/,
    `${label}: private response caching`,
  );
  return response;
}
async function login(prefix: string) {
  const response = await fetch(new URL("/api/auth/sign-in/email", base), {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env[`${prefix}_EMAIL`],
      password: process.env[`${prefix}_PASSWORD`],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, `${prefix} fictional login`);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert.ok(cookie, `${prefix} session cookie`);
  return cookie;
}
async function previewFor(input: Source, cookie: string) {
  const response = await expectStatus(
    await request("/api/teacher/materials/preview", cookie, formFor(input)),
    200,
    "extract source",
  );
  return PreviewSchema.parse(await response.json());
}
async function save(
  input: Source,
  preview: Preview,
  review: unknown,
  cookie: string,
): Promise<Saved> {
  const response = await expectStatus(
    await request(
      "/api/teacher/materials",
      cookie,
      saveForm(input, preview, review),
    ),
    200,
    "save source",
  );
  const result = SavedSchema.parse(await response.json());
  documentIds.add(result.document_id);
  return result;
}
function sourceProjection(value: unknown) {
  const raw = z.record(z.string(), z.unknown()).parse(value);
  assert.equal(
    Object.hasOwn(raw, "original_bytes"),
    false,
    "private bytes absent from HTTP projection",
  );
  assert.equal(
    Object.hasOwn(raw, "owner_id"),
    false,
    "raw owner field absent from HTTP projection",
  );
  return SourceVersionSchema.parse(raw);
}
async function read(saved: Saved, cookie: string) {
  const response = await expectStatus(
    await request(
      `/api/teacher/materials/${saved.document_id}?version=${saved.version}`,
      cookie,
    ),
    200,
    "reload exact source version",
  );
  return sourceProjection(await response.json());
}
async function list(cookie: string) {
  const response = await expectStatus(
    await request("/api/teacher/materials", cookie),
    200,
    "list teacher sources",
  );
  return z
    .array(z.unknown())
    .parse(await response.json())
    .map(sourceProjection);
}

async function sourceRowCounts() {
  const result = await getPool().query(
    `SELECT (SELECT count(*) FROM source_documents WHERE owner_id=$1) AS documents,
      (SELECT count(*) FROM source_versions v JOIN source_documents d ON d.id=v.document_id WHERE d.owner_id=$1) AS versions`,
    [DEMO_IDS.teacher],
  );
  return z
    .object({ documents: z.coerce.number(), versions: z.coerce.number() })
    .parse(result.rows[0]);
}

async function rejectedWithoutPreview(response: Response, label: string) {
  await expectStatus(response, 400, label);
  const failure = z
    .strictObject({ error: z.string().min(1) })
    .parse(await response.json());
  assert.equal(
    Object.hasOwn(failure, "preview"),
    false,
    `${label}: no partial preview`,
  );
  assert.equal(
    Object.hasOwn(failure, "receipt"),
    false,
    `${label}: no approval receipt`,
  );
  return failure;
}

try {
  const teacher = await login("DEMO_TEACHER");
  const student = await login("DEMO_STUDENT_ONE");
  const foreignTeacher = await login("DEMO_STUDENT_TWO");
  const db = getPool();
  await db.query("INSERT INTO classes(id,teacher_id,name) VALUES($1,$2,$3)", [
    foreignClassId,
    DEMO_IDS.studentTwo,
    `Synthetic material authorization ${runId}`,
  ]);

  for (const [cookie, status, actor] of [
    ["", 401, "anonymous"],
    [student, 404, "student"],
  ] as const) {
    await expectStatus(
      await request("/api/teacher/materials", cookie),
      status,
      `${actor} list denied`,
    );
    await expectStatus(
      await request(`/api/teacher/materials/${randomUUID()}?version=1`, cookie),
      status,
      `${actor} read denied`,
    );
    await expectStatus(
      await request("/api/teacher/materials/preview", cookie, formFor(source)),
      status,
      `${actor} extraction denied`,
    );
    await expectStatus(
      await request("/api/teacher/materials", cookie, formFor(source)),
      status,
      `${actor} save denied before parsing`,
    );
  }

  const preview = await previewFor(source, teacher);
  const [signedPayload, signature] = preview.receipt.split(".");
  assert.ok(
    signature ===
      createHmac("sha256", receiptSecret)
        .update(signedPayload)
        .digest("base64url"),
    "the application and this compatibility check use the same signing key",
  );
  assert.ok(
    preview.preview.passages.length >= 2,
    "ordered passage review fixture",
  );
  assert.equal(preview.preview.inputKind, "paste");
  assert.equal(
    preview.preview.contentHash,
    createHash("sha256").update(pastedWireBytes).digest("hex"),
  );
  const review = reviewFor(preview);
  review.passages[0].text =
    "Reviewed correction: equal pots receive the same amount of water; the class records the result before drawing a conclusion.";
  review.passages[1].included = false;
  const saved = await save(source, preview, review, teacher);
  assert.equal(saved.version, 1);
  const original = await read(saved, teacher);
  assert.deepEqual(
    original.extraction,
    preview.preview.passages,
    "original extraction survives corrections",
  );
  assert.deepEqual(
    original.passages,
    preview.preview.passages.flatMap((passage, index) =>
      review.passages[index].included
        ? [{ ...passage, text: review.passages[index].text }]
        : [],
    ),
  );
  assert.deepEqual(original.attribution, attribution);
  assert.equal(original.document_sha256, preview.preview.contentHash);
  assert.equal(original.review_status, "approved");
  assert.equal(original.source_ref.source_kind, "uploaded");
  assert.equal(original.source_ref.access_scope.teacher_id, DEMO_IDS.teacher);
  assert.equal(
    Object.hasOwn(original.source_ref, "source_commit"),
    false,
    "no fabricated Git reference",
  );
  assert.deepEqual(
    (await list(teacher)).find(
      (item) =>
        item.document_id === saved.document_id &&
        item.version === saved.version,
    ),
    original,
  );
  const bytesRow = z
    .object({ original_bytes: z.instanceof(Buffer), extraction: z.unknown() })
    .parse(
      (
        await db.query(
          "SELECT original_bytes,extraction FROM source_versions WHERE document_id=$1 AND version=1",
          [saved.document_id],
        )
      ).rows[0],
    );
  assert.deepEqual(
    bytesRow.original_bytes,
    pastedWireBytes,
    "private original bytes match the multipart text received by the server",
  );
  assert.deepEqual(bytesRow.extraction, preview.preview.passages);
  await assert.rejects(
    db.query(
      "UPDATE source_versions SET review_status='extracted' WHERE document_id=$1 AND version=1",
      [saved.document_id],
    ),
    /immutable/,
    "saved extraction and review are immutable in SQL",
  );

  assert.deepEqual(
    await save(source, preview, review, teacher),
    saved,
    "same receipt replay returns original source version",
  );
  const renewalForm = formFor(source);
  renewalForm.set("receipt", preview.receipt);
  const renewedResponse = await expectStatus(
    await request("/api/teacher/materials/preview", teacher, renewalForm),
    200,
    "extend review time",
  );
  const renewed = PreviewSchema.parse(await renewedResponse.json());
  assert.deepEqual(
    renewed.preview,
    preview.preview,
    "renewal preserves original extraction",
  );
  assert.deepEqual(
    await save(source, renewed, review, teacher),
    saved,
    "renewal preserves save identity and reviewed corrections",
  );
  await expectStatus(
    await request(
      "/api/teacher/materials",
      teacher,
      saveForm(source, preview, {
        ...review,
        title: `${fixtureTitle} changed`,
      }),
    ),
    409,
    "changed review cannot reuse saved request identity",
  );
  const versionCount = z
    .object({ count: z.coerce.number() })
    .parse(
      (
        await db.query(
          "SELECT count(*) FROM source_versions WHERE document_id=$1",
          [saved.document_id],
        )
      ).rows[0],
    );
  assert.equal(versionCount.count, 1, "replay does not create another version");

  for (const [cookie, status, actor] of [
    ["", 401, "anonymous"],
    [student, 404, "student"],
    [foreignTeacher, 404, "foreign teacher"],
  ] as const) {
    await expectStatus(
      await request(
        `/api/teacher/materials/${saved.document_id}?version=1`,
        cookie,
      ),
      status,
      `${actor} known source read denied`,
    );
  }
  assert.equal(
    (await list(foreignTeacher)).some(
      (item) => item.document_id === saved.document_id,
    ),
    false,
    "teacher list is owner scoped",
  );
  await expectStatus(
    await request(
      "/api/teacher/materials",
      foreignTeacher,
      saveForm(source, preview, review),
    ),
    400,
    "another teacher cannot use the extraction receipt",
  );
  const foreignPreview = await previewFor(source, foreignTeacher);
  await expectStatus(
    await request(
      "/api/teacher/materials",
      foreignTeacher,
      saveForm(source, foreignPreview, {
        ...reviewFor(foreignPreview),
        document_id: saved.document_id,
        expected_latest_version: 1,
      }),
    ),
    404,
    "another teacher cannot revise a private source",
  );

  const revisedSource: Source = {
    text: "A revised fictional source explains that a fair test changes one condition at a time. The teacher keeps the earlier reading and its historical references intact.",
  };
  const revisedPreview = await previewFor(revisedSource, teacher);
  const revised = await save(
    revisedSource,
    revisedPreview,
    {
      ...reviewFor(revisedPreview),
      document_id: saved.document_id,
      expected_latest_version: 1,
    },
    teacher,
  );
  assert.deepEqual(revised, { document_id: saved.document_id, version: 2 });
  const newVersion = await read(revised, teacher);
  assert.notEqual(newVersion.document_sha256, original.document_sha256);
  assert.equal(newVersion.source_ref.source_version, 2);
  assert.deepEqual(
    await read(saved, teacher),
    { ...original, latest_version: 2 },
    "new version leaves old reading and references unchanged",
  );
  const stalePreview = await previewFor(revisedSource, teacher);
  await expectStatus(
    await request(
      "/api/teacher/materials",
      teacher,
      saveForm(revisedSource, stalePreview, {
        ...reviewFor(stalePreview),
        document_id: saved.document_id,
        expected_latest_version: 1,
      }),
    ),
    409,
    "stale revision rejected",
  );

  for (const input of [
    {
      bytes: new TextEncoder().encode(
        "\uFEFFFictional UTF-8 notes. Café observations are recorded accurately.\r\nThe same amount of water is used in each trial.",
      ),
      filename: "synthetic-notes.txt",
      type: "text/plain",
    },
    {
      bytes: new TextEncoder().encode(
        "# Synthetic classroom notes\n\nStudents compare equal samples and record observations.\n\n## A fair comparison\n\nChange one condition at a time.",
      ),
      filename: "synthetic-notes.md",
      type: "text/markdown",
    },
  ]) {
    const filePreview = await previewFor(input, teacher);
    assert.equal(filePreview.preview.originalFilename, input.filename);
    assert.equal(
      filePreview.preview.inputKind,
      input.filename.endsWith(".md") ? "md" : "txt",
    );
    assert.equal(
      filePreview.preview.contentHash,
      createHash("sha256").update(input.bytes).digest("hex"),
      "uploaded text-file bytes retain their exact provenance",
    );
    assert.ok(filePreview.preview.passages.length > 0);
    if (input.filename.endsWith(".md"))
      assert.ok(
        filePreview.preview.passages.some((passage) => passage.section),
        "Markdown section references retained",
      );
  }
  const pdf: Source = {
    bytes: syntheticPdf([
      "Synthetic PDF reading. A fair comparison changes one condition at a time and records its result.",
      "Second synthetic PDF page. Students explain their observations using evidence from the classroom trial.",
    ]),
    filename: "synthetic-reading.pdf",
    type: "application/pdf",
  };
  const pdfPreview = await previewFor(pdf, teacher);
  assert.equal(pdfPreview.preview.inputKind, "pdf");
  assert.deepEqual(
    pdfPreview.preview.passages.map((passage) => passage.page_number),
    [1, 2],
  );
  const pdfSaved = await save(
    pdf,
    pdfPreview,
    reviewFor(pdfPreview, `${fixtureTitle} PDF`),
    teacher,
  );
  const pdfReloaded = await read(pdfSaved, teacher);
  assert.deepEqual(pdfReloaded.passages, pdfPreview.preview.passages);
  assert.equal(
    pdfReloaded.document_sha256,
    createHash("sha256").update(pdf.bytes).digest("hex"),
  );
  const pdfBytesRow = z
    .object({ original_bytes: z.instanceof(Buffer) })
    .parse(
      (
        await db.query(
          "SELECT original_bytes FROM source_versions WHERE document_id=$1 AND version=$2",
          [pdfSaved.document_id, pdfSaved.version],
        )
      ).rows[0],
    );
  assert.deepEqual(
    pdfBytesRow.original_bytes,
    Buffer.from(pdf.bytes),
    "uploaded PDF bytes remain byte-for-byte unchanged in private storage",
  );

  const multiStreamPdf: Source = {
    bytes: contentStreamPdf("valid"),
    filename: "synthetic-two-content-streams.pdf",
    type: "application/pdf",
  };
  const multiStreamPreview = await previewFor(multiStreamPdf, teacher);
  const multiStreamText = multiStreamPreview.preview.passages
    .map((passage) => passage.text)
    .join("\n")
    .replace(/\s+/g, " ");
  const firstStreamOffset = multiStreamText.indexOf(
    CONTENT_STREAM_PARAGRAPHS[0],
  );
  const secondStreamOffset = multiStreamText.indexOf(
    CONTENT_STREAM_PARAGRAPHS[1],
  );
  assert.ok(
    firstStreamOffset >= 0 && secondStreamOffset > firstStreamOffset,
    "a valid two-stream PDF retains both streams in order",
  );
  const multiStreamSaved = await save(
    multiStreamPdf,
    multiStreamPreview,
    reviewFor(multiStreamPreview, `${fixtureTitle} multi-stream PDF`),
    teacher,
  );
  const multiStreamReloaded = await read(multiStreamSaved, teacher);
  assert.deepEqual(
    multiStreamReloaded.extraction,
    multiStreamPreview.preview.passages,
    "both original PDF streams survive storage and reload",
  );
  assert.deepEqual(
    multiStreamReloaded.passages,
    multiStreamPreview.preview.passages,
    "both approved PDF streams survive storage and reload",
  );
  assert.equal(
    multiStreamReloaded.document_sha256,
    createHash("sha256").update(multiStreamPdf.bytes).digest("hex"),
  );

  for (const variant of INVALID_CONTENT_STREAM_PDF_VARIANTS) {
    const damaged: Source = {
      bytes: contentStreamPdf(variant),
      filename: `synthetic-damaged-${variant}.pdf`,
      type: "application/pdf",
    };
    const before = await sourceRowCounts();
    const failure = await rejectedWithoutPreview(
      await request(
        "/api/teacher/materials/preview",
        teacher,
        formFor(damaged),
      ),
      `${variant}: reject damaged later PDF stream`,
    );
    assert.match(
      failure.error,
      /damaged|could not be.*read|unreadable/i,
      `${variant}: unreadable PDF explanation`,
    );
    assert.deepEqual(
      await sourceRowCounts(),
      before,
      `${variant}: failed extraction persists no source`,
    );
    await rejectedWithoutPreview(
      await request(
        "/api/teacher/materials",
        teacher,
        saveForm(damaged, multiStreamPreview, reviewFor(multiStreamPreview)),
      ),
      `${variant}: another PDF's valid receipt cannot approve damaged bytes`,
    );
    assert.deepEqual(
      await sourceRowCounts(),
      before,
      `${variant}: mismatched approval persists no source`,
    );
    await rejectedWithoutPreview(
      await request(
        "/api/teacher/materials",
        teacher,
        saveForm(
          damaged,
          {
            ...multiStreamPreview,
            receipt: `${multiStreamPreview.receipt}.tampered`,
          },
          reviewFor(multiStreamPreview),
        ),
      ),
      `${variant}: forged receipt cannot approve a partial extraction`,
    );
    assert.deepEqual(
      await sourceRowCounts(),
      before,
      `${variant}: forged approval persists no source`,
    );

    // Reproduce a genuinely signed pre-fix receipt, including the damaged file's
    // correct hash and only its readable first stream. Do not call the current
    // receipt creator: it would add the new parser-validation policy version.
    const legacyPreview = MaterialExtractionPreviewSchema.parse({
      ...multiStreamPreview.preview,
      originalFilename: damaged.filename,
      contentHash: createHash("sha256").update(damaged.bytes).digest("hex"),
      characterCount: CONTENT_STREAM_PARAGRAPHS[0].length,
      passages: [
        {
          passage_id: "p001",
          text: CONTENT_STREAM_PARAGRAPHS[0],
          page_number: 1,
        },
      ],
    });
    const legacyPayload = Buffer.from(
      JSON.stringify({
        actorId: DEMO_IDS.teacher,
        requestId: randomUUID(),
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        preview: legacyPreview,
      }),
    ).toString("base64url");
    const legacy: Preview = {
      preview: legacyPreview,
      receipt: `${legacyPayload}.${createHmac("sha256", receiptSecret).update(legacyPayload).digest("base64url")}`,
    };
    await rejectedWithoutPreview(
      await request(
        "/api/teacher/materials",
        teacher,
        saveForm(damaged, legacy, reviewFor(legacy)),
      ),
      `${variant}: authentic old partial preview cannot be approved`,
    );
    assert.deepEqual(
      await sourceRowCounts(),
      before,
      `${variant}: legacy approval persists no source`,
    );
    const legacyRenewal = formFor(damaged);
    legacyRenewal.set("receipt", legacy.receipt);
    await rejectedWithoutPreview(
      await request("/api/teacher/materials/preview", teacher, legacyRenewal),
      `${variant}: authentic old partial preview cannot be renewed`,
    );
    assert.deepEqual(
      await sourceRowCounts(),
      before,
      `${variant}: legacy renewal persists no source`,
    );
  }

  const invalidInputs: Array<[string, Source]> = [
    ["empty source", { text: "" }],
    ["whitespace source", { text: " \n\t " }],
    ["over character limit", { text: "a".repeat(50_001) }],
    [
      "binary text",
      {
        bytes: Uint8Array.from([0, 1, 0, 2]),
        filename: "binary.txt",
        type: "text/plain",
      },
    ],
    [
      "malformed UTF-8",
      {
        bytes: Uint8Array.from([0xc3, 0x28]),
        filename: "invalid.txt",
        type: "text/plain",
      },
    ],
    [
      "unsupported Word file",
      {
        bytes: new TextEncoder().encode("This is not a supported document."),
        filename: "unsupported.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ],
    [
      "over byte limit",
      {
        bytes: new Uint8Array(MAX_MATERIAL_BYTES + 1).fill(97),
        filename: "oversize.txt",
        type: "text/plain",
      },
    ],
    [
      "scanned PDF",
      {
        bytes: syntheticPdf([null]),
        filename: "scanned.pdf",
        type: "application/pdf",
      },
    ],
    [
      "scan with selectable footer",
      {
        bytes: syntheticPdf([null], { scanWithFooter: true }),
        filename: "scanned-footer.pdf",
        type: "application/pdf",
      },
    ],
    [
      "password-protected PDF",
      {
        bytes: syntheticPdf(["Synthetic protected page."], { encrypted: true }),
        filename: "protected.pdf",
        type: "application/pdf",
      },
    ],
  ];
  for (const [label, input] of invalidInputs) {
    const response = await expectStatus(
      await request("/api/teacher/materials/preview", teacher, formFor(input)),
      400,
      label,
    );
    const failure = z
      .object({ error: z.string().min(1) })
      .parse(await response.json());
    assert.ok(failure.error, `${label}: useful failure`);
  }
  const both = formFor(source);
  both.set(
    "file",
    new Blob(["Synthetic duplicate source."], { type: "text/plain" }),
    "duplicate.txt",
  );
  await expectStatus(
    await request("/api/teacher/materials/preview", teacher, both),
    400,
    "multiple source fields rejected",
  );
  await expectStatus(
    await request(
      "/api/teacher/materials/preview",
      teacher,
      formFor(source),
      "https://cross-origin.invalid",
    ),
    403,
    "cross-origin preview rejected",
  );
  await expectStatus(
    await request(
      "/api/teacher/materials",
      teacher,
      saveForm(source, preview, review),
      "https://cross-origin.invalid",
    ),
    403,
    "cross-origin save rejected",
  );
  await expectStatus(
    await request(
      "/api/teacher/materials",
      teacher,
      saveForm(
        source,
        { ...preview, receipt: `${preview.receipt}.tampered` },
        review,
      ),
    ),
    400,
    "forged receipt rejected",
  );
  await expectStatus(
    await request(
      "/api/teacher/materials",
      teacher,
      saveForm(
        {
          text: "A different fictional source must not reuse the prior extraction receipt.",
        },
        preview,
        review,
      ),
    ),
    400,
    "receipt bound to original bytes",
  );
  await expectStatus(
    await request(
      "/api/teacher/materials",
      teacher,
      saveForm(source, preview, { ...review, owner_id: DEMO_IDS.studentTwo }),
    ),
    400,
    "browser-supplied ownership rejected",
  );
  const unusedPreview = await previewFor(source, teacher);
  await expectStatus(
    await request(
      "/api/teacher/materials",
      teacher,
      saveForm(source, unusedPreview, {
        ...reviewFor(unusedPreview),
        passages: reviewFor(unusedPreview).passages.map((passage) => ({
          ...passage,
          included: false,
        })),
      }),
    ),
    400,
    "empty approved selection rejected",
  );
  await expectStatus(
    await request(
      "/api/teacher/materials",
      teacher,
      saveForm(source, unusedPreview, {
        ...reviewFor(unusedPreview),
        reviewed: false,
      }),
    ),
    400,
    "explicit teacher review required",
  );
  await expectStatus(
    await request(
      "/api/teacher/materials",
      teacher,
      saveForm(source, unusedPreview, {
        ...reviewFor(unusedPreview),
        permitted_use: false,
      }),
    ),
    400,
    "permitted-use confirmation required",
  );

  console.log(
    "PASS: authenticated text/TXT/Markdown/PDF extraction; complete two-stream PDF storage; damaged later streams rejected without preview, approval receipt, or persisted source; corrected/excluded passages; private SQL bytes; saved reload/list; immutable versions; idempotent save; stale/replayed/forged request rejection; teacher isolation; unsupported, malformed and over-limit inputs; same-origin enforcement. No model calls or browser automation performed.",
  );
} finally {
  const db = getPool();
  try {
    await db.query("DELETE FROM classes WHERE id=$1 AND teacher_id=$2", [
      foreignClassId,
      DEMO_IDS.studentTwo,
    ]);
    if (documentIds.size)
      console.log(
        `Retained ${documentIds.size} synthetic source documents labeled '${fixtureTitle}' because source-version history is append-only. Temporary authorization class removed.`,
      );
  } finally {
    await db.end();
  }
}
