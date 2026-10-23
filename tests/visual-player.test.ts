import assert from "node:assert/strict";
import test from "node:test";
import {
  PacketExperimentSchema,
  VISUAL_LIMITS,
  type ActivityEvent,
} from "../lib/visual/contracts.ts";
import {
  validActivityEvents,
  validConceptGraph,
  validPacketExperiment,
  validSequenceDiagram,
} from "../lib/visual/examples.ts";
import {
  appendPlayerEvent,
  checkedExperimentResult,
  defaultSettings,
  parsePlayerActivity,
  parsePlayerEvents,
  validSettings,
  type ExperimentRequest,
  type PlayerContext,
} from "../lib/visual/player.ts";

const activity = PacketExperimentSchema.parse(validPacketExperiment);
const context: PlayerContext = {
  activity_id: validActivityEvents[0].activity_id,
  session_id: validActivityEvents[0].session_id,
  root_attempt_id: validActivityEvents[0].root_attempt_id,
  attempt_id: validActivityEvents[0].attempt_id,
};
const otherId = "8f1c2a10-0000-4000-8000-000000000099";
const prediction: Extract<ActivityEvent, { type: "prediction" }> = {
  ...context,
  event_id: "8f1c2a10-0000-4000-8000-000000000011",
  type: "prediction",
  text: "The packets will arrive later.",
};
const result: Extract<ActivityEvent, { type: "experiment_result" }> = {
  ...context,
  event_id: "8f1c2a10-0000-4000-8000-000000000012",
  type: "experiment_result",
  outcome: "Fixture outcome for the player, not a calculated result.",
};

function experimentRequest(signal = new AbortController().signal) {
  return {
    activity,
    context,
    settings: defaultSettings(activity),
    prediction: prediction.text,
    request_id: result.event_id,
    signal,
  } satisfies ExperimentRequest;
}

test("the player accepts shared records and safely rejects malformed or private records", () => {
  for (const record of [
    validConceptGraph,
    validSequenceDiagram,
    validPacketExperiment,
  ]) {
    assert.deepEqual(parsePlayerActivity(record), record);
  }
  for (const record of [
    null,
    undefined,
    [],
    { kind: "constructor" },
    { kind: "toString" },
    { kind: "__proto__" },
    { ...validConceptGraph, version: "visual-v2" },
    { ...validConceptGraph, rubric: "Private grading guidance" },
    { ...validPacketExperiment, expected_answer: "Private answer" },
  ]) {
    assert.equal(parsePlayerActivity(record), null);
  }
});

test("replay rejects another session or attempt and mismatched activity records", () => {
  assert.deepEqual(
    parsePlayerEvents(validActivityEvents, context, activity),
    validActivityEvents,
  );
  for (const field of [
    "activity_id",
    "session_id",
    "root_attempt_id",
    "attempt_id",
  ] as const) {
    assert.equal(
      parsePlayerEvents(
        [{ ...prediction, [field]: otherId }],
        context,
        activity,
      ),
      null,
    );
  }
  assert.equal(
    parsePlayerEvents([], { ...context, session_id: "invalid" }, activity),
    null,
  );
  assert.equal(
    parsePlayerEvents(
      [
        {
          ...context,
          event_id: otherId,
          type: "display",
          activity_kind: "concept_graph",
          supplied_hint_ids: [],
        },
      ],
      context,
      activity,
    ),
    null,
  );
  const graph = parsePlayerActivity(validConceptGraph);
  assert.ok(graph);
  assert.equal(
    parsePlayerEvents([validActivityEvents[3]], context, graph),
    null,
  );
});

test("replay preserves prediction text and hides an outcome preceding its prediction", () => {
  const outOfOrder = [result, prediction];
  assert.deepEqual(parsePlayerEvents(outOfOrder, context, activity), [
    prediction,
  ]);
  assert.deepEqual(outOfOrder, [result, prediction]);
  assert.deepEqual(parsePlayerEvents([result], context, activity), []);
  assert.deepEqual(parsePlayerEvents([prediction, result], context, activity), [
    prediction,
    result,
  ]);
  assert.equal(
    parsePlayerEvents(
      [prediction, { ...result, rubric: "Private assessment guidance" }],
      context,
      activity,
    ),
    null,
  );
});

