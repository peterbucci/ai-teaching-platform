import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ActivityEventLogSchema } from "../lib/visual/contracts.ts";
import {
  VisualToolProposalSchema,
  VisualToolRequestSchema,
  VisualToolResultSchema,
} from "../lib/visual/tool-contract.ts";
import { validConceptGraph } from "../lib/visual/examples.ts";

const base = () => ({
  event_id: randomUUID(),
  activity_id: randomUUID(),
  session_id: randomUUID(),
  root_attempt_id: null,
  attempt_id: null,
});

test("accepts proposed, accepted, and failed lifecycle events", () => {
  const events = [
    { ...base(), type: "proposed", activity_kind: "packet_experiment" },
    { ...base(), type: "accepted" },
    { ...base(), type: "failed", reason: "display_error" },
  ];
  assert.equal(ActivityEventLogSchema.safeParse(events).success, true);
});

test("rejects an unknown failure reason", () => {
  const event = { ...base(), type: "failed", reason: "model_said_so" };
  assert.equal(ActivityEventLogSchema.safeParse([event]).success, false);
});

test("a model proposal carries only an activity kind", () => {
  assert.equal(
    VisualToolProposalSchema.safeParse({ activity_kind: "concept_graph" })
      .success,
    true,
  );
});

test("a model proposal cannot supply permissions, source, or results", () => {
  for (const extra of [
    { session_id: randomUUID() },
    { source: validConceptGraph.source },
    { expected_revision: 0 },
    { outcome: "Latency rises by 50 ms." },
  ]) {
    const result = VisualToolProposalSchema.safeParse({
      activity_kind: "concept_graph",
      ...extra,
    });
    assert.equal(result.success, false, JSON.stringify(extra));
  }
});

test("a server-written request links the proposal to an eligible action and source", () => {
  const request = {
    version: "visual-v1",
    request_id: randomUUID(),
    session_id: randomUUID(),
    expected_revision: 3,
    source: validConceptGraph.source,
    eligible_action: "GIVE_HINT",
    proposal: { activity_kind: "concept_graph" },
    activity_sha256: "a".repeat(64),
  };
  assert.equal(VisualToolRequestSchema.safeParse(request).success, true);
  assert.equal(
    VisualToolRequestSchema.safeParse({
      ...request,
      eligible_action: "MADE_UP",
    }).success,
    false,
  );
});

test("a verified result needs a server observation and display acknowledgement", () => {
  const verified = {
    request_id: randomUUID(),
    status: "verified",
    activity_sha256: "b".repeat(64),
    observation: "Latency rises by 50 ms.",
    display_acknowledged: true,
  };
  assert.equal(VisualToolResultSchema.safeParse(verified).success, true);
  assert.equal(
    VisualToolResultSchema.safeParse({ ...verified, observation: null })
      .success,
    false,
  );
});

test("a rejected result cannot claim it was displayed", () => {
  const rejected = {
    request_id: randomUUID(),
    status: "rejected",
    activity_sha256: "c".repeat(64),
    observation: null,
    display_acknowledged: true,
  };
  assert.equal(VisualToolResultSchema.safeParse(rejected).success, false);
});
