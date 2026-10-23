# Bounded tutor orchestration (#85)

This module coordinates **one proposal and at most one instructional tool per saved observation**. It does not classify or submit answers, run an autonomous loop, create persistence tables, or replace the existing tutor controller.

## Entry point and ownership

`runTutorOrchestration(request, ports)` in `lib/tutoring/orchestration/run.ts` consumes the existing `DialogueRequest`. A student trigger must already be an authorized help request; a controller trigger must reference the current accepted, unapplied evaluation. Do not pass an unclassified composer message into this entry point.

- **#85:** strict tool proposals, context/allowlist policy, one-tool dispatch, private action records, safe projection, and the proposal-provider adapter.
- **#74:** real structured proposal requests, grounded content generation and independent content review. Proposal, generation and review each consume a separately reserved provider call.
- **#75:** authenticated operation reservation, actor/enrollment checks, immutable request matching, concurrency, shared usage, all persistence/commit/display effects, and teacher reconstruction.
- **#53:** exact assignment-pinned `ApprovedContent` and its activity policy. The orchestrator never loads a default lesson from disk.

The interfaces were coordinated with the active #74/#75/#53 workers. Existing dialogue, evaluator, controller and evidence files remain unchanged in this PR.

## Allowed tools

| Proposal              | Execution and gate                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `retrieve_passages`   | Reads selected approved passages from the resolved content map; no network or arbitrary search. Reading assistance requires later actual display acknowledgement. |
| `clarify`             | Generates reviewed neutral clarification, preserving the active question.                                                                                         |
| `explain`             | Generates reviewed grounded help; original submission and assistance snapshots remain unchanged.                                                                  |
| `generate_diagnostic` | Requires the existing controller's `ASK_DIAGNOSTIC_FOLLOWUP`, matching request intent, accepted evidence and an installed assessed-question handoff.              |
| `generate_followup`   | Requires `ASK_SELF_EXPLANATION`, matching neutral-clarification intent and installed handoff.                                                                     |
| `generate_retest`     | Requires `RETEST_CONCEPT`, matching immediate-retest intent, shared contract support and installed handoff.                                                       |
| `return_to_lesson`    | Returns the current original attempt without submitting, grading or advancing it.                                                                                 |
| `advance_lesson`      | Computes the existing controller decision; #75 applies it through the existing transaction before confirming execution.                                           |

Availability is the intersection of these state rules, the server-owned lesson policy, installed capabilities and remaining shared provider usage. The model cannot enable a tool. Visuals, messaging, teacher edits, publication and assignments are absent.

The proposal prompt includes the current approved objectives/passages, exact saved student reasoning, accepted evaluation summaries, displayed assistance and bounded accepted conversation history. Rubrics, expected answers, raw provider responses and unsent drafts are excluded. Complete recent records are selected within bounds, with omission counts; original student text is never rewritten.

## Persistence adapter obligations

`OrchestrationPorts` is deliberately a seam into #75, not an implemented store:

1. `claim` authorizes and atomically claims `action_id = request_id` under the **existing** operation reservation. The turn counter includes the claimed turn. Identical requests return the saved receipt; changed payloads, concurrent claims and unknown outcomes must never start a second dispatch.
2. `checkpoint` rechecks original actor/session/assignment/source/attempt/revision and cancellation under the session lock, appends the typed private record idempotently and returns fresh shared counters. No provider call runs while that transaction is open.
3. `propose` uses `createProposalService` with #74's `requestStructuredProposal` and #75's operation-bound `runReservedCall`. The adapter uses stable step `propose`, a payload/schema hash, an object-root schema and a combined abort signal. It never retries or keeps a second usage counter.
4. `generate` calls #74 with the selected strategy, approved scope and exact request. Its generation and independent review must each reserve a provider call. The trusted review must not be copied from the generator's own claims. This callback computes content only, with no lesson writes or delivery acknowledgement.
5. `complete` atomically rechecks current authorization, anchor, cancellation, policy and installed capability; applies any approved controller effect; stores the exact result and an `executed` record; and releases the operation. For help/retrieval it stores accepted content for #75's display flow. It must **not** demand another generation budget after those calls already completed. A generated question is not executed until an actual controller-authorized immutable attempt handoff commits.
6. `fail` appends failure information without replacing earlier proposal/validation/tool records. Unknown provider or commit outcomes remain blocked for read-only reconciliation. Failure to save failure information returns a reconciliation-required storage fallback; it never triggers another call.

`OrchestrationRecordSchema` validates proposed, validated, dispatch-started, executed and failed records. #75's envelope supplies authenticated session/request identity and server timestamps. Raw malformed proposals and model provenance remain in the private reserved provider result; the orchestration record references them by the same request/action identity instead of accepting arbitrary JSON into its typed trace.

`OrchestrationReceipt` is **server-private** because generated snapshots contain private criteria. Only `toStudentOrchestrationReceipt()` may be used as an instructional display payload. Production transport must still connect it to #81's conversation receipt/display contracts; returning a payload does not mark assistance as displayed.

## Limits and recovery

All paid calls share `DIALOGUE_LIMITS` (36 provider calls, 12 turns, one concurrent request, zero automatic retries, 45-second call timeout). The allowlist reserves room for one proposal and, for generated instruction, two subsequent calls. Provider timeouts abort and stop the current execution; late results cannot resume it. #75 must reconcile the external outcome before any new paid retry. Explicit retries remain #75's existing linked-request/cooldown policy.

One tool result ends the function. A later saved student response/evaluation produces a new request and freshly loaded context. There is no self-invoking follow-up or keyword-selected demonstration path.

## Integration gates and verification scope

This focused PR runs against merged `r7-v1` contracts. It is **not a live connected tutoring endpoint**. Its deterministic tests simulate persistence/provider services; they do not prove database durability, real model quality, or browser delivery.

Before enabling production:

- Connect #75's reservation/checkpoint/commit/failure adapter and #74's reviewed generation. Keep generated assessment tools out of `installed_tools` until the controller handoff exists.
- Resolve the generated-question continuation gate: `decideTutoring` currently looks up authored question IDs, while generated snapshots use immutable UUIDs. A generated Attempt alone will not make subsequent controller decisions work. Agree an approved activity-slot mapping without a second state machine.
- Integrate #74's additive `immediate_retest` contract. On merged baseline the schema rejects this request, so retest generation is unavailable.
- Resolve actual assignment content and policy through #53; retain curated behavior as a regression path. Uploaded sources require that branch's content-reference extension.
- Connect safe results and actual display acknowledgements to #73/#81, including reading assistance. Reconstruct the full trace in authorized teacher evidence.
- Run the #76 live gate using two held-out misunderstandings and one complete reasoning → actual model proposal → permitted execution → next student observation → changed decision cycle. Record model/configuration, source/version, database IDs, failures and educational review separately from simulated tests.

No issue/epic should close from these deterministic checks alone. No live model or browser/database proof is implied by the interface.
