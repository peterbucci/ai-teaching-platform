import {
  ConceptGraphSchema,
  PacketExperimentSchema,
  SequenceDiagramSchema,
  type ActivityEvent,
  type ConceptGraph,
  type PacketExperiment,
  type SequenceDiagram,
} from "../../../lib/visual/contracts.ts";
import {
  validConceptGraph,
  validPacketExperiment,
  validSequenceDiagram,
} from "../../../lib/visual/examples.ts";
import type {
  ExperimentAdapter,
  PlayerContext,
  PlayerEventType,
} from "../../../lib/visual/player.ts";

type Activity = ConceptGraph | SequenceDiagram | PacketExperiment;

export interface PlayerSample {
  id: string;
  label: string;
  description: string;
  family: "Concept graphs" | "Sequence diagrams" | "Experiments" | "Validation";
  activity: unknown;
  context: PlayerContext;
  replay: ActivityEvent[];
}

export const FIXTURE_OUTCOME =
  "Fixture result: the demonstration packet has reached the receiver. This is an illustration, not a calculated delay. These generic controls are not yet mapped to the reviewed networking model.";

export const SAMPLE_FALLBACK =
  "This sample could not be drawn. In the text activity, identify the sender and receiver, describe how a packet moves between them, and distinguish sending the packet onto a link from its travel along the link.";

export const SAMPLE_PERMITTED_EVENTS: readonly PlayerEventType[] = [
  "display",
  "experiment_state",
  "prediction",
  "experiment_result",
  "explanation",
];

