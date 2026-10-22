"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../components/icons.tsx";
import { LearningOverview } from "./overview.tsx";
import { SessionElapsed } from "./session-elapsed.tsx";
import type { StudentDashboard } from "../../lib/tutoring/dashboard-model.ts";
import { assignmentStudyHref } from "../../lib/tutoring/navigation.ts";
import {
  TutorViewSchema,
  type AssignedLesson,
  type TutorView,
} from "../../lib/tutoring/contracts.ts";

const button = "lp-button lp-button-primary";
// Keep drafts across same-tab reader navigation even if browser storage is blocked.
// Restoration still requires the exact attempt returned by the authorized server.
const draftMemory = new Map<string, string>();
// Some browsers disable tab storage. That must never prevent an answer being sent.
function saveDraft(
  attempt: string,
  value: { key: string; response: string; locked?: boolean } | null,
) {
  const serialized = value === null ? null : JSON.stringify(value);
  if (serialized === null) draftMemory.delete(attempt);
  else draftMemory.set(attempt, serialized);
  try {
    if (serialized === null)
      sessionStorage.removeItem(`learning-pulse:${attempt}`);
    else sessionStorage.setItem(`learning-pulse:${attempt}`, serialized);
  } catch {
    // The in-memory submission key still protects retries in this tab.
  }
}
async function request(path: string, body?: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "We couldn’t connect. Your answer stays here; check your connection and try again.",
    );
  }
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Please sign in again. Your submitted work is saved."
        : value &&
            typeof value === "object" &&
            "error" in value &&
            typeof value.error === "string"
          ? value.error
          : "We couldn’t finish that request. Your saved work is safe.",
    );
  if (value === null)
    throw new Error("We couldn’t load your progress. Please try again.");
  return value;
}
export function StudySession({
  lessons,
  initial,
  initialTitle,
  dashboard,
  assignmentId,
}: {
  lessons: AssignedLesson[];
  initial: TutorView | null;
  initialTitle?: string;
  dashboard: StudentDashboard;
  /** Existing session UI embedded in its authorized assignment detail page. */
  assignmentId?: string;
}) {
  const router = useRouter();
  const wantsReading = useSearchParams().get("reading") === "1";
  const [view, setView] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [startingNew, setStartingNew] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [locked, setLocked] = useState(false);
  const [displayRetry, setDisplayRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const currentStep = useRef<HTMLHeadingElement>(null);
  const feedbackStep = useRef<HTMLHeadingElement>(null);
  const focusedAttempt = useRef<string | null>(null);
  const pendingReading = view?.pending_reading;
  const restoredReading = useRef<string | null>(null);
  useEffect(() => {
    const id = view?.session.id;
    if (!id) return;
    const passage = window.location.hash.slice(1);
    // Preserve old saved reader links without restoring the retired sidebar.
    if (/^P\d+$/.test(passage) || wantsReading) {
      const query = new URLSearchParams({ session: id, from: "study" });
      if (/^P\d+$/.test(passage)) query.set("passage", passage);
      const destination = `/study/reading?${query}`;
      if (restoredReading.current === destination) return;
      restoredReading.current = destination;
      router.replace(destination);
    }
  }, [view?.session.id, wantsReading, router]);
  const busyRef = useRef(false);
  const submission = useRef<{
    attempt: string;
    key: string;
    response: string;
  } | null>(null);
  const last = view?.attempts.at(-1);
  const lastId = last?.id;
  const submittedAt = last?.submitted_at;
  const phase = view?.progress.phase;
  const progressMessage =
    view?.session.status === "pending_evaluation"
      ? "Your answer is saved and evaluation is pending. Refresh saved progress in a moment."
      : view?.progress.message;
  const latestFeedback = view?.interventions
    .filter((i) => i.type !== "reading")
    .at(-1)?.id;
  const assignment = lessons.find(
    (lesson) => lesson.session?.id === view?.session.id,
  );
  const refresh = useCallback(async (sessionId: string) => {
    const updated = TutorViewSchema.parse(
      await request(`/api/tutoring/${sessionId}`),
    );
    setView(updated);
    return updated;
  }, []);
  async function perform(operation: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function refreshProgress() {
    if (!view) return;
    await perform(async () => {
      setRefreshing(true);
      try {
        await refresh(view.session.id);
        setDisplayRetry((value) => value + 1);
      } finally {
        setRefreshing(false);
      }
    });
  }
  useEffect(() => {
    if (!lastId || submittedAt) return;
    submission.current = null;
    queueMicrotask(() => setLocked(false));
    let stored = draftMemory.get(lastId) ?? null;
    try {
      stored ??= sessionStorage.getItem(`learning-pulse:${lastId}`);
    } catch {
      /* Sending answers still works when tab storage is unavailable. */
    }
    if (stored) {
      try {
        const saved: unknown = JSON.parse(stored);
        if (
          saved &&
          typeof saved === "object" &&
          "key" in saved &&
          "response" in saved &&
          typeof saved.key === "string" &&
          typeof saved.response === "string"
        ) {
          const wasSending = "locked" in saved && saved.locked === true;
          if (wasSending)
            submission.current = {
              attempt: lastId,
              key: saved.key,
              response: saved.response,
            };
          // Restore only a draft belonging to this server-authorized attempt.
          const restored = saved.response;
          queueMicrotask(() => {
            setDraft(restored);
            setLocked(wasSending);
          });
        }
      } catch {
        saveDraft(lastId, null);
      }
    } else queueMicrotask(() => setDraft(""));
  }, [lastId, submittedAt]);
  // Acknowledgement follows rendering. Creating or fetching help alone does not
  // record it as assistance. The server owns its visibility timestamp.
  const pendingHelp =
    view?.interventions
      .filter((i) => i.delivery_status === "created" && i.type !== "reading")
      .map((i) => i.id)
      .join(",") ?? "";
  const sessionId = view?.session.id;
  const retryAfter = view?.progress.retry_after;
  // Only read progress: refresh/resume never starts or retries a paid evaluation.
  // Bound background checks, then leave the explicit refresh control.
  useEffect(() => {
    if (!sessionId || busy || (phase !== "evaluate" && phase !== "failed"))
      return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let checks = 0;
    async function poll() {
      try {
        const updated = TutorViewSchema.parse(
          await request(`/api/tutoring/${sessionId}`),
        );
        if (cancelled) return;
        setView(updated);
        checks += 1;
        if (
          checks < 30 &&
          (updated.progress.phase === "evaluate" ||
            (updated.progress.phase === "failed" &&
              !updated.progress.retry_allowed))
        )
          timer = setTimeout(poll, 3000);
      } catch {
        if (!cancelled)
          setError(
            "We couldn’t refresh your saved progress. Check your connection, then use the refresh button.",
          );
      }
    }
    timer = setTimeout(
      poll,
      phase === "failed" && retryAfter
        ? Math.max(
            1000,
            Math.min(3000, Date.parse(retryAfter) - Date.now() + 250),
          )
        : 3000,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId, phase, retryAfter, busy]);
  useEffect(() => {
    if (phase !== "answer" && phase !== "completed" && phase !== "feedback")
      return;
    if (phase === "answer" && focusedAttempt.current === lastId) return;
    const target =
      phase === "feedback"
        ? feedbackStep.current
        : phase === "completed"
          ? (feedbackStep.current ?? currentStep.current)
          : currentStep.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
    // A delivery acknowledgement must not jump past feedback to the next question.
    focusedAttempt.current = lastId ?? null;
  }, [lastId, phase, latestFeedback]);
  useEffect(() => {
    if (!pendingHelp || !sessionId) return;
    let cancelled = false;
    void (async () => {
      try {
        for (const id of pendingHelp.split(","))
          await request(`/api/sessions/${sessionId}/interventions/${id}`, {});
        if (!cancelled) await refresh(sessionId);
      } catch {
        if (!cancelled)
          setError(
            "The feedback is visible, but we couldn’t confirm it was shown. Refresh saved progress before continuing.",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingHelp, sessionId, refresh, displayRetry]);
  async function start(id: string) {
    await perform(async () => {
      const updated = TutorViewSchema.parse(
        await request("/api/tutoring", { assignment_id: id }),
      );
      router.push(assignmentStudyHref(id, updated.session.id));
      router.refresh();
    });
  }
  async function evaluate(retry = false) {
    if (!view || !last) return;
    await perform(async () => {
      setView(
        TutorViewSchema.parse(
          await request(`/api/tutoring/${view.session.id}`, {
            attempt_id: last.id,
            ...(retry && view.progress.failed_evaluation_id
              ? { retry_of: view.progress.failed_evaluation_id }
              : {}),
          }),
        ),
      );
    });
  }
  async function startNewSession() {
    if (!assignmentId || view?.session.status !== "completed") return;
    await perform(async () => {
      setStartingNew(true);
      try {
        const updated = TutorViewSchema.parse(
          await request(`/api/tutoring/${view.session.id}/restart`, {}),
        );
        setView(updated);
        router.push(assignmentStudyHref(assignmentId, updated.session.id));
        router.refresh();
      } finally {
        setStartingNew(false);
      }
    });
  }
  async function answer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!view || !last || !draft.trim()) return;
    await perform(async () => {
      const stored = submission.current;
      const next =
        stored?.attempt === last.id
          ? stored
          : { attempt: last.id, key: crypto.randomUUID(), response: draft };
      submission.current = next;
      setLocked(true);
      saveDraft(last.id, { ...next, locked: true });
      await request(`/api/sessions/${view.session.id}/answers`, {
        attempt_id: last.id,
        submission_key: next.key,
        response_text: next.response,
      });
      await refresh(view.session.id);
      saveDraft(last.id, null);
      setDraft("");
      submission.current = null;
      setLocked(false);
      setView(
        TutorViewSchema.parse(
          await request(`/api/tutoring/${view.session.id}`, {
            attempt_id: last.id,
          }),
        ),
      );
    });
  }
  const refreshButton = (
    <button
      type="button"
      className="lp-study-refresh"
      disabled={busy}
      aria-label="Refresh saved progress"
      title="Refresh saved progress"
      onClick={() => void refreshProgress()}
    >
      <Icon name="refresh" />
    </button>
  );
  return (
    <section
      className={
        view
          ? `lp-study-session${assignmentId ? " lp-study-embedded" : ""}`
          : "lp-study-home lp-s-dashboard"
      }
    >
      {!assignmentId && (
        <header className="lp-page-heading">
          <div>
            <p className="lp-eyebrow">
              {view ? "AI Study Session" : "My learning"}
            </p>
            <h1 className="lp-title">
              {view
                ? (assignment?.title ?? initialTitle ?? "Your study session")
                : `Welcome back, ${dashboard.displayName.trim().split(/\s+/)[0]}.`}
            </h1>
            <p className="lp-intro">
              {view
                ? "Explain your thinking, one question at a time."
                : "Your current work, what is next, and support from your instructor."}
            </p>
          </div>
        </header>
      )}
      {error && (
        <div role="alert" className="lp-notice lp-notice-warning mb-5">
          {error}{" "}
          <Link href="/login" className="underline">
            Check sign-in
          </Link>
        </div>
      )}
      {!view ? (
        <LearningOverview dashboard={dashboard} busy={busy} onStart={start} />
      ) : (
        <>
          <div role="status" aria-live="polite" className="sr-only">
            {startingNew
              ? "Opening your new session…"
              : refreshing
                ? "Refreshing saved progress…"
                : busy
                  ? "Saving and checking your answer… You can return to this session if you need to leave."
                  : progressMessage}
          </div>
          <div id="conversation" className="lp-panel lp-conversation-card">
            <div className="lp-study-chat-toolbar">
              <span>
                <span
                  className="lp-study-chat-dot"
                  data-status={view.session.status}
                  aria-hidden="true"
                />{" "}
                {view.session.status === "completed"
                  ? "Completed"
                  : "In progress"}
              </span>
              <div className="lp-study-chat-controls">
                {assignmentId && view.session.status === "completed" && (
                  <button
                    type="button"
                    className="lp-text-link lp-study-new-session"
                    disabled={busy}
                    onClick={() => void startNewSession()}
                  >
                    {startingNew ? "Opening session…" : "Start new session"}
                  </button>
                )}
                <SessionElapsed
                  key={view.session.id}
                  startedAt={view.session.started_at}
                  endedAt={view.session.ended_at}
                />
              </div>
            </div>
            <ol
              className="lp-turns"
              aria-label="Your saved learning conversation"
              tabIndex={0}
            >
              {view.attempts.map((attempt, index) => (
                <li key={attempt.id} className="lp-turn">
                  <div className="lp-message-label">
                    <span className="lp-tutor-mark">
                      <Icon name="pulse" />
                    </span>
                    Learning Pulse
                  </div>
                  <div className="lp-question">
                    <h2
                      id={`question-${attempt.id}`}
                      ref={attempt.id === lastId ? currentStep : undefined}
                      tabIndex={-1}
                    >
                      {attempt.intent === "diagnostic_followup"
                        ? "Let’s check your reasoning"
                        : attempt.intent === "immediate_retest"
                          ? "Try a fresh question"
                          : attempt.intent === "neutral_clarification"
                            ? "Tell us a little more"
                            : `Question ${index + 1}`}
                    </h2>
                    <p className="whitespace-pre-wrap leading-7">
                      {attempt.prompt_text}
                    </p>
                  </div>
                  {attempt.submitted_at && (
                    <div className="lp-student-message">
                      <h3 className="lp-message-label">
                        Your answer — saved <Icon name="check" />
                      </h3>
                      <p className="lp-answer">
                        {attempt.response_text || "No response entered."}
                      </p>
                    </div>
                  )}
                  {view.interventions
                    .filter(
                      (help) =>
                        help.related_attempt_id === attempt.id &&
                        help.type !== "reading",
                    )
                    .map((help) => (
                      <article key={help.id} className="lp-feedback">
                        <div className="lp-message-label">
                          <span className="lp-tutor-mark">
                            <Icon name="pulse" />
                          </span>
                          Learning Pulse
                        </div>
                        <div className="lp-question">
                          <h2
                            ref={
                              help.id === latestFeedback
                                ? feedbackStep
                                : undefined
                            }
                            tabIndex={-1}
                          >
                            {help.type === "fallback"
                              ? "Let’s return to the question"
                              : "Feedback"}
                          </h2>
                          <p className="mt-2 whitespace-pre-wrap leading-7">
                            {help.text_shown}
                          </p>
                          {view.citations
                            .filter((c) => c.intervention_id === help.id)
                            .map((citation) => (
                              <Link
                                key={citation.passage_id}
                                className="lp-citation"
                                href={`/study/reading?${new URLSearchParams({
                                  ...(assignmentId
                                    ? { assignment: assignmentId }
                                    : {}),
                                  session: view.session.id,
                                  version: citation.content_version,
                                  passage: citation.passage_id,
                                  citation: citation.intervention_id,
                                })}`}
                                prefetch={false}
                                aria-disabled={busy || undefined}
                                onClick={(event) => {
                                  if (busy) event.preventDefault();
                                }}
                              >
                                <Icon name="book" /> Reading ·{" "}
                                {citation.passage_id}
                                <span className="lp-study-citation-version">
                                  {citation.content_version}
                                </span>
                              </Link>
                            ))}
                        </div>
                      </article>
                    ))}
                </li>
              ))}
            </ol>
            {view.progress.phase === "answer" && (
              <form onSubmit={(e) => void answer(e)} className="lp-composer">
                <label htmlFor="response" className="block font-semibold">
                  Your answer and reasoning
                </label>
                <textarea
                  id="response"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (last && !submission.current)
                      saveDraft(last.id, {
                        key: crypto.randomUUID(),
                        response: e.target.value,
                      });
                  }}
                  maxLength={12000}
                  required
                  disabled={busy || locked || Boolean(pendingReading)}
                  rows={3}
                  placeholder="Write what you think, and why…"
                  className="lp-input"
                  aria-describedby="response-help"
                />
                <div className="lp-composer-footer">
                  <p id="response-help">
                    It’s okay to be unsure. Explain what you’re thinking.
                  </p>
                  <div className="lp-composer-actions">
                    {refreshButton}
                    <button
                      className={button}
                      disabled={
                        busy || Boolean(pendingReading) || !draft.trim()
                      }
                    >
                      {busy && !refreshing
                        ? "Checking…"
                        : locked
                          ? "Retry sending saved answer"
                          : "Submit answer"}
                      <Icon name="send" />
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
          {((phase !== "answer" && view.session.status !== "completed") ||
            pendingReading ||
            (phase !== "answer" && error)) && (
            <div className="lp-session-actions">
              {phase !== "answer" && view.session.status !== "completed" && (
                <p className="lp-study-session-state">{progressMessage}</p>
              )}
              {pendingReading && (
                <p className="lp-study-session-state" role="status">
                  Finish opening your reading before continuing.{" "}
                  <Link
                    href={`/study/reading?${new URLSearchParams({ session: view.session.id, passage: pendingReading.passage_id, from: "study" })}`}
                    prefetch={false}
                    className="lp-text-link"
                  >
                    Return to reading
                  </Link>
                </p>
              )}
              {view.progress.phase === "evaluate" && (
                <button
                  type="button"
                  className={button}
                  disabled={busy || Boolean(pendingReading)}
                  onClick={() => void evaluate()}
                >
                  {busy ? "Checking your answer…" : "Evaluate saved answer"}
                </button>
              )}
              {view.progress.phase === "failed" && (
                <button
                  type="button"
                  className={button}
                  disabled={
                    busy ||
                    Boolean(pendingReading) ||
                    !view.progress.retry_allowed
                  }
                  onClick={() => void evaluate(true)}
                >
                  {busy ? "Retrying evaluation…" : "Retry evaluation"}
                </button>
              )}
              {phase !== "answer" &&
                (view.session.status !== "completed" || error) &&
                refreshButton}
            </div>
          )}
        </>
      )}
    </section>
  );
}
