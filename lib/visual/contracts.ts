import { z } from "zod";
import {
  ContentRefSchema,
  QuestionSnapshotSchema,
} from "../evidence/contracts.ts";
import {
  PACKET_DELAY_MODEL_VERSION,
  PacketDelayParametersSchema,
  calculatePacketDelay,
} from "../networking/packet-delay.ts";

export const VISUAL_VERSION = "visual-v1";
export const PACKET_VISUAL_VERSION = "visual-v2";
export const VISUAL_LIMITS = {
  titleCharacters: 120,
  promptCharacters: 300,
  labelCharacters: 80,
  nodes: 12,
  edges: 24,
  participants: 6,
  messages: 20,
  parameters: 4,
  responseCharacters: 1_000,
  followUpAttempts: 3,
  eventsPerActivity: 50,
  concepts: 12,
  guidedSteps: 5,
  stepCharacters: 200,
  textAlternativeCharacters: 500,
  controls: 3,
  hints: 4,
} as const;

const text = z
  .string()
  .refine((value) => value.trim().length > 0, "Required text");
const identifier = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]{0,39}$/,
    "Use lowercase letters, numbers, and dashes",
  );
// Reuse content identities, including uploaded lessons' stable UUID concepts.
// Syntax does not authorize a concept: runtime callers must check membership
// in the exact lesson/source version resolved for the actor.
const conceptIdentifier = QuestionSnapshotSchema.shape.concept_ids.element;

const unique = (values: string[]) => new Set(values).size === values.length;

// Fields every visual activity shares: where it came from, what it teaches,
// how it is controlled, and who or what made it.
const activityFields = {
  version: z.literal(VISUAL_VERSION),
  title: text.max(VISUAL_LIMITS.titleCharacters),
  source: ContentRefSchema,
  concept_ids: z
    .array(conceptIdentifier)

    .max(VISUAL_LIMITS.concepts)
    .refine(unique, "Duplicate concept IDs"),
  text_alternative: text.max(VISUAL_LIMITS.textAlternativeCharacters),
  guided_steps: z
    .array(text.max(VISUAL_LIMITS.stepCharacters))
    .min(1)
    .max(VISUAL_LIMITS.guidedSteps),
  controls: z
    .array(z.enum(["select_item", "step_through", "adjust_setting"]))
    .min(1)
    .max(VISUAL_LIMITS.controls)
    .refine(unique, "Duplicate controls"),
  provenance: z.strictObject({
    generated_by: z.enum(["teacher_authored", "ai_generated"]),
    generator_version: identifier,
    reviewed_by_teacher: z.boolean(),
  }),
};

// Concept maps are plain data only: no HTML, SVG, scripts, or formulas.
export const ConceptGraphSchema = z
  .strictObject({
    ...activityFields,
    kind: z.literal("concept_graph"),
    nodes: z
      .array(
        z.strictObject({
          id: identifier,
          label: text.max(VISUAL_LIMITS.labelCharacters),
        }),
      )
      .min(1)
      .max(VISUAL_LIMITS.nodes),
    edges: z
      .array(
        z.strictObject({
          from: identifier,
          to: identifier,
          label: text.max(VISUAL_LIMITS.labelCharacters),
        }),
      )
      .max(VISUAL_LIMITS.edges),
  })
  .superRefine((graph, context) => {
    const nodeIds = graph.nodes.map((node) => node.id);
    if (new Set(nodeIds).size !== nodeIds.length) {
      context.addIssue({
        code: "custom",
        path: ["nodes"],
        message: "Node IDs must be unique",
      });
    }
    const known = new Set(nodeIds);
    graph.edges.forEach((edge, index) => {
      for (const end of ["from", "to"] as const) {
        if (!known.has(edge[end])) {
          context.addIssue({
            code: "custom",
            path: ["edges", index, end],
            message: `Unknown node "${edge[end]}"`,
          });
        }
      }
    });
  });

export type ConceptGraph = z.infer<typeof ConceptGraphSchema>;

