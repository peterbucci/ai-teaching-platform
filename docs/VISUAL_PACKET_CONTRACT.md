# Packet activity contract for #38, #39, #40 and #41

This is a shared contract and deterministic adapter, not a live visual tutor,
permission service or persistence implementation. #92 supplies the unchanged
`lib/networking/packet-delay.ts` calculator. #104 adds its activity envelope.
The renderer (#105) and generator (#107) must explicitly adopt this contract.

## Current packet activities

`PacketDelayExperimentSchema` describes `kind: "packet_experiment"` with
`version: "visual-v2"` and `model_version: "packet-delay-v1"`. It retains the
source reference, concept IDs, text alternative, guided steps and provenance.
`parameters` is exactly #92's `PacketDelayParametersSchema`:

| Field                                 | Unit                 | Numeric form                     |
| ------------------------------------- | -------------------- | -------------------------------- |
| `packet_bits`                         | complete packet bits | integer                          |
| `link_rate_bits_per_second`           | bits per second      | finite number, fractions allowed |
| `distance_meters`                     | meters               | finite number, fractions allowed |
| `propagation_speed_meters_per_second` | meters per second    | finite number, fractions allowed |

The model owns accepted ranges. Each `adjustable_parameters` entry contains
`parameter`, `min` and `max`, with an allowlisted field name and a narrower range
containing its initial value. Entries are unique; unlisted parameters are fixed.
There are no arbitrary formulas, unit aliases, computed output fields or controls
that can change model identity. Display-unit conversion is explicit and must use
#92's conversion helpers; saved inputs retain SI units without rounding.

`calculatePacketActivity(activity, parameters, scope)` validates the activity,
exact source version, authorized concept membership, fixed values and activity
bounds, then calls `calculatePacketDelay`. Its return value is the calculator's
unchanged `{ model_version, parameters, result }`, where `result` has
`transmission_delay_seconds`, `propagation_delay_seconds` and
`transmission_plus_propagation_seconds`. The combined value describes one link
without queueing or processing; it is neither general latency nor RTT.

The server must obtain `scope` from the authenticated content resolver and load
the authorized activity snapshot itself. A browser preview can use the same pure
adapter, but its values are not trusted evidence. The server recomputes before
saving a result and owns event IDs, session/attempt identity, revision checks and
display permission. `verifyPacketActivityCalculation` validates recorded replay
against the activity and scope; `PacketDelayCalculationSchema` also rejects
numeric results that differ from #92's calculator. No equations are copied.

## Events and student display

Existing event envelopes remain unchanged. The additive `packet_state` event
has `version: "visual-v2"`, `model_version` and full canonical `parameters`.
The additive `packet_result` event has `version: "visual-v2"` and a
`calculation` checked by `PacketDelayCalculationSchema`. Numeric output is
separate from optional instructional prose and never authored by the model.

Both use existing activity/session/root-attempt/attempt identifiers. A result is
shown only after a preceding prediction for that activity; duplicate numeric or
legacy results for one activity are rejected. This fixture projection does not
authorize storage or prove the prediction came from the authenticated student.
The future runtime must bind events to the saved activity and original actor,
recheck expected revision, verify meaningful settings, and record assistance
only when the validated content is actually displayed. No answer is graded by
this adapter, and no database/API or tutor transition is added here.

## Legacy records and downstream adoption

`PacketExperimentSchema` and `PacketExperiment` retain their original
`visual-v1` shape, including integer `ms`/`packets`/`percent` controls and string
`experiment_result` events. They remain readable; these labels do not establish
SI inputs or a reproducible model result. `readPacketExperiment` returns their
text alternative with `mode: "text"`, never an inferred conversion.

For v2, that helper returns `mode: "interactive"` and the validated activity.
Unknown or malformed versions fail validation. `validateVisualActivity` accepts
both explicit packet versions; concept graphs and sequence diagrams stay v1.
#105 should branch on the helper's mode. #107 should generate only
`PacketDelayExperimentSchema` for numerical packet experiments, using approved
source/concept scope, and must not generate results or permissions.

Shared fixtures are `validPacketDelayExperiment` and `validPacketDelayEvents`;
the original examples remain compatibility fixtures. Deterministic tests cover
fractional values, fixed/bounded controls, exact-source membership, tampered
results, unknown model versions, legacy fallback and prediction-before-reveal.
These checks make no actual-model, browser, PostgreSQL or complete R1 claim.