function sampleContext(index: number): PlayerContext {
  return {
    activity_id: `d0390000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    session_id: "d0390000-0000-4000-8000-000000000100",
    root_attempt_id: "d0390000-0000-4000-8000-000000000101",
    attempt_id: "d0390000-0000-4000-8000-000000000101",
  };
}

function replayEvents(
  activity: Activity,
  context: PlayerContext,
): ActivityEvent[] {
  const base = (index: number) => ({
    ...context,
    event_id: `d0390000-0000-4000-9000-${index.toString().padStart(12, "0")}`,
  });
  const events: ActivityEvent[] = [
    {
      ...base(1),
      type: "display",
      activity_kind: activity.kind,
      supplied_hint_ids: [],
    },
  ];
  if (activity.kind === "packet_experiment") {
    events.push(
      {
        ...base(2),
        type: "experiment_state",
        settings: Object.fromEntries(
          activity.parameters.map((parameter) => [
            parameter.id,
            parameter.default,
          ]),
        ),
      },
      {
        ...base(3),
        type: "prediction",
        text: "Synthetic prediction: I expect the packet to move from the sender to the receiver.",
      },
      { ...base(4), type: "experiment_result", outcome: FIXTURE_OUTCOME },
      {
        ...base(5),
        type: "explanation",
        text: "Synthetic explanation: sending onto the link and travelling across it are separate stages. This fixture does not establish their duration.",
      },
    );
  }
  return events;
}

function sample(
  index: number,
  id: string,
  label: string,
  description: string,
  family: PlayerSample["family"],
  activity: Activity,
): PlayerSample {
  const context = sampleContext(index);
  return {
    id,
    label,
    description,
    family,
    activity,
    context,
    replay: replayEvents(activity, context),
  };
}

const chain = ConceptGraphSchema.parse({
  ...validConceptGraph,
  controls: ["select_item", "step_through"],
  text_alternative:
    "The sending computer sends a packet to a router. The router forwards the packet to the receiving computer.",
  guided_steps: [
    "Select the sending computer and inspect its connection.",
    "Follow the packet to the router, then to the receiving computer.",
    "Describe the relationship between each pair of connected concepts.",
  ],
});

const branching = ConceptGraphSchema.parse({
  ...chain,
  title: "A network branches to several destinations",
  nodes: [
    { id: "sender", label: "Sending computer" },
    { id: "router", label: "Router" },
    { id: "laptop", label: "Laptop" },
    { id: "tablet", label: "Tablet" },
    { id: "server", label: "Server" },
  ],
  edges: [
    { from: "sender", to: "router", label: "sends packet" },
    { from: "router", to: "laptop", label: "can forward to" },
    { from: "router", to: "tablet", label: "can forward to" },
    { from: "router", to: "server", label: "can forward to" },
  ],
  text_alternative:
    "A sender connects to a router. Three branches connect the router to a laptop, a tablet, and a server.",
  guided_steps: [
    "Select the router to inspect its incoming and outgoing connections.",
    "Compare the three destinations connected to the router.",
  ],
});

const cycle = ConceptGraphSchema.parse({
  ...chain,
  title: "A cycle of connected routers",
  nodes: [
    { id: "west", label: "West router" },
    { id: "north", label: "North router" },
    { id: "east", label: "East router" },
    { id: "south", label: "South router" },
  ],
  edges: [
    { from: "west", to: "north", label: "connects to" },
    { from: "north", to: "east", label: "connects to" },
    { from: "east", to: "south", label: "connects to" },
    { from: "south", to: "west", label: "connects to" },
  ],
  text_alternative:
    "West connects to North, North to East, East to South, and South back to West. Together these directed connections form a cycle.",
  guided_steps: [
    "Begin at any router and follow its outgoing connection.",
    "Continue around the cycle until you return to your starting router.",
  ],
});

const largeGraph = ConceptGraphSchema.parse({
  ...chain,
  title: "Twelve concepts with longer labels",
  nodes: Array.from({ length: 12 }, (_, index) => ({
    id: `node-${index + 1}`,
    label: `Network stage ${index + 1}: a longer label to inspect at small screen widths`,
  })),
  edges: Array.from({ length: 11 }, (_, index) => ({
    from: `node-${index + 1}`,
    to: `node-${index + 2}`,
    label: "connects to the following stage in this synthetic layout example",
  })),
  text_alternative:
    "This layout fixture contains twelve numbered network stages, linked in order from stage one to stage twelve. The long labels exercise wrapping and reading at narrow widths.",
  guided_steps: [
    "Inspect the complete chain of twelve nodes.",
    "Select a node near the end and read its connected relationships.",
  ],
});

const twoParticipants = SequenceDiagramSchema.parse({
  ...validSequenceDiagram,
  controls: ["step_through"],
  text_alternative:
    "First the browser requests a page from the web server. Then the web server sends the page back to the browser.",
  guided_steps: [
    "Follow the page request from the browser to the web server.",
    "Advance to the response returning to the browser.",
  ],
});

const fourParticipants = SequenceDiagramSchema.parse({
  ...twoParticipants,
  title: "A request across four participants",
  participants: [
    { id: "browser", label: "Browser" },
    { id: "gateway", label: "Gateway" },
    { id: "server", label: "Web server" },
    { id: "store", label: "Content store" },
  ],
  messages: [
    { from: "browser", to: "gateway", label: "Request page" },
    { from: "gateway", to: "server", label: "Forward request" },
    { from: "server", to: "store", label: "Read page content" },
    { from: "store", to: "server", label: "Return content" },
    { from: "server", to: "server", label: "Prepare response" },
    { from: "server", to: "gateway", label: "Send response" },
    { from: "gateway", to: "browser", label: "Deliver page" },
  ],
  text_alternative:
    "A browser sends a request through a gateway to a server. The server reads content from a store, prepares the response in a self-message, and sends it back through the gateway to the browser.",
  guided_steps: [
    "Step through the request as it moves toward the content store.",
    "Inspect the web server's self-message while it prepares a response.",
    "Step backward to compare the request and response paths.",
  ],
});

const sixParticipants = SequenceDiagramSchema.parse({
  ...twoParticipants,
  title: "Six participants with longer names",
  participants: Array.from({ length: 6 }, (_, index) => ({
    id: `participant-${index + 1}`,
    label: `Network participant ${index + 1} with a descriptive display name`,
  })),
  messages: [
    ...Array.from({ length: 5 }, (_, index) => ({
      from: `participant-${index + 1}`,
      to: `participant-${index + 2}`,
      label: `Forward the request to the next participant (stage ${index + 1})`,
    })),
    {
      from: "participant-6",
      to: "participant-6",
      label: "Prepare the response locally",
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      from: `participant-${6 - index}`,
      to: `participant-${5 - index}`,
      label: `Return the response along the path (stage ${index + 1})`,
    })),
  ],
  text_alternative:
    "The request moves in order from participant one through participant six. Participant six prepares a response locally. The response follows the same path in reverse, ending at participant one.",
  guided_steps: [
    "Use the timeline to follow a request across all six participants.",
    "Find the local processing step, then follow the response back.",
  ],
});

const packet = PacketExperimentSchema.parse({
  ...validPacketExperiment,
  guided_steps: [
    "Explore the permitted settings and write a prediction before revealing a result.",
    "Run the illustration, then compare it with your prediction.",
    "Explain what this fixture can and cannot tell you about packet delay.",
  ],
});

const boundedPacket = PacketExperimentSchema.parse({
  ...packet,
  title: "An experiment with a fixed setting",
  controls: ["adjust_setting", "step_through"],
  prompt:
    "Compare a narrow range of link-delay settings while the packet count stays fixed. Predict before inspecting the fixture result.",
  parameters: [
    {
      id: "link-delay",
      label: "Link delay",
      unit: "ms",
      min: 20,
      max: 60,
      default: 40,
    },
    {
      id: "packet-count",
      label: "Packets sent (fixed for this activity)",
      unit: "packets",
      min: 1,
      max: 1,
      default: 1,
    },
  ],
});

export const PLAYER_SAMPLES: PlayerSample[] = [
  sample(
    1,
    "graph-chain",
    "Graph · three-node chain",
    "The original contract example with graph-appropriate controls and a guided explanation.",
    "Concept graphs",
    chain,
  ),
  sample(
    2,
    "graph-branching",
    "Graph · five-node branches",
    "Select the central router to inspect several relationships.",
    "Concept graphs",
    branching,
  ),
  sample(
    3,
    "graph-cycle",
    "Graph · directed cycle",
    "A cyclic structure that cannot rely on a one-way tree layout.",
    "Concept graphs",
    cycle,
  ),
  sample(
    4,
    "graph-large",
    "Graph · twelve long labels",
    "The maximum node count with long node and relationship labels.",
    "Concept graphs",
    largeGraph,
  ),
  sample(
    5,
    "sequence-two",
    "Sequence · two participants",
    "A short request and response, using the original contract example.",
    "Sequence diagrams",
    twoParticipants,
  ),
  sample(
    6,
    "sequence-four",
    "Sequence · four participants",
    "A longer timeline with a self-message and a return path.",
    "Sequence diagrams",
    fourParticipants,
  ),
  sample(
    7,
    "sequence-six",
    "Sequence · six long labels",
    "The maximum participant count, with eleven messages and long labels.",
    "Sequence diagrams",
    sixParticipants,
  ),
  sample(
    8,
    "packet-original",
    "Experiment · original parameters",
    "The existing link-delay and packet-count controls. Results are qualitative fixtures.",
    "Experiments",
    packet,
  ),
  sample(
    9,
    "packet-bounded",
    "Experiment · narrow and fixed ranges",
    "A permitted narrow range and a fixed parameter exercise control boundaries.",
    "Experiments",
    boundedPacket,
  ),
  {
    ...sample(
      10,
      "invalid-version",
      "Invalid · unsupported version",
      "The player should reject the record and use the safe fallback.",
      "Validation",
      chain,
    ),
    activity: { ...chain, version: "unsupported-visual-version" },
    replay: [],
  },
  {
    ...sample(
      11,
      "invalid-private-field",
      "Invalid · unexpected private field",
      "A synthetic private-field sentinel must never appear in the rendered player or event log.",
      "Validation",
      packet,
    ),
    activity: {
      ...packet,
      expected_answer: "PRIVATE_ANSWER_SENTINEL_DO_NOT_RENDER",
    },
    replay: [],
  },
];

export const ADAPTER_MODES = [
  { id: "fixture", label: "Fixture result" },
  { id: "delayed", label: "Delayed fixture (four seconds)" },
  { id: "failure", label: "Simulated failure" },
  { id: "invalid", label: "Invalid result" },
  { id: "unavailable", label: "No result adapter" },
] as const;

export type AdapterMode = (typeof ADAPTER_MODES)[number]["id"];

export function fixtureAdapter(
  mode: AdapterMode,
): ExperimentAdapter | undefined {
  if (mode === "unavailable") return undefined;
  return {
    provenance: "fixture",
    async run(request) {
      await new Promise<void>((resolve, reject) => {
        if (request.signal.aborted) {
          reject(new DOMException("Fixture request cancelled", "AbortError"));
          return;
        }
        const abort = () => {
          clearTimeout(timer);
          request.signal.removeEventListener("abort", abort);
          reject(new DOMException("Fixture request cancelled", "AbortError"));
        };
        const timer = setTimeout(
          () => {
            request.signal.removeEventListener("abort", abort);
            resolve();
          },
          mode === "delayed" ? 4_000 : 350,
        );
        request.signal.addEventListener("abort", abort, { once: true });
      });
      if (mode === "failure") throw new Error("Simulated fixture failure");
      if (mode === "invalid") return { type: "not-a-result" };
      return {
        ...request.context,
        event_id: request.request_id,
        type: "experiment_result",
        outcome: FIXTURE_OUTCOME,
      } satisfies ActivityEvent;
    },
  };
}
