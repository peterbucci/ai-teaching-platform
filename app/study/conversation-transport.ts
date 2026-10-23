import { z } from "zod";
import { DIALOGUE_LIMITS } from "../../lib/dialogue/contracts.ts";
import type {
  ConversationTransport,
  ConversationView,
} from "../../lib/dialogue/conversation.ts";

// Classification, action selection, generation and review share server limits.
// Waiting for their one reserved operation never creates a replacement request.
export const CONVERSATION_OPERATION_TIMEOUT_MS =
  DIALOGUE_LIMITS.timeoutMs * 4 + 5_000;

export function createConversationTransport(
  sessionId: string,
  request: typeof fetch = fetch,
): ConversationTransport {
  const base = `/api/tutoring/${z.uuid().parse(sessionId)}/conversation`;
  async function send(path: string, body?: unknown): Promise<unknown> {
    const response = await request(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Please sign in again to read your saved conversation."
          : "The conversation request could not be confirmed. Check its saved status before continuing.",
      );
    if (value === null) throw new Error("The conversation response was empty.");
    return value;
  }
  return {
    load: () => send(base),
    act: (action) => send(base, action),
    acknowledge: (display) => send(`${base}/display`, display),
    recover: (requestId, expectedRevision) =>
      send(`${base}/operations/${z.uuid().parse(requestId)}`, {
        expected_revision: z.int().nonnegative().parse(expectedRevision),
      }),
  };
}

/** An explicit answer fallback is offered only after conversation reconciliation. */
export function canUseCuratedAnswer(view: ConversationView): boolean {
  const { state, turns } = view.dialogue;
  if (
    state.progress.phase !== "answer" ||
    state.active_request_id ||
    turns.some((turn) => turn.response.status === "accepted") ||
    view.messages.some((message) =>
      ["pending", "clarification"].includes(message.outcome.status),
    )
  )
    return false;
  const latest = view.messages.at(-1);
  return (
    !state.enabled ||
    state.turns_used >= DIALOGUE_LIMITS.turnsPerSession ||
    state.provider_requests_used >=
      DIALOGUE_LIMITS.providerRequestsPerSession ||
    (latest?.attempt_id === state.lesson.attempt_id &&
      latest.outcome.status === "fallback" &&
      ["disabled", "limit_reached"].includes(latest.outcome.reason))
  );
}
