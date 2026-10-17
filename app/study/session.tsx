"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TutorViewSchema,
  type TutorView,
} from "../../lib/tutoring/contracts.ts";

type Lesson = { id: string; title: string; approval_label: string };
const button =
  "rounded-lg bg-teal-800 px-5 py-3 font-medium text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed disabled:opacity-50";
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
}: {
  lessons: Lesson[];
  initial: TutorView | null;
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
    <section className="mt-8 space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4"
        >
          {error}
        </div>
      )}
      {!view ? (
        <>
          <h2 className="text-xl font-semibold">Your assignment</h2>
          {lessons.length === 0 && (
            <p>
              No assignments are available for this account. Ask your teacher
              which fictional student login to use.
            </p>
          )}
          {lessons.map((lesson) => (
            <article
              key={lesson.id}
              className="rounded-xl border border-slate-200 bg-white p-6"
            >
              <h3 className="text-xl font-medium">{lesson.title}</h3>
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
              </button>
            </article>
          ))}
        </>
      ) : (
        <>
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg bg-teal-50 p-4"
          >
            {busy
              ? "Saving and checking your answer… You can return to this session if you need to leave."
              : view.progress.message}
          </div>
          <ol
            className="space-y-6"
            aria-label="Your saved learning conversation"
          >
            {view.attempts.map((attempt, index) => (
              <li
                key={attempt.id}
                className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <h2 className="mb-3 font-semibold">
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
                {attempt.submitted_at && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold">
                      Your answer — saved
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap break-words">
                      {attempt.response_text || "No response entered."}
                    </p>
                  </div>
                )}
                {view.interventions
                  .filter((help) => help.related_attempt_id === attempt.id)
                  .map((help) => (
                    <article
                      key={help.id}
                      className="rounded-xl border border-teal-200 bg-teal-50 p-5"
                    >
                      <h2 className="font-semibold">
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
                          <details key={citation.passage_id} className="mt-3">
                            <summary className="cursor-pointer underline">
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
                    </article>
                  ))}
              </li>
            ))}
          </ol>
          {view.progress.phase === "answer" && (
            <form onSubmit={(e) => void answer(e)} className="space-y-3">
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
                rows={5}
                className="w-full rounded-lg border border-slate-400 p-3 focus-visible:outline-teal-700"
              />
              <button className={button} disabled={busy || !draft.trim()}>
                {busy
                  ? "Checking…"
                  : locked
                    ? "Retry sending saved answer"
                    : "Submit answer"}
              </button>
            </form>
          )}
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
              <p className="rounded-lg bg-slate-50 p-4">
                Suggested next practice:{" "}
                {new Date(view.progress.next_review_at).toLocaleString()}. This
                is an illustrative demo reminder.
              </p>
            )}
          <button
            type="button"
            className="rounded border border-slate-300 px-4 py-2 underline disabled:opacity-50"
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
        </>
      )}
    </section>
  );
}
