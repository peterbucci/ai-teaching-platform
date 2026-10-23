// Runs in a disposable Node worker: never render PDF content or execute embedded code.
import { parentPort, workerData } from "node:worker_threads";
import {
  AnnotationMode,
  getDocument,
  OPS,
  version,
} from "pdfjs-dist/legacy/build/pdf.mjs";

const imageOperators = new Set([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageMaskXObject,
  OPS.paintImageXObjectRepeat,
  OPS.paintInlineImageXObjectGroup,
  OPS.paintImageMaskXObjectGroup,
  OPS.paintImageMaskXObjectRepeat,
  OPS.paintSolidColorImageMask,
]);

async function checkPageOperators(page) {
  // PDF.js 6.4.299's public getOperatorList() can resolve a partial list before
  // rejecting a parser error. Read its pinned transport stream directly so the
  // maxImageSize: 0 error reaches us before any image can be silently omitted.
  // This adapter must be re-reviewed with a PDF.js upgrade. Missing internals fail
  // closed; no rendering, canvas, image decoding, or fallback parser is allowed.
  const transport = page._transport;
  if (
    version !== "6.4.299" ||
    typeof transport?.getRenderingIntent !== "function" ||
    typeof transport?.messageHandler?.sendWithStream !== "function" ||
    !Number.isInteger(page._id) ||
    !Number.isInteger(page.pageNumber)
  ) {
    throw new Error("unreadable_pdf");
  }
  const intent = transport.getRenderingIntent(
    "any",
    AnnotationMode.ENABLE,
    null,
    false,
    true,
  );
  if (
    !Number.isInteger(intent.renderingIntent) ||
    typeof intent.cacheKey !== "string" ||
    !intent.annotationStorageSerializable
  ) {
    throw new Error("unreadable_pdf");
  }
  const { map, transfer } = intent.annotationStorageSerializable;
  // These are freshly loaded documents: no page insertion, deletion or remapping.
  const stream = transport.messageHandler.sendWithStream(
    "GetOperatorList",
    {
      pageId: page.pageNumber - 1,
      pageIndex: page.pageNumber - 1,
      pageProxyId: page._id,
      intent: intent.renderingIntent,
      cacheKey: intent.cacheKey,
      annotationStorage: map,
      modifiedIds: intent.modifiedIds,
    },
    undefined,
    transfer,
  );
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!Array.isArray(value?.fnArray)) throw new Error("unreadable_pdf");
      if (value.fnArray.some((operator) => imageOperators.has(operator))) {
        throw new Error("pdf_images_unsupported");
      }
    }
  } finally {
    // Cancellation is cleanup only; a previous extraction error remains an error.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

const task = getDocument({
  data: workerData.bytes,
  stopAtErrors: true,
  // PDF.js throws before decoding every image when stopAtErrors is enabled.
  maxImageSize: 0,
  disableFontFace: true,
  useSystemFonts: false,
  useWasm: false,
  isEvalSupported: false,
  enableXfa: false,
  disableAutoFetch: true,
  disableRange: true,
  disableStream: true,
  verbosity: 0,
});

// Password-protected files are unsupported even when the PDF permits empty passwords.
task.onPassword = () => {
  parentPort.postMessage({ error: "encrypted_pdf" });
  void task.destroy();
};

try {
  const document = await task.promise;
  if ((await document.getPermissions()) !== null) {
    parentPort.postMessage({ error: "encrypted_pdf" });
  } else {
    const pages = [];
    let characterCount = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      await checkPageOperators(page);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        // PDF.js supplies content-stream ordering and line boundaries. Teachers
        // must review columns, tables, and formulas; we do not invent their order.
        text += item.str;
        if (item.hasEOL) text += "\n";
        if (characterCount + text.length > workerData.maxCharacters) {
          throw new Error("text_too_long");
        }
      }
      if (!text.trim()) throw new Error("unreadable_pdf");
      characterCount += text.length;
      pages.push({ pageNumber, text });
      page.cleanup();
    }
    parentPort.postMessage({ pages });
  }
} catch (error) {
  const code =
    error?.message === "Image exceeded maximum allowed size and was removed." ||
    error?.message === "pdf_images_unsupported"
      ? "pdf_images_unsupported"
      : error?.name === "PasswordException"
        ? "encrypted_pdf"
        : error?.message === "text_too_long"
          ? "text_too_long"
          : "unreadable_pdf";
  parentPort.postMessage({ error: code });
} finally {
  await task.destroy();
}
