import "server-only";

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import type { Worker } from "node:worker_threads";
import { z } from "zod";
import {
  MAX_EXTRACTED_CHARACTERS,
  MAX_MATERIAL_BYTES,
  MAX_MATERIAL_PASSAGES,
  MAX_PASSAGE_CHARACTERS,
  MaterialExtractionError,
  MaterialExtractionPreviewSchema,
} from "./contracts.ts";
import type {
  MaterialExtractionInput,
  MaterialExtractionPreview,
  MaterialPassage,
} from "./contracts.ts";

export { MaterialExtractionError } from "./contracts.ts";

const PDF_TIMEOUT_MS = 10_000;
const MAX_ACTIVE_PDF_WORKERS = 2;
let activePdfWorkers = 0;

const PdfResultSchema = z.union([
  z
    .object({
      pages: z
        .array(
          z
            .object({
              pageNumber: z.number().int().positive(),
              text: z.string().max(MAX_EXTRACTED_CHARACTERS),
            })
            .strict(),
        )
        .min(1)
        .max(MAX_EXTRACTED_CHARACTERS),
    })
    .strict(),
  z
    .object({
      error: z.enum([
        "encrypted_pdf",
        "text_too_long",
        "unreadable_pdf",
        "pdf_images_unsupported",
      ]),
    })
    .strict(),
]);

function tooLong(): MaterialExtractionError {
  return new MaterialExtractionError(
    "text_too_long",
    "Material exceeds 50,000 extracted characters. Import a shorter excerpt.",
  );
}

function checkReadableText(text: string): void {
  // Do not replace invalid characters silently or interpret embedded instructions.
  const withoutWhitespace = text.replace(/[\r\n\t]/g, "");
  if (
    /[\p{Cc}\p{Co}\p{Cs}\uFFFD]/u.test(withoutWhitespace) ||
    !/[\p{L}\p{N}]/u.test(text)
  ) {
    throw new MaterialExtractionError(
      "unreadable_text",
      "The text contains unreadable characters or no readable words. Check the source and use a clean UTF-8 text excerpt.",
    );
  }
}

function validateText(text: string): string {
  // Count before trimming: whitespace cannot evade the extraction limit.
  if (text.length > MAX_EXTRACTED_CHARACTERS) throw tooLong();
  if (!text.trim()) {
    throw new MaterialExtractionError(
      "empty_material",
      "Add readable source text before creating a preview.",
    );
  }
  checkReadableText(text);
  return text.replace(/\r\n?/g, "\n").trim();
}

function chunks(text: string): string[] {
  const result: string[] = [];
  while (text.length > MAX_PASSAGE_CHARACTERS) {
    let boundary = text.lastIndexOf("\n", MAX_PASSAGE_CHARACTERS);
    if (boundary < MAX_PASSAGE_CHARACTERS / 2)
      boundary = text.lastIndexOf(" ", MAX_PASSAGE_CHARACTERS);
    if (boundary < MAX_PASSAGE_CHARACTERS / 2)
      boundary = MAX_PASSAGE_CHARACTERS;
    // Never cut a Unicode surrogate pair in half.
    if (/[\uD800-\uDBFF]/.test(text[boundary - 1])) boundary--;
    result.push(text.slice(0, boundary).trim());
    text = text.slice(boundary).trim();
  }
  if (text) result.push(text);
  return result;
}

function appendPassages(
  target: MaterialPassage[],
  text: string,
  options: { markdown?: boolean; page_number?: number } = {},
): void {
  let section: string | undefined;
  let pending = "";
  let fencedCode: string | null = null;
  function flush() {
    if (!pending) return;
    for (const chunk of chunks(pending)) {
      if (target.length >= MAX_MATERIAL_PASSAGES) {
        throw new MaterialExtractionError(
          "invalid_input",
          "The source creates more than 500 review passages. Import a shorter excerpt or combine short sections.",
        );
      }
      target.push({
        passage_id: `p${String(target.length + 1).padStart(3, "0")}`,
        text: chunk,
        ...(options.page_number ? { page_number: options.page_number } : {}),
        ...(section ? { section } : {}),
      });
    }
    pending = "";
  }
  // Group short adjacent paragraphs to keep a bounded, readable review surface.
  for (const paragraph of text.split(/\n[ \t]*\n/)) {
    const heading =
      options.markdown && !fencedCode
        ? /^ {0,3}#{1,6}[ \t]+([^\n]+?)(?:[ \t]+#+)?(?:\n|$)/.exec(paragraph)
        : null;
    if (options.markdown) {
      for (const line of paragraph.split("\n")) {
        const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);
        if (fence && !fencedCode) fencedCode = fence[1][0];
        else if (fence && fence[1][0] === fencedCode) fencedCode = null;
      }
    }
    if (heading) {
      flush();
      section = heading[1].trim().slice(0, 300);
    }
    if (pending.length + paragraph.length + 2 > 1_500) flush();
    pending = pending ? `${pending}\n\n${paragraph}` : paragraph;
  }
  flush();
}

