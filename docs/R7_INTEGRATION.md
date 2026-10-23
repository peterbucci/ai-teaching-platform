# R7 application integration

This guide describes the integration branch `integration/r7-agentic-tutor` for
[#73](https://github.com/peterbucci/ai-teaching-platform/issues/73),
[#74](https://github.com/peterbucci/ai-teaching-platform/issues/74),
[#75](https://github.com/peterbucci/ai-teaching-platform/issues/75),
[#76](https://github.com/peterbucci/ai-teaching-platform/issues/76), and
[#85](https://github.com/peterbucci/ai-teaching-platform/issues/85).
Implementation and executed verification are separate: this guide is not a claim
that all real-model or browser acceptance checks have passed.

## Application path

The student study page uses PR #81's single conversation composer with
`app/study/conversation-transport.ts`. The adapter calls #95's authenticated
conversation GET, POST, and display-acknowledgment routes. There is no Ask/Answer
mode. Quick actions only fill editable text.

`lib/dialogue/application.ts` composes the existing services:

1. The server authorizes the actor/session/assignment and reserves the immutable
   original message through #95's `reserveConversationOperation`.
2. #96's `classifyIntent` proposes intent under a durable provider reservation.
   `commitConversationIntent` validates and records the route.
3. A help request enters #94's bounded orchestration: one structured proposal,
   server validation, at most one permitted tool, then a saved result.
4. #96 generates and independently reviews source-grounded content. Every paid
   stage uses the same #95 reservation store; raw output and private rubrics stay
   on the server.
5. Accepted help is rendered through the conversation view. Only its subsequent
   display acknowledgment marks the existing intervention as assistance.
6. A confirmed answer uses the original text and stable submission identity in
   the established submission/evaluation path. The explicit existing evaluation
   action can then request a controller-authorized instructional response.

The classifier is advisory. Even an `ANSWER` classification retains uncertain
answer intent until the student explicitly confirms submission. Ambiguous text
also requires confirmation; neither help nor unresolved intent is graded. This
conservative confirmation is distinct from a manual composer mode.

## Generated activities use the existing controller

`reserveControllerOperation` reserves one server-owned operation per current,
accepted, unapplied evaluation. Its stable request ID is that evaluation's UUID.
The browser cannot submit a controller payload. The existing `decideTutoring`
selects the permitted activity slot; the model chooses an available instructional
tool within that slot.

`applyTutoringInTransaction` recomputes the decision under the existing session
lock. `bindGeneratedQuestion` keeps the generated question's immutable UUID,
private rubric, provenance and exact source version, and adds a server-owned
`controller_node_id` for the approved authored slot. This binding lets subsequent
answers use the same evaluator, controller bounds, hypothesis evidence, retests
and completion rules. It does not register a second tutoring state machine or
replace the authored question bank.

Generated questions must preserve all concepts required by their approved slot.
The proposal receives that required coverage; narrowed proposals fail before
generation. A generated question cannot choose its own slot, repeat a previous
prompt, reset retry bounds, or carry embedded scaffolding. Until a dedicated
question-display acknowledgment exists, runtime assessments are restricted to
unscaffolded prompts. Generation and independent review enforce this restriction;
the final controller handoff rejects declared scaffolding again. Existing curated
question scaffolding remains unchanged.

Controller-generated teaching uses existing controller interventions and their
existing display acknowledgment. The controller operation records the linked
intervention/next attempt privately, rather than claiming that generation means
display. Teacher session evidence includes the original message, authorized route,
proposed action, validation, execution result and linked controller action.

## Authorized published content

PR #93 merged as `939c766d5cd82fa1347b731eabbba24331a836a4` and is
reconciled into this branch. Dialogue, evaluation, tutoring, reading, persistence
and teacher evidence use the existing authorized assignment resolver. It checks
the exact approved lesson/source version, class ownership or enrollment, complete
concept/passage/category scope and immutable publication. Private uploaded sources
need no public URL or invented Git commit. Full resolved content remains server-only.

Runtime permission comes only from that version's published `activity_policy`.
The temporary deployment assignment allowlist is removed. Installed capabilities
are intersected with the published actions at claim, checkpoint and final commit.
The controller helper independently re-resolves content under the session lock;
a caller's copied policy cannot enable a tool. Intent classification is separate
from generation permission. The original curated lesson keeps runtime generation
disabled and uses its approved deterministic instruction; its saved R7 history
remains readable. A new approved uploaded version may explicitly enable generation.

Student explanations require `GIVE_HINT`; neutral clarification requires
`ASK_SELF_EXPLANATION`. Controller generation requires both the exact recomputed
controller action and the corresponding published permission. Diagnostic, neutral
follow-up, explanation and retest map to the existing diagnostic/self-explanation/
corrective-feedback/retest actions. No policy change rewrites a published version.

Approved AI-authored bank questions may have `origin: generated`; exact catalog
snapshot equality makes them approved controller questions. Runtime UUID snapshots
remain distinct and carry server-assigned activity-slot bindings. Publication
rejects runtime bindings in bank questions. No second controller is introduced.

Installed tools are deliberately limited:

| Context                         | Installed, state-permitted tools                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Unanswered student help         | `clarify`, `explain`                                                                                                                     |
| Accepted controller observation | `generate_diagnostic`, `generate_followup`, `generate_retest`, `explain`, `advance_lesson`, subject to the established controller action |

Reading retrieval, return-to-lesson orchestration delivery, R1 visuals, arbitrary
execution, messaging and teacher edits are not installed tools in this adapter.
The existing reading navigation and deterministic authored tutor remain available.
A settled unavailable/invalid instructional result can use the authored fallback;
an unknown provider outcome cannot be treated as a settled failure.

## Durability and recovery boundaries

Messages, classifications, action proposals, validation, actual execution and
results remain in the existing PostgreSQL dialogue/evidence records. Original
answers and accepted evaluations are immutable. GET and refresh reconstruct saved
state without model calls, answer submission, progression, or display side effects.
Duplicate identities replay saved outcomes; altered payloads conflict.

Classification, action proposal, generation, review and legacy evaluations share
36 provider requests per session and one concurrent provider operation. Dialogue
has 12 turns, 45-second individual provider timeouts and zero automatic retries.
The browser waits for the bounded composite operation; waiting never dispatches a
replacement request. Commit-time policy validation does not reserve another pair
of calls after generation and review have completed.

Interrupted or uncertain provider outcomes remain reserved. A late original
callback may record a known result, but cannot revive cancelled/stale work.
Pending controller operations are blocked across refresh rather than restarted.
A process interruption after provider results are saved but before content commits
also leaves the operation pending; replay does not resume that commit. There is no
automatic reconciler or user-facing dialogue retry endpoint. Operator reconciliation
of an interrupted operation is a remaining integration/reliability gate; never clear
reservations or invent a fresh request ID to bypass uncertainty.

The existing explicit, bounded evaluation retry remains available after a proven
terminal provider failure. New failure records link a server-owned settled/unknown
outcome to the exact pending evaluation reservation; only a matching settled failure
releases that reservation. Timeouts, uncertain transport failures, interrupted calls
and older unlabelled failures with pending reservations remain blocked. All original
reservations still count
against the shared session budget.

## Git history and overlapping changes

The integration branch merges the existing PR heads as ancestors, preserving the
original commits and leaving their branches intact:

- [PR #81](https://github.com/peterbucci/ai-teaching-platform/pull/81): composer and conversation contracts.
- [PR #95](https://github.com/peterbucci/ai-teaching-platform/pull/95): durable operations, authenticated routes and teacher evidence.
- [PR #96](https://github.com/peterbucci/ai-teaching-platform/pull/96): real classifier, generator and independent review.
- [PR #94](https://github.com/peterbucci/ai-teaching-platform/pull/94): bounded tool proposals, validation and dispatch.

Shared conversation/student-view contracts retain their common PR #81 foundation.
The additive `immediate_retest` contract from #94/#96 is preserved. Persistence
changes keep conversational delivery separate from controller intervention
acknowledgments. Controller, evidence and study-page changes compose these existing
implementations. The conflicting `docs/R7_CONTRACTS.md` retained the revised guide
from the current main branch; the integration does not restore an older product
or contract description over it.

Before eventual merge, agree one landing strategy with the owners of all four
PRs. Preserve their ancestry when landing this integration, then reconcile the
original PRs against the resulting base; do not independently squash/cherry-pick
those same changes afterward. If any original PR gains commits, merge/reconcile
that updated head into the integration before claiming it is included. No original
PR or issue is closed or merged into main automatically by this work.

## Verification record

The [resolver-phase verification report](../evals/R7_RESOLVER_VERIFICATION.md)
records the approved uploaded Moonlight workflow separately from the
[initial application run](../evals/R7_APPLICATION_VERIFICATION.md). Final PR #98
implementation `9ffdec6` passed [CI 39951459851](https://github.com/peterbucci/ai-teaching-platform/actions/runs/39951459851)
with 211 unit tests and all configured checks. Resolver PostgreSQL checks passed
18 dialogue groups and five controller groups, using deterministic providers.

A separate temporary checkout combined that exact R7 implementation with #102's
reviewed authoring workflow for actual browser verification. The teacher reviewed,
approved, published and activated Moonlight version 2. Its version/policy editing
required an explicit existing-service preparation step because #102 has no UI
controls for those fields. That preparation was not a browser result or an
additional authoring model run; the canonical save invalidated earlier approvals.

The student browser received real grounded help, confirmed an intended answer,
received and refreshed a generated diagnostic, submitted a new observation, and
completed through the existing controller. The model selected the diagnostic from
`[generate_diagnostic, advance_lesson]`; after the new correct response the
controller permitted only advancement. The authorized teacher inspected the full
trace. Database evidence confirms exactly one accepted evaluation per original
answer and assistance recorded after display. HTTP replay and cross-user checks
passed without changing evidence, and published v1's original evidence stayed
unchanged. After an application/database restart, teacher reload and student
Review session recovered the completed conversation; all 11 saved snapshot hashes
and the v1 baseline stayed identical, with no extra model calls. This uploaded case
supplements the earlier two distinct networking
misunderstandings; it does not claim a new two-case comparison.

The new phase records 14 successful model calls (12 dialogue and two evaluator)
and one additional settled failed proposal reservation. Dialogue usage is 33,054
tokens; legacy evaluator usage is not persisted. The first uploaded proposal
failed; investigation found unsupported URI formats in its wire schema. The narrow
adapter fix removes only that wire annotation while retaining canonical URL and
exact source validation. Local SDK conversion had succeeded; the failed record
alone does not prove network dispatch or paid usage. The later explicit browser
request passed. Original reservations, zero automatic retries and call budgets
are preserved.

The curated control retained runtime generation disabled and used one classifier
call only. Its original fallback misleadingly reported a usage limit; corrected
unavailable-policy wording has deterministic coverage. Browser recovery showed the
saved historical message, so corrected wording is not claimed as a fresh browser
result. Keep successful calls, known failed reservations, synthetic checks and
browser observations distinct. The prior 22-call R7 run and seven-call #102
authoring/student workflow (four authoring calls and three evaluations) were not
rerun or counted again.

## CI isolation and the #93 handoff

The initial PR #98 CI failure was accumulated authentication state, not a failed
password or a persistence error. The single application process admitted four
logins in the dialogue suite, two in metrics, three in patterns, then the
persistence suite's teacher login. Its student login was the eleventh request in
Better Auth's shared ten-login budget. The dialogue timeout check takes 45 seconds;
the limiter requires 60 seconds without an admitted login to reset, so suite order
and machine speed exposed the coupling.

`scripts/check-isolated.mjs` gives each CI check a fresh application process and
waits for its health check. It neither recreates containers nor resets PostgreSQL.
Authentication settings and trusted-header handling are unchanged. The separate
`auth:rate-limit:check` deliberately exhausts the real HTTP limit and verifies
invalid credentials, valid credentials, and both demo roles remain blocked despite
changing forwarding headers. The persistence check follows it in a fresh process;
the existing full database/application restart check still reuses saved cookies and
compares the original evidence and record counts. Do not replace this isolation
with sleeps, login retries, larger limits, or disabling authentication.

## Remaining R4/R7 integration gates

#93 is merged and reconciled; the resolver/temporary-allowlist gate is complete on
this branch. The uploaded Moonlight workflow has actual student and teacher
browser evidence. #102 remains a separate dependency: the temporary combined
checkout proves the reviewed authoring/publication workflow but does not land
#102 in this PR. Its UI still lacks content-version/full action-policy controls,
so the documented service preparation must not be presented as UI editing.

A generation-disabled publication stays disabled. Enable runtime generation only
through a reviewed new version with explicit activity permissions and its own
activated assignment. The Moonlight audit confirms its previous version and
original responses remained unchanged. Retain migrations 006, 008 and 009
unchanged and reconcile #102's authoring migrations as their own dependency stack.

Unknown/interrupted operation reconciliation and human educational/security review
remain #76 acceptance gates. Preserve both display acknowledgment paths and
original evidence. Runtime assessed prompts remain unscaffolded; generated retests
and neutral follow-ups have fixture coverage, not new live selections in this
phase. The uploaded browser demonstrated a diagnostic followed by an observed
response and changed next decision; the broader two-misunderstanding evidence
remains in the initial application report. No bounded run establishes durable
mastery or general educational effectiveness.

Use [the resolver report](../evals/R7_RESOLVER_VERIFICATION.md) for current CI,
provider, PostgreSQL, browser, authorization and application/database restart
recovery evidence. Preserve historical reports as records of
their actual revisions rather than relabeling earlier curated runs as newly
verified uploaded behavior. Keep PR #98 draft and coordinate the original four
PRs' landing strategy; do not merge any PR automatically.
