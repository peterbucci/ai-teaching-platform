import {
  ActivityEventLogSchema,
  ActivityEventSchema,
  ConceptGraphSchema,
  PacketExperimentSchema,
  SequenceDiagramSchema,
  type ActivityEvent,
  type ConceptGraph,
  type PacketExperiment,
  type SequenceDiagram,
} from "./contracts.ts";
import { validateVisualActivity } from "./validate.ts";
import { toStudentActivityEvents } from "./rules.ts";

export type VisualActivity = ConceptGraph | SequenceDiagram | PacketExperiment;
export type PlayerContext = Pick<
  ActivityEvent,
  "activity_id" | "session_id" | "root_attempt_id" | "attempt_id"
>;
export type PlayerEventType =
  | "display"
  | "prediction"
  | "experiment_state"
  | "experiment_result"
  | "explanation";

// A transport boundary, not a second activity or calculation schema. The
// integrator owns authorization, revision checks and the #40 parameter mapping.
export type ExperimentRequest = {
  activity: PacketExperiment;
  context: PlayerContext;
  settings: Record<string, number>;
  prediction: string;
  request_id: string;
  signal: AbortSignal;
};
export type ExperimentAdapter = {
  provenance: "fixture" | "server";
  run: (request: ExperimentRequest) => Promise<unknown>;
};

export function parsePlayerActivity(record: unknown): VisualActivity | null {
  // The dependency's validator returns unknown and currently accepts inherited
  // object keys in its dispatch lookup. Guard before calling the shared check.
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
    return PacketExperimentSchema.parse(result.activity);
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
  activity: PacketExperiment,
  settings: Record<string, number>,
): boolean {
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
  activity: PacketExperiment,
): Record<string, number> {
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
  for (const event of parsed.data) {
    if (!sameContext(event, context)) return null;
    if (event.type === "display" && event.activity_kind !== activity.kind)
      return null;
    if (
      event.type === "experiment_state" &&
      (resultSeen ||
        activity.kind !== "packet_experiment" ||
        !validSettings(activity, event.settings))
    )
      return null;
    if (event.type === "experiment_result") resultSeen = true;
  }
  return toStudentActivityEvents(parsed.data);
}

export function checkedExperimentResult(
  input: unknown,
  request: ExperimentRequest,
): Extract<ActivityEvent, { type: "experiment_result" }> | null {
  const result = ActivityEventSchema.safeParse(input);
  if (
    !result.success ||
    result.data.type !== "experiment_result" ||
    result.data.event_id !== request.request_id ||
    !sameContext(result.data, request.context) ||
    !validSettings(request.activity, request.settings) ||
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
    event.type === "experiment_result" &&
    !events.some(
      (prior) => prior.type === "prediction" && sameContext(prior, event),
    )
  )
    return null;
  const parsed = ActivityEventLogSchema.safeParse([...events, event]);
  return parsed.success ? parsed.data : null;
}
