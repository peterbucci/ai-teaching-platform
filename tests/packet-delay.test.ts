import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import {
  PACKET_DELAY_LIMITS,
  PACKET_DELAY_MODEL_VERSION,
  PacketDelayParametersSchema,
  bytesToBits,
  calculatePacketDelay,
  calculatePropagationDelaySeconds,
  calculateTransmissionDelaySeconds,
  kilometersToMeters,
  megabitsPerSecondToBitsPerSecond,
  secondsToMilliseconds,
  type PacketDelayCalculation,
  type PacketDelayParameters,
} from "../lib/networking/packet-delay.ts";

const baseline: PacketDelayParameters = {
  packet_bits: 8_000,
  link_rate_bits_per_second: 1_000_000,
  distance_meters: 200_000,
  propagation_speed_meters_per_second: 200_000_000,
};

function approximatelyEqual(actual: number, expected: number) {
  assert.ok(
    Math.abs(actual - expected) <= Math.abs(expected) * 1e-12,
    `Expected ${actual} to be approximately ${expected}`,
  );
}

test("one link calculates 8 ms transmission and 1 ms propagation separately", () => {
  assert.equal(
    calculateTransmissionDelaySeconds({
      packet_bits: baseline.packet_bits,
      link_rate_bits_per_second: baseline.link_rate_bits_per_second,
    }),
    0.008,
  );
  assert.equal(
    calculatePropagationDelaySeconds({
      distance_meters: baseline.distance_meters,
      propagation_speed_meters_per_second:
        baseline.propagation_speed_meters_per_second,
    }),
    0.001,
  );
  const calculation = calculatePacketDelay(baseline);
  assert.equal(calculation.result.transmission_delay_seconds, 0.008);
  assert.equal(calculation.result.propagation_delay_seconds, 0.001);
  approximatelyEqual(
    calculation.result.transmission_plus_propagation_seconds,
    0.009,
  );
});

test("approved NP-TX-02 and NP-PROP-01 examples use bytes, decimal Mbps and km", () => {
  const calculation = calculatePacketDelay({
    packet_bits: bytesToBits(1_500),
    link_rate_bits_per_second: megabitsPerSecondToBitsPerSecond(6),
    distance_meters: kilometersToMeters(600),
    propagation_speed_meters_per_second: 200_000_000,
  });
  assert.equal(calculation.parameters.packet_bits, 12_000);
  assert.equal(calculation.parameters.link_rate_bits_per_second, 6_000_000);
  assert.equal(calculation.parameters.distance_meters, 600_000);
  assert.equal(
    secondsToMilliseconds(calculation.result.transmission_delay_seconds),
    2,
  );
  assert.equal(
    secondsToMilliseconds(calculation.result.propagation_delay_seconds),
    3,
  );
  assert.equal(calculation.result.transmission_plus_propagation_seconds, 0.005);
});

test("finite rates retain one-bit transmission time and approved small/large transfers", () => {
  for (const [bits, rate, seconds] of [
    [1, 10_000_000, 0.0000001], // P01: 0.1 microseconds, not zero.
    [8, 1_000_000, 0.000008], // P09: one byte takes 8 microseconds.
    [8, 100_000_000, 0.00000008], // P09: one byte takes 0.08 microseconds.
    [bytesToBits(25_000_000), 10_000_000, 20], // P10: decimal MB, not MiB.
  ]) {
    assert.equal(
      calculateTransmissionDelaySeconds({
        packet_bits: bits,
        link_rate_bits_per_second: rate,
      }),
      seconds,
    );
  }
});

