/**
 * Fail-closed adapter for the exact reviewed PDF.js worker bundle below.
 * Only trusted, hash-checked library source and this fixed export shim are loaded
 * as JavaScript. Uploaded PDF bytes are never interpolated into executable code.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { inflateSync } from "node:zlib";

const WORKER_SHA256 =
  "bb422f60804477de4a0b09091d8347a916a387755ed1cbad24ccaec1d09c78bf";
const MAX_STREAM_BYTES = 8_000_000;
const MAX_DECODED_BYTES = 32_000_000;
const CORE_EXPORTS = `
export { Parser, XRef, Page, BaseStream, Stream, NullStream, Dict, Name, Ref,
  Ascii85Stream, PredictorStream, isCmd };
export function installIntegrityDiagnostics(report) {
  // These functions are internal to the pinned, audited worker module. Intercept
  // diagnostics before its verbosity filter and without logging private content.
  warn = message => report("warning", String(message));
  info = message => report("info", String(message));
}
`;
let installed = false;

/** One import operation per disposable worker; failure remains sticky. */
export async function installStrictPdfWorker() {
  if (installed) throw new Error("unreadable_pdf");
  installed = true;
  const require = createRequire(import.meta.url);
  const source = await readFile(
    require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  );
  if (createHash("sha256").update(source).digest("hex") !== WORKER_SHA256) {
    throw new Error("unreadable_pdf");
  }
  // Bundled standard-font substitution intentionally converts Type1 Helvetica
  // to PDF.js's TrueType fallback. Suppress only that configuration diagnostic,
  // while an inconsistent uploaded/embedded font still marks integrity failure.
  const fontDiagnostic =
    'info("Inconsistent font file Type/SubType, expected: " + ' +
    "`${this.type}/${this.subtype} but found: ${type}/${subtype}.`);";
  const moduleSource = source.toString("utf8");
  if (moduleSource.split(fontDiagnostic).length !== 2) {
    throw new Error("unreadable_pdf");
  }
  const strictSource = moduleSource.replace(
    fontDiagnostic,
    `if (!properties.isInternalFont) { ${fontDiagnostic} }`,
  );
  const core = await import(
    `data:text/javascript;base64,${Buffer.from(strictSource + CORE_EXPORTS).toString("base64")}`
  );
  let failure = null;
  let decodedBytes = 0;
  const markFailure = (code = "unreadable_pdf") => {
    failure ??= code;
  };
  const fail = (code = "unreadable_pdf") => {
    markFailure(code);
    throw new Error(code);
  };
  const assertComplete = () => {
    if (failure) throw new Error(failure);
  };
  const bounded = (bytes) => {
    decodedBytes += bytes.length;
    if (bytes.length > MAX_STREAM_BYTES || decodedBytes > MAX_DECODED_BYTES) {
      fail();
    }
    return bytes;
  };

  core.installIntegrityDiagnostics((level, message) => {
    // Standard-font fallback is application configuration, not discarded source
    // content. Normal operation timing is informational. Everything else is a
    // conservative supplement to the structural and decoder checks below.
    if (
      message ===
        "UnknownErrorException: Ensure that the `standardFontDataUrl` API parameter is provided." ||
      (message.startsWith("fetchStandardFontData:") &&
        message.includes("standardFontDataUrl")) ||
      (level === "info" &&
        /^page=\d+ - (getOperatorList|getTextContent):/.test(message))
    ) {
      return;
    }
    markFailure();
  });

  const originalParse = core.XRef.prototype.parse;
  core.XRef.prototype.parse = function (recoveryMode = false) {
    if (recoveryMode) fail();
    try {
      const result = originalParse.call(this, false);
      // Includes partially unreadable /Prev chains that readXRef otherwise skips.
      if (this.countUpdatesAfter(0) === null) fail();
      return result;
    } catch (error) {
      if (error?.name !== "PasswordException") markFailure();
      throw error;
    }
  };
  const originalFetch = core.XRef.prototype.fetch;
  core.XRef.prototype.fetch = function (ref, suppressEncryption = false) {
    if (!(ref instanceof core.Ref) || !this.getEntry(ref.num)) fail();
    try {
      return originalFetch.call(this, ref, suppressEncryption);
    } catch (error) {
      if (error?.name !== "PasswordException") markFailure();
      throw error;
    }
  };

  // Replace only the short stream-boundary path from PDF.js Parser.makeStream.
  // In particular, never call its #findStreamLength repair or tryShift recovery.
  core.Parser.prototype.makeStream = function (dict, cipherTransform) {
    try {
      if (cipherTransform) fail("encrypted_pdf");
      const lexer = this.lexer;
      let stream = lexer.stream;
      if (!(stream instanceof core.Stream)) fail();
      while (lexer.currentChar === 0x20 || lexer.currentChar === 0x09) {
        lexer.nextChar();
      }
      if (lexer.currentChar !== 0x0a && lexer.currentChar !== 0x0d) fail();
      lexer.skipToNextLine();
      const start = stream.pos - 1;
      const length = dict.get("Length");
      if (
        !Number.isInteger(length) ||
        length < 0 ||
        length > MAX_STREAM_BYTES ||
        start + length > stream.end
      )
        fail();
      const boundary = stream.getByteRange(start + length, start + length + 12);
      let offset = 0;
      if (boundary[offset] === 0x0d) offset++;
      if (boundary[offset] === 0x0a) offset++;
      const marker = Buffer.from(
        boundary.subarray(offset, offset + 9),
      ).toString("ascii");
      if (marker !== "endstream" || !pdfWhitespace(boundary[offset + 9]))
        fail();
      stream.pos = start + length;
      lexer.nextChar();
      this.shift();
      if (!core.isCmd(this.buf2, "endstream")) fail();
      this.shift();
      this.shift();
      if (!core.isCmd(this.buf1, "endobj")) fail();
      stream = stream.makeSubStream(start, length, dict);
      // Resource dictionaries may include unused image streams. Preserve their
      // bounded encoded bytes without decoding them; the operator gate rejects
      // every actually painted image before PDF.js can decode it.
      if (!(
        dict.get("Subtype") instanceof core.Name &&
        dict.get("Subtype").name === "Image"
      )) {
        stream = this.filter(stream, dict, length, null);
      }
      stream.dict = dict;
      return stream;
    } catch (error) {
      markFailure();
      throw error;
    }
  };
  core.Parser.prototype.makeInlineImage = () => fail("pdf_images_unsupported");

  core.Parser.prototype.filter = function (stream, dict, length) {
    const filter = dict.get("F", "Filter");
    const params = dict.get("DP", "DecodeParms");
    if (filter === undefined || filter === null) {
      if (params !== undefined && params !== null) fail();
      return stream;
    }
    const filters = Array.isArray(filter) ? filter : [filter];
    if (!filters.length || filters.length > 3) fail();
    if (
      Array.isArray(params) &&
      (!Array.isArray(filter) || params.length !== filters.length)
    )
      fail();
    if (
      params != null &&
      !Array.isArray(params) &&
      (Array.isArray(filter) || !(params instanceof core.Dict))
    )
      fail();
    for (const [index, rawFilter] of filters.entries()) {
      const name = this.xref ? this.xref.fetchIfRef(rawFilter) : rawFilter;
      if (!(name instanceof core.Name)) fail();
      let parameter = Array.isArray(params) ? params[index] : params;
      if (this.xref) parameter = this.xref.fetchIfRef(parameter);
      stream = this.makeFilter(
        stream,
        name.name,
        index === 0 ? length : null,
        parameter,
      );
    }
    return stream;
  };
  core.Parser.prototype.makeFilter = function (stream, name, _length, params) {
    try {
      if (params != null && !(params instanceof core.Dict)) fail();
      const encoded = stream.getBytes();
      if (encoded.length > MAX_STREAM_BYTES) fail();
      let decoded;
      if (name === "FlateDecode" || name === "Fl") {
        const remaining = Math.min(
          MAX_STREAM_BYTES,
          MAX_DECODED_BYTES - decodedBytes,
        );
        if (remaining <= 0) fail();
        // Default Z_FINISH validates both the complete deflate stream and Adler32.
        // Z_SYNC_FLUSH would incorrectly accept truncated input and is prohibited.
        const result = inflateSync(encoded, {
          info: true,
          maxOutputLength: remaining,
        });
        if (result.engine.bytesWritten !== encoded.length) fail();
        decoded = bounded(result.buffer);
        decoded = applyPredictor(decoded, params);
      } else if (name === "ASCII85Decode" || name === "A85") {
        if (params && !params.getKeys().next().done) fail();
        validateAscii85(encoded, fail);
        decoded = bounded(
          new core.Ascii85Stream(new core.Stream(encoded)).getBytes(),
        );
      } else {
        // Keep support bounded to reviewed lossless text encodings. Do not invoke
        // PDF.js decoders that can recover invalid/truncated input as partial text.
        fail();
      }
      return new core.Stream(decoded, 0, decoded.length, stream.dict);
    } catch (error) {
      markFailure();
      throw error;
    }
  };

  function applyPredictor(bytes, params) {
    if (!params) return bytes;
    const predictor = params.get("Predictor") ?? 1;
    if (predictor === 1) return bytes;
    if (
      predictor !== 2 &&
      !(Number.isInteger(predictor) && predictor >= 10 && predictor <= 15)
    )
      fail();
    const colors = params.get("Colors") ?? 1;
    const bits = params.get("BPC", "BitsPerComponent") ?? 8;
    const columns = params.get("Columns") ?? 1;
    if (
      !Number.isInteger(colors) ||
      colors < 1 ||
      colors > 32 ||
      ![1, 2, 4, 8, 16].includes(bits) ||
      !Number.isInteger(columns) ||
      columns < 1 ||
      columns > 65_536
    )
      fail();
    const rowBytes = Math.ceil((colors * bits * columns) / 8);
    const encodedRowBytes = rowBytes + (predictor === 2 ? 0 : 1);
    if (bytes.length % encodedRowBytes !== 0) fail();
    if (predictor !== 2) {
      for (let offset = 0; offset < bytes.length; offset += encodedRowBytes) {
        if (bytes[offset] > 4) fail();
      }
    }
    return bounded(
      new core.PredictorStream(
        new core.Stream(bytes),
        bytes.length,
        params,
      ).getBytes(),
    );
  }

  const contentProperty = Object.getOwnPropertyDescriptor(
    core.Page.prototype,
    "content",
  );
  if (!contentProperty?.get) fail();
  Object.defineProperty(core.Page.prototype, "content", {
    ...contentProperty,
    get() {
      try {
        const content = contentProperty.get.call(this);
        const streams = Array.isArray(content) ? content : [content];
        if (
          !streams.length ||
          streams.some(
            (stream) =>
              !(stream instanceof core.BaseStream) ||
              stream instanceof core.NullStream ||
              stream.isImageStream ||
              (stream.dict?.get("Subtype") instanceof core.Name &&
                stream.dict.get("Subtype").name === "Image"),
          )
        )
          fail();
        return content;
      } catch (error) {
        markFailure();
        throw error;
      }
    },
  });

  return { assertComplete };
}

function pdfWhitespace(byte) {
  return (
    byte === 0 ||
    byte === 9 ||
    byte === 10 ||
    byte === 12 ||
    byte === 13 ||
    byte === 32
  );
}

/** Validate every byte/tuple before using the pinned, reviewed ASCII85 decoder. */
function validateAscii85(bytes, fail) {
  let digits = 0;
  let value = 0;
  let ended = false;
  for (let index = 0; index < bytes.length; index++) {
    const byte = bytes[index];
    if (pdfWhitespace(byte)) continue;
    if (ended) fail();
    if (byte === 0x7e) {
      if (bytes[++index] !== 0x3e || digits === 1) fail();
      if (digits > 0) {
        let padded = value;
        for (let count = digits; count < 5; count++) padded = padded * 85 + 84;
        if (padded > 0xffffffff) fail();
      }
      ended = true;
    } else if (byte === 0x7a) {
      if (digits !== 0) fail();
    } else {
      if (byte < 0x21 || byte > 0x75) fail();
      value = value * 85 + byte - 0x21;
      digits++;
      if (digits === 5) {
        if (value > 0xffffffff) fail();
        digits = 0;
        value = 0;
      }
    }
  }
  if (!ended) fail();
}
