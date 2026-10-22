import assert from "node:assert/strict";
import test from "node:test";
import { loadApprovedContent } from "../lib/evidence/content.ts";
import { makeDialogueExamples } from "../lib/dialogue/examples.ts";
import {
  dialogueFallback,
  toStudentDialogueContent,
} from "../lib/dialogue/rules.ts";
import { DIALOGUE_VERSION } from "../lib/dialogue/contracts.ts";
import {
  DIALOGUE_QUICK_ACTIONS,
  makeAskAction,
  makeDisplayAcknowledgement,
  makeReturnAction,
  parseStudentDialogueView,
  StudentDialogueViewSchema,
  type StudentDialogueView,
} from "../lib/dialogue/student-view.ts";

const content = loadApprovedContent();
const examples = makeDialogueExamples(content);
const id = (number: number) =>
  `73000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const expected = {
  sessionId: examples.state.lesson.session_id,
  attemptId: examples.state.lesson.attempt_id,
};
function accepted(): StudentDialogueView {
  const request = examples.studentRequest;
  const common = {
    version: DIALOGUE_VERSION,
    request_id: request.request_id,
    at: request.requested_at,
  } as const;
  const projected = toStudentDialogueContent(request, [
    { ...common, event_id: id(1), outcome: "requested" },
    {
      ...common,
      event_id: id(2),
      outcome: "generated",
      content: examples.help,
    },
    {
      ...common,
      event_id: id(3),
      outcome: "accepted",
      content_id: examples.help.content_id,
      applied_attempt_id: null,
      applied_revision: 0,
    },
  ]);
  return StudentDialogueViewSchema.parse({
    state: { ...examples.state, active_request_id: request.request_id },
    turns: [
      {
        request_id: request.request_id,
        attempt_id: examples.state.lesson.attempt_id,
        purpose: examples.asks.question.purpose,
        text: examples.asks.question.text,
        response: {
          status: "accepted",
          expected_revision: 0,
          accepted_event_id: id(3),
          intervention_id: id(4),
          content: projected,
          citations:
            examples.help.kind === "help"
              ? examples.help.source_passage_ids.map((passageId) => {
                  const passage = content.passages.get(passageId);
                  assert.ok(passage, "Fixture must cite an approved passage");
                  return {
                    passage_id: passageId,
                    content_version: content.content_ref.content_version,
                    text: passage.text,
                    url: passage.url,
                  };
                })
              : [],
        },
      },
    ],
  });
}

test("ask and return actions preserve the existing activity and cannot become answer submissions", () => {
  for (const ask of Object.values(examples.asks)) {
    const action = makeAskAction(
      examples.state,
      ask.purpose,
      ask.text,
      ask.request_id,
    );
    assert.deepEqual(action, ask);
    assert.equal("answer" in action, false);
  }
  const returned = makeReturnAction(examples.state, id(20));
  assert.equal(returned.action, "return_to_lesson");
  assert.equal("answer" in returned, false);
  assert.deepEqual(
    examples.state.progress.current_attempt_id,
    expected.attemptId,
  );
});

test("free-text asks preserve exact wording; optional quick actions keep compatible metadata", () => {
  for (const text of [
    "What do you mean by packet size?",
    "Can you explain that another way?",
    "  What do you mean by packet size?\nI mean the size of one packet.  ",
  ]) {
    const action = makeAskAction(examples.state, "question", text, id(21));
    assert.equal(action.text, text);
    assert.equal(action.purpose, "question");
    assert.equal(action.action, "ask_tutor");
    assert.equal("answer" in action, false);
  }
  const purposes = ["example", "alternative_explanation", "clarification"];
  DIALOGUE_QUICK_ACTIONS.forEach((choice, index) => {
    const edited = `${choice.text} Use a shorter cable in the explanation.`;
    const action = makeAskAction(
      examples.state,
      choice.purpose,
      edited,
      id(22),
    );
    assert.equal(action.purpose, purposes[index]);
    assert.equal(action.text, edited);
    assert.equal(action.action, "ask_tutor");
    assert.equal(action.attempt_id, expected.attemptId);
  });
});

test("follow-up asks retain earlier messages and the same unanswered activity", () => {
  const first = accepted();
  const firstResponse = first.turns[0].response;
  if (firstResponse.status !== "accepted")
    throw new Error("Expected fixture help");
  firstResponse.status = "displayed";
  first.state.active_request_id = null;
  const followup = makeAskAction(
    first.state,
    "question",
    "Can you explain that another way?",
    id(23),
  );
  const pending = parseStudentDialogueView(
    {
      state: { ...first.state, active_request_id: followup.request_id },
      turns: [
        ...first.turns,
        {
          request_id: followup.request_id,
          attempt_id: followup.attempt_id,
          purpose: followup.purpose,
          text: followup.text,
          response: { status: "pending" },
        },
      ],
    },
    expected,
    first,
  );
  const answered = parseStudentDialogueView(
    {
      ...pending,
      turns: [
        pending.turns[0],
        {
          ...pending.turns[1],
          response: {
            ...firstResponse,
            status: "accepted",
            accepted_event_id: id(24),
            intervention_id: id(25),
            content: { ...firstResponse.content, content_id: id(26) },
          },
        },
      ],
    },
    expected,
    pending,
  );
  assert.equal(answered.turns.length, 2);
  assert.deepEqual(answered.turns[0], first.turns[0]);
  assert.equal(answered.turns[1].text, followup.text);
  assert.deepEqual(answered.state.lesson, first.state.lesson);
  assert.deepEqual(answered.state.progress, first.state.progress);
  const acknowledgement = makeDisplayAcknowledgement(
    answered.state,
    answered.turns[1],
  );
  assert.equal(acknowledgement.request_id, followup.request_id);
});

test("student dialogue keeps accepted safe help and never accepts private guidance or generated questions", () => {
  const view = accepted();
  assert.deepEqual(parseStudentDialogueView(view, expected), view);
  const response = view.turns[0].response;
  assert.equal(response.status, "accepted");
  if (response.status !== "accepted") throw new Error("Expected fixture help");
  for (const content of [
    { ...response.content, rubric: { answer_guidance: "private" } },
    { ...response.content, generation: { model: "private" } },
    {
      kind: "question",
      content_id: id(30),
      question: examples.diagnostics.distance,
    },
  ])
    assert.equal(
      StudentDialogueViewSchema.safeParse({
        ...view,
        turns: [{ ...view.turns[0], response: { ...response, content } }],
      }).success,
      false,
    );
});

test("wrong session, question, assignment, source and regressed revisions cannot replace current dialogue", () => {
  const view = accepted();
  assert.throws(() =>
    parseStudentDialogueView(view, { ...expected, sessionId: id(31) }),
  );
  assert.throws(() =>
    parseStudentDialogueView(view, { ...expected, attemptId: id(32) }),
  );
  const changedAssignment = structuredClone(view);
  changedAssignment.state.lesson.assignment_id = id(33);
  assert.throws(
    () => parseStudentDialogueView(changedAssignment, expected, view),
    /assignment/,
  );
  const changedSource = structuredClone(view);
  changedSource.state.lesson.content_ref.source_commit = "1".repeat(40);
  assert.throws(
    () => parseStudentDialogueView(changedSource, expected, view),
    /source/,
  );
  const previous = {
    ...view,
    state: { ...view.state, revision: 1 },
    turns: [],
  };
  assert.throws(
    () => parseStudentDialogueView(view, expected, previous),
    /revision/,
  );
});

test("invalid, repeated, missing or wrong-version citations reject an otherwise valid response", () => {
  const view = accepted();
  const response = view.turns[0].response;
  if (response.status !== "accepted") throw new Error("Expected fixture help");
  for (const citations of [
    response.citations.slice(1),
    [response.citations[0], response.citations[0]],
    response.citations.map((citation) => ({ ...citation, passage_id: "P999" })),
    response.citations.map((citation) => ({
      ...citation,
      content_version: "wrong",
    })),
    response.citations.map((citation) => ({
      ...citation,
      url: "javascript:alert(1)",
    })),
  ])
    assert.equal(
      StudentDialogueViewSchema.safeParse({
        ...view,
        turns: [{ ...view.turns[0], response: { ...response, citations } }],
      }).success,
      false,
    );
});

test("only current accepted help gets a display acknowledgement; old displayed history stays readable", () => {
  const view = accepted();
  const acknowledgement = makeDisplayAcknowledgement(view.state, view.turns[0]);
  assert.equal(acknowledgement.accepted_event_id, id(3));
  assert.equal(acknowledgement.request_id, view.turns[0].request_id);
  assert.equal("visible_at" in acknowledgement, false);
  assert.throws(
    () =>
      makeDisplayAcknowledgement({ ...view.state, revision: 1 }, view.turns[0]),
    /Stale/,
  );
  assert.throws(
    () =>
      makeDisplayAcknowledgement(
        { ...view.state, active_request_id: id(42) },
        view.turns[0],
      ),
    /Stale/,
  );
  const displayed = structuredClone(view);
  const response = displayed.turns[0].response;
  if (response.status !== "accepted") throw new Error("Expected fixture help");
  response.status = "displayed";
  displayed.state.revision = 1;
  displayed.state.active_request_id = null;
  assert.deepEqual(
    parseStudentDialogueView(displayed, expected, view),
    displayed,
  );
  assert.throws(
    () => makeDisplayAcknowledgement(displayed.state, displayed.turns[0]),
    /accepted/,
  );
});

test("fallback and pending views expose no unvalidated output and duplicate requests are rejected", () => {
  const view = accepted();
  const pending = {
    ...view.turns[0],
    response: { status: "pending" as const },
  };
  assert.equal(
    StudentDialogueViewSchema.safeParse({ ...view, turns: [pending] }).success,
    true,
  );
  assert.equal(
    StudentDialogueViewSchema.safeParse({ ...view, turns: [pending, pending] })
      .success,
    false,
  );
  for (const reason of [
    "disabled",
    "off_topic",
    "private_guidance",
    "timeout",
    "invalid_output",
  ] as const) {
    const item = {
      ...view.turns[0],
      response: {
        status: "fallback" as const,
        fallback: dialogueFallback(reason),
      },
    };
    assert.equal(
      StudentDialogueViewSchema.safeParse({ ...view, turns: [item] }).success,
      true,
    );
    assert.throws(
      () => makeDisplayAcknowledgement(view.state, item),
      /accepted/,
    );
  }
});

test("late loads cannot remove, rewrite or regress accepted help; cancellation only retires undisplayed help", () => {
  const view = accepted();
  const item = view.turns[0];
  const response = item.response;
  if (response.status !== "accepted") throw new Error("Expected fixture help");
  const displayed = StudentDialogueViewSchema.parse({
    ...view,
    state: { ...view.state, active_request_id: null },
    turns: [{ ...item, response: { ...response, status: "displayed" } }],
  });
  const cancelled = {
    ...view,
    state: { ...view.state, revision: 1 },
    turns: [
      {
        ...item,
        response: {
          status: "fallback",
          fallback: dialogueFallback("cancelled"),
        },
      },
    ],
  };
  assert.doesNotThrow(() =>
    parseStudentDialogueView(cancelled, expected, view),
  );
  assert.throws(
    () => parseStudentDialogueView(cancelled, expected, displayed),
    /regressed/,
  );
  for (const previous of [view, displayed]) {
    for (const incoming of [
      { ...view, turns: [] },
      { ...view, turns: [{ ...item, response: { status: "pending" } }] },
      { ...view, turns: [{ ...item, text: "A changed student question" }] },
      {
        ...view,
        turns: [
          {
            ...item,
            response: {
              ...response,
              content: { ...response.content, text: "Changed help" },
            },
          },
        ],
      },
    ])
      assert.throws(
        () => parseStudentDialogueView(incoming, expected, previous),
        /dialogue/,
      );
  }
  assert.throws(
    () => parseStudentDialogueView(view, expected, displayed),
    /regressed/,
  );
  assert.deepEqual(
    parseStudentDialogueView(displayed, expected, displayed),
    displayed,
  );
});
