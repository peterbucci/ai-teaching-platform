# Intervention responses and evidence comparison — #46

This extends #44 private drafts and #45 approved delivery. One intended recipient
can explicitly start and submit one fresh-check answer to the exact approved
question. Reading an activity is not starting or completing it. The teacher sees
the original work beside the later response; missing follow-up is not failure,
and assisted performance is not independent learning or long-term retention.

## Interfaces

`lib/interventions/outcomes-contracts.ts` defines the public actions and student
and teacher projections. `lib/interventions/outcomes.ts` implements authorized
services using the existing evidence database and evaluator.

| Endpoint                                               | Behavior                                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `GET /api/student/interventions/:approvalId/followup`  | Reads saved start, exact answer, assistance and evaluation status. Never starts or evaluates. |
| `POST /api/student/interventions/:approvalId/followup` | Explicit `start`, `submit` or controlled `retry`; body limited to 64,000 bytes.               |
| `GET /api/teacher/interventions/:draftId/followup`     | Owning teacher's comparison, or null before delivery.                                         |

`start` has only its action. `submit` carries a UUID `request_id` and the original
`response_text` (nonblank, at most 12,000 UTF-16 code units). `retry` carries a new
request UUID and the currently inspected `expected_evaluation_id`, nullable only
when configuration prevented an evaluation record. Actor, recipient, question,
source, session, attempt, timestamps and assistance are all server-owned.

An explicit start creates one existing `sessions` record and one existing
`attempts` record, linked uniquely to `(approval_id, student_id)`. Its immutable
question is exactly `approval.activity.fresh_check`, including private criteria.
The approval already preserves draft ID/revision, assignment, source version,
generation provenance and motivating original evidence. No answer, score or
analytics store is duplicated. Ordinary tutor resume, restart, reading and answer
endpoints exclude these sessions, so a review cannot enter the curated controller.

## Assistance and submission

The existing display acknowledgement records explanation/source excerpts actually
visible in the active browser tab. It never marks the exercise started. While
holding the recipient lock, the adapter mirrors that timestamp and approved text
into existing session `interventions` evidence. It preserves an earlier display
when a student starts later. Submit and display share recipient-then-session lock
ordering; `deriveAssistance` and `submit_answer` capture the first submitted answer
and actual prior help atomically. Later display cannot rewrite that snapshot.

#45 retains the first display timestamp, not a history of every later viewing.
The derived elapsed value therefore must not be interpreted as time since the
student last saw help. The comparison makes no such retention claim.

The single check uses `immediate_retest` intent, not an independently verified
delayed retrieval. Even without recorded display, this assigned review is not
promoted to independent retention evidence. The UI waits for its actual visible
help acknowledgement before submitting and retains text when acknowledgement
fails. Account-scoped session storage preserves unsent text and an unconfirmed
request through refresh; saved answers live in PostgreSQL.

## Evaluation and recovery

`evaluateSubmittedAttempt` receives the real linked session/attempt IDs. Its
existing source/question validation, prompt, provider, result validation and
`recordEvaluation` path remain authoritative. No second scoring engine or tutor
transition is introduced. Accepted results produce allowlisted correctness and
bounded feedback; private rubrics, criteria, hypotheses and approval evidence
never enter the student DTO.

Submission and an evaluation-dispatch reservation commit together. Only the
request that created that reservation dispatches. Same-identity replays read the
saved result; different payloads conflict. Another identity cannot replace an
already-submitted answer. A process interruption leaves a durable pending
reservation; a read, refresh, restart or replay never repeats paid work.

Known failure permits an explicit retry after 60 seconds, at most three dispatches
per answer, reusing the same immutable response. Accepted evaluations never retry.
The shared evaluator records one `pending_review` start reservation, followed by
a final outcome linked through `provider_reservation_id`. Unknown completion is
`evaluation_failed` with `provider_outcome: "unknown"`; its original reservation
remains unresolved and budget-spent. Both the follow-up journal and evaluator
reject retry until reconciliation. No second pending marker is created. Configuration failure is a failed dispatch with no invented
model evaluation. An accepted uncertain judgment is counted as accepted **and**
uncertain, distinct from an unknown provider outcome. No automatic retry occurs.

