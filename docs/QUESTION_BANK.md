# Teacher question bank (#51)

This feature generates and reviews initial lesson questions. It consumes #50's
approved objectives in #53's owned, revisioned draft. It does not publish lessons,
activate assignments, or add a runtime tutor. The draft PR is stacked on #50;
#52 owns the final publication screen and runtime sequence assembly.

## Teacher workflow

Approve objectives at `/teacher/objectives/:lessonId`, then continue to
`/teacher/lessons/:lessonId/questions`. Generation creates one bounded family:
initial, alternative, diagnostic and retest. Teachers can emphasize up to six
concepts; a question may assess multiple concepts. Saved preferences include
format, difficulty, explanation/application/comparison/calculation priorities,
approved misconception IDs, tentative reasoning errors and student instructions.
Initial emphasis defaults from #50's `essential` items. Later explicit bank
preferences are retained.

The editor supports question/rubric/citation edits, manual questions, deletion,
reordering, format/difficulty changes, one-question or selected-group regeneration,
source inspection, private criteria, partial answers and review notes. Regeneration
replaces only selected IDs. Per-question format/difficulty override global defaults.
Teachers must resolve flags, check each item and explicitly approve the saved bank.
Feedback guidance is private during assessment, but is a student-facing corrective
explanation for delivery after an answer. Student preview uses an explicit
projection excluding answers, criteria, review notes and reasoning hypotheses.

Unsaved edits retain their original revision in session storage. A stale response
cannot overwrite them. Reload/reconnect reads generation status; it never reruns
the provider. Manual edits remain possible after a failed or uncertain request.

## Interfaces for #52, #87 and #88

`LessonDraftContentSchema` retains existing `questions: QuestionSnapshot[]`,
`question_guidance`, concepts, misconceptions, source references and evaluation
policy. Optional draft-only `question_bank` metadata contains:

- `preferences`: saved generation choices.
- `items`: matching question ID, family ID, role, format, difficulty, feedback,
  tentative reasoning error, exact criterion-support quotes, optional reviewed
  calculation, review status/notes and model quality flags.
- `delivery`: reviewed closing feedback for the four existing sequence outcomes
  and a fallback message.
- `approval`: server-stamped actor/time and SHA-256 content fingerprint, or null.

Use `readQuestionBank(access, lessonId)` and
`updateQuestionBank(access, lessonId, command)` from `lib/question-bank/store.ts`.
Both require current ownership. `GET` and `POST` at
`/api/teacher/lessons/:lessonId/question-bank` expose these services with authenticated,
same-origin JSON writes, a streamed 500,000-byte limit and no-store responses.

| Command    | Required fields                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `save`     | `expected_revision`, complete ordered `questions`, `question_guidance`, `question_bank`, `activity_policy`           |
| `generate` | `expected_revision`, new `request_id`, `question_ids` (empty only for an empty bank), optional `acknowledge_unknown` |
| `approve`  | `expected_revision`                                                                                                  |

Responses contain `{lesson_id, title, revision, draft, issues, operations,
has_unknown_outcome}`. The operation status is `pending`, `completed`, `failed`,
`stale` or `unknown`. A request UUID and payload hash are durable; replay is a
read-only reconciliation. Stale generated proposals remain inspectable in history.
Conversational edits should preview these typed changes and apply through the
same revision-checked services after teacher acceptance. They cannot mint approvals.

**#52's exact handoff:** `getReviewedQuestionBank(draft)` from
`lib/question-bank/validation.ts` returns deep-cloned
`{questions, question_guidance, items, preferences, delivery, activity_policy}`.
It rejects validation issues, unreviewed items or a missing/stale fingerprint.
The caller must first load an owned draft at its expected revision. Generation
and bank approval require a present #50 workflow and
`assertObjectiveReviewForLesson(draft)`, not just an old approved `concepts` array.
Question edits preserve that server-owned objective review. Objective edits,
reordering, emphasis or reapproval invalidate dependent bank approval.
Any invalidated bank also clears its derived tutoring sequence; #52 must assemble
the reviewed bank again before full lesson approval, preventing stale feedback.

