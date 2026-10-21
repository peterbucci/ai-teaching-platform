# R7 dialogue contracts

[Issue #72](https://github.com/peterbucci/ai-teaching-platform/issues/72) defines the shared `r7-v1` shapes and pure validation rules. It does not add a generator, chat UI, database migration, or live dialogue feature. The existing tutoring controller still owns lesson progression.

## Shared files

- [contracts.ts](../lib/dialogue/contracts.ts): Zod schemas, inferred types, and limits.
- [rules.ts](../lib/dialogue/rules.ts): action, source, lifecycle, retry, and student-projection checks.
- [examples.ts](../lib/dialogue/examples.ts): `makeDialogueExamples(content)` supplies valid and deliberately invalid fixtures. Call it on the server; it includes private question guidance.
- [dialogue.test.ts](../tests/dialogue.test.ts): executable examples of the boundaries and recovery cases.

The fixtures are invented contract examples, not real model outputs or additions to the approved lesson. They cover distance confusion and packet-size confusion with different diagnostic prompts. The second uses `other_or_uncertain`; it does not invent a confirmed misconception category.

## Actions and lesson state

`StudentActionSchema` distinguishes `submit_answer`, `ask_tutor`, and `return_to_lesson`. An ask has an explicit purpose: question, clarification, example, or alternative explanation. Never infer an answer submission from its wording. Unclear intent gets the `intent_unclear` fallback and an explicit choice.

`submit_answer` wraps the existing `SubmitAnswerSchema`. The existing `IntentSchema` still describes assessment question types; it is unchanged. An ask or return produces no answer submission, evaluation, or lesson transition.

`DialogueStateSchema` carries the controller's existing progress together with an owned lesson/attempt anchor, revision, usage, and active request. `LessonDraftSchema` keeps draft text tied to that exact activity. Drafts are recovery data, never answers or model context; `restoreLessonDraft` refuses a different activity.

The revision is an invalidation token. Return/cancel, answer submission, or a question handoff invalidates older work by advancing it. Ordinary generated/help-delivery events do not advance it. Exact request replays reuse the saved result; reusing an ID with different input fails. A stale new action cannot advance the lesson.

An outstanding help request does not block explicit answer submission or return. Their plans include `cancel_request_id`; the caller must invalidate that request while preserving the original activity and draft. The provider reservation can remain occupied until the call settles, preventing another paid ask without blocking the core lesson.

## Generation, acceptance, and display

`DialogueRequestSchema` records server-owned identity, source context, and either a student ask or a controller-authorized request linked to an evaluation. `GeneratedDialogueSchema` contains help or a proposed question. Questions reuse `QuestionSnapshotSchema`, including private rubric, embedded scaffolding, and generation provenance; their immutable `question_id` equals `content_id`.

`validateGeneratedDialogue` checks the exact content version, authorized concepts/passages, known misconception references, and permitted request type. A student ask cannot authorize an assessed question. The authorized scope comes from the server's assignment and lesson, never browser claims. Multiple-lesson resolution remains [#53](https://github.com/peterbucci/ai-teaching-platform/issues/53); these contracts use the existing `ContentRefSchema`.

`DialogueReview` is a trusted server finding about grounding, disclosure, and controller permission. Never copy these flags from model output or allow the model to authorize itself. Schemas and valid citations cannot establish factual support or detect an answer hidden in ordinary prose. #74 must check those concerns and refuse unsupported, uncertain, off-topic, or private-guidance responses.

Each request has an append-only delivery history: `requested` → `generated` → `accepted` → `displayed`, with rejected, failed, or cancelled terminal outcomes. Only accepted content can be projected to students. Late terminal bookkeeping can retain the original request after the lesson changes; it must not change lesson state or clear a newer request's reservation.

Help acceptance keeps the current revision and has no `applied_attempt_id`. Generated-question acceptance requires the controller's `evaluate` phase, a new `applied_attempt_id`, and `applied_revision = expected_revision + 1`. The server must atomically persist the immutable question snapshot as an existing-style attempt and record that handoff. The current controller still selects curated activities; #74 must implement its bounded generated-question integration.

For help, `dialogueIntervention` reuses `InterventionSchema`. Acceptance creates an undisplayed record; only a validated visible acknowledgement sets `displayed` and a server timestamp. Existing assistance rules then count the appropriate help. #74 must also check `assistance_type`: a substantive explanation cannot be labeled `neutral_clarification` to preserve independent-answer credit. Diagnostic display references its assessed attempt instead of creating a fabricated help intervention. Embedded scaffolding stays in the question snapshot and follows existing assistance rules.

`toStudentDialogueContent` explicitly selects public fields and excludes rubrics, expected answers, hypotheses, and provider details. Raw request/event histories and the full example factory are for authorized server/teacher use. Never send them wholesale to the student UI. Rejected or failed generated text is not projected.

## Consumer responsibilities

- **#73 — Student UI:** send an explicit action with request ID and expected revision; preserve the draft; render server-authorized projections and safe fallbacks. Acknowledge actual display with `DisplayDialogueSchema`; do not supply timestamps or make lesson decisions.
- **#74 — Generation:** use approved scoped material and minimal accepted history; validate proposals and semantic disclosure; ask the existing controller for permission. Keep generation separate from evaluation and apply no state changes based on model instructions.
- **#75 — Persistence:** authenticate and authorize every operation; load trusted state; lock/reserve the session; enforce replay, limits, and revisions atomically. Persist drafts against the owned attempt. Resolve display acknowledgements to saved accepted events and verify ownership/content/revision before recording server time.

There is currently no persisted dialogue revision, usage reservation, or draft store. #75 must add the necessary persistence; these pure helpers do not provide transactions or authorization by themselves. Preserve existing curated records and immutable student responses.

## Limits and retries

`DIALOGUE_LIMITS` is the source of truth. Bounds keep the conversation focused and costs finite; timeout, output tokens, no automatic retries, and cooldown follow the existing evaluator's conventions.

| Limit                                                  | Value                                |
| ------------------------------------------------------ | ------------------------------------ |
| Student ask                                            | 2,000 characters                     |
| Saved draft                                            | 16,000 characters                    |
| Help response / individual history message             | 6,000 characters                     |
| Complete generated payload, including private guidance | 16,000 JSON characters               |
| Supplied history                                       | 12 messages; 12,000 total characters |
| Dialogue turns per session                             | 12                                   |
| Provider requests per session, including retries       | 36                                   |
| Concurrent provider requests per session               | 1                                    |
| Provider timeout                                       | 45 seconds                           |
| Model output                                           | 4,096 tokens                         |
| Automatic retries                                      | 0                                    |
| Explicit retries per turn                              | 2; at least 60 seconds apart         |

Count both student- and controller-initiated turns. Reserve every provider request before sending it, including calls that fail; retries consume request budget but stay within their original turn. Bounded history is separate from the full saved evidence and excludes private rubrics and raw rejected outputs.

A retry is a new request linked by `retry.of_request_id` and its ordinal. The student action's `retry_of` names that same failed request. Use `validateDialogueRetry` against the previous terminal history before reserving it, then `assertProviderAttemptAllowed` against the reserved current state. A retry of turn 12 is still permitted within its original turn budget. Only failed generation or rejected `invalid_output` can be retried. Keep prior histories intact and reuse already accepted results.

An unknown provider outcome must be reconciled before another paid request. Keep its reservation until it settles, even after UI cancellation; late callbacks cannot clear a newer reservation or overwrite newer state. These contracts do not promise exactly-once external billing. Disabled, exhausted, unsupported, or failed dialogue must leave the curated lesson usable.

## Verification

`npm test` runs the deterministic contract examples alongside existing tests. They check explicit actions, preserved drafts, scoped references, private projections, displayed assistance, generated-question handoffs, stale/duplicate events, bounded retries, and fallback. No OpenAI calls or new database behavior are tested here. #76 owns the integrated real-model demonstration after #73–#75 are connected.
