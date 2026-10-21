"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "../components/icons.tsx";
import { StudentReading } from "./reading.tsx";
import {
  TutorViewSchema,
  type AssignedLesson,
  type TutorView,
} from "../../lib/tutoring/contracts.ts";

const button = "lp-button lp-button-primary";
// Some browsers disable tab storage. That must never prevent an answer being sent.
function saveDraft(attempt: string, value: unknown | null) {
  try {
    if (value === null) sessionStorage.removeItem(`learning-pulse:${attempt}`);
    else
      sessionStorage.setItem(
        `learning-pulse:${attempt}`,
        JSON.stringify(value),
      );
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
  topics,
}: {
  lessons: AssignedLesson[];
  initial: TutorView | null;
  topics: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [displayRetry, setDisplayRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [readingBusy, setReadingBusy] = useState(false);
  const currentStep = useRef<HTMLHeadingElement>(null);
  const feedbackStep = useRef<HTMLHeadingElement>(null);
  const focusedAttempt = useRef<string | null>(null);
  const completion = useRef<HTMLHeadingElement>(null);
  const [readingRequest, setReadingRequest] = useState<{
    passage: string;
    citation?: string;
    key: number;
  } | null>(null);
  const pendingReading = view?.pending_reading;
  const restoredReading = useRef<string | null>(null);
  useEffect(() => {
    const id = view?.session.id;
    if (!id || restoredReading.current === id) return;
    restoredReading.current = id;
    const passage = window.location.hash.slice(1);
    if (!pendingReading && /^P\d+$/.test(passage))
      queueMicrotask(() => setReadingRequest({ passage, key: Date.now() }));
  }, [view?.session.id, pendingReading]);
  // On refresh, finish displaying an interrupted passage before accepting an answer.
  useEffect(() => {
    if (!pendingReading) return;
    queueMicrotask(() =>
      setReadingRequest({
        passage: pendingReading.passage_id,
        key: Date.now(),
      }),
    );
  }, [pendingReading]);
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
  useEffect(() => {
    if (!lastId || submittedAt) return;
    submission.current = null;
    queueMicrotask(() => setLocked(false));
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(`learning-pulse:${lastId}`);
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
  // Bound background checks, then leave the explicit Check saved progress control.
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
            "We couldn’t refresh your saved progress. Check your connection, then choose Check saved progress.",
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
          ? completion.current
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
            "The feedback is visible, but we couldn’t confirm it was shown. Check progress before continuing.",
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
      setView(updated);
      router.replace(`/study?session=${updated.session.id}`);
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
  return (
    <section className={view ? "lp-conversation" : ""}>
      <header className="lp-page-heading">
        {view ? (
          <Link href="/study" className="lp-text-link mb-3">
            <Icon name="back" />
            Back to your assignments
          </Link>
        ) : (
          <p className="lp-eyebrow">Your learning</p>
        )}
        <h1 className="lp-title">
          {view
            ? (assignment?.title ?? "Your study session")
            : "Make room for a little discovery."}
        </h1>
        <p className="lp-intro">
          {view
            ? "Take your time. Explain your thinking, and we’ll work through the next step together."
            : "Work through your assigned lesson with support, one question at a time."}
        </p>
        <p className="mt-2 text-xs text-slate-600">
          Fictional student demo · Team-approved networking lesson
        </p>
        {view && (
          <div className="lp-session-actions">
            <button
              type="button"
              className="lp-button"
              disabled={busy || readingBusy}
              onClick={() =>
                setReadingRequest({ passage: "", key: Date.now() })
              }
            >
              <Icon name="book" /> Assigned reading
            </button>
            <a href="#conversation" className="lp-text-link">
              Your saved conversation
            </a>
          </div>
        )}
      </header>
      {error && (
        <div role="alert" className="lp-notice lp-notice-warning mb-5">
          {error}{" "}
          <Link href="/login" className="underline">
            Check sign-in
          </Link>
        </div>
      )}
      {!view ? (
        <>
          {lessons.length === 0 && (
            <p className="lp-panel">
              No assignments are active for this account yet. Ask your teacher
              to review and activate the prepared lesson.
            </p>
          )}
          <div className="lp-study-grid">
            <div className="space-y-5">
              {lessons.map((lesson) => (
                <article key={lesson.id} className="lp-panel lp-lesson-hero">
                  <span className="lp-eyebrow">Your assignment</span>
                  <h2>{lesson.title}</h2>
                  <p className="text-slate-600">
                    Explore how networks move information. Share your reasoning,
                    get helpful feedback, and try a fresh question.
                  </p>
                  <p className="my-3 text-sm text-slate-600">
                    {lesson.approval_label}
                  </p>
                  <p className="my-3 text-sm font-medium">
                    {lesson.session
                      ? lesson.session.status === "active"
                        ? "In progress · Your work is saved"
                        : "Session saved · Review your conversation"
                      : "Ready when you are"}
                  </p>
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => void start(lesson.id)}
                  >
                    {busy
                      ? "Opening…"
                      : !lesson.session
                        ? "Start session"
                        : lesson.session.status === "active"
                          ? "Continue session"
                          : "View saved session"}
                    <Icon name="arrow" />
                  </button>
                </article>
              ))}
              {lessons.length > 0 && (
                <div className="lp-panel lp-learning-note">
                  <span className="lp-avatar">
                    <Icon name="clock" />
                  </span>
                  <div>
                    <h2>Pick up where you left off</h2>
                    <p>
                      Your submitted answers and feedback are saved. Return here
                      any time to continue your session or read it again.
                    </p>
                  </div>
                </div>
              )}
            </div>
            {topics.length > 0 && (
              <aside className="lp-panel">
                <h2>Topics in this lesson</h2>
                <p className="lp-panel-description">
                  Five ideas behind network performance.
                </p>
                <ul className="lp-topic-list">
                  {topics.map((topic) => (
                    <li className="lp-topic" key={topic.id}>
                      <span className="lp-avatar">
                        <Icon name="book" />
                      </span>
                      {topic.title}
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </div>
        </>
      ) : (
        <>
          <div
            role="status"
            aria-live="polite"
            className="lp-notice lp-tutor-status"
          >
            {busy
              ? "Saving and checking your answer… You can return to this session if you need to leave."
              : view.progress.message}
          </div>
          <StudentReading
            sessionId={view.session.id}
            requested={readingRequest}
            onBusy={setReadingBusy}
            onSelect={(passage) => {
              if (!readingBusy) setReadingRequest({ passage, key: Date.now() });
            }}
            onDisplayed={async () => {
              await refresh(view.session.id);
            }}
            onReturn={() => {
              setReadingRequest(null);
              window.history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search,
              );
              const target = currentStep.current ?? completion.current;
              target?.focus({ preventScroll: true });
              target?.scrollIntoView({ block: "nearest" });
            }}
          />
          <div id="conversation" className="lp-panel lp-conversation-card">
            <div className="lp-conversation-heading">
              Your conversation · Submitted answers are saved
            </div>
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
                              <a
                                key={citation.passage_id}
                                className="lp-citation"
                                href={`#${citation.passage_id}`}
                                onClick={(event) => {
                                  event.preventDefault();
                                  if (readingBusy || busy) return;
                                  window.history.replaceState(
                                    null,
                                    "",
                                    `#${citation.passage_id}`,
                                  );
                                  setReadingRequest({
                                    passage: citation.passage_id,
                                    citation: citation.intervention_id,
                                    key: Date.now(),
                                  });
                                }}
                              >
                                Open reading passage {citation.passage_id}
                              </a>
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
                  disabled={
                    busy || locked || readingBusy || Boolean(pendingReading)
                  }
                  rows={4}
                  placeholder="Write what you think, and why…"
                  className="lp-input"
                />
                <div className="lp-composer-footer">
                  <p>A rough idea is a good place to start.</p>
                  <button
                    className={button}
                    disabled={
                      busy ||
                      readingBusy ||
                      Boolean(pendingReading) ||
                      !draft.trim()
                    }
                  >
                    {busy
                      ? "Checking…"
                      : locked
                        ? "Retry sending saved answer"
                        : "Submit answer"}
                    <Icon name="send" />
                  </button>
                </div>
              </form>
            )}
          </div>
          <div className="lp-session-actions">
            {view.progress.phase === "completed" && (
              <section className="lp-panel lp-session-complete">
                <span className="lp-avatar">
                  <Icon name="check" />
                </span>
                <h2 ref={completion} tabIndex={-1}>
                  Your session is saved
                </h2>
                <p>
                  You can revisit your answers and feedback above. A fresh
                  answer after help shows today’s progress; later practice helps
                  check what sticks.
                </p>
                <Link href="/study" className="lp-button lp-button-primary">
                  Back to your assignments <Icon name="arrow" />
                </Link>
              </section>
            )}
            {view.progress.phase === "evaluate" && (
              <button
                type="button"
                className={button}
                disabled={busy || readingBusy || Boolean(pendingReading)}
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
                  readingBusy ||
                  Boolean(pendingReading) ||
                  !view.progress.retry_allowed
                }
                onClick={() => void evaluate(true)}
              >
                {busy ? "Retrying evaluation…" : "Retry evaluation"}
              </button>
            )}
            {view.progress.phase === "completed" &&
              view.progress.next_review_at && (
                <p className="lp-notice w-full">
                  Suggested next practice:{" "}
                  {new Date(view.progress.next_review_at).toLocaleString(
                    "en-US",
                    { timeZone: "UTC" },
                  )}{" "}
                  UTC. This is an illustrative demo reminder.
                </p>
              )}
            <button
              type="button"
              className="lp-button"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await refresh(view.session.id);
                  setDisplayRetry((value) => value + 1);
                })
              }
            >
              Check saved progress
            </button>
          </div>
        </>
      )}
    </section>
  );
}
