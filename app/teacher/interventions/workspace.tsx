"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { z } from "zod";
import type { InterventionReview } from "../../../lib/interventions/approval-contracts.ts";
import type { InterventionEvidence } from "../../../lib/interventions/contracts.ts";
import {
  InterventionGenerationResponseSchema,
  type InterventionDraft,
  type InterventionGenerationRequest,
  type InterventionGenerationResponse,
} from "../../../lib/interventions/drafts.ts";
import { EvidenceReview } from "./review.tsx";
import { InterventionEditor } from "./editor.tsx";
import {
  teacherWorkspaceHref,
  type TeacherWorkspaceContext,
} from "../../../lib/teacher/workspace-contracts.ts";
import {
  interventionPreviewHref,
  matchesReviewedSelection,
} from "./handoff.ts";

function subscribeToDirection(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function requestUrl(
  requestId: string | null,
  draft?: InterventionDraft,
  pendingDraftId?: string,
) {
  const url = new URL(window.location.href);
  if (pendingDraftId) url.searchParams.set("generation_draft", pendingDraftId);
  if (requestId) url.searchParams.set("request", requestId);
  else url.searchParams.delete("request");
  if (draft) {
    url.searchParams.delete("generation_draft");
    url.searchParams.set("draft", draft.id);
    url.searchParams.set("concept", draft.evidence.selection.concept_id);
    if (draft.evidence.selection.misconception_id)
      url.searchParams.set(
        "misconception",
        draft.evidence.selection.misconception_id,
      );
    else url.searchParams.delete("misconception");
    url.searchParams.set("origin", draft.evidence.selection.origin);
  }
  window.history.replaceState(null, "", url);
}

export function InterventionWorkspace({
  assignmentId,
  actorId,
  context,
  initialEvidence,
  initialDraft,
  initialRequestId,
  initialDraftId,
  initialReview,
}: {
  assignmentId: string;
  actorId: string;
  context: TeacherWorkspaceContext;
  initialEvidence: InterventionEvidence | null;
  initialDraft: InterventionDraft | null;
  initialRequestId: string | null;
  initialDraftId: string | null;
  initialReview: InterventionReview | null;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [mobilePane, setMobilePane] = useState<"evidence" | "activity">(
    initialDraft ? "activity" : "evidence",
  );
  const revealActivity = useCallback(() => setMobilePane("activity"), []);
  const [review, setReview] = useState(initialReview);
  const [editorState, setEditorState] = useState({
    dirty: false,
    busy: Boolean(initialDraft),
  });
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialEvidence?.selection.attempt_ids ?? [],
  );
  const [editedInstructions, setInstructions] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState(initialRequestId);
  const [busy, setBusy] = useState(Boolean(initialRequestId));
  const [notice, setNotice] = useState<string | null>(
    initialRequestId ? "Checking your previous generation request…" : null,
  );
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const draftId = useRef(initialDraft?.id ?? initialDraftId);
  const evidence = draft?.evidence ?? initialEvidence;
  const previewCurrent =
    Boolean(draft) ||
    matchesReviewedSelection(
      selectedIds,
      initialEvidence?.selection.attempt_ids ?? [],
    );
  const directionKey = `learning-pulse:intervention-direction:${actorId}:${assignmentId}:${context.concept ?? ""}`;
  const recoveredDirection = useSyncExternalStore(
    subscribeToDirection,
    () => {
      try {
        return sessionStorage.getItem(directionKey) ?? "";
      } catch {
        return "";
      }
    },
    () => "",
  );
  const instructions =
    editedInstructions ?? (initialDraft ? "" : recoveredDirection);
  const locked = busy || pendingId !== null;
  const generationLocked =
    locked ||
    !previewCurrent ||
    editorState.dirty ||
    editorState.busy ||
    (draft !== null && draft.status !== "private_draft");

  useEffect(() => {
    if (!pendingId) return;
    const preventLoss = (event: BeforeUnloadEvent) => event.preventDefault();
    const guardLink = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const next = new URL(link.href, window.location.href);
      if (
        next.pathname === window.location.pathname &&
        next.search === window.location.search
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setMobilePane("activity");
      setNotice(
        "Check this generation request before leaving. Its outcome is still unconfirmed; opening another page must not start it again.",
      );
    };
    window.addEventListener("beforeunload", preventLoss);
    window.addEventListener("click", guardLink, true);
    return () => {
      window.removeEventListener("beforeunload", preventLoss);
      window.removeEventListener("click", guardLink, true);
    };
  }, [pendingId]);

  const acceptReview = useCallback((next: InterventionReview) => {
    setReview(next);
    setDraft(next.draft);
  }, []);

  const acceptResult = useCallback((result: InterventionGenerationResponse) => {
    if (result.draft) {
      const next = result.draft;
      setReview(null);
      setDraft((current) =>
        !current || next.revision > current.revision ? next : current,
      );
      draftId.current = next.id;
    }
    if (result.status === "pending") {
      setPendingId(result.request_id);
      setNotice(
        "Generation is still pending. Check its status to retrieve the result; checking does not ask AI to generate again.",
      );
      return;
    }
    setPendingId(null);
    requestUrl(null, result.draft ?? undefined);
    if (result.status === "completed") {
      setInstructions("");
      setNotice(
        "AI-generated draft saved privately. Review the activity, source support, and answer guidance.",
      );
      setError(null);
    } else {
      setError(
        result.error ??
          "Generation did not produce a valid draft. Your previous valid draft is unchanged.",
      );
      setNotice(null);
    }
  }, []);

  useEffect(() => {
    if (!draft) return;
    try {
      sessionStorage.removeItem(directionKey);
    } catch {
      /* Recovery is optional. */
    }
  }, [directionKey, draft]);

  const missingRequest = useCallback(() => {
    setPendingId(null);
    requestUrl(null);
    setNotice(null);
    setError(
      "No saved generation request was found. Your previous valid draft is unchanged. You can explicitly start a new generation.",
    );
  }, []);
  const checkRequest = useCallback(
    async (requestId: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          assignment: assignmentId,
          request: requestId,
        });
        const response = await fetch(`/api/teacher/interventions?${params}`, {
          cache: "no-store",
        });
        const payload: unknown = await response.json();
        const failure = z.object({ error: z.string() }).safeParse(payload);
        if (
          response.status === 404 &&
          failure.success &&
          failure.data.error === "Generation request not found."
        ) {
          missingRequest();
          return;
        }
        const parsed = InterventionGenerationResponseSchema.safeParse(payload);
        if (
          !response.ok ||
          !parsed.success ||
          parsed.data.request_id !== requestId
        )
          throw new Error(
            "The request status could not be verified. Your previous draft is still available. Check again before starting another generation.",
          );
        acceptResult(parsed.data);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to check generation status.",
        );
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    },
    [acceptResult, assignmentId, missingRequest],
  );

  useEffect(() => {
    if (!initialRequestId) return;
    let active = true;
    inFlight.current = true;
    const params = new URLSearchParams({
      assignment: assignmentId,
      request: initialRequestId,
    });
    // Resume with a read only. Mounting or refreshing must never generate.
    void fetch(`/api/teacher/interventions?${params}`, { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        const failure = z.object({ error: z.string() }).safeParse(payload);
        if (
          response.status === 404 &&
          failure.success &&
          failure.data.error === "Generation request not found."
        ) {
          if (active) missingRequest();
          return;
        }
        const parsed = InterventionGenerationResponseSchema.safeParse(payload);
        if (
          !response.ok ||
          !parsed.success ||
          parsed.data.request_id !== initialRequestId
        )
          throw new Error(
            "The request status could not be verified. Check its status before starting another generation.",
          );
        if (active) acceptResult(parsed.data);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to check generation status.",
          );
      })
      .finally(() => {
        if (active) {
          setBusy(false);
          inFlight.current = false;
        }
      });
    return () => {
      active = false;
    };
  }, [acceptResult, assignmentId, initialRequestId, missingRequest]);

  async function generate() {
    if (!evidence || generationLocked || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(
      "AI is drafting from the selected evidence and approved source passages…",
    );
    const requestId = crypto.randomUUID();
    draftId.current ??= crypto.randomUUID();
    const request: InterventionGenerationRequest = {
      request_id: requestId,
      draft_id: draftId.current,
      expected_revision: draft?.revision ?? 0,
      selection: draft?.evidence.selection ?? {
        ...evidence.selection,
        attempt_ids: selectedIds,
      },
      revision_instructions: instructions,
    };
    setPendingId(requestId);
    requestUrl(requestId, undefined, draftId.current);
    try {
      const response = await fetch("/api/teacher/interventions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload: unknown = await response.json();
      const parsed = InterventionGenerationResponseSchema.safeParse(payload);
      if (parsed.success && parsed.data.request_id === requestId) {
        acceptResult(parsed.data);
      } else if (response.status >= 400 && response.status < 500) {
        const message = z.object({ error: z.string() }).safeParse(payload);
        setPendingId(null);
        requestUrl(null);
        setNotice(null);
        setError(
          message.success
            ? message.data.error
            : "The request was rejected. Review the selected evidence and current saved revision before trying again.",
        );
      } else {
        throw new Error(
          "The generation outcome could not be confirmed. Check the request status before starting another generation.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to verify generation.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  if (!evidence)
    return (
      <p className="lp-empty-results">
        Choose a concept with accepted student responses to prepare a review
        activity.
      </p>
    );

  return (
    <div className="lp-intervention-layout">
      <div
        className="lp-intervention-mobile-tabs"
        role="group"
        aria-label="Intervention workspace"
      >
        <button
          type="button"
          className="lp-button"
          aria-pressed={mobilePane === "evidence"}
          onClick={() => setMobilePane("evidence")}
        >
          Evidence used
        </button>
        <button
          type="button"
          className="lp-button"
          aria-pressed={mobilePane === "activity"}
          onClick={() => setMobilePane("activity")}
        >
          Activity
        </button>
      </div>
      <div
        className="lp-intervention-evidence-pane"
        data-active={mobilePane === "evidence"}
      >
        <EvidenceReview
          evidence={evidence}
          context={context}
          selectedIds={selectedIds}
          locked={locked}
          previewCurrent={previewCurrent}
          reviewHref={interventionPreviewHref(context, selectedIds)}
          onToggle={
            draft
              ? undefined
              : (id) =>
                  setSelectedIds((current) =>
                    current.includes(id)
                      ? current.filter((item) => item !== id)
                      : current.length < 60
                        ? [...current, id]
                        : current,
                  )
          }
        />
      </div>
      <section
        className="lp-panel lp-intervention-panel lp-intervention-activity-pane"
        data-active={mobilePane === "activity"}
        aria-labelledby="intervention-draft-title"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="lp-badge lp-badge-neutral">
            Teacher-controlled intervention
          </span>
        </div>
        <h2 id="intervention-draft-title">
          {draft ? "Review the proposed activity" : "Prepare a review activity"}
        </h2>
        <p>
          {draft
            ? "Review the evidence, refine the activity, and choose who should receive it. Approval and delivery are separate teacher decisions."
            : "Ask AI to create a source-grounded explanation, targeted practice, and a fresh check from this recorded reasoning."}
        </p>
        {!draft && (
          <p className="lp-intervention-note">
            This stays private. Generating does not select recipients, approve
            the activity, or deliver anything.
          </p>
        )}
        {draft && initialEvidence && (
          <p className="lp-intervention-meta">
            Saved evidence: {draft.evidence.counts.selected_responses} responses
            from {draft.evidence.counts.selected_students} students.
            {draft.evidence.observations.filter(
              (item) =>
                !initialEvidence.observations.some(
                  (previous) => previous.attempt.id === item.attempt.id,
                ),
            ).length > 0 &&
              " New accepted responses were included when generation rechecked the evidence. Review the saved scope alongside the activity."}
          </p>
        )}
        {draft && (
          <InterventionEditor
            key={`${draft.id}:${draft.revision}`}
            actorId={actorId}
            draft={draft}
            initialReview={review}
            disabled={locked}
            onReview={acceptReview}
            onStateChange={setEditorState}
            onNavigationBlocked={revealActivity}
          />
        )}
        {(!draft || draft.status === "private_draft") && (
          <form
            className="lp-intervention-section"
            onSubmit={(event) => {
              event.preventDefault();
              void generate();
            }}
          >
            <h3>{draft ? "Request a revision" : "Draft with AI"}</h3>
            <label className="lp-intervention-field">
              {draft ? "What should change?" : "Optional teaching direction"}
              <textarea
                className="lp-input"
                value={instructions}
                onChange={(event) => {
                  setInstructions(event.target.value);
                  if (!draft) {
                    try {
                      sessionStorage.setItem(directionKey, event.target.value);
                    } catch {
                      /* Recovery is optional. */
                    }
                  }
                }}
                maxLength={1500}
                required={Boolean(draft)}
                disabled={generationLocked}
                placeholder="For example: use a conceptual comparison and ask students to explain what stays the same."
              />
            </label>
            <p className="lp-intervention-meta">
              Revisions keep the same recorded evidence and source version. A
              failed generation preserves the previous saved draft.
            </p>
            {!previewCurrent && (
              <p className="lp-intervention-warning" role="status">
                Your starting responses changed. Review selected evidence before
                generating; the server includes related and contrary answers.
                Your teaching direction is kept in this tab.
              </p>
            )}
            {editorState.dirty && (
              <p className="lp-intervention-meta">
                Save or discard your edits before requesting an AI revision.
              </p>
            )}
            <div className="lp-intervention-actions">
              <button
                className="lp-button lp-button-primary"
                disabled={
                  generationLocked || Boolean(draft && !instructions.trim())
                }
                aria-busy={busy}
              >
                {busy
                  ? "Working…"
                  : draft
                    ? "Generate revised draft"
                    : "Generate private draft"}
              </button>
              {pendingId && (
                <button
                  type="button"
                  className="lp-button"
                  disabled={busy}
                  onClick={() => void checkRequest(pendingId)}
                >
                  Check generation status
                </button>
              )}
              {draft && !locked && (
                <a
                  className="lp-text-link"
                  href={teacherWorkspaceHref(
                    "/teacher/interventions",
                    context,
                    {
                      origin: evidence.selection.origin,
                      concept: evidence.selection.concept_id,
                      seedAttempt: [],
                    },
                  )}
                >
                  Start a separate draft
                </a>
              )}
            </div>
            {notice && (
              <p role="status" className="lp-intervention-note mt-4">
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-4">
                {error}
              </p>
            )}
          </form>
        )}
        {draft && draft.status !== "private_draft" && pendingId && (
          <div className="lp-intervention-section">
            <p className="lp-intervention-meta">
              An earlier generation request still needs reconciliation. It
              cannot overwrite this finalized activity.
            </p>
            <button
              type="button"
              className="lp-button"
              disabled={busy}
              onClick={() => void checkRequest(pendingId)}
            >
              Check earlier generation status
            </button>
            {notice && <p role="status">{notice}</p>}
            {error && <p role="alert">{error}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
