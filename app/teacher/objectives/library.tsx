"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { requestedApprovedSource } from "./draft-recovery.ts";
import {
  ObjectiveLibrarySchema,
  ObjectiveEditorSchema,
  ObjectiveRequestError,
  objectiveRequest,
  errorMessage,
} from "./client-contracts.ts";

const PendingCreationSchema = z.strictObject({
  requestId: z.uuid(),
  title: z.string().min(1).max(300),
  sourceKey: z.string().min(1),
});

export function ObjectiveLibrary({
  sourceId,
  sourceVersion,
  compact = false,
}: {
  sourceId?: string;
  sourceVersion?: string;
  compact?: boolean;
}) {
  const [library, setLibrary] = useState<z.infer<
    typeof ObjectiveLibrarySchema
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [sourceKey, setSourceKey] = useState("");
  const requestId = useRef<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    objectiveRequest(
      "/api/teacher/objectives",
      ObjectiveLibrarySchema,
      "GET",
      undefined,
      controller.signal,
    )
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setLibrary(loaded);
        const requested = requestedApprovedSource(
          loaded.sources,
          sourceId,
          sourceVersion,
        );
        if (requested) {
          setSourceKey(`${requested.document_id}:${requested.version}`);
          setTitle(requested.attribution.title);
        } else if (sourceId || sourceVersion) {
          setNotice(
            "The linked source version is not available as approved material. Choose an approved source below or return to material review.",
          );
        }
        try {
          const raw = sessionStorage.getItem("objective-pending-creation");
          const pending = raw
            ? PendingCreationSchema.safeParse(JSON.parse(raw))
            : null;
          if (
            pending?.success &&
            loaded.sources.some(
              (source) =>
                source.review_status === "approved" &&
                `${source.document_id}:${source.version}` ===
                  pending.data.sourceKey,
            )
          ) {
            requestId.current = pending.data.requestId;
            setTitle(pending.data.title);
            setSourceKey(pending.data.sourceKey);
            setRetrying(true);
            setNotice(
              "An earlier draft creation has an unconfirmed result. Retry the same request to safely recover it before starting another draft.",
            );
          }
        } catch {
          /* No usable recovery copy; available sources still load. */
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [sourceId, sourceVersion]);

  const sources =
    library?.sources.filter((source) => source.review_status === "approved") ??
    [];
  const selected = sources.find(
    (source) => `${source.document_id}:${source.version}` === sourceKey,
  );

  async function create() {
    if (busy || !selected) return;
    setBusy(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    try {
      sessionStorage.setItem(
        "objective-pending-creation",
        JSON.stringify({ requestId: requestId.current, title, sourceKey }),
      );
    } catch {
      setNotice(
        "This browser cannot preserve a pending request after refresh. Keep this page open until creation is confirmed.",
      );
    }
    try {
      const state = await objectiveRequest(
        "/api/teacher/objectives",
        ObjectiveEditorSchema,
        "POST",
        {
          request_id: requestId.current,
          title,
          source_id: selected.document_id,
          source_version: selected.version,
        },
      );
      try {
        sessionStorage.removeItem("objective-pending-creation");
      } catch {
        /* The server confirmed the draft. */
      }
      router.push(`/teacher/objectives/${state.lesson.id}`);
    } catch (err) {
      const uncertain =
        !(err instanceof ObjectiveRequestError) || err.status >= 500;
      setRetrying(uncertain);
      if (!uncertain) {
        requestId.current = null;
        try {
          sessionStorage.removeItem("objective-pending-creation");
        } catch {
          /* Keep visible error. */
        }
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`lp-objectives ${compact ? "lo-preparation" : "lo-objective-library"}`}
    >
      {notice && (
        <p className="lo-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="lo-notice lo-warning">
          {error}{" "}
          {error.startsWith("Your sign-in") && (
            <Link href="/login">Sign in</Link>
          )}
        </p>
      )}
      {!library && !error && (
        <p role="status">Loading your drafts and approved material…</p>
      )}
      {library && (
        <>
          <section
            className="lp-panel lo-create"
            aria-labelledby="new-objectives-heading"
          >
            <div>
              <p className="lp-eyebrow">Start a lesson draft</p>
              <h2 id="new-objectives-heading">Choose the material</h2>
              <p className="lp-panel-description">
                Start with reviewed material and define what students should be
                able to do. This creates a reusable lesson, ready for multiple
                objectives and questions.
              </p>
            </div>
            {sources.length ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void create();
                }}
              >
                <label className="lp-field">
                  Lesson title
                  <input
                    className="lp-input"
                    value={title}
                    maxLength={300}
                    required
                    disabled={busy || retrying}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="For example, Water changing state"
                  />
                </label>
                <label className="lp-field">
                  Approved material
                  <select
                    className="lp-input"
                    required
                    value={sourceKey}
                    disabled={busy || retrying}
                    onChange={(event) => setSourceKey(event.target.value)}
                  >
                    <option value="">Choose a source</option>
                    {sources.map((source) => (
                      <option
                        key={`${source.document_id}:${source.version}`}
                        value={`${source.document_id}:${source.version}`}
                      >
                        {source.attribution.title} · version {source.version}
                      </option>
                    ))}
                  </select>
                </label>
                {selected && (
                  <p className="lo-muted">
                    {selected.passages.length} reviewed passages ·{" "}
                    {selected.file_name}
                    {" · "}
                    <Link
                      href={`/teacher/materials/${encodeURIComponent(selected.document_id)}?version=${selected.version}`}
                    >
                      Review this source version
                    </Link>
                  </p>
                )}
                <button
                  className="lp-button lp-button-primary"
                  disabled={busy || !selected || !title.trim()}
                  aria-busy={busy}
                >
                  {busy
                    ? "Creating draft…"
                    : retrying
                      ? "Retry creating this draft"
                      : "Create lesson and write objectives"}
                </button>
                {retrying && (
                  <p className="lo-muted">
                    Retry uses the same request so a saved draft is recovered
                    safely.
                  </p>
                )}
              </form>
            ) : (
              <p className="lo-notice">
                No approved source material is available yet. Import and review
                your material first; then return here to write objectives.{" "}
                <Link href="/teacher/materials">Open teaching material</Link>
              </p>
            )}
          </section>
          {!compact && (
            <section className="lo-library" aria-labelledby="drafts-heading">
              <div className="lo-section-heading">
                <h2 id="drafts-heading">Resume objective review</h2>
                <span className="lo-muted">{library.drafts.length} drafts</span>
              </div>
              {library.drafts.length ? (
                <div className="lo-draft-list">
                  {library.drafts.map((lesson) => (
                    <Link
                      className="lp-panel lo-draft-link"
                      href={`/teacher/objectives/${lesson.id}`}
                      key={lesson.id}
                    >
                      <div>
                        <h3>{lesson.title}</h3>
                        <p className="lo-muted">
                          {lesson.draft.objective_workflow?.items.length ?? 0}{" "}
                          objectives · draft revision {lesson.revision}
                        </p>
                      </div>
                      <span
                        className={`lp-badge ${lesson.draft.objective_workflow?.reviewed ? "" : "lp-badge-neutral"}`}
                      >
                        {lesson.draft.objective_workflow?.reviewed
                          ? "Objectives approved"
                          : "Needs review"}
                      </span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="lo-notice">
                  Your first objectives draft will appear here.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
