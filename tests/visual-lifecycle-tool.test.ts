import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  ActivityEventLogSchema,
  ConceptGraphSchema,
} from "../lib/visual/contracts.ts";
import {
  VisualToolProposalSchema,
  VisualToolRequestSchema,
  VisualToolResultSchema,
} from "../lib/visual/tool-contract.ts";
import { validConceptGraph } from "../lib/visual/examples.ts";
import { validPacketDelayExperiment } from "../lib/visual/examples.ts";
import { calculatePacketDelay } from "../lib/networking/packet-delay.ts";
import {
  activitySnapshotSha256,
  verifyActivitySnapshotSha256,
} from "../lib/visual/snapshot-hash.ts";

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
    activity_snapshot: validConceptGraph,
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

test("a request must carry the full activity snapshot", () => {
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
  assert.equal(VisualToolRequestSchema.safeParse(request).success, false);
});

test("a request rejects a snapshot whose kind differs from the proposal", () => {
  const request = {
    version: "visual-v1",
    request_id: randomUUID(),
    session_id: randomUUID(),
    expected_revision: 3,
    source: validConceptGraph.source,
    eligible_action: "GIVE_HINT",
    proposal: { activity_kind: "packet_experiment" },
    activity_snapshot: validConceptGraph,
    activity_sha256: "a".repeat(64),
  };
  assert.equal(VisualToolRequestSchema.safeParse(request).success, false);
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

test("v2 packet requests and results use an explicit version and numeric observation", () => {
  const request = {
    version: "visual-v2",
    request_id: randomUUID(),
    session_id: randomUUID(),
    expected_revision: 3,
    source: validPacketDelayExperiment.source,
    eligible_action: "GIVE_HINT",
    proposal: { activity_kind: "packet_experiment" },
    activity_snapshot: validPacketDelayExperiment,
    activity_sha256: "a".repeat(64),
  };
  assert.equal(VisualToolRequestSchema.safeParse(request).success, true);
  assert.equal(
    VisualToolRequestSchema.safeParse({ ...request, version: "visual-v1" })
      .success,
    false,
  );
  assert.equal(
    VisualToolRequestSchema.safeParse({
      ...request,
      source: { ...request.source, content_version: "another-version" },
    }).success,
    false,
  );
  assert.equal(
    VisualToolRequestSchema.safeParse({
      ...request,
      proposal: { activity_kind: "concept_graph" },
    }).success,
    false,
  );
  const result = {
    version: "visual-v2",
    request_id: request.request_id,
    status: "verified",
    activity_sha256: request.activity_sha256,
    observation: calculatePacketDelay(validPacketDelayExperiment.parameters),
    display_acknowledged: false,
  };
  assert.equal(VisualToolResultSchema.safeParse(result).success, true);
  assert.equal(
    VisualToolResultSchema.safeParse({
      ...result,
      observation: "A model supplied a result.",
    }).success,
    false,
  );
  assert.equal(
    VisualToolResultSchema.safeParse({ ...result, status: "rejected" }).success,
    false,
  );
  assert.equal(
    VisualToolResultSchema.safeParse({
      ...result,
      observation: {
        ...result.observation,
        result: { ...result.observation.result, propagation_delay_seconds: 9 },
      },
    }).success,
    false,
  );
});

test("the snapshot hash ignores key order but changes with content", () => {
  const graph = ConceptGraphSchema.parse(validConceptGraph);
  const reordered = Object.fromEntries(
    Object.entries(graph).reverse(),
  ) as typeof graph;
  const hash = activitySnapshotSha256(graph);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(activitySnapshotSha256(reordered), hash);
  assert.notEqual(
    activitySnapshotSha256({ ...graph, title: "Changed title" }),
    hash,
  );
});

test("verifies a snapshot against its stored hash and rejects tampering", () => {
  const graph = ConceptGraphSchema.parse(validConceptGraph);
  const hash = activitySnapshotSha256(graph);
  assert.equal(verifyActivitySnapshotSha256(graph, hash), true);
  assert.equal(
    verifyActivitySnapshotSha256({ ...graph, title: "Changed title" }, hash),
    false,
  );
});
