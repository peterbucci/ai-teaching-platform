import assert from "node:assert/strict";
import test from "node:test";
import type { StudentSessionView } from "../lib/evidence/contracts.ts";
import {
  acknowledgeAnswerSave,
  answerSaveMessage,
  canRetryOriginalAnswer,
  failedAnswerSave,
  hasMatchingSavedAnswer,
  restoreAnswerRecovery,
  studyRequest,
  StudyRequestError,
  type AnswerRecovery,
} from "../app/study/answer-recovery.ts";

const session = "76000000-0000-4000-8000-000000000001";
const attempt = "76000000-0000-4000-8000-000000000002";
const key = "76000000-0000-4000-8000-000000000003";
const other = "76000000-0000-4000-8000-000000000004";
const response = "  Light supplies energy.\nExtra water cannot replace it.  ";
const original: AnswerRecovery = {
  session,
  attempt,
  key,
  response,
  state: "local",
};
function snapshot(saved: boolean): StudentSessionView {
  return {
    session: { id: session, status: "active" },
    attempts: [
      {
        id: attempt,
        sequence_index: 0,
        intent: "initial_retrieval",
        prompt_text: "Why does the plant need light?",
        concept_ids: ["light"],
        presented_at: "2026-10-25T12:00:00Z",
        submitted_at: saved ? "2026-10-25T12:01:00Z" : null,
        response_text: saved ? response : null,
      },
    ],
    interventions: [],
  };
}

test("pre-commit authentication rejection preserves the original draft and never claims a server save", async () => {
  let calls = 0;
  const error = await studyRequest(
    "/answer",
    { submission_key: key, response_text: response },
    async (_path, options) => {
      calls++;
      assert.equal(options?.method, "POST");
      assert.equal(options?.cache, "no-store");
      assert.equal(options?.credentials, "same-origin");
      assert.deepEqual(JSON.parse(String(options?.body)), {
        submission_key: key,
        response_text: response,
      });
      return Response.json({ error: "Sign in" }, { status: 401 });
    },
  ).then(
    () => assert.fail("Expected rejection"),
    (error: unknown) => error,
  );
  assert.equal(calls, 1);
  const recovery = failedAnswerSave(original, error);
  assert.deepEqual(recovery, { ...original, state: "unconfirmed" });
  assert.match(
    answerSaveMessage(recovery),
    /kept in this tab.*not confirmed saving/,
  );
  assert.doesNotMatch(String(error), /work is saved|answer is saved/);
  assert.deepEqual(
    restoreAnswerRecovery(JSON.stringify(recovery), session, attempt),
    recovery,
  );
});

test("offline, empty, and server failures remain unknown with no automatic resend", async () => {
  for (const failure of ["offline", "empty", "server"] as const) {
    let calls = 0;
    const error = await studyRequest("/answer", {}, async () => {
      calls++;
      if (failure === "offline") throw new TypeError("Offline");
      if (failure === "empty") return new Response("invalid JSON");
      return Response.json({ error: "Server unavailable" }, { status: 503 });
    }).then(
      () => assert.fail("Expected rejection"),
      (error: unknown) => error,
    );
    assert.equal(calls, 1);
    const recovery = failedAnswerSave(original, error);
    assert.deepEqual(recovery, { ...original, state: "unknown" });
    assert.match(answerSaveMessage(recovery), /don’t know whether/);
    assert.equal(
      failedAnswerSave(recovery, new StudyRequestError(401, "Sign in")).state,
      "unknown",
      "A later 401 does not settle the earlier uncertain write",
    );
  }
});

test("only a validated acknowledgement for the same session, attempt and exact original text marks saved", () => {
  const valid = snapshot(true);
  assert.deepEqual(acknowledgeAnswerSave(valid, original), {
    ...original,
    state: "acknowledged",
  });
  const failures: unknown[] = [null, {}, snapshot(false)];
  const wrongSession = structuredClone(valid);
  wrongSession.session.id = other;
  failures.push(wrongSession);
  const wrongAttempt = structuredClone(valid);
  wrongAttempt.attempts[0].id = other;
  failures.push(wrongAttempt);
  const trimmed = structuredClone(valid);
  trimmed.attempts[0].response_text = response.trim();
  failures.push(trimmed);
  const duplicate = structuredClone(valid);
  duplicate.attempts.push(structuredClone(duplicate.attempts[0]));
  failures.push(duplicate);
  for (const invalid of failures)
    assert.throws(
      () => acknowledgeAnswerSave(invalid, original),
      StudyRequestError,
    );
  assert.equal(hasMatchingSavedAnswer(snapshot(false), original), false);
});