// Messages run in array order, so the list itself is the timeline.
export const SequenceDiagramSchema = z
  .strictObject({
    ...activityFields,
    kind: z.literal("sequence_diagram"),
    participants: z
      .array(
        z.strictObject({
          id: identifier,
          label: text.max(VISUAL_LIMITS.labelCharacters),
        }),
      )
      .min(2)
      .max(VISUAL_LIMITS.participants),
    messages: z
      .array(
        z.strictObject({
          from: identifier,
          to: identifier,
          label: text.max(VISUAL_LIMITS.labelCharacters),
        }),
      )
      .min(1)
      .max(VISUAL_LIMITS.messages),
  })
  .superRefine((diagram, context) => {
    const participantIds = diagram.participants.map((item) => item.id);
    if (new Set(participantIds).size !== participantIds.length) {
      context.addIssue({
        code: "custom",
        path: ["participants"],
        message: "Participant IDs must be unique",
      });
    }
    const known = new Set(participantIds);
    diagram.messages.forEach((message, index) => {
      for (const end of ["from", "to"] as const) {
        if (!known.has(message[end])) {
          context.addIssue({
            code: "custom",
            path: ["messages", index, end],
            message: `Unknown participant "${message[end]}"`,
          });
        }
      }
    });
  });

export type SequenceDiagram = z.infer<typeof SequenceDiagramSchema>;

// Legacy visual-v1 records remain readable. These units are not packet-delay
// model inputs and must never be inferred or converted into the v2 calculation.
const experimentParameter = z
  .strictObject({
    id: identifier,
    label: text.max(VISUAL_LIMITS.labelCharacters),
    unit: z.enum(["ms", "packets", "percent"]),
    min: z.int().nonnegative(),
    max: z.int().nonnegative(),
    default: z.int().nonnegative(),
  })
  .refine(
    (parameter) =>
      parameter.min <= parameter.default && parameter.default <= parameter.max,
    "Default must be between min and max",
  );

export const PacketExperimentSchema = z
  .strictObject({
    ...activityFields,
    kind: z.literal("packet_experiment"),
    prompt: text.max(VISUAL_LIMITS.promptCharacters),
    parameters: z
      .array(experimentParameter)
      .min(1)
      .max(VISUAL_LIMITS.parameters),
  })
  .superRefine((experiment, context) => {
    const ids = experiment.parameters.map((parameter) => parameter.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["parameters"],
        message: "Parameter IDs must be unique",
      });
    }
  });

export type PacketExperiment = z.infer<typeof PacketExperimentSchema>;

const packetControl = z.strictObject({
  parameter: PacketDelayParametersSchema.keyof(),
  min: z.number().finite(),
  max: z.number().finite(),
});

/** SI input names carry their units. Only packet_bits is restricted to integers. */
export const PacketDelayExperimentSchema = z
  .strictObject({
    ...activityFields,
    version: z.literal(PACKET_VISUAL_VERSION),
    kind: z.literal("packet_experiment"),
    concept_ids: activityFields.concept_ids.min(1),
    prompt: text.max(VISUAL_LIMITS.promptCharacters),
    model_version: z.literal(PACKET_DELAY_MODEL_VERSION),
    parameters: PacketDelayParametersSchema,
    adjustable_parameters: z.array(packetControl).min(1).max(4),
  })
  .superRefine((activity, context) => {
    if (!activity.controls.includes("adjust_setting"))
      context.addIssue({
        code: "custom",
        path: ["controls"],
        message: "Packet experiments require the adjust_setting control",
      });
    const seen = new Set<string>();
    activity.adjustable_parameters.forEach((control, index) => {
      const schema = PacketDelayParametersSchema.shape[control.parameter];
      if (
        seen.has(control.parameter) ||
        !schema.safeParse(control.min).success ||
        !schema.safeParse(control.max).success ||
        control.min >= control.max ||
        activity.parameters[control.parameter] < control.min ||
        activity.parameters[control.parameter] > control.max
      )
        context.addIssue({
          code: "custom",
          path: ["adjustable_parameters", index],
          message:
            "Controls must be unique, within model bounds, and contain the initial value",
        });
      seen.add(control.parameter);
    });
  });
export type PacketDelayExperiment = z.infer<typeof PacketDelayExperimentSchema>;

/** Recorded numeric results are checked with #92's calculator, never a second formula. */
export const PacketDelayCalculationSchema = z
  .strictObject({
    model_version: z.literal(PACKET_DELAY_MODEL_VERSION),
    parameters: PacketDelayParametersSchema,
    result: z.strictObject({
      transmission_delay_seconds: z.number().finite().nonnegative(),
      propagation_delay_seconds: z.number().finite().nonnegative(),
      transmission_plus_propagation_seconds: z.number().finite().nonnegative(),
    }),
  })
  .superRefine((calculation, context) => {
    // A child refinement can fail while Zod still runs this parent refinement.
    // Keep safeParse safe for invalid model inputs such as sub-millimeter distance.
    if (!PacketDelayParametersSchema.safeParse(calculation.parameters).success)
      return;
    const actual = calculatePacketDelay(
      calculation.parameters,
      calculation.model_version,
    );
    for (const key of [
      "transmission_delay_seconds",
      "propagation_delay_seconds",
      "transmission_plus_propagation_seconds",
    ] as const)
      if (calculation.result[key] !== actual.result[key])
        context.addIssue({
          code: "custom",
          path: ["result", key],
          message: "Recorded result differs from the versioned calculation",
        });
  });