async function extractPdf(
  bytes: Uint8Array,
): Promise<{ pageNumber: number; text: string }[]> {
  if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") {
    throw new MaterialExtractionError(
      "unreadable_pdf",
      "The file is not a readable PDF. Upload a text-based PDF or paste its text.",
    );
  }
  if (activePdfWorkers >= MAX_ACTIVE_PDF_WORKERS) {
    throw new MaterialExtractionError(
      "pdf_busy",
      "PDF extraction is busy. Try again shortly; your file has not been saved.",
    );
  }
  activePdfWorkers++;
  let worker: Worker | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    // Docker copies lib into the runtime image. Use a filesystem worker so PDF.js
    // and its own worker resolve normally, outside the Next.js request bundle.
    // Load the native constructor at runtime. Turbopack rewrites a statically
    // imported `new Worker(...)`, which bundles PDF.js and breaks its own sibling
    // worker resolution. This worker must execute the copied filesystem module.
    const nodeWorkerThreads: typeof import("node:worker_threads") =
      createRequire(path.join(process.cwd(), "package.json"))(
        "node:worker_threads",
      );
    worker = new nodeWorkerThreads.Worker(
      path.join(process.cwd(), "lib/materials/pdf-worker.mjs"),
      {
        execArgv: [],
        workerData: {
          bytes: new Uint8Array(bytes),
          maxCharacters: MAX_EXTRACTED_CHARACTERS,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: 128,
          maxYoungGenerationSizeMb: 16,
          stackSizeMb: 4,
        },
        // Do not expose parser diagnostics that may contain private source content.
        stdout: true,
        stderr: true,
      },
    );
    worker.stdout.resume();
    worker.stderr.resume();
    const pdfWorker = worker;
    const raw: unknown = await new Promise((resolve, reject) => {
      timeout = setTimeout(
        () =>
          reject(
            new MaterialExtractionError(
              "pdf_timeout",
              "PDF extraction took too long. Try a smaller, text-only excerpt.",
            ),
          ),
        PDF_TIMEOUT_MS,
      );
      pdfWorker.once("message", resolve);
      pdfWorker.once("error", () =>
        reject(
          new MaterialExtractionError(
            "unreadable_pdf",
            "The PDF could not be safely read. Try a smaller text-based PDF or paste its text.",
          ),
        ),
      );
      pdfWorker.once("exit", () =>
        reject(
          new MaterialExtractionError(
            "unreadable_pdf",
            "The PDF could not be read completely. No partial extraction was saved.",
          ),
        ),
      );
    });
    const result = PdfResultSchema.safeParse(raw);
    if (!result.success) {
      throw new MaterialExtractionError(
        "unreadable_pdf",
        "The PDF returned an invalid extraction. No partial extraction was saved.",
      );
    }
    if ("error" in result.data) {
      if (result.data.error === "text_too_long") throw tooLong();
      if (result.data.error === "pdf_images_unsupported") {
        throw new MaterialExtractionError(
          "pdf_images_unsupported",
          "This PDF contains images that cannot be extracted, including scanned content or logos. Paste a permitted text excerpt or upload a PDF containing only text.",
        );
      }
      if (result.data.error === "encrypted_pdf") {
        throw new MaterialExtractionError(
          "encrypted_pdf",
          "Password-protected or encrypted PDFs are not supported. Use a permitted unencrypted excerpt.",
        );
      }
      throw new MaterialExtractionError(
        "unreadable_pdf",
        "The PDF is damaged or has a page without readable text. Scans and image-only pages are not supported; use a text-only excerpt.",
      );
    }
    let total = 0;
    for (const page of result.data.pages) {
      total += page.text.length;
      if (total > MAX_EXTRACTED_CHARACTERS) throw tooLong();
      validateText(page.text);
    }
    return result.data.pages;
  } finally {
    if (timeout) clearTimeout(timeout);
    try {
      if (worker) await worker.terminate();
    } finally {
      activePdfWorkers--;
    }
  }
}

