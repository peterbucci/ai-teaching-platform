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

## Authorized content and temporary enablement

PR #93/#53 was unmerged when this branch was integrated. The current executable
source is therefore the approved curated lesson. The dialogue context checks the
assignment's exact approved content reference and concept/passage/misconception
scope; unknown versions fail closed. Proposal context, selection and generation
remain within that authorized scope.

`R7_RUNTIME_ASSIGNMENT_IDS` is a temporary deployment-owned, comma-separated list
of assignment UUIDs approved for runtime generation. An absent or invalid list
enables no assignments. A browser/model cannot grant this permission. The gate is
rechecked during orchestration and final delivery. Valid provider configuration
is also required. Do not put credentials or private verification records in Git.

After #93 merges, reconcile its `resolveAssignmentContent(client, access,
assignmentId, role)` and the resolved `activity_policy` directly. Replace this
configuration bridge with the exact published lesson policy, preserving the
assignment/source checks. Uploaded lessons are not supported by substituting the
curated loader. The temporary bridge is not a permanent networking-only resolver.

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

Record executed deterministic checks, database/service checks, real-model calls,
and authenticated browser checks separately in the integration PR/report. Preserve
the earlier provider and persistence reports rather than presenting them as new
application runs. Record bounded call counts, inputs, observed tools and failures
for any new model run. A varied response alone does not establish adaptive action
selection: #76 still requires materially different justified actions, an observed
student response that changes the next decision, recovery, and authorized teacher
inspection in the integrated application.
