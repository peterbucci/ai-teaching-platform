"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  MaterialExtractionPreviewSchema,
  MAX_EXTRACTED_CHARACTERS,
  MAX_MATERIAL_BYTES,
  type MaterialExtractionPreview,
} from "../../../lib/materials/contracts.ts";
import {
  parseMaterialRecovery,
  type MaterialImportDraft,
} from "./import-draft.ts";
import "./materials.css";

const PreviewResponseSchema = z.object({
  preview: MaterialExtractionPreviewSchema,
  receipt: z.string().min(1),
});
const SaveResponseSchema = z.object({
  document_id: z.string().uuid(),
  version: z.number().int().positive(),
});
const ErrorResponseSchema = z.object({ error: z.string().min(1) });

type PassageReview = {
  passage_id: string;
  text: string;
  included: boolean;
};

type SourceRevision = {
  documentId: string;
  expectedVersion: number;
  latestVersion?: number;
  title: string;
  attribution: {
    title: string;
    authors: string[];
    copyright: string;
    section: string;
    url: string | null;
    license: string;
    license_url: string | null;
    cautions: string[];
  };
};

function subscribeToRecovery(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readRecovery(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

async function responseBody(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ErrorResponseSchema.safeParse(body);
    throw new Error(
      error.success
        ? error.data.error
        : "The request could not be completed. Your work is still here; please try again.",
    );
  }
  return body;
}

function requestError(cause: unknown, fallback: string) {
  if (
    cause instanceof TypeError ||
    (cause instanceof DOMException &&
      ["AbortError", "TimeoutError"].includes(cause.name))
  )
    return fallback;
  return cause instanceof Error ? cause.message : fallback;
}

export function ImportMaterialForm({
  revision,
  recoveryKey,
}: {
  revision?: SourceRevision;
  recoveryKey: string;
}) {
  const router = useRouter();
  const requestInFlight = useRef(false);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const completed = useRef(false);
  const [stage, setStage] = useState<"review" | "attribution">("review");
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [recoveredFilename, setRecoveredFilename] = useState<string | null>(
    null,
  );
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MaterialExtractionPreview | null>(
    null,
  );
  const [receipt, setReceipt] = useState("");
  const [passages, setPassages] = useState<PassageReview[]>([]);
  const [title, setTitle] = useState(revision?.title ?? "");
  const [authors, setAuthors] = useState(
    revision?.attribution.authors.join("\n") ?? "",
  );
  const [copyright, setCopyright] = useState(
    revision?.attribution.copyright ?? "",
  );
  const [license, setLicense] = useState(revision?.attribution.license ?? "");
  const [sourceUrl, setSourceUrl] = useState(revision?.attribution.url ?? "");
  const [permittedUse, setPermittedUse] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState<"preview" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveConflict, setSaveConflict] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const storedRecovery = useSyncExternalStore(
    subscribeToRecovery,
    () => readRecovery(recoveryKey),
    () => null,
  );
  const recovery = parseMaterialRecovery(storedRecovery);
  const dirty = Boolean(
    text ||
    file ||
    preview ||
    title !== (revision?.title ?? "") ||
    authors !== (revision?.attribution.authors.join("\n") ?? "") ||
    copyright !== (revision?.attribution.copyright ?? "") ||
    license !== (revision?.attribution.license ?? "") ||
    sourceUrl !== (revision?.attribution.url ?? ""),
  );
  const recoveryAvailable = Boolean(recovery && !recoveryDismissed && !dirty);
  const busy = pending !== null;
  const historicalRevision = Boolean(
    revision &&
    (revision.latestVersion ?? revision.expectedVersion) >
      revision.expectedVersion,
  );
  const missingOriginalFile = mode === "file" && !file;
  const includedPassages = passages.filter((passage) => passage.included);
  const reviewedCharacters = includedPassages.reduce(
    (total, passage) => total + passage.text.length,
    0,
  );
  const reviewIsValid =
    includedPassages.length > 0 &&
    includedPassages.every((passage) => passage.text.trim().length > 0) &&
    reviewedCharacters <= MAX_EXTRACTED_CHARACTERS;

  useEffect(() => {
    if (recoveryAvailable || completed.current) return;
    if (!dirty) {
      if (recoveryDismissed) {
        try {
          sessionStorage.removeItem(recoveryKey);
        } catch {
          // No unsaved text is being discarded when the form is empty.
        }
      }
      return;
    }
    const draft: MaterialImportDraft = {
      mode,
      text,
      filename: file?.name ?? recoveredFilename,
      preview,
      receipt,
      passages,
      title,
      authors,
      copyright,
      license,
      sourceUrl,
    };
    try {
      sessionStorage.setItem(recoveryKey, JSON.stringify(draft));
    } catch {
      // A blocked/full tab store does not discard edits or submit material.
      queueMicrotask(() => setStorageUnavailable(true));
    }
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (completed.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [
    dirty,
    recoveryAvailable,
    recoveryDismissed,
    recoveryKey,
    mode,
    text,
    file,
    recoveredFilename,
    preview,
    receipt,
    passages,
    title,
    authors,
    copyright,
    license,
    sourceUrl,
  ]);

  useEffect(() => {
    if (!dirty || !storageUnavailable) return;
    const warnOnNavigation = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(target instanceof HTMLAnchorElement) ||
        target.target === "_blank" ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      if (
        !window.confirm(
          "Leave this material review? Browser recovery is unavailable, so unsaved text and corrections will be lost.",
        )
      )
        event.preventDefault();
    };
    document.addEventListener("click", warnOnNavigation, true);
    return () => document.removeEventListener("click", warnOnNavigation, true);
  }, [dirty, storageUnavailable]);

  function clearRecovery() {
    setRecoveryDismissed(true);
    try {
      sessionStorage.removeItem(recoveryKey);
    } catch {
      setStorageUnavailable(true);
    }
  }

  function restoreRecovery() {
    if (!recovery) return;
    setMode(recovery.mode);
    setText(recovery.text);
    setRecoveredFilename(recovery.filename);
    setPreview(recovery.preview);
    setReceipt(recovery.receipt);
    setPassages(recovery.passages);
    setTitle(recovery.title);
    setAuthors(recovery.authors);
    setCopyright(recovery.copyright);
    setLicense(recovery.license);
    setSourceUrl(recovery.sourceUrl);
    setReviewed(false);
    setPermittedUse(false);
    setRecoveryDismissed(true);
    setNotice(
      "Your unsaved text, corrections and credit are restored. Review them and confirm permission before saving.",
    );
  }

  function downloadReview() {
    const review =
      recoveryAvailable && recovery
        ? recovery
        : {
            mode,
            text,
            filename: file?.name ?? recoveredFilename,
            preview,
            passages,
            title,
            authors,
            copyright,
            license,
            sourceUrl,
          };
    const copy = {
      title: review.title,
      authors: review.authors,
      copyright: review.copyright,
      license: review.license,
      source_url: review.sourceUrl,
      source_document_id: revision?.documentId ?? null,
      based_on_version: revision?.expectedVersion ?? null,
      original_filename: review.preview?.originalFilename ?? review.filename,
      original_text: review.mode === "paste" ? review.text : null,
      original_extraction: review.preview?.passages ?? [],
      reviewed_passages: review.passages,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(copy, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "teaching-material-review.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function sourceData() {
    const data = new FormData();
    if (mode === "paste") data.set("text", text);
    else if (file) data.set("file", file);
    return data;
  }

  async function extract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current || preview) return;
    setError(null);
    if (
      mode === "paste" &&
      (!text.trim() || text.length > MAX_EXTRACTED_CHARACTERS)
    ) {
      setError(
        "Paste between 1 and 50,000 characters of readable source text.",
      );
      return;
    }
    if (mode === "file" && !file) {
      setError("Choose a UTF-8 text, Markdown, or text-based PDF file.");
      return;
    }
    if (file && mode === "file" && file.size > MAX_MATERIAL_BYTES) {
      setError("This file is too large. Choose a file no larger than 5 MB.");
      return;
    }
    requestInFlight.current = true;
    setRecoveryDismissed(true);
    setPending("preview");
    try {
      const response = await fetch("/api/teacher/materials/preview", {
        method: "POST",
        body: sourceData(),
        signal: AbortSignal.timeout(30_000),
      });
      const parsed = PreviewResponseSchema.safeParse(
        await responseBody(response),
      );
      if (!parsed.success)
        throw new Error(
          "The extraction preview could not be read. Please try again.",
        );
      setPreview(parsed.data.preview);
      setReceipt(parsed.data.receipt);
      setPassages(
        parsed.data.preview.passages.map((passage) => ({
          passage_id: passage.passage_id,
          text: passage.text,
          included: true,
        })),
      );
      setReviewed(false);
      setStage("review");
      requestAnimationFrame(() => previewHeading.current?.focus());
    } catch (cause) {
      setError(
        requestError(
          cause,
          "The extraction could not be completed. Your material is still here; please try again.",
        ),
      );
    } finally {
      requestInFlight.current = false;
      setPending(null);
    }
  }

  function updatePassage(
    index: number,
    update: Partial<Pick<PassageReview, "text" | "included">>,
  ) {
    setPassages((current) =>
      current.map((passage, position) =>
        position === index ? { ...passage, ...update } : passage,
      ),
    );
    setReviewed(false);
  }

  function rejectPreview() {
    if (requestInFlight.current) return;
    const changed = preview?.passages.some(
      (passage, index) =>
        passages[index]?.text !== passage.text || !passages[index]?.included,
    );
    if (
      changed &&
      !window.confirm(
        "Reject this preview and discard passage corrections? Your original material and attribution will stay here.",
      )
    )
      return;
    setPreview(null);
    setReceipt("");
    setPassages([]);
    setReviewed(false);
    setError(null);
    setNotice(null);
    setSaveConflict(false);
  }

  async function extendReviewTime() {
    if (requestInFlight.current || !preview || !receipt || missingOriginalFile)
      return;
    requestInFlight.current = true;
    setPending("preview");
    setError(null);
    setNotice(null);
    try {
      const data = sourceData();
      data.set("receipt", receipt);
      const response = await fetch("/api/teacher/materials/preview", {
        method: "POST",
        body: data,
        signal: AbortSignal.timeout(30_000),
      });
      const renewed = PreviewResponseSchema.safeParse(
        await responseBody(response),
      );
      if (
        !renewed.success ||
        renewed.data.preview.contentHash !== preview.contentHash ||
        JSON.stringify(renewed.data.preview.passages) !==
          JSON.stringify(preview.passages)
      ) {
        throw new Error(
          "The renewed preview did not match this source. Your corrections are still here; please try again.",
        );
      }
      setReceipt(renewed.data.receipt);
      setNotice(
        "Review time extended. Your corrections and attribution are unchanged.",
      );
    } catch (cause) {
      setError(
        requestError(
          cause,
          "The review time could not be extended. Your corrections are still here; please try again.",
        ),
      );
    } finally {
      requestInFlight.current = false;
      setPending(null);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      requestInFlight.current ||
      !preview ||
      !receipt ||
      missingOriginalFile ||
      saveConflict ||
      historicalRevision
    )
      return;
    setError(null);
    if (
      !reviewIsValid ||
      !reviewed ||
      !permittedUse ||
      !title.trim() ||
      !copyright.trim() ||
      !license.trim() ||
      !authors.trim()
    ) {
      setError(
        "Add a title and attribution, include readable passages within the limit, and confirm your review and permitted use.",
      );
      return;
    }
    requestInFlight.current = true;
    setPending("save");
    try {
      const data = sourceData();
      data.set("receipt", receipt);
      data.set(
        "review",
        JSON.stringify({
          title: title.trim(),
          attribution: {
            title: title.trim(),
            authors: authors
              .split("\n")
              .map((author) => author.trim())
              .filter(Boolean),
            copyright: copyright.trim(),
            license: license.trim(),
            url: sourceUrl.trim() || null,
            section: revision?.attribution.section ?? "Imported source",
            license_url: revision?.attribution.license_url ?? null,
            cautions: revision?.attribution.cautions ?? [],
          },
          permitted_use: permittedUse,
          reviewed,
          passages,
          ...(revision
            ? {
                document_id: revision.documentId,
                expected_latest_version: revision.expectedVersion,
              }
            : {}),
        }),
      );
      const response = await fetch("/api/teacher/materials", {
        method: "POST",
        body: data,
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 409) setSaveConflict(true);
      const saved = SaveResponseSchema.safeParse(await responseBody(response));
      if (!saved.success)
        throw new Error(
          "The save response could not be read. Your review is still here; retry to confirm the result.",
        );
      completed.current = true;
      clearRecovery();
      router.push(
        `/teacher/materials/${saved.data.document_id}?version=${saved.data.version}`,
      );
      router.refresh();
    } catch (cause) {
      setError(
        requestError(
          cause,
          "We couldn’t confirm the save. Your review is still here. Retry the unchanged review to confirm whether this source version was saved.",
        ),
      );
      requestInFlight.current = false;
      setPending(null);
    }
  }

  return (
    <div
      className="lp-material-import"
      aria-busy={busy}
      onChangeCapture={() => {
        if (!recoveryAvailable) setRecoveryDismissed(true);
      }}
    >
      {recoveryAvailable && (
        <section
          className="lp-material-notice"
          aria-label="Recover material review"
        >
          <strong>Material you were adding</strong>
          <p>
            Unsaved work is available in this browser tab. Restore the reading
            and corrections, or discard this local copy.
          </p>
          <div className="lp-material-actions">
            <button
              type="button"
              className="lp-button lp-button-primary"
              onClick={restoreRecovery}
            >
              Continue checking it
            </button>
            <button type="button" className="lp-button" onClick={clearRecovery}>
              Discard local copy
            </button>
            <button
              type="button"
              className="lp-button"
              onClick={downloadReview}
            >
              Download recovered review
            </button>
          </div>
        </section>
      )}
      <div className="lp-material-progress" role="status">
        {busy
          ? pending === "save"
            ? "Saving reviewed source…"
            : "Preparing extraction preview…"
          : dirty
            ? "Unsaved material review"
            : revision
              ? `Preparing source version ${revision.expectedVersion + 1}`
              : "New teaching material"}
        <span>
          {storageUnavailable
            ? "Browser recovery is unavailable. Keep this page open until you save."
            : "Unsaved text stays in this browser tab until you save or discard it. Files must be reselected after a reload."}
        </span>
      </div>
      {dirty && (
        <div className="lp-material-actions">
          <button type="button" className="lp-button" onClick={downloadReview}>
            Download review copy
          </button>
        </div>
      )}
      {historicalRevision && (
        <p className="lp-material-notice">
          This review belongs to an older source version. You can inspect and
          download your edits, but saving here is disabled. Start from the
          latest source version after comparing the changes.
        </p>
      )}
      {notice && (
        <p className="lp-material-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div role="alert" className="lp-material-error lp-material-card">
          {error}
          {saveConflict && revision && (
            <p>
              Your review remains here.{" "}
              <Link
                className="lp-text-link"
                href={`/teacher/materials/${revision.documentId}?version=${revision.expectedVersion}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Inspect the saved source versions in a new tab
              </Link>{" "}
              before starting a revision from the latest version.
            </p>
          )}
        </div>
      )}
      {!preview && (
        <form onSubmit={extract} className="lp-material-card">
          <fieldset disabled={busy || recoveryAvailable}>
            <legend>Choose the material</legend>
            <p className="lp-material-note" id="material-limits">
              Paste text, or upload a UTF-8 .txt or .md file or a text-based
              PDF. Maximum file size: 5 MB. Maximum extracted text: 50,000
              characters. PDFs containing images, including logos, are not
              supported. Scans, password-protected PDFs, Word documents, and
              slides are not supported.
            </p>
            <div className="lp-material-modes">
              <label>
                <input
                  type="radio"
                  name="material-mode"
                  value="paste"
                  checked={mode === "paste"}
                  onChange={() => {
                    setMode("paste");
                    setError(null);
                  }}
                />
                Paste text
              </label>
              <label>
                <input
                  type="radio"
                  name="material-mode"
                  value="file"
                  checked={mode === "file"}
                  onChange={() => {
                    setMode("file");
                    setFile(null);
                    setError(null);
                  }}
                />
                Upload a file
              </label>
            </div>
            {mode === "paste" ? (
              <label className="lp-field" htmlFor="material-text">
                Source text
                <textarea
                  id="material-text"
                  className="lp-input lp-material-source"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={9}
                  maxLength={MAX_EXTRACTED_CHARACTERS}
                  required
                  aria-describedby="material-limits material-character-count"
                />
                <span
                  className="lp-material-note"
                  id="material-character-count"
                >
                  {text.length.toLocaleString()} / 50,000 characters
                </span>
              </label>
            ) : (
              <label className="lp-field" htmlFor="material-file">
                Source file
                <input
                  id="material-file"
                  className="lp-input lp-material-file"
                  type="file"
                  accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                  required
                  aria-describedby="material-limits"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setError(null);
                  }}
                />
                {file && (
                  <span className="lp-material-note">
                    {file.name} · {file.size.toLocaleString()} bytes
                  </span>
                )}
                {!file && recoveredFilename && (
                  <span className="lp-material-note">
                    Reselect {recoveredFilename} to continue. Your browser does
                    not restore uploaded files.
                  </span>
                )}
              </label>
            )}
            {!preview && (
              <button type="submit" className="lp-button lp-button-primary">
                {pending === "preview"
                  ? "Extracting passages…"
                  : "Preview extracted passages"}
              </button>
            )}
          </fieldset>
          <p className="lp-material-note">
            Previewing extracts text for your review. It does not call an AI
            model or save a source version.
          </p>
        </form>
      )}

      {preview && (
        <form onSubmit={save} className="lp-material-review">
          <fieldset disabled={busy || recoveryAvailable}>
            <legend className="lp-material-step-title">
              {stage === "review"
                ? "Review extracted passages"
                : "Credit and permission"}
            </legend>
            <div
              className="lp-material-substeps"
              role="group"
              aria-label="Material review stages"
            >
              <button
                type="button"
                aria-pressed={stage === "review"}
                onClick={() => setStage("review")}
              >
                1. Check the reading
              </button>
              <button
                type="button"
                aria-pressed={stage === "attribution"}
                onClick={() => setStage("attribution")}
              >
                2. Credit and permission
              </button>
            </div>
            {missingOriginalFile && (
              <label
                className="lp-field lp-material-notice"
                htmlFor="material-original-file"
              >
                Reselect the original file to resume saving
                <span>
                  {preview.originalFilename}. Your corrections are preserved;
                  the server checks that the original content matches.
                </span>
                <input
                  id="material-original-file"
                  type="file"
                  accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {stage === "review" && (
              <>
                <section
                  className="lp-material-card"
                  aria-labelledby="material-preview-title"
                >
                  <div className="lp-material-heading">
                    <div>
                      <h2
                        id="material-preview-title"
                        ref={previewHeading}
                        tabIndex={-1}
                      >
                        Check the reading
                      </h2>
                      <p className="lp-material-note">
                        {preview.originalFilename ?? "Pasted text"} ·{" "}
                        {preview.passages.length} passages ·{" "}
                        {preview.characterCount.toLocaleString()} extracted
                        characters
                      </p>
                    </div>
                    <button
                      type="button"
                      className="lp-button"
                      onClick={rejectPreview}
                    >
                      Reject preview
                    </button>
                  </div>
                  <p className="lp-material-note">
                    Read the passages in order. Correct extraction errors or
                    exclude passages before saving. Page and section references
                    describe the original source.
                  </p>
                  {preview.warnings.length > 0 && (
                    <div className="lp-material-notice" role="note">
                      <strong>Check these extraction limits</strong>
                      <ul>
                        {preview.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <ol className="lp-material-passages">
                    {preview.passages.map((passage, index) => {
                      const review = passages[index];
                      if (!review) return null;
                      return (
                        <li
                          key={passage.passage_id}
                          className={
                            review.included
                              ? "lp-material-passage"
                              : "lp-material-passage lp-material-passage-excluded"
                          }
                        >
                          <div className="lp-material-heading">
                            <h3>Passage {index + 1}</h3>
                            <label className="lp-material-check">
                              <input
                                type="checkbox"
                                checked={review.included}
                                onChange={(event) =>
                                  updatePassage(index, {
                                    included: event.target.checked,
                                  })
                                }
                              />
                              <span>Include this passage</span>
                            </label>
                          </div>
                          <p className="lp-material-reference">
                            <code>{passage.passage_id}</code>
                            {passage.page_number !== undefined && (
                              <span>Page {passage.page_number}</span>
                            )}
                            {passage.section && <span>{passage.section}</span>}
                          </p>
                          <label
                            className="lp-field"
                            htmlFor={`material-passage-${index}`}
                          >
                            {review.included
                              ? "Reviewed passage text"
                              : "Excluded passage text"}
                            <textarea
                              id={`material-passage-${index}`}
                              className="lp-input lp-material-passage-text"
                              value={review.text}
                              disabled={!review.included}
                              required={review.included}
                              rows={Math.min(
                                12,
                                Math.max(4, Math.ceil(review.text.length / 95)),
                              )}
                              onChange={(event) =>
                                updatePassage(index, {
                                  text: event.target.value,
                                })
                              }
                            />
                          </label>
                          {review.text !== passage.text && (
                            <details className="lp-material-original">
                              <summary>
                                Compare with original extraction
                              </summary>
                              <p>{passage.text}</p>
                              <button
                                type="button"
                                className="lp-button"
                                onClick={() =>
                                  updatePassage(index, { text: passage.text })
                                }
                              >
                                Undo my correction
                              </button>
                            </details>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  <p className="lp-material-note" aria-live="polite">
                    {includedPassages.length} passages included ·{" "}
                    {reviewedCharacters.toLocaleString()} / 50,000 characters
                  </p>
                  {!reviewIsValid && (
                    <p className="lp-material-error">
                      Include at least one nonempty passage and keep included
                      text within 50,000 characters.
                    </p>
                  )}
                </section>
                <div className="lp-material-actions">
                  <button
                    type="button"
                    className="lp-button lp-button-primary"
                    disabled={!reviewIsValid}
                    onClick={() => setStage("attribution")}
                  >
                    Next: credit and permission →
                  </button>
                  <Link className="lp-button" href="/teacher/lessons">
                    Return to lessons
                  </Link>
                </div>
              </>
            )}

            {stage === "attribution" && (
              <section
                className="lp-material-card"
                aria-labelledby="material-approval-title"
              >
                <h2 id="material-approval-title">Confirm and save privately</h2>
                <p className="lp-material-note">
                  {includedPassages.length} reviewed passages ·{" "}
                  {preview.originalFilename ?? "Pasted text"}. Saving creates a
                  private source version; lesson approval and publication happen
                  later.
                </p>
                <label className="lp-field" htmlFor="material-title">
                  Source title
                  <input
                    id="material-title"
                    className="lp-input"
                    value={title}
                    maxLength={200}
                    required
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setReviewed(false);
                    }}
                  />
                </label>
                <label className="lp-field" htmlFor="material-authors">
                  Author or creator credit
                  <textarea
                    id="material-authors"
                    className="lp-input"
                    value={authors}
                    maxLength={4000}
                    required
                    rows={2}
                    placeholder="One author or creator per line"
                    onChange={(event) => {
                      setAuthors(event.target.value);
                      setPermittedUse(false);
                      setReviewed(false);
                    }}
                  />
                </label>
                <label className="lp-field" htmlFor="material-copyright">
                  Attribution or copyright notice
                  <textarea
                    id="material-copyright"
                    className="lp-input"
                    value={copyright}
                    maxLength={4000}
                    required
                    rows={3}
                    placeholder="Preserve the source's credit and copyright notice"
                    onChange={(event) => {
                      setCopyright(event.target.value);
                      setPermittedUse(false);
                      setReviewed(false);
                    }}
                  />
                </label>
                <label className="lp-field" htmlFor="material-license">
                  License or permission for classroom use
                  <textarea
                    id="material-license"
                    className="lp-input"
                    value={license}
                    maxLength={4000}
                    required
                    rows={2}
                    placeholder="For example: Original teaching notes, created by me"
                    onChange={(event) => {
                      setLicense(event.target.value);
                      setPermittedUse(false);
                      setReviewed(false);
                    }}
                  />
                </label>
                <label className="lp-field" htmlFor="material-url">
                  Source URL (optional)
                  <input
                    id="material-url"
                    className="lp-input"
                    value={sourceUrl}
                    type="url"
                    maxLength={2000}
                    placeholder="https://"
                    onChange={(event) => {
                      setSourceUrl(event.target.value);
                      setPermittedUse(false);
                      setReviewed(false);
                    }}
                  />
                </label>
                <label className="lp-material-check">
                  <input
                    type="checkbox"
                    checked={permittedUse}
                    required
                    onChange={(event) => setPermittedUse(event.target.checked)}
                  />
                  <span>
                    I have permission to use this material and have recorded its
                    attribution.
                  </span>
                </label>
                <label className="lp-material-check">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    required
                    onChange={(event) => setReviewed(event.target.checked)}
                  />
                  <span>
                    I reviewed the included passages, their order, and the
                    available source references.
                  </span>
                </label>
                <p className="lp-material-note">
                  This saves a private source version for later lesson
                  authoring. It does not publish a lesson or assign work to
                  students.
                  {revision &&
                    " Earlier source versions and their references are preserved."}
                </p>
                <div className="lp-material-actions">
                  <button
                    type="submit"
                    className="lp-button lp-button-primary"
                    disabled={
                      !reviewIsValid ||
                      !reviewed ||
                      !permittedUse ||
                      missingOriginalFile ||
                      saveConflict ||
                      historicalRevision
                    }
                  >
                    {pending === "save"
                      ? "Saving private source…"
                      : revision
                        ? "Save new source version"
                        : "Save private source"}
                  </button>
                  <button
                    type="button"
                    className="lp-button"
                    onClick={extendReviewTime}
                    disabled={missingOriginalFile}
                  >
                    {pending === "preview"
                      ? "Extending review time…"
                      : "Extend review time"}
                  </button>
                  <button
                    type="button"
                    className="lp-button"
                    onClick={() => setStage("review")}
                  >
                    ← Previous: check the reading
                  </button>
                </div>
                <p className="lp-material-note">
                  If your preview expires, extend the review time to keep your
                  corrections and attribution.
                </p>
              </section>
            )}
          </fieldset>
        </form>
      )}
    </div>
  );
}
