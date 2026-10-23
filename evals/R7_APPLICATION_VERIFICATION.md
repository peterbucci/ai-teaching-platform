# R7 application verification

Verified October 23, 2026 UTC (October 22 America/New_York) in the isolated
`integration/r7-agentic-tutor` worktree. All accounts and responses were fictional.
Final implementation revision: `95b6e7521637cf51e7753258e9a34d624bc38f71`. The actual
Learning Pulse study page, authenticated APIs, PostgreSQL, classifier,
generator, evaluator and controller were used. No original PR was merged into main.

## Result and scope

The application now accepts one natural-language message, validates model-proposed
intent, delivers reviewed grounded help, confirms intended answers, evaluates them
once, and executes controller-authorized generated activities. Committed
conversations survive refresh and are inspectable by the authorized teacher.
A real generated diagnostic was answered and evaluated through the original
controller; a second misunderstanding led to a generated explanation and authored
retest. This is bounded adaptation, not unrestricted agent control or evidence of
educational effectiveness. Full #76 acceptance remains open for the limits below.

[Sanitized database/model record](results/2026-10-23-r7-application.json) contains
exact messages, source identities, permitted tools, proposals, validation,
execution, observations, display receipts and provider metadata. It excludes
credentials, raw provider prompts and private question rubrics. Earlier
[provider](R7_PROVIDER_VERIFICATION.md) and
[orchestration](R7_ORCHESTRATION_VERIFICATION.md) reports remain unchanged.

## Why the earlier help-only run did not adapt

The earlier #94 service harness installed only `clarify` and `explain` against an
unanswered assessment. Its three messages legitimately called for explanations;
neutral clarification cannot teach a definition or correct a misconception. The
corrected prompt made that distinction explicit. Generated questions could not
become assessed attempts because the controller expected authored question IDs.
Changing wording or forcing a different action would not fix those constraints.

This integration adds the missing controller handoff. A validated immutable
question snapshot retains its generated UUID, exact source and private criteria,
and receives a server-owned binding to an approved activity slot. The original
controller then enforces its existing attempt bounds and transitions. Installed
tools depend on that decision and the assignment opt-in; unsupported tools are
never advertised. Generated prompts currently must be unscaffolded.

## New real-model evidence

Provider: `gpt-6.1-sol`; 45-second per-stage limits, shared session budget, zero
automatic retries. The new runs used **22 actual calls**: 19 dialogue stages and
3 legacy evaluator calls. Stored dialogue usage totals **81,635 tokens**. The
legacy evaluator does not persist token/response-ID/latency metadata, so these
figures are not a complete billing total. No extra calls were made to obtain a
preferred action. These are additional application checks, not reruns of the
previous expensive service scenarios.

| Case                              | Surface and observation                                                                                                                                                          | Real decision and execution                                                                                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial help                      | Actual student browser: asks what packet size means, then uses editable “Explain that another way.”                                                                              | Two grounded explanations with P07/P08 citations, rendered and acknowledged separately. Neither was graded.                                                                                                                                 |
| Ambiguity                         | Actual browser: “I think both delays double—is that right?”                                                                                                                      | Model proposed ambiguity. Refresh preserved the clarification without grading; student cancellation was saved.                                                                                                                              |
| Distance misunderstanding         | Actual browser: claims the transmitter must push the packet through twice as much wire, so both delays double. Explicitly confirms answer.                                       | One accepted evaluation. Model chose `generate_diagnostic` from `[generate_diagnostic, advance_lesson]`; reviewed question varies link rate while holding distance/signal speed fixed.                                                      |
| New student observation           | Actual browser: answers that the higher rate shortens last-bit insertion while a bit's journey is unchanged. Explicitly confirms answer.                                         | Generated snapshot assessed once. New accepted evidence changed the controller state; `advance_lesson` was then the only permitted tool. The real model proposed it and the controller completed practice without claiming lasting mastery. |
| Simultaneous-bit misunderstanding | Authenticated real HTTP application: claims transmission time is zero because the packet enters all at once, while correctly explaining propagation. Explicitly confirms answer. | One accepted evaluation. Model chose `explain`/`alternative_explanation` from `[explain, advance_lesson]`. Generated correction distinguishes finite bit placement from travel; original controller creates authored D05 retest.            |

The last case used HTTP for generation, then the actual student browser for
display. Teacher inspection and an offscreen feedback heading left it `created`
without a visibility timestamp. Scrolling the feedback text into the visible
viewport recorded its first display and enabled the retest composer. Refresh
preserved that receipt; the original answer retained `none_recorded` assistance.
No further model call was made. We did not submit a response to that retest or
claim a live generated retest. Generated retest/controller behavior was checked
separately with deterministic PostgreSQL fixtures.

The two misconceptions produced meaningfully different actions without forced
outputs. Available choices were constrained by the existing controller and the
accepted assessment; this is not a comparison with identical unrestricted tool
sets. An independent coding agent reviewed the outputs against the approved
passages and found the diagnostic, explanation and advancement educationally
appropriate. That review is not human educational validation.

## Browser and evidence checks

Primary live session: `e83c2dd0-c28a-4a6b-983f-97583bb27c6e`.
Second real HTTP session: `9c2de1e3-bebd-42a4-92c2-c7d5f5691ef3`.

