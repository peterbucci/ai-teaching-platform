import assert from "node:assert/strict";
import test from "node:test";
import { DIALOGUE_LIMITS } from "../lib/dialogue/contracts.ts";
import { makeDialogueExamples } from "../lib/dialogue/examples.ts";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import {
  makeMessageAction,
  type ConversationView,
} from "../lib/dialogue/conversation.ts";
import {
  canUseCuratedAnswer,
  createConversationTransport,
  CONVERSATION_OPERATION_TIMEOUT_MS,
} from "../app/study/conversation-transport.ts";

const examples = makeDialogueExamples(loadApprovedContent());
const sessionId = examples.state.lesson.session_id;
const requestId = "76000000-0000-4000-8000-000000000001";

function view(): ConversationView {
  return {
    dialogue: { state: structuredClone(examples.state), turns: [] },
    messages: [],
  };
}

test("authenticated conversation transport preserves exact message and display identities without caching", async () => {
  const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
  const transport = createConversationTransport(
    sessionId,
    async (input, init) => {
      calls.push({ input, init });
      return Response.json(view());
    },
  );
  const action = makeMessageAction(
    examples.state,
    "  What is packet size?\n",
    requestId,
  );
  await transport.load();
  await transport.act(action);
  const display = {
    version: examples.state.version,
    session_id: sessionId,
    request_id: requestId,
    expected_revision: examples.state.revision,
    accepted_event_id: "76000000-0000-4000-8000-000000000002",
    content_id: "76000000-0000-4000-8000-000000000003",
  };
  await transport.acknowledge(display);
  assert.ok(transport.recover);
  await transport.recover(requestId, examples.state.revision);
  assert.equal(calls[0].input, `/api/tutoring/${sessionId}/conversation`);
  assert.equal(calls[0].init?.method, "GET");
  assert.equal(calls[0].init?.body, undefined);
  assert.equal(calls[1].init?.method, "POST");
  assert.equal(calls[1].init?.body, JSON.stringify(action));
  assert.equal(
    calls[2].input,
    `/api/tutoring/${sessionId}/conversation/display`,
  );
  assert.equal(calls[2].init?.body, JSON.stringify(display));
  assert.equal(
    calls[3].input,
    `/api/tutoring/${sessionId}/conversation/operations/${requestId}`,
  );
  assert.equal(calls[3].init?.method, "POST");
  assert.equal(
    calls[3].init?.body,
    JSON.stringify({ expected_revision: examples.state.revision }),
  );
  for (const call of calls) {
    assert.equal(call.init?.credentials, "same-origin");
    assert.equal(call.init?.cache, "no-store");
  }
  assert.ok(CONVERSATION_OPERATION_TIMEOUT_MS > DIALOGUE_LIMITS.timeoutMs * 4);
});

test("uncertain transport outcomes never resend a paid action or acknowledge help", async () => {
  for (const failure of ["network", "invalid", "rejected"]) {
    let calls = 0;
    const transport = createConversationTransport(sessionId, async () => {
      calls++;
      if (failure === "network") throw new Error("Connection interrupted");
      if (failure === "invalid") return new Response("not JSON");
      return Response.json({ error: "Conflict" }, { status: 409 });
    });
    await assert.rejects(
      transport.act(makeMessageAction(examples.state, "Help", requestId)),
    );
    assert.equal(calls, 1);
  }
  assert.throws(() => createConversationTransport("../other-session"));
});

test("curated answer fallback requires reconciled activity and never bypasses clarification or unseen help", () => {
  const current = view();
  assert.equal(canUseCuratedAnswer(current), false);
  current.dialogue.state.enabled = false;
  assert.equal(canUseCuratedAnswer(current), true);
  current.dialogue.state.active_request_id = requestId;
  assert.equal(canUseCuratedAnswer(current), false);
  current.dialogue.state.active_request_id = null;
  current.messages.push({
    request_id: requestId,
    attempt_id: examples.state.lesson.attempt_id,
    expected_revision: examples.state.revision,
    text: "Maybe, can you check?",
    classification: "AMBIGUOUS",
    outcome: { status: "clarification" },
  });
  assert.equal(canUseCuratedAnswer(current), false);
  current.messages[0].outcome = { status: "cancelled" };
  assert.equal(canUseCuratedAnswer(current), true);
  current.dialogue.state.progress.phase = "evaluate";
  assert.equal(canUseCuratedAnswer(current), false);
  current.dialogue.state.progress.phase = "answer";
  current.dialogue.state.enabled = true;
  current.dialogue.state.turns_used = DIALOGUE_LIMITS.turnsPerSession;
  assert.equal(canUseCuratedAnswer(current), true);
  current.dialogue.turns.push({
    request_id: requestId,
    attempt_id: examples.state.lesson.attempt_id,
    purpose: "question",
    text: "Help",
    response: {
      status: "accepted",
      expected_revision: examples.state.revision,
      accepted_event_id: "76000000-0000-4000-8000-000000000002",
      intervention_id: "76000000-0000-4000-8000-000000000003",
      content: {
        kind: "help",
        content_id: "76000000-0000-4000-8000-000000000004",
        text: "Approved assistance",
        concept_ids: examples.curatedQuestion.concept_ids,
        source_passage_ids: [],
        content_ref: examples.state.lesson.content_ref,
      },
      citations: [],
    },
  });
  assert.equal(canUseCuratedAnswer(current), false);
});
