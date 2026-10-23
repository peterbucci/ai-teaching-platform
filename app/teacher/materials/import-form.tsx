"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  MaterialExtractionPreviewSchema,
  MAX_EXTRACTED_CHARACTERS,
  MAX_MATERIAL_BYTES,
  type MaterialExtractionPreview,
} from "../../../lib/materials/contracts.ts";
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

export function ImportMaterialForm({
  revision,
}: {
  revision?: SourceRevision;
}) {
  const router = useRouter();
  const requestInFlight = useRef(false);
  const previewHeading = useRef<HTMLHeadingElement>(null);
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
  const busy = pending !== null;
  const includedPassages = passages.filter((passage) => passage.included);
  const reviewedCharacters = includedPassages.reduce(
    (total, passage) => total + passage.text.length,
    0,
  );
  const reviewIsValid =
    includedPassages.length > 0 &&
    includedPassages.every((passage) => passage.text.trim().length > 0) &&
    reviewedCharacters <= MAX_EXTRACTED_CHARACTERS;

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
    setPending("preview");
    try {
      const response = await fetch("/api/teacher/materials/preview", {
        method: "POST",
        body: sourceData(),
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
      requestAnimationFrame(() => previewHeading.current?.focus());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The source could not be extracted. Please try again.",
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
    setPreview(null);
    setReceipt("");
    setPassages([]);
    setReviewed(false);
    setError(null);
    setNotice(null);
  }

  async function extendReviewTime() {
    if (requestInFlight.current || !preview || !receipt) return;
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
        cause instanceof Error
          ? cause.message
          : "The review time could not be extended. Your corrections are still here; please try again.",
      );
    } finally {
      requestInFlight.current = false;
      setPending(null);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current || !preview || !receipt) return;
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
      });
      const saved = SaveResponseSchema.safeParse(await responseBody(response));
      if (!saved.success)
        throw new Error(
          "The save response could not be read. Your review is still here; retry to confirm the result.",
        );
      router.push(
        `/teacher/materials/${saved.data.document_id}?version=${saved.data.version}`,
      );
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The material could not be saved. Your review is still here; please try again.",
      );
      requestInFlight.current = false;
      setPending(null);
    }
  }

  return (
    <div className="lp-material-import" aria-busy={busy}>
      <form onSubmit={extract} className="lp-material-card">
        <fieldset disabled={busy || preview !== null}>
          <legend>1. Choose source material</legend>
          <p className="lp-material-note" id="material-limits">
            Paste text, or upload a UTF-8 .txt or .md file or a text-based PDF.
            Maximum file size: 5 MB. Maximum extracted text: 50,000 characters.
            PDFs containing images, including logos, are not supported. Scans,
            password-protected PDFs, Word documents, and slides are not
            supported.
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
                required
                aria-describedby="material-limits material-character-count"
              />
              <span className="lp-material-note" id="material-character-count">
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
        {preview && (
          <p className="lp-material-note">
            The preview belongs to this source. Reject the preview below to
            change or replace it.
          </p>
        )}
      </form>

      {preview && (
        <form onSubmit={save} className="lp-material-review">
          <fieldset disabled={busy}>
            <legend className="lp-material-step-title">
              2. Review extracted passages
            </legend>
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
                Read the passages in order. Correct extraction errors or exclude
                passages before saving. Page and section references describe the
                original source.
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
                            updatePassage(index, { text: event.target.value })
                          }
                        />
                      </label>
                      {review.text !== passage.text && (
                        <details className="lp-material-original">
                          <summary>Compare with original extraction</summary>
                          <p>{passage.text}</p>
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
                  Include at least one nonempty passage and keep included text
                  within 50,000 characters.
                </p>
              )}
            </section>

            <section
              className="lp-material-card"
              aria-labelledby="material-approval-title"
            >
              <h2 id="material-approval-title">
                3. Confirm and save privately
              </h2>
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
                This saves a private source version for later lesson authoring.
                It does not publish a lesson or assign work to students.
                {revision &&
                  " Earlier source versions and their references are preserved."}
              </p>
              <div className="lp-material-actions">
                <button
                  type="submit"
                  className="lp-button lp-button-primary"
                  disabled={!reviewIsValid || !reviewed || !permittedUse}
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
                >
                  {pending === "preview"
                    ? "Extending review time…"
                    : "Extend review time"}
                </button>
              </div>
              <p className="lp-material-note">
                If your preview expires, extend the review time to keep your
                corrections and attribution.
              </p>
              {notice && (
                <p className="lp-material-note" role="status">
                  {notice}
                </p>
              )}
            </section>
          </fieldset>
        </form>
      )}
      {error && (
        <div role="alert" className="lp-material-error lp-material-card">
          {error}
        </div>
      )}
    </div>
  );
}
