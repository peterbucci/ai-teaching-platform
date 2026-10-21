"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "../components/icons.tsx";
import {
  TutorViewSchema,
  type TutorView,
} from "../../lib/tutoring/contracts.ts";

type Lesson = { id: string; title: string; approval_label: string };
const button = "lp-button lp-button-primary";
async function request(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value: unknown = await response.json();
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
  return value;
}
export function StudySession({
  lessons,
  initial,
  topics,
}: {
  lessons: Lesson[];
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
  const busyRef = useRef(false);
  const submission = useRef<{
    attempt: string;
    key: string;
    response: string;
  } | null>(null);
  const last = view?.attempts.at(-1);
  const lastId = last?.id;
  const submittedAt = last?.submitted_at;
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
    const stored = sessionStorage.getItem(`learning-pulse:${lastId}`);
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
        sessionStorage.removeItem(`learning-pulse:${lastId}`);
      }
    } else queueMicrotask(() => setDraft(""));
  }, [lastId, submittedAt]);
  // Acknowledgement follows rendering. Creating or fetching help alone does not
  // record it as assistance. The server owns its visibility timestamp.
  const pendingHelp =
    view?.interventions
      .filter((i) => i.delivery_status === "created")
      .map((i) => i.id)
      .join(",") ?? "";
  const sessionId = view?.session.id;
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
      sessionStorage.setItem(
        `learning-pulse:${last.id}`,
        JSON.stringify({ ...next, locked: true }),
      );
      await request(`/api/sessions/${view.session.id}/answers`, {
        attempt_id: last.id,
        submission_key: next.key,
        response_text: next.response,
      });
      await refresh(view.session.id);
      sessionStorage.removeItem(`learning-pulse:${last.id}`);
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
          {view ? "Your study session" : "Make room for a little discovery."}
        </h1>
        <p className="lp-intro">
          {view
            ? "Take your time. Explain your thinking, and we’ll work through the next step together."
            : "Work through your assigned lesson with support, one question at a time."}
        </p>
        <p className="mt-2 text-xs text-slate-600">
          Fictional student demo · Team-approved networking lesson
        </p>
      </header>
      {error && (
        <div role="alert" className="lp-notice lp-notice-warning mb-5">
          {error}
        </div>
      )}
      {!view ? (
        <>
          {lessons.length === 0 && (
            <p className="lp-panel">
              No assignments are available for this account. Ask your teacher
              which fictional student login to use.
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
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => void start(lesson.id)}
                  >
                    {busy ? "Opening…" : "Start or resume"}
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
                      Your submitted answers and feedback are saved. Use Start
                      or resume to return to your latest session.
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
          <div className="lp-panel lp-conversation-card">
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
                    <h2>
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
                    .filter((help) => help.related_attempt_id === attempt.id)
                    .map((help) => (
                      <article key={help.id} className="lp-feedback">
                        <div className="lp-message-label">
                          <span className="lp-tutor-mark">
                            <Icon name="pulse" />
                          </span>
                          Learning Pulse
                        </div>
                        <div className="lp-question">
                          <h2>
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
                              <details
                                key={citation.passage_id}
                                className="lp-citation"
                              >
                                <summary>
                                  Reading passage {citation.passage_id}
                                </summary>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                  {citation.text}
                                </p>
                                <a
                                  href={citation.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-block text-sm underline"
                                >
                                  Peterson and Davie, Computer Networks — source
                                  passage
                                </a>
                              </details>
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
                      sessionStorage.setItem(
                        `learning-pulse:${last.id}`,
                        JSON.stringify({
                          key: crypto.randomUUID(),
                          response: e.target.value,
                        }),
                      );
                  }}
                  maxLength={12000}
                  required
                  disabled={busy || locked}
                  rows={4}
                  placeholder="Write what you think, and why…"
                  className="lp-input"
                />
                <div className="lp-composer-footer">
                  <p>A rough idea is a good place to start.</p>
                  <button className={button} disabled={busy || !draft.trim()}>
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
            {view.progress.phase === "evaluate" && (
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => void evaluate()}
              >
                Evaluate saved answer
              </button>
            )}
            {view.progress.phase === "failed" && (
              <button
                type="button"
                className={button}
                disabled={busy || !view.progress.retry_allowed}
                onClick={() => void evaluate(true)}
              >
                Retry evaluation
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
