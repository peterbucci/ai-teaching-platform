# R7 dialogue contracts

[Issue #72](https://github.com/peterbucci/ai-teaching-platform/issues/72) defines the shared `r7-v1` shapes and pure validation rules. It does not add a generator, chat UI, database migration, or live dialogue feature. The existing tutoring controller still owns lesson progression.

## Shared files

- [contracts.ts](../lib/dialogue/contracts.ts): Zod schemas, inferred types, and limits.
- [rules.ts](../lib/dialogue/rules.ts): action, source, lifecycle, retry, and student-projection checks.
- [examples.ts](../lib/dialogue/examples.ts): `makeDialogueExamples(content)` supplies valid and deliberately invalid fixtures. Call it on the server; it includes private question guidance.
- [dialogue.test.ts](../tests/dialogue.test.ts): executable examples of the boundaries and recovery cases.
- [conversation.ts](../lib/dialogue/conversation.ts): additive `r7-conversation-v1` message, intent, resolution and student-view contracts for the single composer.
- [conversation.test.ts](../tests/conversation.test.ts): deterministic routing and recovery examples; these are not live-model results.

The fixtures are invented contract examples, not real model outputs or additions to the approved lesson. They cover distance confusion and packet-size confusion with different diagnostic prompts. The second uses `other_or_uncertain`; it does not invent a confirmed misconception category.

## Actions and lesson state

`StudentActionSchema` distinguishes `submit_answer`, `ask_tutor`, and `return_to_lesson`. These existing explicit-action contracts remain compatible. An ask retains a purpose: question, clarification, example, or alternative explanation. Ordinary free text uses `question`; optional quick actions provide a hint and fill an editable message without sending it. The new composer sends an unclassified `send_message`, as described below; the browser never guesses which existing action to execute.

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

- **#73 — Student UI:** send a message or explicit clarification with request ID and expected revision; preserve the draft; render server-authorized projections and safe fallbacks. Acknowledge actual display with `DisplayDialogueSchema`; do not supply timestamps or make lesson decisions.
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

## Student interface handoff (#73)

`app/study/dialogue.tsx` uses one conversational composer. Students type naturally; optional quick actions fill an editable message. Tab storage recovers the local draft and unresolved request identity. It is not a learning-evidence store. The existing answer submission handler remains in `session.tsx` for the explicit unavailable-feature fallback; normal integrated routing must happen on the server.

`lib/dialogue/student-view.ts` retains the help envelope and original `DialogueTransport`. The single composer consumes `ConversationTransport` from `conversation.ts`, whose `load`, `act`, and `acknowledge` return a `ConversationView`. That view wraps the existing help envelope and adds original messages, safe intent labels, and routing outcomes. #75 supplies authenticated endpoints; #74 supplies classification and validated help. Reuse `DisplayDialogueSchema` for actual display. The acknowledgement's `request_id` is the original dialogue request, with its `accepted_event_id` and `content_id`; repeated acknowledgements must reuse that identity. The server owns revision changes, cancellation, timestamps, assistance and authorization.

The envelope carries only accepted help, safe fallbacks, pending status, and previously displayed help. Its citations must match the pinned content version and passage list. A live citation's `intervention_id` is the persisted help intervention used by the existing reading API. Generated diagnostic questions must arrive through the controller's `TutorView`, never replace the question from an ask response. Client validation supplements, and does not replace, server grounding or authorization.

Until #74 and #75 connect that transport, the ordinary study page shows an honest unavailable message after Send and offers an explicit **Submit as my answer** fallback. It does not guess or silently grade the message. No synthetic help is inserted into live learning records. After integration, failed or uncertain requests are checked with a read-only refresh, not automatically regenerated. Once help is accepted, the UI requires its display confirmation before continuing, even after refresh; reliable cancellation of accepted but unseen help is deferred to #75. #75 must enforce the same boundary across tabs and recover a previous accepted result instead of making another paid request.

For local UI verification, run `npm run dev` and open `/study/dialogue-preview`. This development-only page returns 404 in a production build. Its scenario selector supplies invented intent outcomes and the #72 sample hint; it never classifies wording or calls an AI/database. Check direct help, answer, clarification, follow-ups, cancellation, failures and refresh. Asking must leave the answer count at zero; accepted help must be acknowledged once before a later answer. #75's durable dialogue/assistance retrieval and #76's live cross-role verification remain integration requirements.

## Single-composer integration

`ConversationActionSchema` accepts `send_message`, `resolve_intent`, or `cancel_message`. Every action names the owned session, active attempt, request ID and expected revision. Sending preserves exact text. A purpose hint is optional and cannot decide the route. Resolving or cancelling has a new action ID and references the original message ID; the server routes the saved text, not replacement text supplied with the choice.

`IntentClassificationSchema` describes model proposals: `ANSWER`, `QUESTION_OR_HELP`, `AMBIGUOUS`, or `OFF_TOPIC_OR_UNSUPPORTED`, with a short server-only rationale. #74 must use the current question, lesson and bounded accepted conversation. Do not infer intent from punctuation, keywords, quick-action hints or prepared answer phrases. `routeClassifiedMessage` validates the proposal against the current activity and trusted server review. An established answer yields the existing `SubmitAnswerSchema`; help yields the existing `AskTutorSchema`; unclear intent yields clarification; unsupported/private requests yield an application-owned fallback. These helpers perform no effects, model calls, authorization or storage. A model label alone does not authorize an irreversible submission.

An ambiguous message stays ungraded until the student chooses **Submit as my answer** or **I'm asking for help**. If server review disputes an `ANSWER` proposal, project it as effective `AMBIGUOUS` and retain the original provider proposal separately for authorized inspection. #74 must establish this before routing, so corrections do not require rewriting accepted answers. Never display raw classifier rationale or rejected generated output. Fallback text must come from application-owned messages, not unchecked provider prose.

`ConversationView` retains immutable messages and terminal outcomes. A help outcome references the existing dialogue turn with the same text and attempt; an answer references its idempotent submission key. Clarification cannot become a new pending request. The parser also applies existing source-version, citation, accepted-help and revision checks. The answer response retains the requested attempt anchor as its receipt; the caller then refreshes the existing `TutorView` to obtain any next activity. It must not grade merely because it sees an intent label. Pending or clarification messages may be cancelled; their original text remains visible, and a late classifier cannot revive them.

#75 must persist the original action and reserve the session before any paid call, then validate the current revision again when committing the route. Replays return the saved result. Unknown outcomes require read-only reconciliation, not a second model request. Store classifications, explicit resolutions, authorized routes and results without overwriting earlier messages. Preserve one active reservation across classification and help generation. Cancelled or stale completions cannot advance the lesson. An uncertain cancellation needs a durable tombstone before the UI can safely start another message. The existing help display acknowledgement remains the only evidence that generated assistance was received.

The composer accepts up to 12,000 characters, matching the existing assessment input. Existing help requests remain bounded to 2,000; an overlong help message is rejected without truncation or grading. Classification and any subsequent generation share the existing dialogue request budget, one concurrent provider request, 45-second timeout, zero automatic retries and explicit retry cooldown. Each paid call consumes budget. Use the existing bounded history and output ceiling; do not send the entire conversation or create another limit/configuration system. These contracts do not themselves implement the required server reservations or a live classifier.
