"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";
import { Icon } from "../components/icons.tsx";
import {
  DIALOGUE_LIMITS,
  AskTutorSchema,
  type AskTutor,
} from "../../lib/dialogue/contracts.ts";
import {
  DIALOGUE_QUICK_ACTIONS,
  makeAskAction,
  makeReturnAction,
  makeDisplayAcknowledgement,
  parseStudentDialogueView,
  type DialogueTransport,
  type StudentDialogueView,
  type StudentDialogueTurn,
} from "../../lib/dialogue/student-view.ts";

const RecoverySchema = z.strictObject({
  mode: z.enum(["answer", "ask"]),
  purpose: AskTutorSchema.shape.purpose,
  text: z.string().max(DIALOGUE_LIMITS.requestCharacters),
});

// A client timeout never retries generation. The server must reconcile its request.
async function bounded(operation: Promise<unknown>): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("timeout")),
          DIALOGUE_LIMITS.timeoutMs + 5_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Presentation only. #75 supplies the authorized transport; #74 supplies help. */
export function StudyDialogue({
  sessionId,
  attemptId,
  disabled = false,
  children,
  onReturn,
  onCitation,
  transport,
  preview = false,
}: {
  sessionId: string;
  attemptId: string;
  disabled?: boolean;
  children: ReactNode;
  onReturn: () => void;
  onCitation: (citation: {
    passage_id: string;
    intervention_id: string;
  }) => void;
  transport?: DialogueTransport;
  preview?: boolean;
}) {
  const [mode, setMode] = useState<"answer" | "ask">("answer");
  const [text, setText] = useState("");
  const [purpose, setPurpose] = useState<AskTutor["purpose"]>("question");
  const [view, setView] = useState<StudentDialogueView | null>(null);
  const [working, setWorking] = useState(false);
  const [sending, setSending] = useState<{
    request_id: string;
    text: string;
  } | null>(null);
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [displayError, setDisplayError] = useState(false);
  const [displayRetry, setDisplayRetry] = useState(0);
  const latest = useRef<StudentDialogueView | null>(null);
  const epoch = useRef(0);
  const inFlight = useRef(false);
  const returningRef = useRef(false);
  const mounted = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const focusOnEnter = useRef(false);
  const acknowledging = useRef(new Set<string>());
  const [restored, setRestored] = useState(false);
  const recoveryKey = `learning-pulse:dialogue-ui:${preview ? "preview" : "live"}:${sessionId}:${attemptId}`;
  const accepted =
    view?.turns.filter((t) => t.response.status === "accepted") ?? [];
  const needsDisplay = accepted.length > 0;
  const pending = Boolean(view?.state.active_request_id);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      epoch.current += 1;
    };
  }, []);

  const receive = useCallback(
    (value: unknown) => {
      const next = parseStudentDialogueView(
        value,
        { sessionId, attemptId },
        latest.current ?? undefined,
      );
      latest.current = next;
      setView(next);
      return next;
    },
    [sessionId, attemptId],
  );

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(recoveryKey);
      const saved = stored
        ? RecoverySchema.safeParse(JSON.parse(stored))
        : null;
      queueMicrotask(() => {
        if (saved?.success) {
          focusOnEnter.current = saved.data.mode === "ask";
          setText(saved.data.text);
          setPurpose(saved.data.purpose);
          setMode(saved.data.mode);
        }
        setRestored(true);
      });
    } catch {
      queueMicrotask(() => setRestored(true));
    }
  }, [recoveryKey]);
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(
        recoveryKey,
        JSON.stringify({ mode, purpose, text }),
      );
    } catch {
      // Disabled tab storage must not disable the ordinary lesson.
    }
  }, [restored, recoveryKey, mode, purpose, text]);

  const load = useCallback(async () => {
    if (!transport || inFlight.current) return;
    const requestEpoch = ++epoch.current;
    inFlight.current = true;
    setWorking(true);
    setError(null);
    try {
      const result = await bounded(transport.load());
      if (!mounted.current || epoch.current !== requestEpoch) return;
      receive(result);
      setUncertain(false);
    } catch {
      if (mounted.current && epoch.current === requestEpoch) {
        setError(
          "We couldn’t check your saved help. Your answer is still here. Check your connection and try again.",
        );
        setUncertain(true);
      }
    } finally {
      if (mounted.current && epoch.current === requestEpoch) {
        inFlight.current = false;
        setWorking(false);
      }
    }
  }, [transport, receive]);

  // Reconnect is read-only. Never resend an ask just because the page reloaded.
  useEffect(() => {
    if (!restored || mode !== "ask" || !transport || latest.current) return;
    void load();
  }, [restored, mode, transport, load]);

  function openAsk() {
    focusOnEnter.current = true;
    setMode("ask");
    setError(null);
    setUnavailable(false);
    if (transport) void load();
  }

  useEffect(() => {
    if (
      mode !== "ask" ||
      working ||
      returning ||
      disabled ||
      !focusOnEnter.current
    )
      return;
    const frame = requestAnimationFrame(() => {
      if (input.current && !input.current.disabled) {
        input.current.focus();
        focusOnEnter.current = false;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, working, returning, disabled]);

  // Bring newly received help into view; the existing visibility check records
  // assistance only after it is actually shown, never merely on arrival.
  const newestTurn = view?.turns.at(-1);
  useEffect(() => {
    if (mode !== "ask" || newestTurn?.response.status !== "accepted") return;
    document
      .getElementById(`dialogue-${newestTurn.request_id}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [mode, newestTurn?.request_id, newestTurn?.response.status]);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (
      disabled ||
      inFlight.current ||
      returningRef.current ||
      !text.trim() ||
      needsDisplay
    )
      return;
    if (!transport) {
      setUnavailable(true);
      return;
    }
    const current = latest.current;
    if (!current || uncertain || current.state.active_request_id) return;
    const requestEpoch = ++epoch.current;
    inFlight.current = true;
    setWorking(true);
    setError(null);
    try {
      const action = makeAskAction(
        current.state,
        purpose,
        text,
        crypto.randomUUID(),
      );
      setSending({ request_id: action.request_id, text: action.text });
      const result = await bounded(transport.act(action));
      if (!mounted.current || epoch.current !== requestEpoch) return;
      receive(result);
      setText("");
      setPurpose("question");
    } catch {
      if (mounted.current && epoch.current === requestEpoch) {
        setUncertain(true);
        setError(
          "We couldn’t confirm the help request. Check saved help before sending again; your question and answer are still here.",
        );
      }
    } finally {
      if (mounted.current && epoch.current === requestEpoch) {
        inFlight.current = false;
        setWorking(false);
        setSending(null);
      }
    }
  }

  async function returnToQuestion() {
    // Accepted help stays in place until display is saved, including after
    // refresh. An in-memory visibility flag cannot prove it was never seen.
    if (returningRef.current || needsDisplay) return;
    returningRef.current = true;
    const requestEpoch = ++epoch.current; // Late help cannot replace a returned activity.
    inFlight.current = false;
    setWorking(false);
    setSending(null);
    setReturning(true);
    setError(null);
    try {
      if (transport) {
        // Even after an offline/unknown request, cancellation is server-owned.
        const current =
          latest.current ?? receive(await bounded(transport.load()));
        const result = await bounded(
          transport.act(makeReturnAction(current.state, crypto.randomUUID())),
        );
        if (!mounted.current || epoch.current !== requestEpoch) return;
        const next = receive(result);
        if (next.turns.some((t) => t.response.status === "accepted"))
          throw new Error("Unconfirmed help remains");
      }
      if (!mounted.current || epoch.current !== requestEpoch) return;
      setMode("answer");
      setUncertain(false);
      setUnavailable(false);
      onReturn();
    } catch {
      if (mounted.current && epoch.current === requestEpoch)
        setError(
          "We couldn’t confirm the return. Check saved help so any help you saw is recorded before you answer.",
        );
    } finally {
      if (mounted.current && epoch.current === requestEpoch) {
        returningRef.current = false;
        setReturning(false);
      }
    }
  }

  // Only accepted content rendered in a visible document can be acknowledged.
  // Acks are idempotent and retries keep their original request ID.
  useEffect(() => {
    if (mode !== "ask" || !transport || !view) return;
    let stopped = false;
    async function confirm() {
      if (document.visibilityState !== "visible" || stopped) return;
      for (const turn of view!.turns) {
        if (turn.response.status !== "accepted") continue;
        const element = document.getElementById(`dialogue-${turn.request_id}`);
        if (!element || acknowledging.current.has(turn.request_id)) continue;
        const rect = element.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
        const current = latest.current;
        if (!current) continue;
        const requestEpoch = epoch.current;
        acknowledging.current.add(turn.request_id);
        try {
          const ack = makeDisplayAcknowledgement(current.state, turn);
          const result = await bounded(transport!.acknowledge(ack));
          if (!mounted.current || epoch.current !== requestEpoch) return;
          receive(result);
          setDisplayError(false);
        } catch {
          if (mounted.current && epoch.current === requestEpoch)
            setDisplayError(true);
        }
        // Keep a failed attempt reserved until an explicit retry or refresh.
      }
    }
    const observer = new IntersectionObserver(() => void confirm());
    for (const turn of view.turns) {
      const element = document.getElementById(`dialogue-${turn.request_id}`);
      if (element && turn.response.status === "accepted")
        observer.observe(element);
    }
    document.addEventListener("visibilitychange", confirm);
    void confirm();
    return () => {
      stopped = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", confirm);
    };
  }, [view, mode, transport, displayRetry, receive]);

  return (
    <div className="lp-dialogue">
      <div
        className="lp-dialogue-tabs"
        role="group"
        aria-label="Choose how to respond"
      >
        <button
          type="button"
          className="lp-button"
          aria-pressed={mode === "answer"}
          disabled={disabled || returning || needsDisplay}
          onClick={() => {
            if (mode !== "answer") void returnToQuestion();
          }}
        >
          <Icon name="send" /> Answer the question
        </button>
        <button
          type="button"
          className="lp-button"
          aria-pressed={mode === "ask"}
          disabled={disabled || returning}
          onClick={() => {
            if (mode !== "ask") openAsk();
          }}
        >
          <Icon name="chat" /> Ask the tutor
        </button>
      </div>
      <div hidden={mode !== "answer"}>{children}</div>
      {mode === "ask" && (
        <section className="lp-dialogue-body" aria-label="Ask the tutor">
          <div className="lp-dialogue-heading">
            <p>Your answer stays here. Asking won’t submit it.</p>
            <button
              type="button"
              className="lp-text-link"
              disabled={returning || needsDisplay}
              onClick={() => void returnToQuestion()}
            >
              <Icon name="back" />{" "}
              {returning ? "Returning…" : "Return to question"}
            </button>
          </div>
          {(Boolean(view?.turns.length) || sending) && (
            <ol
              className="lp-dialogue-turns"
              aria-label="Your questions and tutor help"
            >
              {view?.turns.map((turn) => (
                <DialogueTurn
                  key={turn.request_id}
                  turn={turn}
                  preview={preview}
                  onCitation={onCitation}
                  disabled={disabled || needsDisplay}
                />
              ))}
              {sending &&
                !view?.turns.some(
                  (turn) => turn.request_id === sending.request_id,
                ) && (
                  <li className="lp-dialogue-turn">
                    <div className="lp-student-message">
                      <h3 className="lp-message-label">You</h3>
                      <p className="lp-answer">{sending.text}</p>
                    </div>
                  </li>
                )}
            </ol>
          )}
          {working && (
            <p role="status" className="lp-notice">
              {sending
                ? "Waiting for the tutor… Your assignment answer hasn’t been submitted."
                : "Checking your saved conversation…"}
            </p>
          )}
          {!working && pending && !needsDisplay && (
            <p role="status" className="lp-notice">
              Your help request is still pending. Check saved help or return to
              the question.
            </p>
          )}
          {unavailable && (
            <p role="status" className="lp-notice">
              Extra tutor help isn’t connected yet. You can use the assigned
              reading or return to your answer.
            </p>
          )}
          {error && (
            <p role="alert" className="lp-notice lp-notice-warning">
              {error}
            </p>
          )}
          {needsDisplay && (
            <p role={displayError ? "alert" : "status"} className="lp-notice">
              {displayError
                ? "This help is visible, but its reading record couldn’t be saved. Retry before answering."
                : "Read the help above. We’ll confirm it was shown before you answer."}
              {displayError && (
                <button
                  type="button"
                  className="lp-text-link ml-2"
                  onClick={() => {
                    for (const turn of accepted)
                      acknowledging.current.delete(turn.request_id);
                    setDisplayError(false);
                    setDisplayRetry((n) => n + 1);
                  }}
                >
                  Retry saving help
                </button>
              )}
            </p>
          )}
          {transport && (uncertain || pending || error) && (
            <button
              type="button"
              className="lp-text-link my-3"
              disabled={working || returning}
              onClick={() => {
                acknowledging.current.clear();
                void load();
              }}
            >
              Check saved help
            </button>
          )}
          <form
            onSubmit={(event) => void ask(event)}
            className="lp-ask-composer"
          >
            <div
              className="lp-dialogue-suggestions"
              role="group"
              aria-label="Optional starting points"
            >
              {DIALOGUE_QUICK_ACTIONS.map((suggestion) => (
                <button
                  key={suggestion.purpose}
                  type="button"
                  className="lp-dialogue-chip"
                  disabled={
                    disabled || working || returning || needsDisplay || pending
                  }
                  onClick={() => {
                    setText(suggestion.text);
                    setPurpose(suggestion.purpose);
                    input.current?.focus();
                  }}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
            <label htmlFor="tutor-question" className="sr-only">
              Your question for the tutor
            </label>
            <textarea
              id="tutor-question"
              ref={input}
              className="lp-input"
              value={text}
              rows={3}
              maxLength={DIALOGUE_LIMITS.requestCharacters}
              required
              placeholder="Ask anything about this lesson..."
              disabled={disabled || working || returning}
              onChange={(event) => {
                setText(event.target.value);
                if (!event.target.value) setPurpose("question");
              }}
            />
            <div className="lp-composer-footer">
              <p>This asks for help, not a grade.</p>
              <button
                type="submit"
                className="lp-button lp-button-primary"
                disabled={
                  disabled ||
                  working ||
                  returning ||
                  needsDisplay ||
                  pending ||
                  uncertain ||
                  (Boolean(transport) && !view) ||
                  !text.trim()
                }
              >
                {working ? "Please wait…" : "Send"} <Icon name="send" />
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

function DialogueTurn({
  turn,
  preview,
  onCitation,
  disabled,
}: {
  turn: StudentDialogueTurn;
  preview: boolean;
  disabled: boolean;
  onCitation: (citation: {
    passage_id: string;
    intervention_id: string;
  }) => void;
}) {
  const response = turn.response;
  return (
    <li className="lp-turn lp-dialogue-turn">
      <div className="lp-student-message">
        <h3 className="lp-message-label">You</h3>
        <p className="lp-answer">{turn.text}</p>
      </div>
      {response.status === "pending" ? (
        <p role="status">Waiting for checked help…</p>
      ) : response.status === "fallback" ? (
        <p className="lp-notice">{response.fallback.text}</p>
      ) : (
        <div className="lp-question" id={`dialogue-${turn.request_id}`}>
          <h3 className="lp-message-label">
            <Icon name="pulse" />{" "}
            {preview
              ? "Example tutor · Fixture, not live AI"
              : "Learning Pulse"}
          </h3>
          <p className="whitespace-pre-wrap">{response.content.text}</p>
          {response.citations.map((citation) => (
            <button
              key={citation.passage_id}
              type="button"
              className="lp-citation"
              disabled={disabled}
              onClick={() =>
                onCitation({
                  passage_id: citation.passage_id,
                  intervention_id: response.intervention_id,
                })
              }
            >
              Open reading passage {citation.passage_id}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
