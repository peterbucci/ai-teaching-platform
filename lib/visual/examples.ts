import type { ActivityEvent } from "./contracts.ts";
import { VISUAL_VERSION } from "./contracts.ts";

// Synthetic examples for contract tests. They contain no student data or rubrics.
const sharedActivity = {
  version: VISUAL_VERSION,
  source: {
    package_id: "network-performance-v1",
    content_version: "3bd292c1476f5becb658418b70ee36153cfce830",
    source_id: "peterson_davie_1_5_1",
    source_commit: "5deec5e741e2b8c0bc44566108a24cb783c2c7de",
    excerpt_sha256:
      "04583798ef79e0538d467aefdecb9ca11698e3e1fdf42a54379415c858ab2b73",
  },
  concept_ids: ["propagation_delay"],
  text_alternative:
    "A diagram showing a packet moving from sender to receiver.",
  guided_steps: [
    "Look at the diagram.",
    "Change one setting and predict the result.",
  ],
  controls: ["adjust_setting"],
  provenance: {
    generated_by: "teacher_authored",
    generator_version: "manual-v1",
    reviewed_by_teacher: true,
  },
};

export const validConceptGraph = {
  ...sharedActivity,
  kind: "concept_graph",
  title: "How a packet travels",
  nodes: [
    { id: "sender", label: "Sending computer" },
    { id: "router", label: "Router" },
    { id: "receiver", label: "Receiving computer" },
  ],
  edges: [
    { from: "sender", to: "router", label: "sends packet" },
    { from: "router", to: "receiver", label: "forwards packet" },
  ],
};

export const validSequenceDiagram = {
  ...sharedActivity,
  kind: "sequence_diagram",
  title: "Requesting a web page",
  participants: [
    { id: "browser", label: "Browser" },
    { id: "server", label: "Web server" },
  ],
  messages: [
    { from: "browser", to: "server", label: "Request page" },
    { from: "server", to: "browser", label: "Send page" },
  ],
};

export const invalidSequenceDiagrams = {
  unknownParticipant: {
    ...validSequenceDiagram,
    messages: [{ from: "browser", to: "database", label: "Query" }],
  },
  emptyMessages: { ...validSequenceDiagram, messages: [] },
};

export const validPacketExperiment = {
  ...sharedActivity,
  kind: "packet_experiment",
  title: "How delay affects a packet",
  prompt: "Change the link delay and packet count, then predict what happens.",
  parameters: [
    {
      id: "link-delay",
      label: "Link delay",
      unit: "ms",
      min: 0,
      max: 500,
      default: 50,
    },
    {
      id: "packet-count",
      label: "Packets sent",
      unit: "packets",
      min: 1,
      max: 100,
      default: 10,
    },
  ],
};

export const invalidPacketExperiments = {
  defaultOutOfRange: {
    ...validPacketExperiment,
    parameters: [{ ...validPacketExperiment.parameters[0], default: 900 }],
  },
  hiddenExpectedAnswer: {
    ...validPacketExperiment,
    expected_answer: "Latency rises by 50 ms.",
  },
  unknownUnit: {
    ...validPacketExperiment,
    parameters: [{ ...validPacketExperiment.parameters[0], unit: "furlongs" }],
  },
};

const linkIds = {
  session_id: "8f1c2a10-0000-4000-8000-0000000000bb",
  root_attempt_id: "8f1c2a10-0000-4000-8000-0000000000cc",
  attempt_id: "8f1c2a10-0000-4000-8000-0000000000cc",
};

export const validActivityEvents: ActivityEvent[] = [
  {
    event_id: "8f1c2a10-0000-4000-8000-000000000001",
    activity_id: "8f1c2a10-0000-4000-8000-0000000000aa",
    ...linkIds,
    type: "offer",
    reason: "A short experiment can show how delay changes packets.",
  },
  {
    event_id: "8f1c2a10-0000-4000-8000-000000000002",
    activity_id: "8f1c2a10-0000-4000-8000-0000000000aa",
    ...linkIds,
    type: "display",
    activity_kind: "packet_experiment",
    supplied_hint_ids: [],
  },
  {
    event_id: "8f1c2a10-0000-4000-8000-000000000003",
    activity_id: "8f1c2a10-0000-4000-8000-0000000000aa",
    ...linkIds,
    type: "prediction",
    text: "Higher delay should make packets arrive later.",
  },
  {
    event_id: "8f1c2a10-0000-4000-8000-000000000004",
    activity_id: "8f1c2a10-0000-4000-8000-0000000000aa",
    ...linkIds,
    type: "experiment_state",
    settings: { "link-delay": 300, "packet-count": 10 },
  },
  {
    event_id: "8f1c2a10-0000-4000-8000-000000000005",
    activity_id: "8f1c2a10-0000-4000-8000-0000000000aa",
    ...linkIds,
    type: "experiment_result",
    outcome: "Packets arrived about 300 ms later than with no delay.",
  },
];

export const invalidActivityEvents = {
  unknownType: [
    {
      event_id: "8f1c2a10-0000-4000-8000-000000000001",
      activity_id: "8f1c2a10-0000-4000-8000-0000000000aa",
      ...linkIds,
      type: "grade",
      score: 3,
    },
  ],
  duplicateEventId: [validActivityEvents[0], validActivityEvents[0]],
  repeatedPrediction: [
    validActivityEvents[2],
    {
      ...validActivityEvents[2],
      event_id: "8f1c2a10-0000-4000-8000-000000000007",
      text: "A second prediction.",
    },
  ],
  tooManyAttempts: [
    {
      event_id: "8f1c2a10-0000-4000-8000-000000000006",
      activity_id: "8f1c2a10-0000-4000-8000-0000000000aa",
      type: "follow_up_attempt",
      attempt_number: 4,
      text: "Try again.",
    },
  ],
};

export const validTeacherActivityKey = {
  version: VISUAL_VERSION,
  activity_id: "8f1c2a10-0000-4000-8000-0000000000aa",
  expected_answer: "Higher delay makes packets arrive later.",
  rubric: ["Names the delay as the cause.", "Predicts a later arrival."],
};

export const invalidConceptGraphs = {
  tooManyNodes: {
    ...validConceptGraph,
    nodes: Array.from({ length: 13 }, (_, index) => ({
      id: `node-${index}`,
      label: `Node ${index}`,
    })),
  },
  brokenSourceCommit: {
    ...validConceptGraph,
    source: { ...sharedActivity.source, source_commit: "not-a-commit" },
  },
  unknownEdgeEndpoint: {
    ...validConceptGraph,
    edges: [{ from: "sender", to: "switch", label: "sends packet" }],
  },
  duplicateNodeId: {
    ...validConceptGraph,
    nodes: [...validConceptGraph.nodes, { id: "sender", label: "Copy" }],
  },
  hiddenRubricField: {
    ...validConceptGraph,
    rubric: "Students must name the router.",
  },
  unsupportedControl: {
    ...validConceptGraph,
    controls: ["drag_node"],
  },
};

export const invalidActivityLinks = {
  missingSessionId: {
    ...validActivityEvents[0],
    session_id: undefined,
  },
};
