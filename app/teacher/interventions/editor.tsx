"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import {
  InterventionActionSchema,
  InterventionReviewSchema,
  toStudentInterventionActivity,
  type InterventionAction,
  type InterventionReview,
} from "../../../lib/interventions/approval-contracts.ts";
import {
  InterventionActivitySchema,
  type InterventionActivity,
} from "../../../lib/interventions/contracts.ts";
import type { InterventionDraft } from "../../../lib/interventions/drafts.ts";
import { InterventionActivityView } from "../../components/intervention-activity.tsx";
import { ActivityEditor } from "./activity-editor.tsx";
import { ActivityReview } from "./review.tsx";
import { InterventionFollowup } from "./followup.tsx";
import { blockInterventionNavigation } from "./navigation-block.ts";
import { interventionTimestamp } from "./timestamp.ts";

// Local recovery accepts unfinished text; only the server accepts saved work.
const recoveryQuestion =
  InterventionActivitySchema.shape.fresh_check.safeExtend({
    prompt_text: z.string(),
    source_passage_ids: z.array(z.string()),
    rubric: InterventionActivitySchema.shape.fresh_check.shape.rubric.extend({
      answer_guidance: z.string(),
      criteria: z.array(z.string()),
      acceptable_variations: z.array(z.string()),
      partial_credit_guidance: z.string().nullable(),
    }),
  });
const recoveryActivity = InterventionActivitySchema.extend({
  title: z.string(),
  explanation: z.string(),
  exercise_text: z.string(),
  practice_questions: z.array(recoveryQuestion),
  fresh_check: recoveryQuestion,
  source_references: z.array(
    z.object({ passage_id: z.string(), quote: z.string() }),
  ),
});
const recoveryAction = z.discriminatedUnion("action", [
  InterventionActionSchema.options[0].extend({ activity: recoveryActivity }),
  InterventionActionSchema.options[1],
  InterventionActionSchema.options[2],
  InterventionActionSchema.options[3],
]);
const RecoverySchema = z.object({
  revision: z.number().int().positive(),
  activity: recoveryActivity,
  recipients: z.array(z.uuid()),
  pending: recoveryAction.nullable(),
});
type Recovery = z.infer<typeof RecoverySchema>;

