import { deflateSync } from "node:zlib";

/** Fictional text only; each paragraph belongs to a separate page content stream. */
export const CONTENT_STREAM_PARAGRAPHS = [
  "First stream: a fair experiment changes one condition at a time.",
  "Second stream: record every observation before drawing a conclusion.",
] as const;

export const INVALID_CONTENT_STREAM_PDF_VARIANTS = [
  "corrupt_flate_header",
  "truncated_flate_body",
  "truncated_flate_trailer",
  "unsupported_filter",
  "missing_object",
  "non_stream_object",
  "bad_stream_length",
  "bad_flate_checksum",
  "trailing_flate_bytes",
  "repaired_startxref",
  "ascii85_partial_overflow",
  "image_subtype_contents",
] as const;

export type ContentStreamPdfVariant =
  | "valid"
  | "valid_ascii85_flate"
  | (typeof INVALID_CONTENT_STREAM_PDF_VARIANTS)[number];

function textOperators(text: string, y: number): string {
  const escaped = text.replace(/[\\()]/g, "\\$&");
  return `BT /F1 10 Tf 40 ${y} Td (${escaped}) Tj ET\n`;
}

function streamObject(
  bytes: Buffer,
  filters: string[] = [],
  declaredLength = bytes.byteLength,
  imageSubtype = false,
): string {
  const filter =
    filters.length === 1
      ? ` /Filter /${filters[0]}`
      : filters.length > 1
        ? ` /Filter [${filters.map((name) => `/${name}`).join(" ")}]`
        : "";
  return `<< /Length ${declaredLength}${filter}${imageSubtype ? " /Subtype /Image" : ""} >>\nstream\n${bytes.toString("latin1")}\nendstream`;
}

/** Adobe ASCII85 as used by PDF streams: no prefix, a required ~> terminator. */
function ascii85(bytes: Buffer): Buffer {
  let encoded = "";
  for (let offset = 0; offset < bytes.byteLength; offset += 4) {
    const count = Math.min(4, bytes.byteLength - offset);
    let value = 0;
    for (let index = 0; index < 4; index++) {
      value = value * 256 + (index < count ? bytes[offset + index] : 0);
    }
    let group = "";
    for (let index = 0; index < 5; index++) {
      group = String.fromCharCode((value % 85) + 33) + group;
      value = Math.floor(value / 85);
    }
    encoded += group.slice(0, count + 1);
  }
  return Buffer.from(`${encoded}~>`, "ascii");
}

/**
 * A valid one-page PDF has /Contents [5 0 R 6 0 R]. Object 5 contains the first
 * paragraph, and valid object 6 contains the different second paragraph compressed
 * by Node's zlib. Except for the explicitly named length/xref cases, defects change
 * only object 6 while xref offsets and /Length stay accurate. The ASCII85 control
 * wraps valid zlib bytes in a common ordered filter chain.
 * All assets are synthesized in memory; no imported documents are used.
 */
export function contentStreamPdf(
  variant: ContentStreamPdfVariant = "valid",
): Uint8Array {
  const first = Buffer.from(textOperators(CONTENT_STREAM_PARAGRAPHS[0], 720));
  const compressed = deflateSync(
    Buffer.from(textOperators(CONTENT_STREAM_PARAGRAPHS[1], 680)),
  );
  let second: Buffer = compressed;
  let filters = ["FlateDecode"];
  if (variant === "corrupt_flate_header") {
    second = Buffer.from(compressed);
    second[0] = 0;
    second[1] = 0;
  } else if (variant === "truncated_flate_body") {
    second = compressed.subarray(0, Math.floor(compressed.byteLength / 2));
  } else if (variant === "truncated_flate_trailer") {
    // Preserve the full deflate payload but remove its required Adler-32 trailer.
    second = compressed.subarray(0, compressed.byteLength - 4);
  } else if (
    variant === "unsupported_filter" ||
    variant === "image_subtype_contents"
  ) {
    filters = ["UnsupportedFixtureDecode"];
    // An ignored filter must not let raw operators masquerade as decoded content.
    second = Buffer.from(textOperators(CONTENT_STREAM_PARAGRAPHS[1], 680));
  } else if (variant === "bad_flate_checksum") {
    second = Buffer.from(compressed);
    second[second.byteLength - 1] ^= 0xff;
  } else if (variant === "trailing_flate_bytes") {
    second = Buffer.concat([
      compressed,
      Buffer.from("unexpected encoded tail"),
    ]);
  } else if (variant === "valid_ascii85_flate") {
    second = ascii85(compressed);
    filters = ["ASCII85Decode", "FlateDecode"];
  } else if (variant === "ascii85_partial_overflow") {
    // The padded final tuple exceeds uint32 even though only two digits appear.
    second = Buffer.from("s9~>", "ascii");
    filters = ["ASCII85Decode"];
  }

  const objects: Array<string | null> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents [5 0 R 6 0 R] >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    streamObject(first),
    variant === "missing_object"
      ? null
      : variant === "non_stream_object"
        ? "<< /NotAStream true >>"
        : streamObject(
            second,
            filters,
            variant === "bad_stream_length" ? 3 : second.byteLength,
            variant === "image_subtype_contents",
          ),
  ];

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: Array<number | null> = [null];
  for (const [index, object] of objects.entries()) {
    if (object === null) {
      offsets.push(null);
      continue;
    }
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) =>
      offset === null
        ? "0000000000 00000 f \n"
        : `${String(offset).padStart(10, "0")} 00000 n \n`,
    )
    .join("");
  const declaredXrefOffset = variant === "repaired_startxref" ? 1 : xrefOffset;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${declaredXrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