// Links each event to the existing session, episode (root attempt), and attempt.
const eventBase = {
  event_id: z.uuid(),
  activity_id: z.uuid(),
  session_id: z.uuid(),
  root_attempt_id: z.uuid().nullable(),
  attempt_id: z.uuid().nullable(),
};

// Each event is one step in an activity. Stored events never contain private rubric data.
export const ActivityEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...eventBase,
    type: z.literal("offer"),
    reason: text.max(VISUAL_LIMITS.promptCharacters),
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal("display"),
    activity_kind: z.enum([
      "concept_graph",
      "sequence_diagram",
      "packet_experiment",
    ]),
    // Hints or relationships the system supplied, recorded for assistance tracking.
    supplied_hint_ids: z
      .array(identifier)
      .max(VISUAL_LIMITS.hints)
      .refine(unique, "Duplicate hint IDs"),
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal("experiment_state"),
    settings: z.record(identifier, z.int().nonnegative()),
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal("prediction"),
    text: text.max(VISUAL_LIMITS.responseCharacters),
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal("experiment_result"),
    outcome: text.max(VISUAL_LIMITS.promptCharacters),
  }),
  z.strictObject({
    ...eventBase,
    version: z.literal(PACKET_VISUAL_VERSION),
    type: z.literal("packet_state"),
    model_version: z.literal(PACKET_DELAY_MODEL_VERSION),
    parameters: PacketDelayParametersSchema,
  }),
  z.strictObject({
    ...eventBase,
    version: z.literal(PACKET_VISUAL_VERSION),
    type: z.literal("packet_result"),
    calculation: PacketDelayCalculationSchema,
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal("explanation"),
    text: text.max(VISUAL_LIMITS.responseCharacters),
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal("follow_up_attempt"),
    attempt_number: z.int().min(1).max(VISUAL_LIMITS.followUpAttempts),
    text: text.max(VISUAL_LIMITS.responseCharacters),
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal("proposed"),
    activity_kind: z.enum([
      "concept_graph",
      "sequence_diagram",
      "packet_experiment",
    ]),
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal("accepted"),
  }),
  z.strictObject({
    ...eventBase,
    type: z.literal("failed"),
    reason: z.enum([
      "invalid_activity",
      "stale_revision",
      "not_permitted",
      "display_error",
    ]),
  }),
]);

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

// A prediction and a result are each submitted once per activity. Follow-up
// attempts are numbered once each. Experiment settings may change repeatedly.
function repeatKey(event: ActivityEvent): string | null {
  if (event.type === "packet_result")
    return `${event.activity_id}:experiment_result`;
  if (event.type === "prediction" || event.type === "experiment_result") {
    return `${event.activity_id}:${event.type}`;
  }
  if (event.type === "follow_up_attempt") {
    return `${event.activity_id}:attempt:${event.attempt_number}`;
  }
  return null;
}

// Teacher-only answer key. Kept separate from student-facing activity schemas,
// which reject these fields, so it is never sent to students by accident.
export const TeacherActivityKeySchema = z.strictObject({
  version: z.literal(VISUAL_VERSION),
  activity_id: z.uuid(),
  expected_answer: text.max(VISUAL_LIMITS.responseCharacters),
  rubric: z
    .array(text.max(VISUAL_LIMITS.stepCharacters))
    .min(1)
    .max(VISUAL_LIMITS.guidedSteps),
});

export type TeacherActivityKey = z.infer<typeof TeacherActivityKeySchema>;

export const ActivityEventLogSchema = z
  .array(ActivityEventSchema)
  .max(VISUAL_LIMITS.eventsPerActivity)
  .superRefine((events, context) => {
    const ids = events.map((event) => event.event_id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Event IDs must be unique",
      });
    }
    const seen = new Set<string>();
    events.forEach((event, index) => {
      const key = repeatKey(event);
      if (key === null) return;
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: `Repeat submission rejected for ${key}`,
        });
      }
      seen.add(key);
    });
  });
