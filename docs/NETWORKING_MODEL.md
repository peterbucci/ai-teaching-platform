# Packet-delay calculation model (#40)

`lib/networking/packet-delay.ts` is a pure, synchronous model usable in the
browser and on the server. It uses no AI, database, clock, randomness or mutable
session state. It does not implement a renderer or tutor action.

## Equations and scope

The approved `network-performance-v1` passages P07/P08 and the separate teaching
note in `reading.md` support:

- Transmission seconds = complete packet bits / effective link rate in bits/s.
- Propagation seconds = cable length in meters / supplied propagation speed in m/s.
- Transmission plus propagation = their sum for one link, from starting
  transmission until the last bit arrives, **excluding queueing and processing**.
  This is not a general network latency or round-trip calculation.

A one-bit packet still has nonzero transmission delay. Packet size includes any
counted overhead. Changing the link rate does not change the separately supplied
signal speed. The functions retain floating-point precision; round only for display.

## Public API

| Export                                                                               | Purpose                                                                |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `calculateTransmissionDelaySeconds(parameters)`                                      | Validated transmission component                                       |
| `calculatePropagationDelaySeconds(parameters)`                                       | Validated propagation component                                        |
| `calculatePacketDelay(parameters, modelVersion?)`                                    | Validated parameters, model version and both components plus their sum |
| `bytesToBits`, `megabitsPerSecondToBitsPerSecond`, `kilometersToMeters`              | Explicit conversions into canonical model units                        |
| `secondsToMilliseconds`                                                              | Unrounded display-unit conversion                                      |
| `TransmissionDelayParameters`, `PropagationDelayParameters`, `PacketDelayParameters` | Input types, each with a corresponding `…Schema` Zod export            |
| `PacketDelayResult`, `PacketDelayCalculation`                                        | Result and reproducible calculation types                              |
| `PACKET_DELAY_MODEL_VERSION`, `PACKET_DELAY_LIMITS`                                  | Supported version and validation envelope                              |

All calculation inputs use explicit unit-bearing field names. Unsupported fields,
unit aliases, strings, nonfinite values and out-of-range values throw `ZodError`;
there is no coercion, clamping or fabricated zero result. Callers can use the input
schemas' `safeParse` for form feedback. Unknown recorded model versions also fail.

The versioned teaching envelope is 1–1,000,000,000 whole packet bits;
1–1,000,000,000,000 bits/s; zero or 0.001–100,000,000 meters; and
1–300,000,000 m/s. These are model bounds, not claims about actual hardware.
The upper speed matches the rounded vacuum figure in P07. Zero distance is an
idealized boundary. Positive distance starts at one millimeter, avoiding tiny
values that underflow to zero. Activity controls may impose narrower bounds.

Conversions use 8 bits per whole byte, 1,000,000 bits/s per Mbps and 1,000 meters
per kilometer. There is no implicit MB/s, binary-prefix or unit-string parsing.

```ts
import {
  calculatePacketDelay,
  PACKET_DELAY_MODEL_VERSION,
} from "../lib/networking/packet-delay.ts";

const calculation = calculatePacketDelay(
  {
    packet_bits: 8_000,
    link_rate_bits_per_second: 1_000_000,
    distance_meters: 200_000,
    propagation_speed_meters_per_second: 200_000_000,
  },
  PACKET_DELAY_MODEL_VERSION,
);
// result: 0.008 transmission, 0.001 propagation, 0.009 combined seconds.
```

## Integration handoff

**#38:** At implementation time, the published default branch and open PRs did
not expose the R1 activity/tool contract. These are mathematical input/result
types only; no replacement activity schema was introduced. The #38 owner should
map the agreed canonical parameters and `PacketDelayCalculation` into that
boundary, including source/version, reveal policy and activity-specific controls.
This adapter remains an integration gate; #40 is not closed by the pure module.

**#39:** Convert explicit UI units, validate against permitted control bounds,
then use the same calculation function for numerical previews. Label the combined
result's omissions and keep animation speed separate from numerical time. Do not
reveal outcomes before the activity permits them. A local preview is not a saved,
authoritative observation.

**#42 / #85:** After authenticating and checking the authorized activity, source,
revision, permitted changes and model version, recalculate from submitted settings
on the server. Supply the server-owned recorded version as the second argument;
never accept browser or model arithmetic. Reject or report invalid inputs without
advancing the activity. The pure function does not authorize submissions or decide
whether an activity is complete, assisted or educationally successful.

**#43:** Persist the checked parameters, model version and server-produced result
in the agreed evidence contract. Replay with
`calculatePacketDelay(record.parameters, record.model_version)`. Keep historical
version implementations available when introducing a future version; do not
silently replay old records with changed formulas or bounds.