Provider provenance is recorded in dispatch metadata: `injected_fixture` for an
explicit trusted test provider and `configured_model` for the configured provider.
The public `evaluation_provenance` label derives from that durable metadata, never
from a model-name heuristic. Older unlabelled records show unknown provenance.

## Teacher comparison

The authorized comparison reads immutable approval evidence, the approved
recipient roster and linked existing sessions/attempts/evaluations in one
repeatable-read transaction. Counts use distinct student IDs: intended, started,
submitted, missing, accepted, pending, failed and uncertain. The original
`calculateClassMetrics` definitions apply to the later sessions and recipient
denominator; no AI-generated count is authoritative. The comparison includes raw
original and later work, contradictory evidence, all evaluation history,
assistance, exact content references and links to teacher session evidence.

## Migrations and dependency reconciliation

016 adds only the link and dispatch journal. 017 strengthens terminal dispatch
timestamp and accepted-evaluation integrity after independent review, without
rewriting already-applied 016. Their allocation follows inspected R4 010–013,
R2 014-015 and R7 008-009. Integration preserves the original bytes of all applied
migrations, including 016 and 017.

The combined stack uses the canonical assignment resolver for both curated and
uploaded lessons. Follow-up reads and actions validate the exact immutable
approved question, source/version, current enrollment and recipient. Private
uploaded source links render as labels rather than fabricated public URLs. The
ordinary answer, controller and R7 conversation paths reject follow-up sessions
before changing evidence, reserving a provider call or applying a tutor result.

The integration keeps the original #99/#103/#106 histories through normal merges;
it does not edit the original worker checkouts or dependency branches. This
compatibility work does not establish new live-model quality or complete the R2
epic's browser acceptance.

## Verification

`npm run interventions:outcomes` requires a running authenticated local app and an
isolated fictional database containing the saved #44 draft. It uses injected
evaluator providers and never pays to regenerate or evaluate. It exercises A's
assisted answer, B missing, C denied, unrelated teacher/profile denial, original
evidence preservation, replay/conflict, cooldown/recovery, provider uncertainty,
private projection, exact versions and ordinary-tutor isolation.

`--verify-integrity` checks additive dispatch constraints with rolled-back writes.
`--verify-persistence` verifies the saved report's fingerprints after an app
restart. Actual-model and browser evidence is recorded separately in
`evals/INTERVENTION_OUTCOMES_VERIFICATION.md`. Keep #46 and R2 open until their
integration and independent human review gates are accepted.

The self-contained integration command is:

```sh
npm run interventions:approval:lessons -- --setup-fixtures --with-followups
```

It creates fictional uploaded and curated fixtures, approves and delivers them
through authenticated HTTP, then checks explicit start, exact answer persistence,
concurrent replay, private student projections and the teacher comparison. It
also checks ordinary answer/controller/R7 exclusion and the one-reservation
unknown-outcome ledger, including blocked retries after elapsed time. The fresh
CI approval job runs this command with no provider credentials. Providers are
injected through an internal test seam; these results are not live AI acceptance.

On the combined integration tree, 356 deterministic tests, lint, typecheck,
formatting and a production build passed. The isolated PostgreSQL/HTTP suite passed
for both lesson types with 21 injected generation/evaluation calls and zero paid
calls (nine setup calls and twelve follow-up/recovery calls). Reloads reused saved
approved and submitted evidence. Visual browser interaction and a new actual-model
follow-up evaluation were not performed in this reconciliation.

A final focused rerun used the retained fixtures with twelve additional injected
evaluations, including meaningful water-state and networking responses, and
compared the exact original teacher evidence before and after follow-up. An
isolated PostgreSQL/app restart retained matching fingerprints across nine
evidence tables and all four initially created follow-ups. No paid calls occurred.