test("controlled changes affect only their own component and the explicit sum", () => {
  const original = calculatePacketDelay(baseline).result;
  const cases: Array<[Partial<PacketDelayParameters>, number, number]> = [
    [{ packet_bits: baseline.packet_bits * 2 }, 0.016, 0.001],
    [
      { link_rate_bits_per_second: baseline.link_rate_bits_per_second / 2 },
      0.016,
      0.001,
    ],
    [
      { link_rate_bits_per_second: baseline.link_rate_bits_per_second * 2 },
      0.004,
      0.001,
    ],
    [{ distance_meters: baseline.distance_meters * 2 }, 0.008, 0.002],
    [
      {
        propagation_speed_meters_per_second:
          baseline.propagation_speed_meters_per_second / 2,
      },
      0.008,
      0.002,
    ],
  ];
  for (const [change, transmission, propagation] of cases) {
    const result = calculatePacketDelay({ ...baseline, ...change }).result;
    assert.equal(result.transmission_delay_seconds, transmission);
    assert.equal(result.propagation_delay_seconds, propagation);
    assert.equal(
      result.transmission_plus_propagation_seconds,
      transmission + propagation,
    );
    assert.equal(
      Number(
        result.transmission_delay_seconds !==
          original.transmission_delay_seconds,
      ) +
        Number(
          result.propagation_delay_seconds !==
            original.propagation_delay_seconds,
        ),
      1,
    );
  }
});

test("conversions keep fractional rates and distances without rounding results", () => {
  assert.equal(bytesToBits(1), 8);
  assert.equal(megabitsPerSecondToBitsPerSecond(1.5), 1_500_000);
  assert.equal(kilometersToMeters(0.000001), 0.001);
  approximatelyEqual(secondsToMilliseconds(0.0000001), 0.0001);
  const result = calculatePacketDelay({
    ...baseline,
    packet_bits: 1,
    link_rate_bits_per_second: 3,
    distance_meters: 1,
    propagation_speed_meters_per_second: 3,
  }).result;
  assert.equal(result.transmission_delay_seconds, 1 / 3);
  assert.equal(result.propagation_delay_seconds, 1 / 3);
  approximatelyEqual(result.transmission_plus_propagation_seconds, 2 / 3);
  assert.notEqual(result.transmission_delay_seconds, 0.333);
});

test("accepted range boundaries yield finite positive delays or zero-distance propagation", () => {
  const minimum = calculatePacketDelay({
    packet_bits: PACKET_DELAY_LIMITS.packet_bits.min,
    link_rate_bits_per_second:
      PACKET_DELAY_LIMITS.link_rate_bits_per_second.max,
    distance_meters: PACKET_DELAY_LIMITS.distance_meters.min_positive,
    propagation_speed_meters_per_second:
      PACKET_DELAY_LIMITS.propagation_speed_meters_per_second.max,
  }).result;
  assert.equal(minimum.transmission_delay_seconds, 1e-12);
  approximatelyEqual(minimum.propagation_delay_seconds, 0.001 / 300_000_000);
  const maximum = calculatePacketDelay({
    packet_bits: PACKET_DELAY_LIMITS.packet_bits.max,
    link_rate_bits_per_second:
      PACKET_DELAY_LIMITS.link_rate_bits_per_second.min,
    distance_meters: PACKET_DELAY_LIMITS.distance_meters.max,
    propagation_speed_meters_per_second:
      PACKET_DELAY_LIMITS.propagation_speed_meters_per_second.min,
  }).result;
  assert.equal(maximum.transmission_delay_seconds, 1_000_000_000);
  assert.equal(maximum.propagation_delay_seconds, 100_000_000);
  assert.equal(maximum.transmission_plus_propagation_seconds, 1_100_000_000);
  const zeroDistance = calculatePacketDelay({
    ...baseline,
    distance_meters: 0,
  }).result;
  assert.equal(zeroDistance.propagation_delay_seconds, 0);
  assert.equal(zeroDistance.transmission_plus_propagation_seconds, 0.008);
});

test("invalid inputs are rejected without coercion, guessed units or supplied results", () => {
  for (const input of [
    null,
    undefined,
    [],
    {},
    { ...baseline, packet_bits: "8000" },
    { ...baseline, link_rate_bits_per_second: "1 Mbps" },
    { ...baseline, distance_meters: null },
    { ...baseline, propagation_speed_meters_per_second: true },
    { ...baseline, packet_bytes: 1_000 },
    { ...baseline, distance_km: 200 },
    { ...baseline, units: "ms" },
    { ...baseline, transmission_delay_seconds: 999 },
    { ...baseline, queue_seconds: 1 },
    { ...baseline, formula: "packet_bits / distance_meters" },
  ]) {
    assert.equal(PacketDelayParametersSchema.safeParse(input).success, false);
    assert.throws(() => calculatePacketDelay(input), ZodError);
  }
});

