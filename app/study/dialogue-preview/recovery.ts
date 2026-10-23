import {
  ConversationViewSchema,
  type ConversationView,
} from "../../../lib/dialogue/conversation.ts";

/** Browser fixture only: its stopped timers cannot finish on a server after refresh. */
export function recoverPreviewConversation(input: ConversationView) {
  const view = ConversationViewSchema.parse(input);
  const pending = view.messages.filter(
    (message) => message.outcome.status === "pending",
  );
  for (const message of pending) message.outcome = { status: "cancelled" };
  if (pending.length) {
    view.dialogue.state.revision += 1;
    view.dialogue.state.active_request_id = null;
  }
  return ConversationViewSchema.parse(view);
}