test("read reconciliation never writes or evaluates; absent answers permit only explicit same-identity retry", async () => {
  const unknown: AnswerRecovery = { ...original, state: "unknown" };
  for (const saved of [false, true]) {
    const calls: RequestInit[] = [];
    const result = await studyRequest(
      "/progress",
      undefined,
      async (_path, options) => {
        calls.push(options ?? {});
        return Response.json(snapshot(saved));
      },
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].body, undefined);
    const read = snapshot(saved);
    assert.deepEqual(result, read);
    assert.equal(hasMatchingSavedAnswer(read, unknown), saved);
    assert.equal(canRetryOriginalAnswer(read, unknown), !saved);
    assert.equal(
      unknown.state,
      "unknown",
      "An absent read does not claim to settle the original write",
    );
    const restored = restoreAnswerRecovery(
      JSON.stringify(unknown),
      session,
      attempt,
    );
    assert.equal(restored?.key, key);
    assert.equal(restored?.response, response);
  }
  const nextAttempt = snapshot(false);
  nextAttempt.attempts.push({
    ...nextAttempt.attempts[0],
    id: other,
    sequence_index: 1,
  });
  assert.equal(canRetryOriginalAnswer(nextAttempt, unknown), false);
  const foreign = snapshot(false);
  foreign.session.id = other;
  assert.equal(canRetryOriginalAnswer(foreign, unknown), false);
});

test("acknowledged saves survive later refresh or evaluation failures and cannot be resent", () => {
  const acknowledged = acknowledgeAnswerSave(snapshot(true), original);
  for (const error of [
    new StudyRequestError(401, "Sign in"),
    new Error("Offline"),
  ])
    assert.equal(failedAnswerSave(acknowledged, error), acknowledged);
  assert.equal(canRetryOriginalAnswer(snapshot(false), acknowledged), false);
  assert.deepEqual(
    restoreAnswerRecovery(JSON.stringify(acknowledged), session, attempt),
    acknowledged,
  );
  assert.match(answerSaveMessage(acknowledged), /server confirmed saving/);
});

test("legacy drafts keep their original identity; in-flight drafts migrate to unknown and foreign drafts never restore", () => {
  for (const locked of [false, true]) {
    assert.deepEqual(
      restoreAnswerRecovery(
        JSON.stringify({ key, response, locked }),
        session,
        attempt,
      ),
      { ...original, state: locked ? "unknown" : "local" },
    );
  }
  assert.equal(
    restoreAnswerRecovery(
      JSON.stringify({ ...original, session: other }),
      session,
      attempt,
    ),
    null,
  );
  assert.equal(
    restoreAnswerRecovery(
      JSON.stringify({ ...original, attempt: other }),
      session,
      attempt,
    ),
    null,
  );
  assert.equal(
    restoreAnswerRecovery(
      JSON.stringify({ ...original, key: "bad-id" }),
      session,
      attempt,
    ),
    null,
  );
  assert.equal(restoreAnswerRecovery("invalid JSON", session, attempt), null);
  assert.equal(
    restoreAnswerRecovery(
      JSON.stringify({ ...original, state: "saved" }),
      session,
      attempt,
    ),
    null,
  );
});

test("a stalled connection or body returns control with an unknown outcome and no resend", async () => {
  for (const stalled of ["connection", "body"] as const) {
    const calls: RequestInit[] = [];
    const error = await studyRequest(
      "/answer",
      { submission_key: key, response_text: response },
      async (_path, options) => {
        calls.push(options ?? {});
        if (stalled === "connection") return new Promise<Response>(() => {});
        return new Response(new ReadableStream<Uint8Array>());
      },
      5,
    ).then(
      () => assert.fail("Expected timeout"),
      (error: unknown) => error,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].signal?.aborted, true);
    assert.deepEqual(failedAnswerSave(original, error), {
      ...original,
      state: "unknown",
    });
    assert.match(String(error), /timed out/);
  }
});