test("each parameter rejects negative, nonfinite and out-of-range values", () => {
  for (const key of Object.keys(baseline)) {
    for (const value of [-1, NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
      assert.throws(
        () => calculatePacketDelay({ ...baseline, [key]: value }),
        ZodError,
      );
    }
  }
  for (const change of [
    { packet_bits: 0 },
    { packet_bits: 1.5 },
    { packet_bits: PACKET_DELAY_LIMITS.packet_bits.max + 1 },
    { link_rate_bits_per_second: 0 },
    { link_rate_bits_per_second: 0.5 },
    {
      link_rate_bits_per_second:
        PACKET_DELAY_LIMITS.link_rate_bits_per_second.max + 1,
    },
    { distance_meters: 0.0005 },
    { distance_meters: PACKET_DELAY_LIMITS.distance_meters.max + 1 },
    { propagation_speed_meters_per_second: 0 },
    { propagation_speed_meters_per_second: 0.5 },
    {
      propagation_speed_meters_per_second:
        PACKET_DELAY_LIMITS.propagation_speed_meters_per_second.max + 1,
    },
  ]) {
    assert.throws(
      () => calculatePacketDelay({ ...baseline, ...change }),
      ZodError,
    );
  }
  assert.throws(
    () =>
      calculateTransmissionDelaySeconds({
        packet_bits: 1,
        link_rate_bits_per_second: 0,
      }),
    ZodError,
  );
  assert.throws(
    () =>
      calculatePropagationDelaySeconds({
        distance_meters: 0,
        propagation_speed_meters_per_second: 0,
      }),
    ZodError,
  );
});

test("conversion helpers reject invalid values and results beyond model ranges", () => {
  for (const convert of [
    bytesToBits,
    megabitsPerSecondToBitsPerSecond,
    kilometersToMeters,
    secondsToMilliseconds,
  ]) {
    for (const invalid of [-1, NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
      assert.throws(() => convert(invalid), ZodError);
    }
  }
  for (const invalid of [0, 0.5, 125_000_001]) {
    assert.throws(() => bytesToBits(invalid), ZodError);
  }
  for (const invalid of [0, 0.0000005, 1_000_001]) {
    assert.throws(() => megabitsPerSecondToBitsPerSecond(invalid), ZodError);
  }
  for (const invalid of [0.0000005, 100_001]) {
    assert.throws(() => kilometersToMeters(invalid), ZodError);
  }
  assert.equal(kilometersToMeters(0), 0);
  assert.equal(secondsToMilliseconds(0), 0);
});

test("server recomputation is repeatable, versioned and stable through JSON replay", () => {
  const original = calculatePacketDelay(baseline);
  assert.equal(original.model_version, PACKET_DELAY_MODEL_VERSION);
  assert.deepEqual(calculatePacketDelay(baseline), original);
  const saved: PacketDelayCalculation = JSON.parse(JSON.stringify(original));
  assert.deepEqual(
    calculatePacketDelay(saved.parameters, saved.model_version),
    original,
  );
  for (const invalidVersion of [
    "packet-delay-v0",
    "packet-delay-v2",
    null,
    1,
    {},
  ]) {
    assert.throws(
      () => calculatePacketDelay(saved.parameters, invalidVersion),
      ZodError,
    );
  }
  const negativeZero = calculatePacketDelay({
    ...baseline,
    distance_meters: -0,
  });
  assert.equal(negativeZero.parameters.distance_meters, 0);
  assert.equal(negativeZero.result.propagation_delay_seconds, 0);
  assert.deepEqual(negativeZero, JSON.parse(JSON.stringify(negativeZero)));
});

test("calculation does not mutate caller parameters or retain their object", () => {
  const input = Object.freeze({ ...baseline, distance_meters: -0 });
  const calculation = calculatePacketDelay(input);
  assert.equal(input.distance_meters, -0);
  assert.notStrictEqual(calculation.parameters, input);
  calculation.parameters.packet_bits = 1;
  assert.equal(input.packet_bits, baseline.packet_bits);
  assert.equal(
    calculatePacketDelay(input).result.transmission_delay_seconds,
    0.008,
  );
});