- Actual student browser: original question, grounded help, alternative help,
  ambiguity, explicit answer submission, generated diagnostic, new answer,
  completed session and refresh recovery all exercised. A second browser login
  verified controller feedback stays uncounted while offscreen and is recorded
  when its text enters the visible viewport; its authored retest then becomes available.
- Actual authorized teacher browser: original messages, intent decisions,
  display times, accepted evaluations, generated diagnostic/response, proposed
  and executed tools, controller transitions and second-case undisplayed feedback
  all visible. Live evidence remains labeled separately from prepared histories.
- Database: six exact original messages, three unique submitted answers, exactly
  one accepted evaluation per answer, two dialogue display acknowledgments plus
  one controller feedback display record, and no
  unresolved live calls. Legacy pending reservation records remain immutable;
  they are not additional assessments. The cancelled ambiguous message has no
  answer. Refresh and teacher reads add no paid calls or accepted judgments.
- Deterministic browser fixture (not live AI): ambiguous-help resolution,
  cancellation/late response, saved-status checks, disabled fallback, refresh and
  mobile 390×844 layout; no Ask/Answer mode and no fixture console warnings.

## Executed automated verification

Executed against the final integration code (all synthetic-provider checks make
zero paid calls):

| Check                                                               | Result                                                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                                                          | 178 passed                                                                                                                                             |
| Repository formatting and whitespace                                | Passed                                                                                                                                                 |
| Production `next build --webpack`                                   | Passed on unchanged second invocation; first stopped after compilation for the inherited Next.js advisory                                              |
| Production HTTP and browser recovery                                | Passed after restart against the same database; fresh browser sign-in restored saved feedback, original answer and retest composer                     |
| ESLint and TypeScript                                               | Passed                                                                                                                                                 |
| `npm run content:check`                                             | 293 checks passed                                                                                                                                      |
| `scripts/check-dialogue.ts` with explicit disposable DB environment | 18 database failure/recovery groups passed, including the real 45-second abort and late completion                                                     |
| `scripts/check-dialogue.ts --http-only`                             | Real-cookie authentication, cross-user/teacher/origin denial, replay and safe projections passed                                                       |
| `npm run r7:controller:check`                                       | Generated diagnostic/explanation/retest controller handoffs, private snapshot/evaluator reuse, exact-once effects, source and teacher isolation passed |
| `npm run tutor:check`                                               | Original six baseline groups passed, including the actual 60-second cooldown and concurrent explicit retry with a mocked 429                           |

The first baseline run exposed #95's known-failure retry regression and failed.
The fix adds immutable reservation linkage and terminal/unknown provider outcome
metadata, with migration `009_evaluation_provider_outcomes.sql`; all spent budget
remains counted. The unchanged baseline then passed. Exact-link settlement,
unknown-outcome blocking and HTTP 408 uncertainty have focused regression tests.
The original display effect also required a fix: controller feedback now uses
viewport and document visibility, with three asynchronous visibility/race tests
and the real offscreen-to-visible browser check above. Apply migration 009 before
using the new evaluator metadata.

Test categories remain distinct:

- Unit/contract tests: intent, source validation, tool policy, generated slot
  bindings, transport identities, replay and student/private projections.
- Real PostgreSQL with deterministic providers: dialogue failure groups; generated
  diagnostic/explanation/retest handoffs; exact-once controller application;
  assistance timing, immutable originals and cross-user authorization.
- Real authenticated HTTP: anonymous/cross-student/cross-teacher denial,
  cross-origin refusal, replay and student-safe projections.
- Actual-model and interactive browser checks: only the cases identified above.

## Remaining acceptance and deployment limits

1. #93 remained open/draft and unmerged at the final resolver check, head
   `6cfa66824310a265d4bfb2a8c3f9d29001b51200`. Current curated exact-version/scope
   authorization is retained. `R7_RUNTIME_ASSIGNMENT_IDS` is a temporary trusted
   assignment opt-in, off by default. Replace it with #93's approved resolver and
   activity policy after merge; uploaded lesson acceptance has not passed here.
2. Interrupted/unknown provider outcomes stay reserved to prevent duplicate paid
   work. A still-running original callback can settle a late known response, but
   process death has no operator reconciliation/resume workflow. A crash after
   saved stages but before content commit can also leave a pending operation.
   Refresh restores committed work, not arbitrary interrupted orchestration.
3. The classifier can propose `ANSWER`, but #96 retains uncertain answer intent
   until explicit student confirmation. This is conservative routing, not a
   separate Ask/Answer mode, and must not be reported as automatic grading.
4. Runtime assessments are restricted to unscaffolded prompts. R1 visuals,
   orchestration reading-delivery tools and arbitrary actions are unavailable.
   Generated retests are database-fixture verified; neutral follow-ups are unit-fixture verified, not
   selected in these bounded live runs.
5. Human educational/security review and merged resolver integration remain
   required before full #76 acceptance. The development runtime also emitted an
   inherited Next.js dependency security advisory; dependencies were not changed
   as part of this integration.

See [R7 integration guide](../docs/R7_INTEGRATION.md) for composition, authorization,
limits and the original-PR history/landing plan. Keep the integration draft and
original issues open; do not apply the four original PR commits again after
landing their combined ancestry.
