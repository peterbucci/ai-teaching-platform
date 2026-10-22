import assert from "node:assert/strict";
import test from "node:test";
import {
  ActivityEventLogSchema,
  ConceptGraphSchema,
  PacketExperimentSchema,
  SequenceDiagramSchema,
} from "../lib/visual/contracts.ts";
import {
  invalidActivityEvents,
  invalidConceptGraphs,
  invalidPacketExperiments,
  invalidSequenceDiagrams,
  validActivityEvents,
  validConceptGraph,
  validPacketExperiment,
  validSequenceDiagram,
} from "../lib/visual/examples.ts";
import { toStudentActivityEvents } from "../lib/visual/rules.ts";

test("accepts a valid concept graph", () => {
  assert.equal(ConceptGraphSchema.safeParse(validConceptGraph).success, true);
});

test("rejects an edge that points to an unknown node", () => {
  const result = ConceptGraphSchema.safeParse(
    invalidConceptGraphs.unknownEdgeEndpoint,
  );
  assert.equal(result.success, false);
  assert.ok(
    result.error?.issues.some((issue) => issue.message.includes("switch")),
  );
});

test("rejects duplicate node IDs", () => {
  const result = ConceptGraphSchema.safeParse(
    invalidConceptGraphs.duplicateNodeId,
  );
  assert.equal(result.success, false);
  assert.ok(
    result.error?.issues.some((issue) => issue.message.includes("unique")),
  );
});

test("rejects extra fields such as a hidden rubric", () => {
  const result = ConceptGraphSchema.safeParse(
    invalidConceptGraphs.hiddenRubricField,
  );
  assert.equal(result.success, false);
});

test("accepts a valid sequence diagram", () => {
  assert.equal(
    SequenceDiagramSchema.safeParse(validSequenceDiagram).success,
    true,
  );
});

test("rejects a message to an unknown participant", () => {
  const result = SequenceDiagramSchema.safeParse(
    invalidSequenceDiagrams.unknownParticipant,
  );
  assert.equal(result.success, false);
  assert.ok(
    result.error?.issues.some((issue) => issue.message.includes("database")),
  );
});

test("rejects a sequence diagram with no messages", () => {
  assert.equal(
    SequenceDiagramSchema.safeParse(invalidSequenceDiagrams.emptyMessages)
      .success,
    false,
  );
});

test("accepts a valid packet experiment", () => {
  assert.equal(
    PacketExperimentSchema.safeParse(validPacketExperiment).success,
    true,
  );
});

test("rejects a default setting outside its allowed range", () => {
  assert.equal(
    PacketExperimentSchema.safeParse(invalidPacketExperiments.defaultOutOfRange)
      .success,
    false,
  );
});

test("rejects a hidden expected answer in a packet experiment", () => {
  assert.equal(
    PacketExperimentSchema.safeParse(
      invalidPacketExperiments.hiddenExpectedAnswer,
    ).success,
    false,
  );
});

test("accepts a valid activity event log", () => {
  assert.equal(
    ActivityEventLogSchema.safeParse(validActivityEvents).success,
    true,
  );
});

test("rejects an unknown event type", () => {
  assert.equal(
    ActivityEventLogSchema.safeParse(invalidActivityEvents.unknownType).success,
    false,
  );
});

test("rejects duplicate event IDs", () => {
  const result = ActivityEventLogSchema.safeParse(
    invalidActivityEvents.duplicateEventId,
  );
  assert.equal(result.success, false);
  assert.ok(
    result.error?.issues.some((issue) => issue.message.includes("unique")),
  );
});

test("rejects a follow-up attempt beyond the limit", () => {
  assert.equal(
    ActivityEventLogSchema.safeParse(invalidActivityEvents.tooManyAttempts)
      .success,
    false,
  );
});

test("hides a result until the same activity has a prediction", () => {
  const beforePrediction = [validActivityEvents[0], validActivityEvents[4]];
  const visible = toStudentActivityEvents(beforePrediction);
  assert.deepEqual(
    visible.map((event) => event.type),
    ["offer"],
  );
});

test("shows the result once the activity has a prediction", () => {
  const visible = toStudentActivityEvents(validActivityEvents);
  assert.ok(visible.some((event) => event.type === "experiment_result"));
});

test("rejects a concept graph over the node limit", () => {
  assert.equal(
    ConceptGraphSchema.safeParse(invalidConceptGraphs.tooManyNodes).success,
    false,
  );
});

test("rejects a source reference with a malformed commit", () => {
  assert.equal(
    ConceptGraphSchema.safeParse(invalidConceptGraphs.brokenSourceCommit)
      .success,
    false,
  );
});

test("rejects an unknown unit in a packet experiment", () => {
  assert.equal(
    PacketExperimentSchema.safeParse(invalidPacketExperiments.unknownUnit)
      .success,
    false,
  );
});

test("rejects a second prediction for the same activity", () => {
  assert.equal(
    ActivityEventLogSchema.safeParse(invalidActivityEvents.repeatedPrediction)
      .success,
    false,
  );
});

test("a prediction on one activity does not reveal another activity's result", () => {
  const otherActivity = "8f1c2a10-0000-4000-8000-0000000000bb";
  const mixed = [
    validActivityEvents[2],
    { ...validActivityEvents[4], activity_id: otherActivity },
  ];
  const visible = toStudentActivityEvents(mixed);
  assert.equal(
    visible.some((event) => event.type === "experiment_result"),
    false,
  );
});
