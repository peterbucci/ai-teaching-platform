import { ContentRefSchema, type ContentRef } from "../evidence/contracts.ts";
import {
  calculatePacketDelay,
  PacketDelayParametersSchema,
} from "../networking/packet-delay.ts";
import {
  PacketDelayCalculationSchema,
  PacketDelayExperimentSchema,
  PacketExperimentSchema,
} from "./contracts.ts";

/** Browser-safe selection: old parameter labels never become calculation inputs. */
export function readPacketExperiment(input: unknown) {
  const current = PacketDelayExperimentSchema.safeParse(input);
  if (current.success)
    return { mode: "interactive" as const, activity: current.data };
  const legacy = PacketExperimentSchema.parse(input);
  return {
    mode: "text" as const,
    text: legacy.text_alternative,
    reason: "legacy_packet_format" as const,
  };
}

/** The server caller obtains this scope from its authenticated lesson resolver,
 * and loads the activity from its authorized snapshot, never from model permissions.
 * Browser calls can preview; the server must repeat this check before saving. */
export type PacketActivityScope = {
  content_ref: ContentRef;
  concept_ids: ReadonlySet<string>;
};

export function calculatePacketActivity(
  activityInput: unknown,
  parametersInput: unknown,
  scope: PacketActivityScope,
) {
  const activity = PacketDelayExperimentSchema.parse(activityInput);
  const source = ContentRefSchema.parse(scope.content_ref);
  if (
    JSON.stringify(activity.source) !== JSON.stringify(source) ||
    activity.concept_ids.some((id) => !scope.concept_ids.has(id))
  )
    throw new Error(
      "The packet activity is outside the authorized lesson scope.",
    );
  const parameters = PacketDelayParametersSchema.parse(parametersInput);
  for (const parameter of PacketDelayParametersSchema.keyof().options) {
    const control = activity.adjustable_parameters.find(
      (item) => item.parameter === parameter,
    );
    if (
      control
        ? parameters[parameter] < control.min ||
          parameters[parameter] > control.max
        : parameters[parameter] !== activity.parameters[parameter]
    )
      throw new Error(
        `The setting for ${parameter} is not permitted by this activity.`,
      );
  }
  return calculatePacketDelay(parameters, activity.model_version);
}

/** Validate a saved result against its exact authorized activity and recompute it.
 * This is a replay check, not an endpoint accepting client-computed observations. */
export function verifyPacketActivityCalculation(
  activityInput: unknown,
  calculationInput: unknown,
  scope: PacketActivityScope,
) {
  const saved = PacketDelayCalculationSchema.parse(calculationInput);
  return calculatePacketActivity(activityInput, saved.parameters, scope);
}
