# R7 provider integration (#74)

This server-only service implements model intent proposals and reviewed, grounded dialogue against already authorized `ApprovedContent`. It does not authenticate callers, submit answers, choose instructional actions, save messages, or mark help displayed.

## Entry points

- `lib/dialogue/service.ts`: `classifyIntent(context, services)` and `generateDialogue({context, request, permitted_by_controller, instructional_strategy?, selected_source?}, services)`.
- `lib/dialogue/model-provider.ts`: `requestStructuredProposal<T>({instructions,input,schema,schemaName}, {signal?})` supplies the one-call provider operation that #85 can use for its proposal schema. Always invoke under #75's reservation.
- `lib/dialogue/generation.ts`: scoped prompt projections, draft schemas and independent review checks. The active rubric is excluded from classification/generation; it is sent only to the private disclosure reviewer.

The context contains the exact original text, active question, lesson anchor/revision, accepted bounded history, prior question snapshots, and server-resolved source scope. Never accept it or `permitted_by_controller` from a client/model. #53's assignment resolver supplies content; the production service never calls the curated global loader. Optional `instructional_strategy` carries #85's validated action/arguments so selected clarification focus, explanation style, diagnostic targets and retest mode reach both generation and review.

`clarify` elicits the student's meaning/reasoning or restates question wording without teaching; it must produce `neutral_clarification`. `explain` teaches content and must use a non-neutral assistance type. Both mismatches fail before the review call, matching #85's dispatch boundary. The service never changes the selected action or relabels the draft. The reviewer still rejects teaching disguised as neutral. Existing R7 types use `hint` for limited cues or explanations, `corrective_feedback` for corrective teaching, and `worked_example` for examples; there is no separate explanation assistance type. Generation v4/review v2 make these distinctions explicit after an integrated check exposed a mismatch; this prompt revision has deterministic coverage but has not been live-tested.

The caller's permission includes #53's `activity_policy.allow_runtime_generation` gate; the legacy curated policy defaults to false. The standalone live checker explicitly uses synthetic controller permission, not a changed production lesson policy. Imported resolver integration is still unverified in this branch.

`selected_source?: {concept_ids, source_passage_ids}` carries #85's narrower response targets while context retains the whole active question for interpretation/disclosure checks. Selection must be inside authorized scope; output concepts must exactly match the selected set and citations must remain inside selected passages. Generation prompt v3 adds this optional restriction; its propagation/rejection checks are deterministic-tested, while the recorded live runs used v1/v2.

`classifyIntent` returns PR #81's unchanged category/rationale proposal. Its `review.answer_intent` stays `uncertain`; only explicit resolution or separately established trusted intent can authorize submission. #75 preserves the original proposal privately and projects an unresolved answer as `AMBIGUOUS`, consistent with PR #81's clarification view. The original message remains unchanged. A help classification over 2,000 characters flags `help_limit_exceeded`; generation refuses it without truncating or grading it.

## Reservation and failure contract

`RunReservedCall<T>(step, callback(signal))` is injected by #75 and bound to authenticated actor/session/operation. `step` contains `step_id`, `stage`, configured `model`, `prompt_version`, and `input_hash`. Classification uses `classify`; generation uses `generate` then `review`. Each is a separate provider request against the same 36-call/session budget and one-call concurrency limit. #85 uses its separate `propose` step.

The owner must reserve before invoking the callback, persist its private JSON outcome, replay the same step/payload, reject altered input, and retain unknown outcomes for read-only reconciliation. The service has no local production reservation or counter. Reservation exceptions propagate to the transport. Provider timeout, connection failure, interrupted cancellation and uncertain server errors set `needs_reconciliation`; they must not release an operation for a blind paid retry. Provider timeout is 45 seconds, maximum output 4,096 tokens, and automatic retries zero. Unavailable configuration performs no reserved call.

One content item uses its request UUID as immutable content/question identity. Actual response model and provider completion time form generation provenance. Replaying the saved draft preserves the subsequent review input. #75 must commit only after checking the original revision, source, current attempt and cancellation state again. All `calls`, rationale, review, rubric and audit records are private. Use the existing accepted-event student projection, never serialize a raw service result to the browser.

## Validation and limits

Before spending, validate question/source identities, scope, bounded text/history/prior questions and controller permission. After drafting, validate schemas, exact source version, concepts/passages, immutable question shape, selected targets, repeated prompts, executable/external markup and literal private-guidance leakage. Only conceptual activities are supported here; quantitative calculations belong in reviewed calculation tools.

A separate model call checks substantive citation support, relevance to the exact student reasoning, answerability/rubric consistency, semantic novelty, disclosure and honest assistance marking. Code requires complete field coverage and exact source quotes from every cited passage, with no uncertain/negative review findings. The generator cannot certify its own output. **Semantic review is probabilistic:** matching quotes do not mathematically prove entailment or educational correctness. Review failures return a typed fallback; no repair/retry cascade occurs.

Generated questions reuse `QuestionSnapshotSchema` and `validateGeneratedDialogue`. The only existing contract change is additive `immediate_retest` support; all controller, review, scope and source checks still apply. A permitted diagnostic/retest at this service boundary does not establish that the current curated controller can hand it off, evaluate it and persist it.

## Verification and remaining integration

Deterministic tests cover provider transport failures/limits, exact input and safe intent proposals, invalid scope/version/citations, unsafe/repeated output, independent semantic review and separately reserved stages. The opt-in live checker records fictional cases and exact model/input/output/source evidence; its in-memory cap is exclusively a standalone test harness, not production durability.

Run the checker with the existing Node flags and configured `OPENAI_MODEL`/`OPENAI_API_KEY`:

```sh
node --experimental-strip-types --conditions=react-server --env-file-if-exists=.env scripts/check-dialogue-provider.ts --run-live
```

`--diagnostics-only` selects two additional synthetic diagnostic cases (four calls). `--output=...` must name a new file in an existing directory. No flag performs no paid calls. The [verification record](../evals/R7_PROVIDER_VERIFICATION.md) preserves both runs and the original rejection.

Integration remains owned by #73/#75/#85: authenticated conversation transport, explicit intent resolution, durable reservations/outcomes, commit-time checks, display acknowledgement, generated-question controller/evaluator handoff and teacher reconstruction. #53/#52 gate uploaded lesson use. #76 retains real browser/database and observe–act–observe acceptance. Provider checks alone do not close these issues or establish the complete agentic tutoring workflow.

The two conversation contract files were imported unchanged from PR #81 at `220cead` through #75's shared foundation commit `83388ed`; no composer UI was copied or redesigned. #74, #75 and #85 agreed the boundaries in their local implementation chats. The GitHub project board could not be read through the available connector; no project status was changed.
