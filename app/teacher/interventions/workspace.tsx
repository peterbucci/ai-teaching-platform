"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { TeacherWorkspacePanes } from "../workspace-panes.tsx";
import {
  resolveTeacherWorkspacePane,
  teacherWorkspacePaneHref,
} from "../workspace-panes-model.ts";
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
import {
  browserDirectionStorage,
  clearAcknowledgedDirection,
  directionRecoveryKey,
  readDirection,
  rememberDirection,
} from "./direction-recovery.ts";
import {
  focusInterventionAnchor,
  interventionAnchorTarget,
} from "./evidence-navigation.ts";
import { blockInterventionNavigation } from "./navigation-block.ts";
import { acknowledgedInterventionContext } from "./snapshot-context.ts";

function subscribeToDirection(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function requestUrl(
  requestId: string | null,
  saved?: { draft: InterventionDraft; context: TeacherWorkspaceContext },
  pendingDraftId?: string,
) {
  const url = new URL(window.location.href);
  if (pendingDraftId) url.searchParams.set("generation_draft", pendingDraftId);
  if (requestId) url.searchParams.set("request", requestId);
  else url.searchParams.delete("request");
  if (saved) {
    // A recovered request may have started with stale investigation filters.
    // Replace the whole scope; absent snapshot identities must remain absent.
    url.search =
      teacherWorkspaceHref("/teacher/interventions", saved.context).split(
        "?",
      )[1] ?? "";
    url.searchParams.set("draft", saved.draft.id);
    url.hash = "";
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
  evidenceControls,
}: {
  assignmentId: string;
  actorId: string;
  context: TeacherWorkspaceContext;
  initialEvidence: InterventionEvidence | null;
  initialDraft: InterventionDraft | null;
  initialRequestId: string | null;
  initialDraftId: string | null;
  initialReview: InterventionReview | null;
  evidenceControls: ReactNode;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const search = useSearchParams();
  const initialPane = initialDraft ? "main" : "navigation";
  const activePane = resolveTeacherWorkspacePane(
    search,
    ["navigation", "main", "context"],
    initialPane,
  );
  const layout = useRef<HTMLDivElement>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null);
  const handledFocus = useRef<{ id: string } | null>(null);
  const revealActivity = useCallback((id = "intervention-draft-title") => {
    window.history.replaceState(
      window.history.state,
      "",
      teacherWorkspacePaneHref(
        new URL(window.location.href),
        id === "intervention-edit-actions"
          ? "context"
          : id === "intervention-evidence-title"
            ? "navigation"
            : "main",
      ),
    );
    setFocusRequest({ id });
  }, []);
  const [review, setReview] = useState(initialReview);
  const [editorState, setEditorState] = useState({
    dirty: false,
    busy: Boolean(initialDraft),
  });
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialEvidence?.selection.attempt_ids ?? [],
  );
  const [editedInstructions, setInstructions] = useState<{
    key: string;
    text: string;
  } | null>(null);
  const [pendingId, setPendingId] = useState(initialRequestId);
  const [busy, setBusy] = useState(Boolean(initialRequestId));
  const [notice, setNotice] = useState<string | null>(
    initialRequestId ? "Checking your previous generation request…" : null,
  );
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const draftId = useRef(initialDraft?.id ?? initialDraftId);
  const evidence = draft?.evidence ?? initialEvidence;

  useEffect(() => {
    const attemptIds =
      evidence?.observations.map((item) => item.attempt.id) ?? [];
    const navigate = (hash: string, initial = false) => {
      const id = interventionAnchorTarget(hash, attemptIds);
      if (!id) return;
      // The shared pane controller owns tabs/history. A citation alone may
      // reveal its exact saved response; pane-only history must not reselect it.
      const pane = id === "intervention-draft-title" ? "main" : "navigation";
      if (
        initial &&
        new URLSearchParams(window.location.search).has("workspacePane") &&
        resolveTeacherWorkspacePane(
          new URLSearchParams(window.location.search),
          ["navigation", "main", "context"],
          initialPane,
        ) !== pane
      )
        return;
      window.history.replaceState(
        window.history.state,
        "",
        teacherWorkspacePaneHref(new URL(window.location.href), pane),
      );
      // A fresh request also handles clicking the currently bookmarked hash.
      setFocusRequest({ id });
    };
    let previousHash = window.location.hash;
    const restore = () => {
      if (window.location.hash === previousHash) return;
      previousHash = window.location.hash;
      navigate(previousHash);
    };
    const follow = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
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
        next.origin === window.location.origin &&
        next.pathname === window.location.pathname &&
        next.search === window.location.search &&
        interventionAnchorTarget(next.hash, attemptIds)
      ) {
        event.preventDefault();
        // A new citation is a new history entry; let the shared shell mint
        // its own restoration identity instead of copying the prior one.
        window.history.pushState(null, "", next);
        previousHash = next.hash;
        navigate(next.hash);
      }
    };
    const root = layout.current;
    root?.addEventListener("click", follow);
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    navigate(window.location.hash, true);
    return () => {
      root?.removeEventListener("click", follow);
      window.removeEventListener("hashchange", restore);
      window.removeEventListener("popstate", restore);
    };
  }, [evidence, initialPane]);

  useEffect(() => {
    if (!focusRequest || handledFocus.current === focusRequest) return;
    const target = document.getElementById(focusRequest.id);
    if (
      !target ||
      !layout.current?.contains(target) ||
      !target.getClientRects().length
    )
      return;
    focusInterventionAnchor(
      target,
      target.querySelector<HTMLDetailsElement>(":scope > details"),
    );
    handledFocus.current = focusRequest;
  }, [focusRequest, activePane]);
  const previewCurrent =
    Boolean(draft) ||
    matchesReviewedSelection(
      selectedIds,
      initialEvidence?.selection.attempt_ids ?? [],
    );
  const directionKey = directionRecoveryKey(actorId, {
    assignment_id: assignmentId,
    concept_id: context.concept ?? "",
    origin: context.origin,
    misconception_id: context.misconception ?? null,
    attempt_ids: selectedIds,
  });
  const recoveredDirection = useSyncExternalStore(
    subscribeToDirection,
    () => {
      try {
        return readDirection(browserDirectionStorage(), directionKey);
      } catch {
        return "";
      }
    },
    () => "",
  );
  const instructions =
    editedInstructions?.key === directionKey
      ? editedInstructions.text
      : initialDraft
        ? ""
        : recoveredDirection;
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
        event.defaultPrevented ||
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
      blockInterventionNavigation(
        event,
        link.closest<HTMLDialogElement>("dialog[open]"),
        () => revealActivity("intervention-generation-status"),
      );
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
  }, [pendingId, revealActivity]);

  const acceptReview = useCallback((next: InterventionReview) => {
    setReview(next);
    setDraft(next.draft);
  }, []);

  const acceptResult = useCallback(
    (result: InterventionGenerationResponse) => {
      const params = new URLSearchParams(window.location.search);
      const saved = result.draft
        ? {
            draft: result.draft,
            context: acknowledgedInterventionContext(
              {
                ...Object.fromEntries(params),
                seedAttempt: params.getAll("seedAttempt"),
              },
              result.draft,
              draftId.current,
            ),
          }
        : undefined;
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
      requestUrl(null, saved);
      if (result.status === "completed" && result.draft) {
        clearAcknowledgedDirection(
          browserDirectionStorage(),
          directionKey,
          result.request_id,
        );
        setInstructions({ key: directionKey, text: "" });
        setNotice(
          "AI-generated draft saved privately. Review the activity, source support, and answer guidance.",
        );
        setError(null);
        revealActivity();
      } else {
        setError(
          result.error ??
            "Generation did not produce a valid draft. Your previous valid draft is unchanged.",
        );
        setNotice(null);
      }
    },
    [directionKey, revealActivity],
  );

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
    if (!draft)
      rememberDirection(
        browserDirectionStorage(),
        directionKey,
        instructions,
        requestId,
      );
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

  function reconcileGeneration() {
    if (pendingId) void checkRequest(pendingId);
  }

  function renderWorkspace({
    activity,
    steps,
  }: {
    activity: ReactNode;
    steps: ReactNode;
  }) {
    return (
      <div className="lp-intervention-workspace" ref={layout}>
        <TeacherWorkspacePanes
          initialPane={initialPane}
          navigation={{
            label: "Evidence",
            children: (
              <>
                {evidenceControls}
                {evidence ? (
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
                ) : (
                  <p className="lp-empty-results">
                    Choose a concept with accepted student responses to prepare
                    a review activity.
                  </p>
                )}
              </>
            ),
          }}
          main={{
            label: "Activity",
            children: (
              <section
                className="lp-intervention-panel lp-intervention-activity-pane"
                aria-labelledby="intervention-draft-title"
              >
                <h2 id="intervention-draft-title" tabIndex={-1}>
                  {draft?.activity.title ?? "Prepare a review activity"}
                </h2>
                {!draft && (
                  <p>
                    Prepare a source-grounded activity from the selected
                    reasoning.
                  </p>
                )}
                {!draft && (
                  <p className="lp-intervention-note">
                    This stays private. Generating does not select recipients,
                    approve the activity, or deliver anything.
                  </p>
                )}
                {draft && initialEvidence && (
                  <p className="lp-intervention-meta">
                    Saved evidence: {draft.evidence.counts.selected_responses}{" "}
                    responses from {draft.evidence.counts.selected_students}{" "}
                    students.
                    {draft.evidence.observations.filter(
                      (item) =>
                        !initialEvidence.observations.some(
                          (previous) => previous.attempt.id === item.attempt.id,
                        ),
                    ).length > 0 &&
                      " New accepted responses were included when generation rechecked the evidence. Review the saved scope alongside the activity."}
                  </p>
                )}
                {activity}
                {evidence && (
                  <>
                    {(!draft || draft.status === "private_draft") && (
                      <form
                        className="lp-intervention-section"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void generate();
                        }}
                      >
                        <h3>
                          {draft ? "Request a revision" : "Draft with AI"}
                        </h3>
                        <label className="lp-intervention-field">
                          {draft
                            ? "What should change?"
                            : "Optional teaching direction"}
                          <textarea
                            className="lp-input"
                            value={instructions}
                            onChange={(event) => {
                              setInstructions({
                                key: directionKey,
                                text: event.target.value,
                              });
                              if (!draft) {
                                rememberDirection(
                                  browserDirectionStorage(),
                                  directionKey,
                                  event.target.value,
                                );
                              }
                            }}
                            maxLength={1500}
                            required={Boolean(draft)}
                            disabled={generationLocked}
                            placeholder="For example: use a conceptual comparison and ask students to explain what stays the same."
                          />
                        </label>
                        <p className="lp-intervention-meta">
                          Revisions keep the same recorded evidence and source
                          version. A failed generation preserves the previous
                          saved draft.
                        </p>
                        {!previewCurrent && (
                          <p className="lp-intervention-warning" role="status">
                            Your starting responses changed. Review selected
                            evidence before generating; the server includes
                            related and contrary answers. Each starting
                            selection keeps its own teaching direction in this
                            tab.
                          </p>
                        )}
                        {editorState.dirty && (
                          <p className="lp-intervention-meta">
                            Save or discard your edits before requesting an AI
                            revision.
                          </p>
                        )}
                        <div className="lp-intervention-actions">
                          <button
                            className="lp-button lp-button-primary"
                            disabled={
                              generationLocked ||
                              Boolean(draft && !instructions.trim())
                            }
                            aria-busy={busy}
                          >
                            {busy
                              ? "Working…"
                              : draft
                                ? "Generate revised draft"
                                : "Generate private draft"}
                          </button>
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
                        {(notice || pendingId) && (
                          <div
                            id="intervention-generation-status"
                            tabIndex={-1}
                            className="lp-intervention-note mt-4"
                          >
                            {notice && <p role="status">{notice}</p>}
                            {pendingId && (
                              <button
                                type="button"
                                className="lp-button"
                                disabled={busy}
                                onClick={reconcileGeneration}
                              >
                                Check generation status
                              </button>
                            )}
                          </div>
                        )}
                        {error && (
                          <p role="alert" className="mt-4">
                            {error}
                          </p>
                        )}
                      </form>
                    )}
                    {draft && draft.status !== "private_draft" && pendingId && (
                      <div
                        className="lp-intervention-section"
                        id="intervention-generation-status"
                        tabIndex={-1}
                      >
                        <p className="lp-intervention-meta">
                          An earlier generation request still needs
                          reconciliation. It cannot overwrite this finalized
                          activity.
                        </p>
                        <button
                          type="button"
                          className="lp-button"
                          disabled={busy}
                          onClick={reconcileGeneration}
                        >
                          Check earlier generation status
                        </button>
                        {notice && <p role="status">{notice}</p>}
                        {error && <p role="alert">{error}</p>}
                      </div>
                    )}
                  </>
                )}
              </section>
            ),
          }}
          context={{ label: "Steps", children: steps }}
        />
      </div>
    );
  }

  return draft ? (
    <InterventionEditor
      key={`${draft.id}:${draft.revision}`}
      actorId={actorId}
      draft={draft}
      initialReview={review}
      disabled={locked}
      onReview={acceptReview}
      onStateChange={setEditorState}
      onNavigationBlocked={revealActivity}
      renderWorkspace={renderWorkspace}
    />
  ) : (
    renderWorkspace({
      activity: null,
      steps: (
        <ol className="lp-intervention-steps">
          <li>
            <h3>Choose the answers to use</h3>
            <p>
              {evidence
                ? `${evidence.counts.selected_responses} responses from ${evidence.counts.selected_students} students reviewed.`
                : "Select accepted evidence in Evidence."}
            </p>
          </li>
          <li>
            <h3>Write and save the draft</h3>
            <p>
              {pendingId
                ? "Generation outcome unconfirmed. Check its status in Activity."
                : "Generate a private draft in Activity after reviewing the evidence."}
            </p>
          </li>
          <li>
            <h3>Choose the students</h3>
            <p>
              Available after a private draft is saved. Evidence selection does
              not select recipients.
            </p>
          </li>
          <li>
            <h3>Approve the saved revision</h3>
            <p>Teacher review required.</p>
          </li>
          <li>
            <h3>Deliver to students</h3>
            <p>Requires separate approval. Nothing has been delivered.</p>
          </li>
          <li>
            <h3>Read follow-up answers</h3>
            <p>Available after delivery.</p>
          </li>
        </ol>
      ),
    })
  );
}
