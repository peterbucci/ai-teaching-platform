import { z } from "zod";

// Provisional module-local calculation interfaces. The approved #38 activity
// parameter/result types will connect through an adapter when available.

// Version the equations, units and accepted ranges together for recorded replay.
export const PACKET_DELAY_MODEL_VERSION = "packet-delay-v1";

// A bounded teaching model, not hardware limits or an activity/control schema.
// #38 may narrow these ranges for a particular authorized activity.
export const PACKET_DELAY_LIMITS = {
  packet_bits: { min: 1, max: 1_000_000_000 },
  link_rate_bits_per_second: { min: 1, max: 1_000_000_000_000 },
  distance_meters: { min: 0, min_positive: 0.001, max: 100_000_000 },
  propagation_speed_meters_per_second: { min: 1, max: 300_000_000 },
} as const;

const packetBits = z
  .int()
  .min(PACKET_DELAY_LIMITS.packet_bits.min)
  .max(PACKET_DELAY_LIMITS.packet_bits.max);
const linkRate = z
  .number()
  .finite()
  .min(PACKET_DELAY_LIMITS.link_rate_bits_per_second.min)
  .max(PACKET_DELAY_LIMITS.link_rate_bits_per_second.max);
const distance = z
  .number()
  .finite()
  .min(PACKET_DELAY_LIMITS.distance_meters.min)
  .max(PACKET_DELAY_LIMITS.distance_meters.max)
  .refine(
    (value) =>
      value === 0 || value >= PACKET_DELAY_LIMITS.distance_meters.min_positive,
    "Distance must be zero or at least 0.001 meters",
  );
const propagationSpeed = z
  .number()
  .finite()
  .min(PACKET_DELAY_LIMITS.propagation_speed_meters_per_second.min)
  .max(PACKET_DELAY_LIMITS.propagation_speed_meters_per_second.max);

export const TransmissionDelayParametersSchema = z.strictObject({
  packet_bits: packetBits,
  link_rate_bits_per_second: linkRate,
});
export type TransmissionDelayParameters = z.infer<
  typeof TransmissionDelayParametersSchema
>;

export const PropagationDelayParametersSchema = z.strictObject({
  distance_meters: distance,
  propagation_speed_meters_per_second: propagationSpeed,
});
export type PropagationDelayParameters = z.infer<
  typeof PropagationDelayParametersSchema
>;

// Canonical calculation inputs only. No source, activity, permission or event
// envelope: those belong to #38 and its consumers. Extra keys are rejected.
export const PacketDelayParametersSchema = z.strictObject({
  ...TransmissionDelayParametersSchema.shape,
  ...PropagationDelayParametersSchema.shape,
});
export type PacketDelayParameters = z.infer<typeof PacketDelayParametersSchema>;

export type PacketDelayResult = {
  transmission_delay_seconds: number;
  propagation_delay_seconds: number;
  /** Single-link last-bit arrival from transmission start; excludes queueing
   * and processing. This is neither general network latency nor RTT. */
  transmission_plus_propagation_seconds: number;
};

export type PacketDelayCalculation = {
  model_version: typeof PACKET_DELAY_MODEL_VERSION;
  parameters: PacketDelayParameters;
  result: PacketDelayResult;
};

/** Complete packet size includes all overhead to be counted. P08: L / R.
 * Even a one-bit packet takes nonzero time (approved reading teaching note).
 * Throws ZodError for invalid inputs; never clamps, coerces or rounds. */
export function calculateTransmissionDelaySeconds(
  input: TransmissionDelayParameters,
): number {
  const parameters = TransmissionDelayParametersSchema.parse(input);
  return parameters.packet_bits / parameters.link_rate_bits_per_second;
}

/** P07/P08: cable length / supplied signal speed. Link rate and packet size
 * cannot affect this component. Zero length is an allowed idealized boundary. */
export function calculatePropagationDelaySeconds(
  input: PropagationDelayParameters,
): number {
  const parameters = PropagationDelayParametersSchema.parse(input);
  // Normalize -0 so JSON replay retains the same result.
  return parameters.distance_meters === 0
    ? 0
    : parameters.distance_meters /
        parameters.propagation_speed_meters_per_second;
}

/** Recompute from inputs using a supported, recorded model version. Call on
 * the server for authoritative arithmetic; client/LLM results are not inputs.
 * The caller still owns authorization, permitted controls and reveal timing.
 * P08 permits this sum only with queueing/processing excluded on one link. */
export function calculatePacketDelay(
  input: unknown,
  modelVersion: unknown = PACKET_DELAY_MODEL_VERSION,
): PacketDelayCalculation {
  const model_version = z
    .literal(PACKET_DELAY_MODEL_VERSION)
    .parse(modelVersion);
  const parameters = PacketDelayParametersSchema.parse(input);
  if (parameters.distance_meters === 0) parameters.distance_meters = 0;
  const transmission_delay_seconds = calculateTransmissionDelaySeconds({
    packet_bits: parameters.packet_bits,
    link_rate_bits_per_second: parameters.link_rate_bits_per_second,
  });
  const propagation_delay_seconds = calculatePropagationDelaySeconds({
    distance_meters: parameters.distance_meters,
    propagation_speed_meters_per_second:
      parameters.propagation_speed_meters_per_second,
  });
  return {
    model_version,
    parameters,
    result: {
      transmission_delay_seconds,
      propagation_delay_seconds,
      transmission_plus_propagation_seconds:
        transmission_delay_seconds + propagation_delay_seconds,
    },
  };
}

// Explicit conversions for the approved content: 8 bits/byte, decimal Mbps
// (not MB/s or binary prefixes), kilometers to meters, seconds to milliseconds.
// Conversion validates the same model ranges; unsupported units have no alias.
export function bytesToBits(bytes: number): number {
  const value = z.int().positive().parse(bytes);
  return packetBits.parse(value * 8);
}

export function megabitsPerSecondToBitsPerSecond(mbps: number): number {
  const value = z.number().finite().positive().parse(mbps);
  return linkRate.parse(value * 1_000_000);
}

export function kilometersToMeters(kilometers: number): number {
  const value = z.number().finite().nonnegative().parse(kilometers);
  return value === 0 ? 0 : distance.parse(value * 1_000);
}

/** Presentation conversion only; keep raw seconds in recorded calculations. */
export function secondsToMilliseconds(seconds: number): number {
  const value = z.number().finite().nonnegative().parse(seconds);
  return value === 0
    ? 0
    : z
        .number()
        .finite()
        .parse(value * 1_000);
}