export async function extractMaterial(
  input: MaterialExtractionInput,
): Promise<MaterialExtractionPreview> {
  let bytes: Uint8Array;
  let inputKind: MaterialExtractionPreview["inputKind"];
  let originalFilename: string | null = null;
  let mediaType = "text/plain";
  if (input.kind === "paste") {
    if (typeof input.text !== "string") {
      throw new MaterialExtractionError(
        "invalid_input",
        "Provide source text to preview.",
      );
    }
    validateText(input.text);
    bytes = new TextEncoder().encode(input.text);
    inputKind = "paste";
  } else {
    if (
      !(input.bytes instanceof Uint8Array) ||
      typeof input.filename !== "string" ||
      typeof input.mediaType !== "string"
    ) {
      throw new MaterialExtractionError(
        "invalid_input",
        "Choose a valid source file.",
      );
    }
    bytes = input.bytes;
    originalFilename = input.filename.split(/[\\/]/).at(-1) ?? "";
    if (
      !originalFilename.trim() ||
      originalFilename.length > 255 ||
      /\p{Cc}/u.test(originalFilename)
    ) {
      throw new MaterialExtractionError(
        "invalid_input",
        "Choose a file with a readable name of at most 255 characters.",
      );
    }
    const extension = /\.([^.]+)$/.exec(originalFilename)?.[1].toLowerCase();
    if (extension !== "txt" && extension !== "md" && extension !== "pdf") {
      throw new MaterialExtractionError(
        "unsupported_type",
        "Upload a UTF-8 .txt or .md file, or a text-based PDF. Word, PowerPoint, scans, and other formats are not supported.",
      );
    }
    inputKind = extension;
    const suppliedType = input.mediaType.toLowerCase().split(";")[0].trim();
    const allowedTypes =
      inputKind === "pdf"
        ? ["application/pdf"]
        : ["text/plain", "text/markdown", "text/x-markdown"];
    if (
      suppliedType &&
      suppliedType !== "application/octet-stream" &&
      !allowedTypes.includes(suppliedType)
    ) {
      throw new MaterialExtractionError(
        "unsupported_type",
        "The file type does not match its extension. Upload the original text or PDF file.",
      );
    }
    mediaType =
      inputKind === "pdf"
        ? "application/pdf"
        : inputKind === "md"
          ? "text/markdown"
          : "text/plain";
  }
  if (bytes.byteLength > MAX_MATERIAL_BYTES) {
    throw new MaterialExtractionError(
      "file_too_large",
      "The file exceeds 5 MB. Import a smaller excerpt.",
    );
  }
  if (bytes.byteLength === 0) {
    throw new MaterialExtractionError(
      "empty_material",
      "The source is empty. Choose a file containing readable text.",
    );
  }
  const passages: MaterialPassage[] = [];
  let characterCount = 0;
  const warnings: string[] = [];
  if (inputKind === "pdf") {
    const pages = await extractPdf(bytes);
    characterCount = pages.reduce((total, page) => total + page.text.length, 0);
    for (const page of pages)
      appendPassages(passages, validateText(page.text), {
        page_number: page.pageNumber,
      });
    warnings.push(
      "Only selectable text was extracted. Images and diagrams were not imported. PDFs containing images, including logos, are rejected. Check reading order, tables, and formulas against the PDF before approving.",
    );
  } else {
    let decoded: string;
    try {
      decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new MaterialExtractionError(
        "invalid_utf8",
        "This file is not valid UTF-8 text. Save it as UTF-8, then upload it again.",
      );
    }
    if (decoded.startsWith("%PDF-")) {
      throw new MaterialExtractionError(
        "unsupported_type",
        "This appears to be a PDF. Upload it with its original .pdf extension.",
      );
    }
    const text = validateText(decoded);
    characterCount = decoded.length;
    appendPassages(passages, text, { markdown: inputKind === "md" });
    if (inputKind === "md")
      warnings.push(
        "Markdown is shown as source text. Linked files and images were not fetched or imported.",
      );
  }
  return MaterialExtractionPreviewSchema.parse({
    inputKind,
    originalFilename,
    mediaType,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    characterCount,
    passages,
    warnings,
  });
}