test("replay cannot attach a revealed outcome to later changed settings", () => {
  const settingsAfterResult: ActivityEvent = {
    ...context,
    event_id: otherId,
    type: "experiment_state",
    settings: { "link-delay": 0, "packet-count": 1 },
  };
  assert.equal(
    parsePlayerEvents(
      [...validActivityEvents, settingsAfterResult],
      context,
      activity,
    ),
    null,
  );
  // A hidden out-of-order result must not make a later state look reliable.
  assert.equal(
    parsePlayerEvents(
      [result, settingsAfterResult, prediction],
      context,
      activity,
    ),
    null,
  );
});

test("submitted settings must match the declared controls, bounds and integer units", () => {
  const defaults = defaultSettings(activity);
  assert.deepEqual(defaults, { "link-delay": 50, "packet-count": 10 });
  assert.equal(validSettings(activity, defaults), true);
  for (const settings of [
    { "link-delay": 0, "packet-count": 1 },
    { "link-delay": 500, "packet-count": 100 },
  ]) {
    assert.equal(validSettings(activity, settings), true);
  }
  const invalidSettings: Record<string, number>[] = [
    { ...defaults, formula: 1 },
    { "link-delay": 50 },
    { "link-delay": 50, "unknown-count": 10 },
    { ...defaults, "link-delay": 501 },
    { ...defaults, "packet-count": 0 },
    { ...defaults, "link-delay": 50.5 },
    { ...defaults, "link-delay": NaN },
  ];
  for (const settings of invalidSettings) {
    assert.equal(validSettings(activity, settings), false);
    assert.equal(
      parsePlayerEvents(
        [{ ...context, event_id: otherId, type: "experiment_state", settings }],
        context,
        activity,
      ),
      null,
    );
  }
});

test("an adapter result must match the exact request identity and contain only public fields", () => {
  const request = experimentRequest();
  assert.deepEqual(checkedExperimentResult(result, request), result);
  for (const field of [
    "event_id",
    "activity_id",
    "session_id",
    "root_attempt_id",
    "attempt_id",
  ] as const) {
    assert.equal(
      checkedExperimentResult({ ...result, [field]: otherId }, request),
      null,
    );
  }
  for (const response of [
    null,
    prediction,
    { ...result, expected_answer: "Private answer" },
    { ...result, outcome: "x".repeat(VISUAL_LIMITS.promptCharacters + 1) },
  ]) {
    assert.equal(checkedExperimentResult(response, request), null);
  }
});

test("a late adapter result is rejected after cancellation or invalid submitted settings", () => {
  const controller = new AbortController();
  const request = experimentRequest(controller.signal);
  controller.abort();
  assert.equal(checkedExperimentResult(result, request), null);
  assert.equal(
    checkedExperimentResult(result, {
      ...experimentRequest(),
      settings: { "link-delay": 50, "packet-count": 101 },
    }),
    null,
  );
});

test("event submission respects permissions, prediction-before-reveal and duplicate identity", () => {
  assert.equal(appendPlayerEvent([], prediction, []), null);
  assert.equal(appendPlayerEvent([], result, ["experiment_result"]), null);
  assert.equal(
    appendPlayerEvent([{ ...prediction, activity_id: otherId }], result, [
      "experiment_result",
    ]),
    null,
  );
  assert.deepEqual(
    appendPlayerEvent([prediction], result, ["experiment_result"]),
    [prediction, result],
  );
  assert.equal(
    appendPlayerEvent([prediction], prediction, ["prediction"]),
    null,
  );
  assert.equal(
    appendPlayerEvent([prediction], { ...prediction, event_id: otherId }, [
      "prediction",
    ]),
    null,
  );
  assert.equal(
    appendPlayerEvent([prediction, result], { ...result, event_id: otherId }, [
      "experiment_result",
    ]),
    null,
  );
});

test("the event budget refuses another submission without changing existing evidence", () => {
  const events: ActivityEvent[] = Array.from(
    { length: VISUAL_LIMITS.eventsPerActivity },
    (_, index) => ({
      ...context,
      event_id: `8f1c2a10-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
      type: "explanation",
      text: "An explanation retained in the fixture log.",
    }),
  );
  const snapshot = structuredClone(events);
  assert.equal(
    appendPlayerEvent(
      events,
      { ...context, event_id: otherId, type: "explanation", text: "One more." },
      ["explanation"],
    ),
    null,
  );
  assert.deepEqual(events, snapshot);
});
