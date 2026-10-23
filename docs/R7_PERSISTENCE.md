# R7 persistence integration

This is the storage and authenticated transport slice for [#75](https://github.com/peterbucci/ai-teaching-platform/issues/75). It preserves existing PostgreSQL tutoring evidence and answer submission. It does not establish that live classification, generation, or an agentic teaching cycle works.

## Contract sources and ownership

- `lib/dialogue/conversation.ts` and `student-view.ts` are the exact contracts copied from draft PR #81 commit `220cead3acbb8ee4c0694d4dc8eeafc84c37ae56`. Their foundation commit is `83388ed815ac6c2b6a8d824f2b8b631f9445d40a`. The PR #81 composer and fixture UI are not included.
- `lib/tutoring/orchestration/contracts.ts` copies the shared `tutor-orchestration-v1` contract from the active #85 worktree. Its presence does not mean the #85 dispatcher is integrated. Reconcile this shared file with #85 before merging either branch; do not create another action store.
- #74 supplies real provider interpretation/generation and trusted review. #85 supplies permitted action selection and dispatch. This slice supplies their shared durable reservations and storage ports.
- The current approved-content loader remains the curated lesson implementation. Reviewed dynamic resolution through #53 is pending. Uploaded lessons must not use the curated loader as an assumed substitute for their exact authorized lesson version.

## Authenticated HTTP endpoints

All responses are non-cacheable. Mutations require authenticated, same-origin JSON requests. Session ownership and current enrollment are checked by the server; teacher reads require ownership of the session's class.

| Method and path                                                   | Operation                                                                                                  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /api/tutoring/:sessionId/conversation`                       | `loadConversation`: reconstruct the student-safe conversation without applying work or calling a provider. |
| `POST /api/tutoring/:sessionId/conversation`                      | `actConversation`: accept a `ConversationAction` and return the current conversation.                      |
| `POST /api/tutoring/:sessionId/conversation/display`              | `acknowledgeConversation`: accept the existing `DisplayDialogue` identity after accepted help is rendered. |
| `GET /api/tutoring/:sessionId/conversation/operations/:requestId` | `readConversationOperation`: read status and provider-stage timestamps for recovery.                       |
| `GET /api/teacher/sessions/:sessionId/conversation`               | `readTeacherConversation`: retrieve authorized operation and audit evidence.                               |

The operation-status response contains `request_id`, `status`, `provider_calls` (`step_id`, `status`, `started_at`, `finished_at`), and `retry_allowed: false`. It contains no raw provider result or private prompt. The teacher session detail page also shows original messages, proposed intent, authorized routing, actual tool history, generated content, citations, and display acknowledgements.

`ConversationTransport` maps `load`, `act`, and `acknowledge` to the first three endpoints. The browser adapter and PR #81 composer still require integration.

### Default behavior before provider integration

`actConversation` saves an original message and asks for explicit intent confirmation because the live intent service is not connected. Choosing **answer** submits that exact original text through the existing answer path. Choosing **help** returns a truthful unavailable fallback. This is a confirmation fallback, not an AI classifier or a live generated response.

The original text is never trimmed or replaced by clarification. The composer limit remains 12,000 characters; a message routed to the 2,000-character help contract receives an honest limit outcome if too long.

## Server integration services

Construct `EvidenceAccess` only from the authenticated actor. These service functions are server-only; no HTTP endpoint accepts a model proposal, trusted review, operation history, or provider output from the browser.

| Module                                | Public integration functions                                                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/dialogue/store.ts`               | `reserveConversationOperation`, `commitConversationIntent`, `commitConversationHelp`, `failConversationOperation`; the HTTP/read operations listed above. |
| `lib/dialogue/provider-store.ts`      | `createReservedCall`, `readProviderCall`.                                                                                                                 |
| `lib/dialogue/orchestration-store.ts` | `createOrchestrationPersistence`, supplying #85's `claim`, `checkpoint`, `complete`, and `fail` storage ports.                                            |
| `lib/dialogue/persistence.ts`         | `withDialogueOperation`, `appendOperationEvent` for reviewed transaction integration.                                                                     |

`projectConversation`, `commitConversationHelpInTransaction`, and `failConversationInTransaction` support the shared transaction path. A caller must already hold the authorized session lock and current context before using transaction helpers. Do not call a public function that starts another session-locking transaction from inside that transaction.

A provider integration should:

1. Reserve the immutable `ConversationAction` before external work. Repeated identical IDs reuse saved work; altered payloads under the same ID conflict.
2. Use `createReservedCall(access, sessionId, requestId)` for **every** paid stage, including classification, proposal, generation, and review. Pass the descriptor and a callback accepting its abort signal; disable SDK retries.
3. Validate provider output and trusted review, then call `commitConversationIntent`. This routes an established answer through the existing submission transaction, retains ambiguity for explicit resolution, or prepares a grounded help request.
4. For an authorized help request, use the #85 persistence ports with the reviewed dispatcher or `commitConversationHelp` with trusted server review. Generated content alone is not displayed assistance.
5. On an uncertain response or commit outcome, read the saved conversation, operation status, or private provider record first. Do not create a new request or paid stage to discover whether the earlier call completed.

The orchestration adapter supports conversational `clarify` and `explain` delivery only when the trusted integration passes them in `approvedHelpTools`; the default allowlist is empty. This parameter must come from approved server policy, never browser or model output. It records proposal, validation, dispatch, execution/failure, and receipt separately. Generated assessed-question handoff, reading delivery, and controller advancement require their reviewed adapters. A generated question can be retained as private proposed/rejected content; it cannot become an assessed attempt through this help-only adapter.

## Display, answers, and reconnects

- Render only accepted student-safe content. After rendering, acknowledge its exact request, accepted event, content ID, and revision. The server timestamps the display and updates the existing intervention in the same transaction.
- If acknowledgement has an uncertain result, reconcile with GET before sending another mutation. A repeated matching acknowledgement is idempotent. The legacy intervention endpoint cannot acknowledge conversation-owned help.
- Accepted but undisplayed help is not assistance. Submitted answers retain their submission-time assistance; later help cannot rewrite earlier answers or accepted evaluations.
- Help and unresolved intent never become assessed attempts. A saved answer receipt means the client should reload the tutor view, not submit again.
- Refresh/reconnect reads do not call a provider, acknowledge content, or advance the lesson. Session/attempt/source/revision identities are rechecked when external results are committed.
- Cancellation is durable. A late known provider outcome may be recorded for reconciliation, but cannot revive cancelled work or change a later activity.

PR #81 still needs an explicit curated-answer return path when a connected service is disabled or exhausted, after pending/display outcomes are reconciled. Local browser drafts remain UI recovery data, not authoritative conversation evidence.

## Provider budgets and uncertain outcomes

`DIALOGUE_LIMITS` remains the shared limit source: 12 conversation turns, 36 provider requests per session, one concurrent provider operation, and a 45-second timeout. Legacy model-evaluation reservations also count toward the shared usage/concurrency checks.

This slice exposes **no retry API**. A provider `step_id` must equal its stage (`classify`, `propose`, `generate`, or `review`), with one saved call per stage per operation. Identical metadata reuses a known result; altered metadata conflicts. A settled failure prevents further paid stages for that operation. Do not change IDs or stage names to retry a call.

A reservation or `unknown` outcome blocks another paid operation. A process interruption does not prove that a provider did no work or charged nothing. A late original callback can save a known result; read-only recovery never dispatches a replacement. This does not guarantee exactly-once external billing.

Legacy `evaluation_failed` records lack enough uncertainty metadata to prove that an earlier pending model request settled safely. The shared check conservatively leaves those reservations unresolved unless a later accepted/rejected result reconciles them. Do not free them based solely on elapsed time or a browser refresh.

Provider results and metadata remain private server records. The student projection omits raw outputs, classifier rationale, private rubrics, expected answers, and hidden hypotheses. The teacher presentation shows selected authorized evidence rather than dumping raw provider responses.

## Migration 008

`database/migrations/008_dialogue_persistence.sql` adds `dialogue_sessions`, `dialogue_operations`, append-only `dialogue_events`, and `dialogue_provider_calls` in the existing database. It adds linked identities, immutable original-payload guards, one-unresolved-provider-per-session enforcement, and revision invalidation for existing attempt/session transitions.

There is no backfill, lesson-source table, or second evidence database. Existing responses/evaluations remain in their established tables; displayed conversational help uses existing interventions. Migration numbers 006/007 remain reserved for the coordinated lesson registry/importer work. Apply migration 008 with the repository migration runner before enabling the new routes or teacher evidence read.

## Verification and remaining acceptance

`npm run dialogue:check` runs real PostgreSQL integration checks with labeled synthetic users, lessons, provider callbacks, and output. It requires explicit `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, and `DIALOGUE_CHECK_SYNTHETIC=1`, plus migrated disposable PostgreSQL using a non-superuser application owner. It does not load `.env`, call a model, or prove browser authentication flows. Each run preserves isolated fixture evidence for inspection.

Set `DIALOGUE_CHECK_URL` to an isolated application using that database to also verify HTTP routes with real synthetic Better Auth cookies and the authorized teacher page. `--http-only` runs that part separately. These HTTP checks do not replace interactive browser/composer acceptance.

The checker covers authorization/isolation, exact-message preservation, duplicate and altered keys, concurrent/unknown provider operations, late cancelled/stale results, display acknowledgement, assistance metadata, refresh, and preservation of earlier answers/evaluations. The PR validation report records which checks were actually executed and their results; this guide itself is not a passing test report.

Before closing the integrated story, connect #73/#74/#85, reconcile #53's exact content resolver, complete generated-question/controller delivery, verify authenticated browser refresh/recovery and teacher inspection, and record actual-model acceptance separately in #76. Storage fixtures are not proof of live AI generation or educational effectiveness.
