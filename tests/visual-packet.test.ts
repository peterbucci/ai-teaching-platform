import assert from "node:assert/strict";
import test from "node:test";
import { ContentRefSchema } from "../lib/evidence/contracts.ts";
import { calculatePacketDelay } from "../lib/networking/packet-delay.ts";
import {
  ActivityEventLogSchema,
  ActivityEventSchema,
  PacketDelayCalculationSchema,
  PacketDelayExperimentSchema,
} from "../lib/visual/contracts.ts";
import {
  validActivityEvents,
  validPacketDelayEvents,
  validPacketDelayExperiment as activity,
  validPacketExperiment,
} from "../lib/visual/examples.ts";
import {
  calculatePacketActivity,
  readPacketExperiment,
  verifyPacketActivityCalculation,
} from "../lib/visual/packet.ts";
import { toStudentActivityEvents } from "../lib/visual/rules.ts";
import { validateVisualActivity } from "../lib/visual/validate.ts";

const scope = {
  content_ref: ContentRefSchema.parse(activity.source),
  concept_ids: new Set(activity.concept_ids),
};

test("current packet activities use the reviewed SI calculator and replay exact numeric results", () => {
  assert.equal(validateVisualActivity(activity).ok, true);
  assert.equal(readPacketExperiment(activity).mode, "interactive");
  const result = calculatePacketActivity(activity, activity.parameters, scope);
  assert.deepEqual(result, calculatePacketDelay(activity.parameters));
  assert.equal(result.result.transmission_delay_seconds, 0.008);
  assert.equal(result.result.propagation_delay_seconds, 0.001);
  assert.deepEqual(
    verifyPacketActivityCalculation(
      activity,
      JSON.parse(JSON.stringify(result)),
      scope,
    ),
    result,
  );
});

test("fractional non-packet settings survive unchanged while packet bits stay integral", () => {
  const adjustable = {
    ...activity,
    adjustable_parameters: [
      { parameter: "distance_meters", min: 0, max: 400_000 },
      { parameter: "link_rate_bits_per_second", min: 1, max: 2_000_000 },
      {
        parameter: "propagation_speed_meters_per_second",
        min: 1,
        max: 300_000_000,
      },
      { parameter: "packet_bits", min: 1, max: 16_000 },
    ],
  };
  const parameters = {
    ...activity.parameters,
    distance_meters: 0.125,
    link_rate_bits_per_second: 1_000_000.5,
    propagation_speed_meters_per_second: 200_000_000.25,
  };
  assert.deepEqual(
    calculatePacketActivity(adjustable, parameters, scope).parameters,
    parameters,
  );
  assert.throws(() =>
    calculatePacketActivity(
      adjustable,
      { ...parameters, packet_bits: 1.5 },
      scope,
    ),
  );
});

test("activity controls can narrow model bounds but cannot widen them or change fixed inputs", () => {
  assert.throws(() =>
    calculatePacketActivity(
      activity,
      { ...activity.parameters, distance_meters: 400_001 },
      scope,
    ),
  );
  assert.throws(() =>
    calculatePacketActivity(
      activity,
      { ...activity.parameters, packet_bits: 16_000 },
      scope,
    ),
  );
  for (const adjustable_parameters of [
    [{ parameter: "distance_meters", min: 0, max: 100_000_001 }],
    [{ parameter: "distance_meters", min: 0, max: 100 }],
    [{ parameter: "distance_meters", min: 0, max: 0 }],
    [{ parameter: "packet_bits", min: 1.5, max: 16_000 }],
    [{ parameter: "queue_delay", min: 0, max: 500 }],
    [...activity.adjustable_parameters, ...activity.adjustable_parameters],
  ])
    assert.equal(
      PacketDelayExperimentSchema.safeParse({
        ...activity,
        adjustable_parameters,
      }).success,
      false,
    );
});