The fingerprint covers source identity, passages, objectives/workflow, questions,
private criteria, policy, preferences, item review and delivery. It deliberately
excludes `sequence` and snapshot `sequence_id`, allowing #52 to attach the reviewed
family to the existing bounded sequence without changing reviewed content.
`projectLessonDraftContent` produces the strict runtime shape; both
`objective_workflow` and `question_bank` remain in the authoring draft. #52's SQL
projection migration must omit exactly those fields while preserving ownership,
source and approval guards. This branch intentionally does not add that migration
or claim combined-bank publication works before #52 integration.

## Validation and provider limits

Code checks current owned/approved immutable sources, exact passage bytes/hashes,
approved concepts and misconception scope, rubric completeness, verbatim quotes
for each criterion and assessed concept, family coverage, MC labels/options,
and conservative lexical retest duplication. Diagnostics assess a subset of their
initial question's concepts. Calculations use reviewed add/subtract/multiply/divide
code; no model-generated code or formula executes. Unknown reasoning errors stay
tentative and do not create misconception categories.

One request makes at most two model calls: structured generation and an independent
critique for correctness, answerability, source support, answer leakage and retest
novelty. Each call has a 90-second timeout, zero SDK retries, `store:false`, no tools,
and the official OpenAI endpoint. It uses existing `OPENAI_API_KEY`/`OPENAI_MODEL`.
Source/model/teacher strings are untrusted data. The provider has no credentials
in its context and cannot authorize writes, fetch sources, publish or assign.

Migration `013_question_bank_operations.sql` adds only a durable request ledger.
Per-teacher locking allows one active generation, at most 20 reservations/day and
12/lesson; selected groups contain at most eight questions. Pending operations
older than five minutes are shown as unknown. Timeouts/connection uncertainty
require explicit acknowledgment of possible duplicate usage before a new request,
including uncertainty on another lesson. No automated retry or repair loop exists.

Matching quotes and model criticism do not prove educational validity. All generated
items start unreviewed. Flags survive ordinary saves; corrections plus explanatory
review notes are required to clear them. Teachers remain responsible for factual
and pedagogical review before approval.

## Verification and recorded limits

`npm run questions:check` uses isolated PostgreSQL and a deterministic injected
provider. It covers approved-objective generation, source/concept grounding,
selective replacement, edits/add/delete/reorder/approval, unauthorized actors,
stale in-flight results, durable replay, malformed output and provider uncertainty.
`npm run questions:live -- --run-paid-check` is an explicitly bounded paid harness;
an additional `--acknowledge-unknown` is required after an uncertain prior outcome.

The actual model evidence and educational review are preserved in
[`evidence/question-bank-live-2026-10-23.json`](evidence/question-bank-live-2026-10-23.json).
Five calls were initiated: one timed out at the former 45-second bound, then four
calls completed for an initial family and selective MC retest regeneration. The
small synthetic water lesson used approved-objective fixtures before #50 became
available. Facts and citations were sound, but both retests were flagged as
insufficiently different. Independent review also found an initial answer clue
and teacher-directed feedback. Prompt v2 addresses these findings and has
deterministic coverage; it has **not** been retested with a paid model.

Actual browser testing edited the initial wording, rewrote the retest as a
goal-directed plan choice, relinked its criteria to source quotations, rewrote
feedback for direct student delivery, reviewed all four questions, explicitly
approved and reloaded revision 8, then inspected the answer-free student preview.
These are agent-operated synthetic teacher checks, not a human educator validation.
#50 service integration and its regression checks were added afterward. #52 owns
final integrated publication and assignment verification; #74 owns runtime questions.

After integrating #50, a separate zero-paid-call browser check followed the real
approved-objectives link into a fixture-generated bank, added and removed a manual
row, and saved a wording edit. This exposed and fixed a recovery bug when undoing
all unsaved edits; the same browser sequence then remained editable.

Final local checks: 143 deterministic tests; `questions:check`, `objectives:check`
and `lessons:check` on isolated PostgreSQL; 293 curated content checks; ESLint,
TypeScript, formatting and diff checks; Docker production build. Database and
browser fixtures are explicitly distinct from the five actual model calls above.
