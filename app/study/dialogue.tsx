"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../components/icons.tsx";
import {
  canUseCuratedAnswer,
  CONVERSATION_OPERATION_TIMEOUT_MS,
} from "./conversation-transport.ts";
import {
  DIALOGUE_LIMITS,
  type AskTutor,
} from "../../lib/dialogue/contracts.ts";
import {
  ConversationActionSchema,
  MESSAGE_CHARACTERS,
  makeCancelAction,
  makeMessageAction,
  makeResolveAction,
  parseConversationView,
  type ConversationAction,
  type ConversationTransport,
  type ConversationView,
} from "../../lib/dialogue/conversation.ts";
import {
  DIALOGUE_QUICK_ACTIONS,
  makeDisplayAcknowledgement,
  type StudentDialogueTurn,
} from "../../lib/dialogue/student-view.ts";

// A client timeout never retries generation. Reconnection reads saved state.
async function bounded(
  operation: Promise<unknown>,
  timeoutMs = DIALOGUE_LIMITS.timeoutMs + 5_000,
): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Presentation only. The server classifies and authorizes every routed message. */
export function StudyDialogue({
  sessionId,
  attemptId,
  disabled = false,
  locked = false,
  readOnly = false,
  text,
  onTextChange,
  onSubmitAnswer,
  onLessonChanged,
  onCitation,
  transport,
  preview = false,
}: {
  sessionId: string;
  attemptId: string;
  disabled?: boolean;
  locked?: boolean;
  readOnly?: boolean;
  text: string;
  onTextChange: (text: string) => void;
  onSubmitAnswer: (text: string) => Promise<void>;
  onLessonChanged: (options: { evaluate: boolean }) => Promise<void>;
  onCitation: (citation: {
    passage_id: string;
    intervention_id: string;
  }) => void;
  transport?: ConversationTransport;
  preview?: boolean;
}) {
  const [view, setView] = useState<ConversationView | null>(null);
  const [purpose, setPurpose] = useState<AskTutor["purpose"] | undefined>();
  const [previousDraft, setPreviousDraft] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState<ConversationAction | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [displayError, setDisplayError] = useState(false);
  const [displayRetry, setDisplayRetry] = useState(0);
  const [restored, setRestored] = useState(false);
  const latest = useRef<ConversationView | null>(null);
  const unresolved = useRef<ConversationAction | null>(null);
  const epoch = useRef(0);
  const inFlight = useRef(false);
  const checkingSaved = useRef(false);
  const mounted = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const focusAfterRequest = useRef(false);
  const acknowledging = useRef(new Set<string>());
  const notifiedAnswers = useRef(new Set<string>());
  const newlySubmittedAnswers = useRef(new Set<string>());
  const recoveryKey = `learning-pulse:conversation-request:${preview ? "preview" : "live"}:${sessionId}:${attemptId}`;
  const draftBackupKey = `${recoveryKey}:draft-backup`;
  const accepted =
    view?.dialogue.turns.filter(
      (turn) => turn.response.status === "accepted",
    ) ?? [];
  const needsDisplay = accepted.length > 0;
  const pending = Boolean(view?.dialogue.state.active_request_id);
  const recoverableMessage = view?.messages.find(
    (message) =>
      message.attempt_id === attemptId && message.outcome.status === "pending",
  );
  const fallbackAvailable = Boolean(view && canUseCuratedAnswer(view));
  const blocked =
    readOnly ||
    disabled ||
    locked ||
    working ||
    needsDisplay ||
    pending ||
    uncertain;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      epoch.current += 1;
    };
  }, []);

  const remember = useCallback(
    (action: ConversationAction | null) => {
      unresolved.current = action;
      setUnconfirmed(action);
      try {
        if (action) sessionStorage.setItem(recoveryKey, JSON.stringify(action));
        else sessionStorage.removeItem(recoveryKey);
      } catch {
        // The active-page guard remains effective if browser storage is unavailable.
      }
    },
    [recoveryKey],
  );

  const receive = useCallback(
    (value: unknown) => {
      const next = parseConversationView(
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

  function rememberDraftBackup(value: string | null) {
    setPreviousDraft(value);
    try {
      if (value === null) sessionStorage.removeItem(draftBackupKey);
      else sessionStorage.setItem(draftBackupKey, value);
    } catch {
      // The editable draft remains usable when tab storage is disabled.
    }
  }

  // An accepted answer is already persisted by the server. Refresh the lesson;
  // never convert a proposed classification into a browser-side answer request.
  useEffect(() => {
    for (const message of view?.messages ?? []) {
      if (
        message.attempt_id !== attemptId ||
        message.outcome.status !== "answer" ||
        notifiedAnswers.current.has(message.request_id)
      )
        continue;
      notifiedAnswers.current.add(message.request_id);
      void onLessonChanged({
        evaluate: newlySubmittedAnswers.current.delete(message.request_id),
      }).catch(() => {
        if (mounted.current)
          setError(
            "Your answer was saved, but the next lesson step could not be loaded. Refresh to continue.",
          );
      });
    }
  }, [view, attemptId, onLessonChanged]);

  useEffect(() => {
    let action: ConversationAction | null = null;
    let invalid = false;
    let backup: string | null = null;
    try {
      const saved = sessionStorage.getItem(recoveryKey);
      if (saved) {
        const result = ConversationActionSchema.safeParse(JSON.parse(saved));
        if (
          result.success &&
          result.data.session_id === sessionId &&
          result.data.attempt_id === attemptId
        )
          action = result.data;
        else invalid = true;
      }
      const draft = sessionStorage.getItem(draftBackupKey);
      if (draft !== null && draft.length <= MESSAGE_CHARACTERS) backup = draft;
    } catch {
      // The ordinary lesson remains usable if tab storage itself is disabled.
    }
    queueMicrotask(() => {
      unresolved.current = action;
      setUnconfirmed(action);
      setPreviousDraft(backup);
      setUncertain(Boolean(action) || invalid);
      if (invalid)
        setError(
          "We couldn’t read this tab’s pending message. Check the saved conversation before continuing.",
        );
      setRestored(true);
    });
  }, [recoveryKey, draftBackupKey, sessionId, attemptId]);

  const reconcile = useCallback(
    (next: ConversationView, action: ConversationAction | null) => {
      if (!action) return true;
      const id =
        action.action === "send_message"
          ? action.request_id
          : action.message_request_id;
      const message = next.messages.find((item) => item.request_id === id);
      const confirmed =
        !!message &&
        (action.action === "send_message"
          ? message.text === action.text
          : !["pending", "clarification"].includes(message.outcome.status));
      if (!confirmed) return false;
      remember(null);
      if (
        action.action === "send_message" &&
        text === action.text &&
        message.outcome.status !== "fallback"
      ) {
        onTextChange("");
        setPurpose(undefined);
      }
      return true;
    },
    [remember, text, onTextChange],
  );

  const load = useCallback(
    async (reconcileInFlight = false) => {
      if (
        !transport ||
        checkingSaved.current ||
        (inFlight.current && !reconcileInFlight)
      )
        return;
      // A read may take over waiting for a long POST. Its eventual response cannot
      // overwrite this snapshot, and the original operation is never resubmitted.
      checkingSaved.current = true;
      const requestEpoch = ++epoch.current;
      inFlight.current = true;
      setWorking(true);
      setError(null);
      try {
        const result = await bounded(transport.load());
        if (!mounted.current || epoch.current !== requestEpoch) return;
        const confirmed = reconcile(receive(result), unresolved.current);
        setUncertain(!confirmed);
        if (!confirmed)
          setError(
            "This message has not been confirmed yet. We won’t resend or grade it while its status is unknown. Check the saved conversation again.",
          );
      } catch {
        if (mounted.current && epoch.current === requestEpoch) {
          setError(
            "We couldn’t check your saved conversation. Your message is still here. Check your connection and try again.",
          );
          setUncertain(true);
        }
      } finally {
        checkingSaved.current = false;
        if (mounted.current && epoch.current === requestEpoch) {
          inFlight.current = false;
          setWorking(false);
        }
      }
    },
    [transport, receive, reconcile],
  );

  async function recoverSavedResponse() {
    if (
      !transport?.recover ||
      !recoverableMessage ||
      inFlight.current ||
      readOnly
    )
      return;
    const requestEpoch = ++epoch.current;
    inFlight.current = true;
    setWorking(true);
    setError(null);
    try {
      const result = await bounded(
        transport.recover(
          recoverableMessage.request_id,
          recoverableMessage.expected_revision,
        ),
      );
      if (!mounted.current || epoch.current !== requestEpoch) return;
      const confirmed = reconcile(receive(result), unresolved.current);
      setUncertain(!confirmed);
    } catch {
      if (mounted.current && epoch.current === requestEpoch)
        setError(
          "This response cannot be recovered yet. Its saved results may be incomplete or uncertain. No new AI request was made.",
        );
    } finally {
      if (mounted.current && epoch.current === requestEpoch) {
        inFlight.current = false;
        setWorking(false);
      }
    }
  }

  useEffect(() => {
    if (restored && transport && !latest.current) void load();
  }, [restored, transport, load]);

  useEffect(() => {
    if (blocked || !focusAfterRequest.current) return;
    const frame = requestAnimationFrame(() => {
      if (input.current && !input.current.disabled) {
        input.current.focus();
        focusAfterRequest.current = false;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [blocked]);

  // Bring accepted help into view; acknowledging it still requires visibility.
  const newestTurn = view?.dialogue.turns.at(-1);
  useEffect(() => {
    if (newestTurn?.response.status !== "accepted") return;
    document
      .getElementById(`dialogue-${newestTurn.request_id}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [newestTurn?.request_id, newestTurn?.response.status]);

  async function act(action: ConversationAction) {
    if (
      !transport ||
      inFlight.current ||
      disabled ||
      readOnly ||
      locked ||
      needsDisplay ||
      uncertain
    )
      return;
    const requestEpoch = ++epoch.current;
    inFlight.current = true;
    focusAfterRequest.current = true;
    setWorking(true);
    setError(null);
    remember(action);
    try {
      const result = await bounded(
        transport.act(action),
        CONVERSATION_OPERATION_TIMEOUT_MS,
      );
      if (!mounted.current || epoch.current !== requestEpoch) return;
      const next = receive(result);
      const messageId =
        action.action === "send_message"
          ? action.request_id
          : action.message_request_id;
      const message = next.messages.find(
        (item) => item.request_id === messageId,
      );
      if (message?.outcome.status === "answer")
        newlySubmittedAnswers.current.add(message.request_id);
      const confirmed = reconcile(next, action);
      setUncertain(!confirmed);
      if (!confirmed)
        setError(
          "We couldn’t confirm what happened to this message. Check the saved conversation before trying again.",
        );
    } catch {
      if (mounted.current && epoch.current === requestEpoch) {
        setUncertain(true);
        setError(
          "We couldn’t confirm the request. Your message is preserved. Check the saved conversation before sending again.",
        );
      }
    } finally {
      if (mounted.current && epoch.current === requestEpoch) {
        inFlight.current = false;
        setWorking(false);
      }
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (blocked || inFlight.current || !text.trim()) return;
    if (!transport || fallbackAvailable) {
      setUnavailable(true);
      return;
    }
    const current = latest.current;
    if (!current) return;
    await act(
      makeMessageAction(
        current.dialogue.state,
        text,
        crypto.randomUUID(),
        purpose,
      ),
    );
  }

  async function submitFallbackAnswer() {
    // Confirmation is separate from Send. The existing server answer path still
    // checks pending operations, displayed assistance and the current attempt.
    if (
      (transport && !fallbackAvailable && !locked) ||
      readOnly ||
      disabled ||
      working ||
      uncertain ||
      needsDisplay ||
      pending ||
      inFlight.current ||
      !text.trim()
    )
      return;
    inFlight.current = true;
    setWorking(true);
    setError(null);
    try {
      await onSubmitAnswer(text);
      setUnavailable(false);
    } catch {
      if (mounted.current)
        setError(
          "Your answer could not be confirmed. Your text is still here; retry the saved answer.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setWorking(false);
    }
  }

  // Accepted help counts as assistance only after it is actually displayed.
  useEffect(() => {
    if (!transport || !view) return;
    let stopped = false;
    async function confirm() {
      if (document.visibilityState !== "visible" || stopped) return;
      for (const turn of view!.dialogue.turns) {
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
          const ack = makeDisplayAcknowledgement(current.dialogue.state, turn);
          const result = await bounded(transport!.acknowledge(ack));
          if (!mounted.current || epoch.current !== requestEpoch) return;
          receive(result);
          setDisplayError(false);
        } catch {
          if (mounted.current && epoch.current === requestEpoch)
            setDisplayError(true);
        }
      }
    }
    const observer = new IntersectionObserver(() => void confirm());
    for (const turn of view.dialogue.turns) {
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
  }, [view, transport, displayRetry, receive]);

  return (
    <section
      className="lp-dialogue lp-dialogue-body"
      aria-label="Conversation with your tutor"
    >
      {(Boolean(view?.messages.length) ||
        unconfirmed?.action === "send_message") && (
        <ol className="lp-dialogue-turns" aria-label="Your conversation">
          {view?.messages.map((message) => {
            const outcome = message.outcome;
            const help =
              outcome.status === "help"
                ? view.dialogue.turns.find(
                    (turn) => turn.request_id === outcome.dialogue_request_id,
                  )
                : undefined;
            return (
              <li className="lp-turn lp-dialogue-turn" key={message.request_id}>
                <div className="lp-student-message">
                  <h3 className="lp-message-label">You</h3>
                  <p className="lp-answer">{message.text}</p>
                </div>
                {help && (
                  <TutorHelp
                    turn={help}
                    preview={preview}
                    onCitation={onCitation}
                    disabled={disabled || needsDisplay}
                  />
                )}
                {outcome.status === "pending" && (
                  <p role="status">Checking your message…</p>
                )}
                {outcome.status === "clarification" && (
                  <div className="lp-question">
                    <p>
                      Would you like to submit that as your answer, or are you
                      asking for help? Nothing has been graded.
                    </p>
                    <div className="lp-dialogue-suggestions mt-3">
                      {(["answer", "help"] as const).map((choice) => (
                        <button
                          type="button"
                          className="lp-button"
                          key={choice}
                          disabled={
                            disabled || working || uncertain || needsDisplay
                          }
                          onClick={() =>
                            void act(
                              makeResolveAction(
                                view.dialogue.state,
                                message.request_id,
                                choice,
                                crypto.randomUUID(),
                              ),
                            )
                          }
                        >
                          {choice === "answer"
                            ? "Submit as my answer"
                            : "I’m asking for help"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {outcome.status === "fallback" && (
                  <p className="lp-notice">{outcome.text}</p>
                )}
                {outcome.status === "answer" && (
                  <p role="status">
                    {preview
                      ? "Fixture: answer submitted. No real evaluation was run."
                      : "Your answer is saved."}
                  </p>
                )}
                {outcome.status === "cancelled" && (
                  <p className="lp-muted">
                    Message cancelled. Your lesson question is still active.
                  </p>
                )}
                {["pending", "clarification"].includes(outcome.status) && (
                  <button
                    type="button"
                    className="lp-text-link"
                    disabled={disabled || working || uncertain || needsDisplay}
                    onClick={() =>
                      void act(
                        makeCancelAction(
                          view.dialogue.state,
                          message.request_id,
                          crypto.randomUUID(),
                        ),
                      )
                    }
                  >
                    Cancel this message
                  </button>
                )}
              </li>
            );
          })}
          {unconfirmed?.action === "send_message" &&
            !view?.messages.some(
              (message) => message.request_id === unconfirmed.request_id,
            ) && (
              <li className="lp-dialogue-turn">
                <div className="lp-student-message">
                  <h3 className="lp-message-label">You</h3>
                  <p className="lp-answer">{unconfirmed.text}</p>
                </div>
              </li>
            )}
        </ol>
      )}
      {working && (
        <p role="status" className="lp-notice">
          {unconfirmed ? "Checking your message…" : "Please wait…"}
        </p>
      )}
      {!readOnly && (unavailable || fallbackAvailable) && !locked && (
        <div className="lp-notice" role="status">
          <p>
            Conversational help is unavailable for this step. You can keep
            editing your message or confirm that it is your assignment answer.
          </p>
          <button
            type="button"
            className="lp-button mt-3"
            disabled={disabled || working || uncertain || !text.trim()}
            onClick={() => void submitFallbackAnswer()}
          >
            Submit this as my answer
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="lp-notice lp-notice-warning">
          {error}
        </p>
      )}
      {needsDisplay && (
        <p role={displayError ? "alert" : "status"} className="lp-notice">
          {displayError
            ? "This help is visible, but its reading record couldn’t be saved. Retry before continuing."
            : "Read the help above. We’ll confirm it was shown before you continue."}
          {displayError && (
            <button
              type="button"
              className="lp-text-link ml-2"
              onClick={() => {
                for (const turn of accepted)
                  acknowledging.current.delete(turn.request_id);
                setDisplayError(false);
                setDisplayRetry((number) => number + 1);
              }}
            >
              Retry saving help
            </button>
          )}
        </p>
      )}
      {transport && (uncertain || pending || error || unconfirmed) && (
        <button
          type="button"
          className="lp-text-link my-3"
          disabled={working && !unconfirmed}
          onClick={() => {
            acknowledging.current.clear();
            void load(true);
          }}
        >
          Check saved conversation
        </button>
      )}
      {!readOnly && transport?.recover && recoverableMessage && (
        <button
          type="button"
          className="lp-text-link my-3"
          disabled={working || locked}
          onClick={() => void recoverSavedResponse()}
        >
          Recover saved response
        </button>
      )}
      {!readOnly && (
        <form
          onSubmit={(event) => void send(event)}
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
                disabled={blocked}
                onClick={() => {
                  if (text.trim() && previousDraft === null)
                    rememberDraftBackup(text);
                  onTextChange(suggestion.text);
                  setPurpose(suggestion.purpose);
                  setUnavailable(false);
                  input.current?.focus();
                }}
              >
                {suggestion.label}
              </button>
            ))}
            {previousDraft !== null && (
              <button
                type="button"
                className="lp-text-link"
                disabled={blocked}
                onClick={() => {
                  onTextChange(previousDraft);
                  rememberDraftBackup(null);
                  setPurpose(undefined);
                  setUnavailable(false);
                  input.current?.focus();
                }}
              >
                Restore previous draft
              </button>
            )}
          </div>
          <label htmlFor={`tutor-message-${attemptId}`} className="sr-only">
            Message your tutor
          </label>
          <textarea
            id={`tutor-message-${attemptId}`}
            ref={input}
            className="lp-input"
            value={text}
            rows={3}
            maxLength={MESSAGE_CHARACTERS}
            required
            placeholder="Ask a question or share your thinking..."
            disabled={
              disabled ||
              locked ||
              working ||
              pending ||
              uncertain ||
              needsDisplay
            }
            onChange={(event) => {
              onTextChange(event.target.value);
              if (!event.target.value) setPurpose(undefined);
              setUnavailable(false);
            }}
          />
          <div className="lp-composer-footer">
            <p>Your lesson question stays above.</p>
            {locked ? (
              <button
                type="button"
                className="lp-button lp-button-primary"
                disabled={disabled || working || uncertain}
                onClick={() => void submitFallbackAnswer()}
              >
                Retry sending saved answer <Icon name="send" />
              </button>
            ) : (
              <button
                type="submit"
                className="lp-button lp-button-primary"
                disabled={
                  blocked ||
                  (Boolean(transport) && !view) ||
                  !restored ||
                  !text.trim()
                }
              >
                {working ? "Please wait…" : "Send"} <Icon name="send" />
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function TutorHelp({
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
  if (response.status === "pending")
    return <p role="status">Waiting for checked help…</p>;
  if (response.status === "fallback")
    return <p className="lp-notice">{response.fallback.text}</p>;
  return (
    <div className="lp-question" id={`dialogue-${turn.request_id}`}>
      <h3 className="lp-message-label">
        <Icon name="pulse" />
        {preview ? "Example tutor · Fixture, not live AI" : "Learning Pulse"}
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
  );
}
