import {
  ActivityEventLogSchema,
  ActivityEventSchema,
  ConceptGraphSchema,
  PacketDelayExperimentSchema,
  PacketExperimentSchema,
  SequenceDiagramSchema,
  type ActivityEvent,
  type ConceptGraph,
  type PacketDelayExperiment,
  type PacketExperiment,
  type SequenceDiagram,
} from "./contracts.ts";
import { validateVisualActivity } from "./validate.ts";
import { toStudentActivityEvents } from "./rules.ts";
import {
  calculatePacketActivity,
  verifyPacketActivityCalculation,
} from "./packet.ts";
import {
  PacketDelayParametersSchema,
  type PacketDelayParameters,
} from "../networking/packet-delay.ts";

export type VisualActivity =
  ConceptGraph | SequenceDiagram | PacketExperiment | PacketDelayExperiment;
export type PlayerContext = Pick<
  ActivityEvent,
  "activity_id" | "session_id" | "root_attempt_id" | "attempt_id"
>;
export type PlayerEventType =
  | "display"
  | "prediction"
  | "experiment_state"
  | "experiment_result"
  | "packet_state"
  | "packet_result"
  | "explanation";

// A transport boundary, not a second activity or calculation schema. The
// integrator owns authorization, revision checks and authoritative recomputation.
export type ExperimentRequest = {
  activity: PacketDelayExperiment;
  context: PlayerContext;
  settings: PacketDelayParameters;
  prediction: string;
  request_id: string;
  signal: AbortSignal;
};
export type ExperimentAdapter = {
  provenance: "fixture" | "server";
  run: (request: ExperimentRequest) => Promise<unknown>;
};

export function parsePlayerActivity(record: unknown): VisualActivity | null {
  // Guard the unknown transport record before recovering its shared schema type.
  if (typeof record !== "object" || record === null || !("kind" in record))
    return null;
  const kind = record.kind;
  if (
    kind !== "concept_graph" &&
    kind !== "sequence_diagram" &&
    kind !== "packet_experiment"
  )
    return null;
  try {
    const result = validateVisualActivity(record);
    if (!result.ok) return null;
    // Recover the shared discriminated types without an unchecked cast or
    // independently maintained copy of Anya's schemas.
    if (kind === "concept_graph")
      return ConceptGraphSchema.parse(result.activity);
    if (kind === "sequence_diagram")
      return SequenceDiagramSchema.parse(result.activity);
    const current = PacketDelayExperimentSchema.safeParse(result.activity);
    return current.success
      ? current.data
      : PacketExperimentSchema.parse(result.activity);
  } catch {
    return null;
  }
}

export function sameContext(
  event: PlayerContext,
  context: PlayerContext,
): boolean {
  return (
    event.activity_id === context.activity_id &&
    event.session_id === context.session_id &&
    event.root_attempt_id === context.root_attempt_id &&
    event.attempt_id === context.attempt_id
  );
}

export function validSettings(
  activity: PacketExperiment | PacketDelayExperiment,
  settings: Record<string, number>,
): boolean {
  if (activity.version === "visual-v2") {
    try {
      // Local validity only. The server separately supplies its authorized scope.
      calculatePacketActivity(activity, settings, {
        content_ref: activity.source,
        concept_ids: new Set(activity.concept_ids),
      });
      return true;
    } catch {
      return false;
    }
  }
  return (
    Object.keys(settings).length === activity.parameters.length &&
    activity.parameters.every((parameter) => {
      const value = settings[parameter.id];
      return (
        Object.hasOwn(settings, parameter.id) &&
        Number.isSafeInteger(value) &&
        value >= parameter.min &&
        value <= parameter.max
      );
    })
  );
}

export function defaultSettings(
  activity: PacketExperiment | PacketDelayExperiment,
): Record<string, number> {
  if (activity.version === "visual-v2") return { ...activity.parameters };
  return Object.fromEntries(activity.parameters.map((p) => [p.id, p.default]));
}

export function parsePlayerEvents(
  input: unknown,
  context: PlayerContext,
  activity: VisualActivity,
): ActivityEvent[] | null {
  const identity = ActivityEventSchema.safeParse({
    ...context,
    event_id: context.activity_id,
    type: "display",
    activity_kind: activity.kind,
    supplied_hint_ids: [],
  });
  const parsed = ActivityEventLogSchema.safeParse(input);
  if (!identity.success || !parsed.success) return null;
  let resultSeen = false;
  let settings =
    activity.kind === "packet_experiment" ? defaultSettings(activity) : {};
  for (const event of parsed.data) {
    if (!sameContext(event, context)) return null;
    if (event.type === "display" && event.activity_kind !== activity.kind)
      return null;
    if (
      event.type === "experiment_state" &&
      (resultSeen ||
        activity.kind !== "packet_experiment" ||
        activity.version !== "visual-v1" ||
        !validSettings(activity, event.settings))
    )
      return null;
    if (event.type === "packet_state") {
      if (
        resultSeen ||
        activity.kind !== "packet_experiment" ||
        activity.version !== "visual-v2" ||
        !validSettings(activity, event.parameters)
      )
        return null;
      settings = event.parameters;
    }
    if (event.type === "packet_result") {
      if (
        activity.kind !== "packet_experiment" ||
        activity.version !== "visual-v2" ||
        !samePacketSettings(settings, event.calculation.parameters)
      )
        return null;
      try {
        verifyPacketActivityCalculation(activity, event.calculation, {
          content_ref: activity.source,
          concept_ids: new Set(activity.concept_ids),
        });
      } catch {
        return null;
      }
      resultSeen = true;
    }
    if (event.type === "experiment_result") {
      if (
        activity.kind !== "packet_experiment" ||
        activity.version !== "visual-v1"
      )
        return null;
      resultSeen = true;
    }
  }
  return toStudentActivityEvents(parsed.data);
}

function samePacketSettings(
  left: Record<string, number>,
  right: PacketDelayParameters,
) {
  return PacketDelayParametersSchema.keyof().options.every(
    (key) => left[key] === right[key],
  );
}

export function checkedExperimentResult(
  input: unknown,
  request: ExperimentRequest,
): Extract<ActivityEvent, { type: "packet_result" }> | null {
  const result = ActivityEventSchema.safeParse(input);
  if (
    !result.success ||
    result.data.type !== "packet_result" ||
    result.data.event_id !== request.request_id ||
    !sameContext(result.data, request.context) ||
    !validSettings(request.activity, request.settings) ||
    !samePacketSettings(request.settings, result.data.calculation.parameters) ||
    request.signal.aborted
  )
    return null;
  return result.data;
}

export function appendPlayerEvent(
  events: readonly ActivityEvent[],
  event: ActivityEvent,
  permitted: readonly PlayerEventType[],
): ActivityEvent[] | null {
  if (!permitted.some((type) => type === event.type)) return null;
  if (
    (event.type === "experiment_result" || event.type === "packet_result") &&
    !events.some(
      (prior) => prior.type === "prediction" && sameContext(prior, event),
    )
  )
    return null;
  const parsed = ActivityEventLogSchema.safeParse([...events, event]);
  return parsed.success ? parsed.data : null;
}
