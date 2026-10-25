"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../components/icons.tsx";
import { StudyDialogue } from "./dialogue.tsx";
import { createConversationTransport } from "./conversation-transport.ts";
import { createDisplayAcknowledgements } from "./display-acknowledgement.ts";
import { LearningOverview } from "./overview.tsx";
import { SessionElapsed } from "./session-elapsed.tsx";
import { FeedbackAudio } from "./feedback-audio.tsx";
import type { StudentDashboard } from "../../lib/tutoring/dashboard-model.ts";
import { assignmentStudyHref } from "../../lib/tutoring/navigation.ts";
import {
  TutorViewSchema,
  type AssignedLesson,
  type TutorView,
} from "../../lib/tutoring/contracts.ts";

import {
  acknowledgeAnswerSave,
  answerSaveMessage,
  canRetryOriginalAnswer,
  failedAnswerSave,
  hasMatchingSavedAnswer,
  restoreAnswerRecovery,
  studyRequest as request,
  type AnswerRecovery,
} from "./answer-recovery.ts";

const button = "lp-button lp-button-primary";
// Keep drafts across same-tab reader navigation even if browser storage is blocked.
// Restoration still requires the exact attempt returned by the authorized server.
const draftMemory = new Map<string, string>();
// Some browsers disable tab storage. That must never prevent an answer being sent.
function saveDraft(attempt: string, value: AnswerRecovery | null) {
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
  const [answerRecovery, setAnswerRecovery] = useState<AnswerRecovery | null>(
    null,
  );
  const [answerRetryAllowed, setAnswerRetryAllowed] = useState(false);
  const [displayRetry, setDisplayRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const currentStep = useRef<HTMLHeadingElement>(null);
  const feedbackStep = useRef<HTMLHeadingElement>(null);
  const completionStep = useRef<HTMLParagraphElement>(null);
  const acknowledgingHelp = useRef(new Set<string>());
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
  const submission = useRef<AnswerRecovery | null>(null);
  const rememberAnswer = useCallback((next: AnswerRecovery) => {
    submission.current = next;
    saveDraft(next.attempt, next);
    setAnswerRecovery(next.state === "local" ? null : next);
    setLocked(next.state !== "local");
  }, []);
  const last = view?.attempts.at(-1);
  const lastId = last?.id;
  const submittedAt = last?.submitted_at;
  const savedResponse = last?.response_text;
  const sessionId = view?.session.id;
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
  const refresh = useCallback(
    async (sessionId: string) => {
      const updated = TutorViewSchema.parse(
        await request(`/api/tutoring/${sessionId}`),
      );
      const original = submission.current;
      if (original && hasMatchingSavedAnswer(updated, original)) {
        rememberAnswer({ ...original, state: "acknowledged" });
        setAnswerRetryAllowed(false);
      }
      setView(updated);
      return updated;
    },
    [rememberAnswer],
  );
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
    if (!lastId || !sessionId) return;
    const restoredSessionId = sessionId;
    let stored = draftMemory.get(lastId) ?? null;
    try {
      stored ??= sessionStorage.getItem(`learning-pulse:${lastId}`);
    } catch {
      /* The active tab still retains its original answer. */
    }
    const restored = stored
      ? restoreAnswerRecovery(stored, restoredSessionId, lastId)
      : null;
    queueMicrotask(() => {
      setAnswerRetryAllowed(false);
      if (restored) {
        const next =
          submittedAt && savedResponse === restored.response
            ? { ...restored, state: "acknowledged" as const }
            : restored;
        rememberAnswer(next);
        setDraft(
          submittedAt && next.state === "acknowledged" ? "" : next.response,
        );
      } else {
        submission.current = null;
        setAnswerRecovery(null);
        setLocked(false);
        setDraft("");
      }
    });
    // Restore only when the authorized attempt or its submission changes.
  }, [lastId, submittedAt, savedResponse, sessionId, rememberAnswer]);
  async function checkAnswerSave() {
    if (!view || !submission.current) return;
    await perform(async () => {
      const updated = await refresh(view.session.id);
      const original = submission.current;
      if (!original) return;
      if (hasMatchingSavedAnswer(updated, original)) {
        setDraft("");
        return;
      }
      setAnswerRetryAllowed(
        updated.progress.phase === "answer" &&
          canRetryOriginalAnswer(updated, original),
      );
      if (
        updated.attempts.find((attempt) => attempt.id === original.attempt)
          ?.submitted_at &&
        original.state !== "acknowledged"
      )
        setError(
          "A different answer is saved for this question. Your original text is still kept in this tab; it will not replace the saved answer.",
        );
    });
  }
  // Acknowledgement follows rendering. Creating or fetching help alone does not
  // record it as assistance. The server owns its visibility timestamp.
  const pendingHelp =
    view?.interventions
      .filter((i) => i.delivery_status === "created" && i.type !== "reading")
      .map((i) => i.id)
      .join(",") ?? "";
  const conversationTransport = useMemo(
    () => (sessionId ? createConversationTransport(sessionId) : undefined),
    [sessionId],
  );
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
          ? completionStep.current
          : currentStep.current;
    if (
      target
        ?.closest("[data-conversation-scroll]")
        ?.getAttribute("data-follow-latest") === "false"
    )
      return;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
    // A delivery acknowledgement must not jump past feedback to the next question.
    focusedAttempt.current = lastId ?? null;
  }, [lastId, phase, latestFeedback]);
  useEffect(() => {
    if (!pendingHelp || !sessionId) return;
    let cancelled = false;
    const ids = pendingHelp.split(",");
    const intersecting = new Set<string>();
    const delivery = createDisplayAcknowledgements({
      ids,
      acknowledging: acknowledgingHelp.current,
      isVisible(id) {
        if (document.visibilityState !== "visible" || !intersecting.has(id))
          return false;
        const element = document.getElementById(`feedback-${id}`);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.right > 0 &&
          rect.left < window.innerWidth
        );
      },
      async acknowledge(id) {
        await request(`/api/sessions/${sessionId}/interventions/${id}`, {});
        if (cancelled) return;
        const updated = TutorViewSchema.parse(
          await request(`/api/tutoring/${sessionId}`),
        );
        // A response from an old session/effect cannot replace newer progress.
        if (!cancelled) setView(updated);
      },
      onError() {
        setError(
          "The feedback is visible, but we couldn’t confirm it was shown. Refresh saved progress before continuing.",
        );
      },
    });
    const confirm = () => void delivery.check();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = entry.target.id.slice("feedback-".length);
        if (entry.isIntersecting && entry.intersectionRatio > 0)
          intersecting.add(id);
        else intersecting.delete(id);
      }
      confirm();
    });
    for (const id of ids) {
      const element = document.getElementById(`feedback-${id}`);
      if (element) observer.observe(element);
    }
    document.addEventListener("visibilitychange", confirm);
    return () => {
      cancelled = true;
      delivery.stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", confirm);
    };
  }, [pendingHelp, sessionId, displayRetry]);
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
  async function answer(response: string) {
    if (!view || !last || !response.trim()) return;
    const existing = submission.current;
    if (
      existing?.state === "acknowledged" ||
      (existing && existing.state !== "local" && !answerRetryAllowed)
    )
      return;
    await perform(async () => {
      const original: AnswerRecovery =
        existing?.attempt === last.id
          ? existing
          : {
              session: view.session.id,
              attempt: last.id,
              key: crypto.randomUUID(),
              response,
              state: "local",
            };
      setAnswerRetryAllowed(false);
      // Persist uncertainty before dispatch, so refresh cannot silently resend.
      rememberAnswer({ ...original, state: "unknown" });
      try {
        const receipt = await request(
          `/api/sessions/${view.session.id}/answers`,
          {
            attempt_id: original.attempt,
            submission_key: original.key,
            response_text: original.response,
          },
        );
        rememberAnswer(acknowledgeAnswerSave(receipt, original));
      } catch (error) {
        rememberAnswer(failedAnswerSave(original, error));
        throw error;
      }
      const updated = await refresh(view.session.id);
      if (!hasMatchingSavedAnswer(updated, original))
        throw new Error(
          "The server acknowledged your answer, but its latest progress could not be confirmed. Check the answer save before continuing.",
        );
      setDraft("");
      if (
        updated.progress.phase === "evaluate" &&
        updated.progress.current_attempt_id === original.attempt
      )
        setView(
          TutorViewSchema.parse(
            await request(`/api/tutoring/${view.session.id}`, {
              attempt_id: original.attempt,
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
          <Link
            href="/login"
            target="_blank"
            rel="noopener"
            className="underline"
          >
            Sign in in a new tab
          </Link>{" "}
          Return to this tab to check your progress.
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

            {last && (
              <StudyDialogue
                key={last.id}
                feedbackAnchorId={
                  pendingHelp
                    ? `feedback-${pendingHelp.split(",")[0]}`
                    : undefined
                }
                lessonHistory={
                  <ol
                    className="lp-turns"
                    aria-label="Your saved learning conversation"
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
                            ref={
                              attempt.id === lastId ? currentStep : undefined
                            }
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
                                <p
                                  id={`feedback-${help.id}`}
                                  className="mt-2 whitespace-pre-wrap leading-7"
                                >
                                  {help.text_shown}
                                </p>
                                {help.delivery_status === "displayed" && (
                                  <FeedbackAudio
                                    key={`${help.id}:${last?.id}:${view.session.status}`}
                                    source={{
                                      session_id: view.session.id,
                                      intervention_id: help.id,
                                    }}
                                  />
                                )}
                                {view.citations
                                  .filter((c) => c.intervention_id === help.id)
                                  .map((citation) => (
                                    <Link
                                      key={citation.passage_id}
                                      className="lp-citation"
                                      href={`/study/reading?${new URLSearchParams(
                                        {
                                          ...(assignmentId
                                            ? { assignment: assignmentId }
                                            : {}),
                                          session: view.session.id,
                                          version: citation.content_version,
                                          passage: citation.passage_id,
                                          citation: citation.intervention_id,
                                        },
                                      )}`}
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
                }
                sessionId={view.session.id}
                attemptId={last.id}
                disabled={busy || Boolean(pendingReading)}
                locked={locked}
                answerRetryAllowed={answerRetryAllowed}
                answerRecoveryNotice={
                  answerRecovery ? (
                    <div className="lp-notice mx-4 my-2" role="status">
                      <p>{answerSaveMessage(answerRecovery)}</p>
                      <button
                        type="button"
                        className="lp-text-link mr-4"
                        disabled={busy}
                        onClick={() => void checkAnswerSave()}
                      >
                        Check answer save
                      </button>
                      {answerRecovery.state !== "acknowledged" && (
                        <Link
                          href="/login"
                          target="_blank"
                          rel="noopener"
                          className="lp-text-link"
                        >
                          Sign in in a new tab
                        </Link>
                      )}
                      {answerRecovery.state !== "acknowledged" && (
                        <p>
                          After signing in, return to this tab and check the
                          answer save.
                        </p>
                      )}
                    </div>
                  ) : undefined
                }
                readOnly={view.progress.phase !== "answer"}
                transport={conversationTransport}
                text={draft}
                onTextChange={(text) => {
                  setDraft(text);
                  if (
                    !submission.current ||
                    submission.current.state === "local"
                  )
                    rememberAnswer({
                      session: view.session.id,
                      attempt: last.id,
                      key: submission.current?.key ?? crypto.randomUUID(),
                      response: text,
                      state: "local",
                    });
                }}
                onSubmitAnswer={answer}
                onLessonChanged={async ({ evaluate: evaluateAnswer }) => {
                  const updated = await refresh(view.session.id);
                  if (
                    evaluateAnswer &&
                    updated.progress.phase === "evaluate" &&
                    updated.progress.current_attempt_id === last.id
                  ) {
                    saveDraft(last.id, null);
                    setDraft("");
                    submission.current = null;
                    setAnswerRecovery(null);
                    setAnswerRetryAllowed(false);
                    setLocked(false);
                    await evaluate();
                  }
                }}
                onCitation={({ passage_id, intervention_id }) => {
                  router.push(
                    `/study/reading?${new URLSearchParams({
                      ...(assignmentId ? { assignment: assignmentId } : {}),
                      session: view.session.id,
                      passage: passage_id,
                      citation: intervention_id,
                      from: "study",
                    })}`,
                  );
                }}
              />
            )}
          </div>
          {(phase !== "answer" || pendingReading) && (
            <div className="lp-session-actions">
              {phase !== "answer" && (
                <p
                  className="lp-study-session-state"
                  ref={phase === "completed" ? completionStep : undefined}
                  tabIndex={phase === "completed" ? -1 : undefined}
                >
                  {progressMessage}
                </p>
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