function remember(actorId: string, draftId: string, value: Recovery | null) {
  try {
    const key = `learning-pulse:intervention:${actorId}:${draftId}`;
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch {
    // The server still owns saved revisions; beforeunload protects unsaved work.
  }
}

function savedWork(actorId: string, draftId: string) {
  try {
    const key = `learning-pulse:intervention:${actorId}:${draftId}`;
    const legacyKey = `learning-pulse:intervention:${draftId}`;
    // Called only after the server confirms this actor owns the saved draft.
    // Preserve an older recovery copy while moving it into the actor scope.
    const raw =
      sessionStorage.getItem(key) ?? sessionStorage.getItem(legacyKey);
    if (!raw) return null;
    const parsed = RecoverySchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      sessionStorage.setItem(key, raw);
      sessionStorage.removeItem(legacyKey);
    }
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const sameActivity = (a: InterventionActivity, b: InterventionActivity) =>
  JSON.stringify(a) === JSON.stringify(b);

function CompletedStage({
  title,
  status,
  headingId,
  children,
}: {
  title: string;
  status: string;
  headingId?: string;
  children: ReactNode;
}) {
  return (
    <details className="lp-intervention-completed-stage">
      <summary>
        <h3 id={headingId}>{title}</h3>
        <span>{status}</span>
      </summary>
      <div>{children}</div>
    </details>
  );
}

export function InterventionEditor({
  actorId,
  draft,
  initialReview,
  disabled,
  onReview,
  onStateChange,
  onNavigationBlocked,
  renderWorkspace,
}: {
  actorId: string;
  draft: InterventionDraft;
  initialReview: InterventionReview | null;
  disabled: boolean;
  onReview: (review: InterventionReview) => void;
  onStateChange: (state: { dirty: boolean; busy: boolean }) => void;
  onNavigationBlocked: (targetId?: string) => void;
  renderWorkspace: (panes: {
    activity: ReactNode;
    steps: ReactNode;
  }) => ReactNode;
}) {
  const [review, setReview] = useState(initialReview);
  const [activity, setActivity] = useState(draft.activity);
  const [recipients, setRecipients] = useState<string[]>(
    initialReview?.approval?.recipient_ids ?? [],
  );
  const [tab, setTab] = useState<"edit" | "student" | "teacher">("student");
  const [busy, setBusy] = useState(true);
  const [pending, setPending] = useState<InterventionAction | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [navigationBlocked, setNavigationBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  // Refresh may update review, but must never rebase unsaved text onto it.
  const editBaseRevision = useRef(draft.revision);
  const currentDraft = review?.draft ?? draft;
  const editable = currentDraft.status === "private_draft";
  const dirty = !sameActivity(activity, currentDraft.activity);
  const locked = disabled || busy || pending !== null || conflict || !editable;

  useEffect(() => {
    onStateChange({ dirty, busy: busy || pending !== null || conflict });
  }, [busy, conflict, dirty, onStateChange, pending]);

  useEffect(() => {
    if (!dirty && !pending) return;
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
        () => onNavigationBlocked("intervention-navigation-notice"),
      );
      setNavigationBlocked(true);
      setNotice(
        pending
          ? "Check the pending action before leaving. Its request identity is kept in this tab; approval or delivery must not be repeated as a new action."
          : "Save or discard your changes before leaving this activity. Your unsaved text is kept in this tab.",
      );
    };
    window.addEventListener("beforeunload", preventLoss);
    window.addEventListener("click", guardLink, true);
    return () => {
      window.removeEventListener("beforeunload", preventLoss);
      window.removeEventListener("click", guardLink, true);
    };
  }, [dirty, onNavigationBlocked, pending]);

  useEffect(() => {
    let active = true;
    // Recover with a read, never an automatic approval, delivery or paid call.
    void fetch(`/api/teacher/interventions/${draft.id}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("The current saved revision could not be loaded.");
        const latest = InterventionReviewSchema.parse(await response.json());
        if (!active) return;
        const local = savedWork(actorId, draft.id);
        setReview(latest);
        if (
          local &&
          (local.pending ||
            !sameActivity(local.activity, latest.draft.activity))
        ) {
          setActivity(local.activity);
          editBaseRevision.current = local.revision;
          setRecipients(local.recipients);
          setPending(local.pending);
          setConflict(
            local.revision !== latest.draft.revision && !local.pending,
          );
          setNotice(
            local.pending
              ? "A previous action has an unconfirmed response. Retry that same request to recover its recorded result safely."
              : "Your unsaved edits were recovered in this tab. Review them before saving.",
          );
        } else {
          setActivity(latest.draft.activity);
          editBaseRevision.current = latest.draft.revision;
          setRecipients(
            latest.approval?.recipient_ids ?? local?.recipients ?? [],
          );
          onReview(latest);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setConflict(true);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load saved activity.",
          );
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [actorId, draft.id, onReview]);

  function edit(next: InterventionActivity) {
    if (!dirty) editBaseRevision.current = currentDraft.revision;
    setActivity(next);
    remember(actorId, draft.id, {
      revision: editBaseRevision.current,
      activity: next,
      recipients,
      pending: null,
    });
    setNotice(null);
  }

  function select(next: string[]) {
    setRecipients(next);
    remember(actorId, draft.id, {
      revision: dirty ? editBaseRevision.current : currentDraft.revision,
      activity,
      recipients: next,
      pending: null,
    });
  }

  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/teacher/interventions/${draft.id}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok)
        throw new Error("Unable to read the latest saved activity.");
      const latest = InterventionReviewSchema.parse(await response.json());
      setReview(latest);
      setConflict(latest.draft.revision !== editBaseRevision.current && dirty);
      if (!dirty && !pending) {
        setActivity(latest.draft.activity);
        editBaseRevision.current = latest.draft.revision;
        setRecipients(latest.approval?.recipient_ids ?? recipients);
        onReview(latest);
      }
      setNotice(
        "Latest saved state loaded. Your unsaved text has been kept; discard it only when you are ready to use the saved version.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to refresh saved activity.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  async function apply(action: InterventionAction) {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setPending(action);
    remember(actorId, draft.id, {
      revision: action.expected_revision,
      activity,
      recipients,
      pending: action,
    });
    try {
      const response = await fetch(`/api/teacher/interventions/${draft.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
        signal: AbortSignal.timeout(20_000),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const failure = z.object({ error: z.string() }).safeParse(payload);
        if (response.status >= 400 && response.status < 500) {
          setPending(null);
          remember(actorId, draft.id, {
            revision: action.expected_revision,
            activity,
            recipients,
            pending: null,
          });
          if (response.status === 409) setConflict(true);
        }
        throw new Error(
          failure.success
            ? failure.data.error
            : "The action could not be confirmed. Retry the same request to recover its saved result.",
        );
      }
      const next = InterventionReviewSchema.parse(payload);
      setReview(next);
      setActivity(next.draft.activity);
      editBaseRevision.current = next.draft.revision;
      setPending(null);
      setConflict(false);
      setRecipients(next.approval?.recipient_ids ?? recipients);
      remember(
        actorId,
        draft.id,
        action.action === "save"
          ? {
              revision: next.draft.revision,
              activity: next.draft.activity,
              recipients,
              pending: null,
            }
          : null,
      );
      setNotice(
        action.action === "save"
          ? "Your changes are saved as a new private revision."
          : action.action === "approve"
            ? "This exact revision and recipient list are approved. Delivery is a separate action below."
            : action.action === "deliver"
              ? "The approved activity is now available to the selected students."
              : "Draft dismissed. Original evidence and revision history are preserved.",
      );
      onReview(next);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The outcome could not be confirmed. Retry the same request.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  function base() {
    return {
      request_id: crypto.randomUUID(),
      expected_revision: dirty
        ? editBaseRevision.current
        : currentDraft.revision,
    };
  }

  function discard() {
    if (!review) return;
    setActivity(review.draft.activity);
    editBaseRevision.current = review.draft.revision;
    setRecipients(review.approval?.recipient_ids ?? []);
    setConflict(false);
    setError(null);
    remember(actorId, draft.id, null);
    setNotice(
      "Unsaved edits discarded. You are viewing the latest loaded saved revision.",
    );
    onReview(review);
  }

  const recipientNames =
    review?.eligible_recipients.filter((recipient) =>
      recipients.includes(recipient.student_id),
    ) ?? [];
  let studentActivity = null;
  try {
    studentActivity = toStudentInterventionActivity(activity);
  } catch {
    // Incomplete local text is editable and recoverable, but cannot be delivered.
  }
  const activityPane = (
    <div className="lp-intervention-editor-workspace">
      {notice && (
        <div
          id="intervention-navigation-notice"
          tabIndex={-1}
          role="status"
          className="lp-intervention-note"
        >
          <p>{notice}</p>
          {navigationBlocked && (dirty || pending) && (
            <button
              type="button"
              className="lp-button"
              disabled={busy}
              onClick={() => {
                if (!pending) setTab("edit");
                onNavigationBlocked(
                  pending
                    ? "intervention-pending-action"
                    : "intervention-edit-actions",
                );
              }}
            >
              {pending
                ? "Review pending action"
                : "Review save and discard controls"}
            </button>
          )}
        </div>
      )}
      <div className="lp-intervention-tabs" aria-label="Activity views">
        {editable && (
          <button
            type="button"
            aria-pressed={tab === "edit"}
            onClick={() => setTab("edit")}
          >
            Edit activity
          </button>
        )}
        <button
          type="button"
          aria-pressed={tab === "student"}
          onClick={() => setTab("student")}
        >
          Student preview
        </button>
        <button
          type="button"
          aria-pressed={tab === "teacher"}
          onClick={() => setTab("teacher")}
        >
          Teacher-only review
        </button>
      </div>
      {editable && (
        <form
          id="intervention-edit-form"
          tabIndex={-1}
          hidden={tab !== "edit"}
          onInvalidCapture={(event) => {
            // The save button is in Steps, so reveal Activity before asking
            // the teacher to complete a field in its otherwise hidden form.
            event.preventDefault();
            if (event.target instanceof HTMLElement) {
              const details = event.target.closest("details");
              if (details) details.open = true;
            }
            setTab("edit");
            setError(
              "Complete the required activity fields before saving. Your edits remain private in this tab.",
            );
            onNavigationBlocked("intervention-edit-form");
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void apply({ ...base(), action: "save", activity });
          }}
        >
          <ActivityEditor
            activity={activity}
            evidence={currentDraft.evidence}
            disabled={locked}
            onChange={edit}
          />
        </form>
      )}
      {tab === "student" && (
        <section
          className="lp-intervention-student-preview"
          aria-label="Student-facing activity preview"
        >
          <p className="lp-intervention-meta">
            Student preview{dirty ? " of unsaved edits" : " of saved activity"}.
            Student-facing content only.
          </p>
          {studentActivity ? (
            <InterventionActivityView activity={studentActivity} />
          ) : (
            <p>
              Complete the required source references and question fields to
              preview this activity.
            </p>
          )}
        </section>
      )}
      {tab === "teacher" && (
        <>
          <p className="lp-intervention-note">
            Teacher-only material: answer guidance, AI recommendation, original
            evidence, uncertainty and recipient suggestions remain private.
          </p>
          <ActivityReview
            activity={activity}
            evidence={currentDraft.evidence}
            teacherOnly
          />
          <details className="lp-intervention-section">
            <summary>Original AI generation provenance</summary>
            <p>Model: {currentDraft.provenance.model}</p>
            <p>Generated: {currentDraft.provenance.generated_at}</p>
            <p className="lp-intervention-meta">
              Template: {currentDraft.provenance.prompt_template_version} ·
              Response: {currentDraft.provenance.response_id}
            </p>
            <p className="lp-intervention-meta">
              Teacher edits preserve this original provenance and the saved
              source and evidence snapshots.
            </p>
          </details>
        </>
      )}
      {conflict && (
        <div
          id="intervention-conflict"
          tabIndex={-1}
          role="alert"
          className="lp-intervention-warning"
        >
          <p>
            This view may be stale. Your unsaved edits have been kept. Refresh
            the saved state, then inspect it before discarding local edits;
            older edits cannot overwrite a newer revision.
          </p>
          <button
            type="button"
            className="lp-button"
            disabled={busy || pending !== null}
            onClick={() => void refresh()}
          >
            Refresh saved state
          </button>
          {review && (
            <button
              type="button"
              className="lp-button"
              disabled={busy || pending !== null}
              onClick={discard}
            >
              Discard local edits and use loaded revision{" "}
              {review.draft.revision}
            </button>
          )}
        </div>
      )}
      {pending && !busy && (
        <div
          className="lp-intervention-warning"
          id="intervention-pending-action"
          tabIndex={-1}
        >
          <p>
            The previous {pending.action} request has an unconfirmed response.
            Replaying its unchanged identity recovers the recorded outcome
            without a second delivery.
          </p>
          <button
            type="button"
            className="lp-button"
            disabled={disabled}
            onClick={() => void apply(pending)}
          >
            Retry same {pending.action} request
          </button>
        </div>
      )}
      {error && (
        <p
          id="intervention-action-error"
          tabIndex={-1}
          role="alert"
          className="lp-intervention-warning"
        >
          {error}
        </p>
      )}
    </div>
  );
  const stepsPane = (
    <div className="lp-intervention-steps-workspace">
      <div className="lp-intervention-status">
        <strong>
          {review?.delivery
            ? "Delivered"
            : review?.approval
              ? "Approved · awaiting delivery"
              : currentDraft.status === "dismissed"
                ? "Dismissed"
                : "Private draft"}
        </strong>
        <span>
          Revision {currentDraft.revision}
          {dirty ? " · unsaved changes" : " · saved"}
        </span>
      </div>
      <ol className="lp-intervention-steps">
        <li>
          <CompletedStage
            title="Choose answers"
            status={`${currentDraft.evidence.counts.selected_responses} saved`}
          >
            <p>
              {currentDraft.evidence.counts.selected_responses} responses from{" "}
              {currentDraft.evidence.counts.selected_students} students. Related
              and contrary answers remain in the saved evidence.
            </p>
            <button
              type="button"
              className="lp-text-link"
              aria-label="Inspect saved evidence"
              onClick={() => onNavigationBlocked("intervention-evidence-title")}
            >
              Inspect saved evidence
            </button>
          </CompletedStage>
        </li>
        <li aria-labelledby="intervention-save-title">
          {!editable && review?.approval ? (
            <CompletedStage
              title="Write and save draft"
              status="Saved"
              headingId="intervention-save-title"
            >
              <p>Saved activity locked by approval.</p>
              <button
                type="button"
                className="lp-text-link"
                onClick={() => onNavigationBlocked("intervention-draft-title")}
              >
                Review in Activity
              </button>
            </CompletedStage>
          ) : (
            <>
              <h3 id="intervention-save-title">Write and save draft</h3>
              <p>
                {dirty
                  ? "Unsaved edits. Save a private revision before approval."
                  : editable
                    ? "Review student preview and private guidance before approval."
                    : "Saved activity locked by approval."}
              </p>
              {!editable && (
                <button
                  type="button"
                  className="lp-text-link"
                  onClick={() =>
                    onNavigationBlocked("intervention-draft-title")
                  }
                >
                  Review in Activity
                </button>
              )}
            </>
          )}
          {editable && (
            <div
              className="lp-intervention-actions"
              id="intervention-edit-actions"
              tabIndex={-1}
            >
              <button
                type="submit"
                form="intervention-edit-form"
                className="lp-button lp-button-primary"
                disabled={locked || !dirty}
              >
                Save private revision
              </button>
              {!conflict && (
                <button
                  type="button"
                  className="lp-button"
                  disabled={busy || pending !== null || !dirty}
                  onClick={discard}
                >
                  Discard unsaved edits
                </button>
              )}
            </div>
          )}
          {(pending || conflict || error) && (
            <div className="lp-intervention-warning" role="status">
              <p>
                {pending
                  ? "An action is unconfirmed. Review its saved request before continuing."
                  : conflict
                    ? "The saved revision needs review. Your local work is preserved."
                    : "The last action needs your attention."}
              </p>
              <button
                type="button"
                className="lp-button"
                disabled={busy}
                onClick={() =>
                  onNavigationBlocked(
                    pending
                      ? "intervention-pending-action"
                      : conflict
                        ? "intervention-conflict"
                        : "intervention-action-error",
                  )
                }
              >
                Review recovery in Activity
              </button>
            </div>
          )}
        </li>
        <li aria-labelledby="intervention-recipients-title">
          {!review?.approval && (
            <h3 id="intervention-recipients-title">Choose recipients</h3>
          )}
          {editable ? (
            <details className="lp-intervention-recipient-selection">
              <summary>{recipients.length} selected · Choose students</summary>
              <p>
                AI suggestions are recommendations only. Select the currently
                eligible students who should receive this activity.
              </p>
              <div className="lp-intervention-actions">
                <button
                  type="button"
                  className="lp-button"
                  disabled={locked || !review?.eligible_recipients.length}
                  onClick={() =>
                    select(
                      review?.eligible_recipients.map(
                        (student) => student.student_id,
                      ) ?? [],
                    )
                  }
                >
                  Select all eligible
                </button>
                <button
                  type="button"
                  className="lp-button"
                  disabled={locked || recipients.length === 0}
                  onClick={() => select([])}
                >
                  Clear selection
                </button>
              </div>
              <div className="lp-intervention-recipients">
                {review?.eligible_recipients.map((recipient) => {
                  const suggestion =
                    currentDraft.activity.suggested_recipients.find(
                      (item) => item.student_id === recipient.student_id,
                    );
                  return (
                    <div
                      key={recipient.student_id}
                      className="lp-intervention-recipient"
                    >
                      <label className="lp-intervention-choice">
                        <input
                          type="checkbox"
                          checked={recipients.includes(recipient.student_id)}
                          disabled={locked}
                          onChange={(event) =>
                            select(
                              event.target.checked
                                ? [...recipients, recipient.student_id]
                                : recipients.filter(
                                    (id) => id !== recipient.student_id,
                                  ),
                            )
                          }
                        />
                        <span>
                          <strong>{recipient.display_name}</strong>
                          {suggestion && (
                            <span className="lp-intervention-meta block">
                              AI suggested · review supporting and contrary
                              evidence
                            </span>
                          )}
                        </span>
                      </label>
                      {suggestion && (
                        <details>
                          <summary>Why suggested?</summary>
                          <p>{suggestion.reason}</p>
                          {suggestion.evidence_attempt_ids.map((id, index) => (
                            <a
                              className="lp-text-link mr-3"
                              href={`#evidence-${id}`}
                              key={id}
                            >
                              Inspect response {index + 1}
                            </a>
                          ))}
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
              {review?.eligible_recipients.length === 0 && (
                <p>No students are currently eligible for this assignment.</p>
              )}
            </details>
          ) : review?.approval ? (
            <CompletedStage
              title="Choose recipients"
              status={`${review.approval.recipient_ids.length} approved`}
              headingId="intervention-recipients-title"
            >
              <p>The approved recipient list is fixed.</p>
              <p>
                {recipientNames.length
                  ? recipientNames
                      .map((student) => student.display_name)
                      .join(", ")
                  : "Recipient names unavailable."}
              </p>
            </CompletedStage>
          ) : (
            <p>This draft is dismissed. No students will receive it.</p>
          )}
        </li>
        <li>
          {!review?.approval && <h3>Approve saved revision</h3>}
          {editable ? (
            <div className="lp-intervention-approval-summary">
              <p>
                Revision {currentDraft.revision} · {recipients.length} selected{" "}
                {recipients.length === 1 ? "student" : "students"}
                {recipientNames.length
                  ? `: ${recipientNames.map((student) => student.display_name).join(", ")}`
                  : "."}
              </p>
              <p>
                Approval locks the activity and recipient list. Students receive
                it only after you choose Deliver approved activity.
              </p>
              {dirty && (
                <p className="lp-intervention-warning">
                  Save or discard your unsaved edits before approval.
                </p>
              )}
              <button
                type="button"
                className="lp-button lp-button-primary"
                disabled={locked || dirty || recipients.length === 0}
                onClick={() =>
                  void apply({
                    ...base(),
                    action: "approve",
                    recipient_ids: recipients,
                  })
                }
              >
                Approve revision {currentDraft.revision} for {recipients.length}{" "}
                {recipients.length === 1 ? "student" : "students"}
              </button>
            </div>
          ) : review?.approval ? (
            <CompletedStage
              title="Approve"
              status={`Revision ${review.approval.approved_revision} approved`}
            >
              <p>
                Approved on{" "}
                <time dateTime={review.approval.approved_at}>
                  {interventionTimestamp(review.approval.approved_at)}
                </time>
                .
              </p>
              <p className="lp-intervention-meta">
                Approval: {review.approval.id}
              </p>
            </CompletedStage>
          ) : (
            <p>No approval is recorded.</p>
          )}
        </li>
        <li>
          {!review?.delivery && <h3>Deliver activity</h3>}
          {review?.approval ? (
            review.delivery ? (
              <CompletedStage title="Delivery recorded" status="Delivered">
                <p>
                  Delivered to {review.approval.recipient_ids.length} students.
                </p>
                <p>
                  Delivered on{" "}
                  <time dateTime={review.delivery.delivered_at}>
                    {interventionTimestamp(review.delivery.delivered_at)}
                  </time>
                  . Refreshing will not create another delivery.
                </p>
                <p className="lp-intervention-meta">
                  Delivery: {review.delivery.id}
                </p>
              </CompletedStage>
            ) : (
              <>
                <p>
                  The activity remains private until delivery. The approved
                  content and recipient list are fixed.
                </p>
                <button
                  type="button"
                  className="lp-button lp-button-primary"
                  disabled={disabled || busy || pending !== null || conflict}
                  onClick={() =>
                    void apply({
                      ...base(),
                      action: "deliver",
                      approval_id: review.approval!.id,
                    })
                  }
                >
                  Deliver approved activity to{" "}
                  {review.approval.recipient_ids.length} students
                </button>
              </>
            )
          ) : (
            <p>Approval is required. Nothing has been delivered.</p>
          )}
        </li>
        <li>
          <h3>Read follow-up</h3>
          {review?.delivery && review.approval ? (
            <InterventionFollowup
              draftId={draft.id}
              approvalId={review.approval.id}
            />
          ) : (
            <p>
              Follow-up will link here after delivery. No learning outcome is
              inferred.
            </p>
          )}
        </li>
      </ol>
      {editable && (
        <details className="lp-intervention-section">
          <summary>Dismiss this draft</summary>
          <p>
            Dismissal keeps the draft history and original student evidence.
            This activity will not be delivered.
          </p>
          <button
            type="button"
            className="lp-button"
            disabled={locked || dirty}
            onClick={() => void apply({ ...base(), action: "dismiss" })}
          >
            Confirm dismissal
          </button>
        </details>
      )}
    </div>
  );
  return renderWorkspace({ activity: activityPane, steps: stepsPane });
}
