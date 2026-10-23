import assert from "node:assert/strict";
import test from "node:test";
import { recoverPreviewConversation } from "../app/study/dialogue-preview/recovery.ts";
import { ConversationViewSchema } from "../lib/dialogue/conversation.ts";
import { makeDialogueExamples } from "../lib/dialogue/examples.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";

test("refresh cancels only unfinished fixture classification and preserves its original message", () => {
  const examples = makeDialogueExamples(loadApprovedContent());
  const requestId = "73000000-0000-4000-8000-000000000901";
  const view = ConversationViewSchema.parse({
    dialogue: {
      state: { ...examples.state, active_request_id: requestId },
      turns: [],
    },
    messages: [
      {
        request_id: requestId,
        attempt_id: examples.state.lesson.attempt_id,
        expected_revision: examples.state.revision,
        text: "  What do you mean by packet size?\n",
        classification: null,
        outcome: { status: "pending" },
      },
    ],
  });
  const recovered = recoverPreviewConversation(view);
  assert.equal(recovered.messages[0].outcome.status, "cancelled");
  assert.equal(recovered.messages[0].text, view.messages[0].text);
  assert.equal(recovered.messages[0].classification, null);
  assert.equal(recovered.dialogue.state.active_request_id, null);
  assert.equal(
    recovered.dialogue.state.revision,
    view.dialogue.state.revision + 1,
  );
  assert.deepEqual(recovered.dialogue.state.lesson, view.dialogue.state.lesson);
  assert.deepEqual(
    recovered.dialogue.state.progress,
    view.dialogue.state.progress,
  );
  assert.equal(
    view.messages[0].outcome.status,
    "pending",
    "Recovery must not mutate the prior snapshot",
  );
  assert.deepEqual(
    recoverPreviewConversation(recovered),
    recovered,
    "Repeated refresh is idempotent",
  );

  const clarification = structuredClone(view);
  clarification.messages[0].classification = "AMBIGUOUS";
  clarification.messages[0].outcome = { status: "clarification" };
  assert.deepEqual(
    recoverPreviewConversation(clarification),
    clarification,
    "An explicit student choice can still be made after refresh",
  );
});