test("source version and authorized concept membership are checked separately from ID syntax", () => {
  const concept = "50000000-0000-4000-8000-000000000001";
  const custom = { ...activity, concept_ids: [concept] };
  assert.equal(PacketDelayExperimentSchema.safeParse(custom).success, true);
  assert.throws(() =>
    calculatePacketActivity(custom, custom.parameters, scope),
  );
  assert.doesNotThrow(() =>
    calculatePacketActivity(custom, custom.parameters, {
      ...scope,
      concept_ids: new Set([concept]),
    }),
  );
  assert.throws(() =>
    calculatePacketActivity(activity, activity.parameters, {
      ...scope,
      content_ref: { ...scope.content_ref, content_version: "another-version" },
    }),
  );
});

test("unrecognized units, model versions and injected results never become calculator input", () => {
  assert.equal(
    PacketDelayExperimentSchema.safeParse({
      ...activity,
      model_version: "packet-delay-v999",
    }).success,
    false,
  );
  for (const parameters of [
    { ...activity.parameters, distance_meters: "200000" },
    { ...activity.parameters, packet_bits: 0 },
    { ...activity.parameters, distance_meters: 0.0001 },
    { ...activity.parameters, result: { propagation_delay_seconds: 0 } },
    { ...activity.parameters, unit: "ms" },
  ])
    assert.throws(() => calculatePacketActivity(activity, parameters, scope));
});

test("stored numeric results reject tampering and invalid inputs without throwing from safeParse", () => {
  const calculation = calculatePacketDelay(activity.parameters);
  assert.equal(
    PacketDelayCalculationSchema.safeParse({
      ...calculation,
      result: { ...calculation.result, propagation_delay_seconds: 7 },
    }).success,
    false,
  );
  assert.equal(
    PacketDelayCalculationSchema.safeParse({
      ...calculation,
      parameters: { ...calculation.parameters, distance_meters: 0.0001 },
    }).success,
    false,
  );
  assert.throws(() =>
    verifyPacketActivityCalculation(
      activity,
      calculatePacketDelay({
        ...activity.parameters,
        packet_bits: 1,
      }),
      scope,
    ),
  );
});

test("legacy packets and string events remain readable with an explicit text fallback", () => {
  assert.equal(validateVisualActivity(validPacketExperiment).ok, true);
  assert.deepEqual(readPacketExperiment(validPacketExperiment), {
    mode: "text",
    text: validPacketExperiment.text_alternative,
    reason: "legacy_packet_format",
  });
  assert.equal(
    ActivityEventLogSchema.safeParse(validActivityEvents).success,
    true,
  );
  assert.throws(() =>
    calculatePacketActivity(validPacketExperiment, activity.parameters, scope),
  );
  assert.equal(
    validateVisualActivity({ ...validPacketExperiment, version: "visual-v2" })
      .ok,
    false,
  );
});

test("numeric packet events preserve exact settings and reveal results only after their own prediction", () => {
  assert.equal(
    ActivityEventLogSchema.safeParse(validPacketDelayEvents).success,
    true,
  );
  const result = validPacketDelayEvents.at(-1)!;
  assert.equal(ActivityEventSchema.safeParse(result).success, true);
  assert.equal(toStudentActivityEvents([result]).length, 0);
  assert.equal(
    toStudentActivityEvents([validPacketDelayEvents[2], result]).length,
    2,
  );
  const other = {
    ...result,
    activity_id: "8f1c2a10-0000-4000-8000-0000000000bb",
  };
  assert.equal(
    toStudentActivityEvents([validPacketDelayEvents[2], other]).length,
    1,
  );
  assert.equal(
    ActivityEventLogSchema.safeParse([
      result,
      { ...result, event_id: "8f1c2a10-0000-4000-8000-000000000099" },
    ]).success,
    false,
  );
  assert.equal(
    ActivityEventLogSchema.safeParse([
      result,
      {
        ...validActivityEvents[4],
        event_id: "8f1c2a10-0000-4000-8000-000000000099",
      },
    ]).success,
    false,
  );
});
