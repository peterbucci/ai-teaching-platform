# Student and recovery acceptance matrix

Reviewed October 24, 2026 (America/New_York). This document records an independent static audit and one limited unit-test attempt. It does **not** certify a browser, database, hosted release, or live-model run.

**Historical planning audit:** The static findings and limited dependency-blocked
test attempt below describe the initial inspection. Later independent browser runs
confirmed S-01 and S-02 on main and PR #116. Current executed statuses are in
[student browser results](STUDENT_BROWSER_RESULTS.md),
[the acceptance report](REPORT.md), and [defects](DEFECTS.md); the scenario table
below remains a reusable test design.

## Targets and evidence boundaries

| Target                             | Exact source                                                | Scope of this audit                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A: current main                    | `723ed6fea41138b604a9d333ebcd4a07b2202c36`                  | Read implementation, tests and runbooks; attempted selected unit tests below.                                              |
| B: Workbench PR #116               | Record its actual tested head in the root acceptance report | Reuse every applicable scenario below on that exact head. No runtime result for #116 is claimed here.                      |
| C: student PR #113                 | `2b490863cc6de69a7659f1df1e4628bc22dd7d9a`                  | Read-only comparison with A. Not merged into A; neither unit nor browser acceptance on this PR was executed by this audit. |
| Later Lessons/Assignments branches | Record each exact SHA, application build and database       | Reuse the same scenarios; earlier passes do not transfer to a new branch.                                                  |

The user authorized repository `PROJECT_CONTEXT.md` in place of the unavailable external context file. That specification was read before this audit. Historical reports in `docs/R7_INTEGRATION.md`, `evals/R7_APPLICATION_VERIFICATION.md` and `evals/R7_RESOLVER_VERIFICATION.md` describe their own revisions and actual-model scopes; they are not fresh main acceptance.

Use these result categories: **PASS/FAIL** only for an executed assertion; **UNRUN** for an unexecuted scenario; **STATIC FINDING** for an implementation observation needing integrated confirmation; **ENVIRONMENT BLOCKED** for setup failures before an assertion. Preserve separate records for synthetic unit fixtures, provider-disabled PostgreSQL/HTTP integration, historical model evidence, fresh actual-model testing, and hosted verification. Fresh paid tests are not authorized.

## Observed static findings and owning workstream

### S-01: Accepted assessment result is absent from the main study conversation

**STATIC FINDING; browser confirmation unrun. Owner: student answer-result workstream / PR #113, coordinated through #76 and #35.**

Later status: independently browser-confirmed on main and PR #116; see the linked
final reports above. The original static observation is retained below.

At A, `app/study/session.tsx:503` renders saved questions, original answers and interventions. The mapped attempts do not render `attempt.evaluation`. The answer receipt in `app/study/dialogue.tsx:578` says only that the answer was saved. The completed session has a `Completed` status; its general progress message remains in an `sr-only` live region, while the visible action panel omits the message for completed sessions (`app/study/session.tsx:662`). General completion is not a visible accepted assessment result or uncertainty explanation.

Reproduction to execute: open a fictional completed session with a current accepted correct evaluation and no feedback intervention; compare the saved current evaluation with the study view. Repeat with incorrect, partial and uncertain accepted results, with/without assistance. Expected: students can identify the accepted outcome and uncertainty without inferring correctness from completion; original text stays exact. Verify the teacher sees the same accepted evaluation identity. Do not insert a competing fix: PR #113 already changes result rendering and completion messaging.

### S-02: Expired-auth copy may assert persistence before an answer was saved

**STATIC FINDING; fault-injection/browser confirmation unrun. Owner: student recovery / #76.**

Later status: independently browser-confirmed on main and PR #116; see the linked
final reports above. The original static observation is retained below.

At A, `app/study/session.tsx:55-57` maps every 401 from its generic request helper to `Please sign in again. Your submitted work is saved.` The helper also sends the initial answer-save request (`app/study/session.tsx:388`). If that first POST is rejected for expired authentication, the response alone does not establish that submitted work exists on the server. Local draft preservation is implemented separately.

Reproduction to execute: type an unsent answer; expire the fictional session or return 401 for the first answer-save request; use the explicit provider-disabled answer fallback. Inspect exact local text, server attempt, visible status and sign-in/return path. Expected: preserve local work and distinguish unconfirmed/local text from saved server evidence. This is a status-accuracy candidate, not an observed loss of work.

### S-03: Unit coverage is not browser acceptance

**COVERAGE GAP. Owner: independent acceptance, with PR #113 for new scrolling behavior.**

The repository has substantial contract, service, transport and display-acknowledgment tests, but this audit found no automated browser acceptance for the React composer draft restoration, expired login and return, Back/Forward, viewport overflow, focus/scroll restoration, or 200% zoom. PR #113 introduces `ConversationScroll`, combines lesson history with the dialogue viewport, changes help visibility acknowledgment, and adds completion tests. Its pure completion tests cannot prove those browser behaviors.

## Reusable scenario matrix

All browser scenarios below are **UNRUN by this audit**. Named tests/scripts are existing coverage candidates, not claims that they were executed. A test of a private service is not a browser result.

| ID    | Scenario and required observation                                                                                 | Existing reproducible coverage / layer                                                                                                                           | Additional integrated check                                                                                                                                                                                               |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ST-01 | Student finds only authorized assignments; assignment/source identities remain distinct.                          | `tests/student-assignments.test.ts`; `tests/student-dashboard.test.ts`; `scripts/check-assignments.ts`; `scripts/check-student-dashboard.ts`                     | Open an assignment from dashboard and filtered list; assert exact authorized assignment/lesson version and absence of another class's work.                                                                               |
| ST-02 | Read exact approved source without starting/submitting/evaluating an answer.                                      | `tests/reading.test.ts`; `tests/student-reader-presentation.test.ts`; `scripts/check-reading.ts`                                                                 | Compare attempt/evaluation counts before and after reading; verify passage, source/version, Back and return link. Reading assistance is recorded only at its existing acknowledgment boundary.                            |
| ST-03 | Start/resume exact session; refresh does not evaluate.                                                            | `tests/tutoring.test.ts`; `scripts/check-tutoring.ts`; `scripts/check-tutoring-restart.ts`                                                                       | Save synthetic answer/evaluation IDs and counts; refresh, navigate away/back and restart app; confirm unchanged IDs/counts.                                                                                               |
| ST-04 | One composer; help and answer are routed distinctly; ambiguity waits for explicit confirmation.                   | `tests/conversation.test.ts`; `tests/dialogue.test.ts`; `tests/dialogue-service.test.ts`; `scripts/check-dialogue.ts`                                            | Type help, intended answer and ambiguous text using same textarea. With provider disabled expect honest fallback/confirmation, not claimed classification. Help must leave response_text/evaluation untouched.            |
| ST-05 | Exact original text and unsent draft survive reading, quick actions, refresh and return.                          | `tests/dialogue.test.ts`; `tests/dialogue-view.test.ts`; UI storage code in `app/study/session.tsx` and `app/study/dialogue.tsx`                                 | Use whitespace, newlines and long text; quick action then Restore previous draft; navigate to reading and Back; refresh. Check exact equality, correct attempt key, and no work restored into a different session.        |
| ST-06 | Help exposure is acknowledged only after actual visibility; accepted-but-unshown help blocks assessed submission. | `tests/display-acknowledgement.test.ts`; `tests/dialogue-view.test.ts`; `tests/conversation-transport.test.ts`; `scripts/check-dialogue.ts`                      | Keep accepted help offscreen and behind scroll clipping; inspect zero visible_at/assistance before display, then one acknowledgment after display. Test both controller feedback and conversational help.                 |
| ST-07 | Accepted result, uncertainty and assistance are visible; no false mastery/retention claim.                        | `tests/evaluation-result.test.ts`; `tests/student-practice-topics.test.ts`; PR #113 `tests/tutoring-completion.test.ts`                                          | Compare result to current_evaluation_id for correct/partial/incorrect/uncertain; immediate assisted success must not become durable mastery. Current-main S-01 needs confirmation.                                        |
| ST-08 | Fresh follow-up/retest uses immutable prompt and private criteria; teacher sees same saved evidence.              | `tests/generated-controller.test.ts`; `tests/dialogue-controller-operation.test.ts`; `scripts/check-r7-controller.ts`                                            | Use synthetic provider generation and recorded evaluations, labeled as such. Verify next prompt is new, source pinned, private criteria absent from student payload and teacher trace tied to original answer.            |
| ST-09 | History/journal preserves prior results and supports exact session review.                                        | `tests/student-journal.test.ts`; `tests/student-dashboard.test.ts`                                                                                               | Review older and newer sessions for same assignment; verify no replacement of historical attempts, correct chronology and original text.                                                                                  |
| RC-01 | Expired authentication preserves work and gives an accurate next step.                                            | Existing HTTP auth checks in `scripts/check-dialogue.ts` and `scripts/check-dialogue-recovery.ts` cover anonymous denial, not the whole expired-session UI.      | Expire before send, after saved response, and before display ACK. Reauthenticate and return; distinguish local, pending and saved evidence. S-02 is a static copy candidate.                                              |
| RC-02 | Failed answer save preserves original text and stable submission identity.                                        | `tests/conversation-transport.test.ts`; `tests/conversation.test.ts`; `scripts/check-dialogue.ts`                                                                | Fail before commit versus lose response after commit. Explicit retry/reconcile must leave one original answer and one identity; do not infer no commit from lost response.                                                |
| RC-03 | Pending/failed evaluation is not treated as accepted; no refresh-triggered paid retry.                            | `tests/evaluation-recovery.test.ts`; `scripts/check-tutoring.ts`; `scripts/check-dialogue.ts`                                                                    | Refresh pending/failed states. Retry only a known terminal failure after existing delay/limit; accepted judgment never re-evaluated. Use mocked/synthetic evaluator only.                                                 |
| RC-04 | Provider unavailable has a usable, honest fallback.                                                               | `tests/dialogue-application.test.ts`; `tests/dialogue-service.test.ts`; `tests/conversation-transport.test.ts`; `scripts/check-dialogue.ts`                      | No credentials/configuration; help remains ungraded, original question remains; explicit authored answer path is available only after reconciliation. New evaluation cannot be claimed accepted without fixture evidence. |
| RC-05 | Unknown outcome remains blocked; saved success can recover without redispatch.                                    | `tests/dialogue-service.test.ts`; `tests/evaluation-recovery.test.ts`; `scripts/check-dialogue-recovery.ts`; `scripts/check-r7-controller.ts`                    | Recover known successful proposal/generation/review once; missing/unknown stage remains pending. Compare provider calls and operation counts before/after repeat recovery; no provider callback allowed.                  |
| RC-06 | Failed assistance ACK preserves exposure uncertainty and blocks continuation until reconciliation.                | `tests/display-acknowledgement.test.ts`; `tests/conversation.test.ts`; `scripts/check-dialogue.ts`                                                               | Fail controller and dialogue ACK independently, including post-commit lost response. Retry exact display identity and inspect one display record; ensure unrelated new input does not bypass gate.                        |
| RC-07 | Duplicate submission/recovery cannot duplicate answer, evaluation or intervention.                                | `tests/conversation.test.ts`; `tests/dialogue-view.test.ts`; `scripts/check-dialogue.ts`; `scripts/check-dialogue-recovery.ts`; `scripts/check-r7-controller.ts` | Double click, repeat exact request ID, then alter same-ID payload. Expect replay versus 409 conflict with exact evidence preserved.                                                                                       |
| RC-08 | Stale tab cannot overwrite newer answer, lesson state or accepted help.                                           | `tests/dialogue-view.test.ts`; `tests/dialogue-controller-operation.test.ts`; `scripts/check-dialogue.ts`; `scripts/check-dialogue-recovery.ts`                  | Two browser tabs, same attempt; submit in one then send/recover in the other. Verify expected revision conflict and no new paid stage.                                                                                    |
| RC-09 | Wrong assignment, unauthorized actor and source version fail closed.                                              | `tests/dialogue-view.test.ts`; `tests/dialogue-service.test.ts`; `scripts/check-dialogue.ts`; `scripts/check-assignments.ts`; `scripts/check-reading.ts`         | Student/other student/teacher/unrelated teacher; wrong session + assignment query; wrong uploaded source/version/hash. No private criteria, raw provider output or foreign evidence in body or rendered page.             |
| RC-10 | Known working curated fallback remains available.                                                                 | `tests/dialogue-application.test.ts`; `tests/conversation-transport.test.ts`; `scripts/check-tutoring.ts`; `scripts/check-r7-controller.ts`                      | Curated runtime generation disabled; uploaded runtime policy separately enforced; invalid generated source cannot rewrite original answer/evaluation or silently enable generation.                                       |

Teacher evidence selection limits, intervention revisions and delivery retry belong in the teacher matrix. Cross-role acceptance should connect ST-08/09 to its exact recipient, approval, delivery and later-evidence IDs.

## Existing commands and safety prerequisites

For each run record source SHA, dirty diff, dependency lock hash, Node version, application build/port, disposable database/container identity, configuration category, fixture and result file. Never load credentials from a shared application `.env`. Blank model API credentials in both the script and server environment; disabling only the script does not disable a separate server.

The following invocation bypasses package scripts that load `.env`; it assumes explicit disposable PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD, migrated schema, and DIALOGUE_CHECK_SYNTHETIC=1 already set in the isolated process:

```powershell
node --experimental-strip-types --conditions=react-server scripts/check-dialogue.ts
node --experimental-strip-types --conditions=react-server scripts/check-dialogue-recovery.ts
node --experimental-strip-types --conditions=react-server scripts/check-r7-controller.ts
```

`check-dialogue.ts` inserts uniquely identified synthetic users/lessons/sessions and preserves their evidence. It has an intentional 45-second timeout case. `DIALOGUE_CHECK_URL` adds real synthetic Better Auth cookie/HTTP checks; `--http-only` can run those separately. `check-dialogue-recovery.ts` explicitly rejects a nonempty OPENAI_API_KEY, requires explicit PG settings, restricts an optional HTTP base to localhost/127.0.0.1 and reports zero actual-model calls. `check-r7-controller.ts` injects provider results and reuses recorded evaluator fixtures from `evals/results/2026-10-16-v2-comparison.json`; those are not fresh model results.

For the existing seeded demo and isolated server, invoke `scripts/check-tutoring.ts`, `scripts/check-reading.ts`, `scripts/check-assignments.ts` with the same Node flags and explicit synthetic auth configuration. Do **not** supply `--live` to check-tutoring. `check-student-reader.ts` has an existing hard guard requiring PGPORT=5434; a different isolated port is an environment mismatch, not a reason to bypass the guard or modify production services during acceptance.

`scripts/check-isolated.mjs` restarts the Compose `app` between HTTP suites because Better Auth retains a process-local login limit. Run it only with the acceptance Compose project/environment clearly selected. Do not restart a shared development app or weaken authentication limits to get a passing test.

## Limited test execution by this audit

- Source: A, original read-only checkout `C:/Users/sb128/Desktop/LearningPlatform`; clean SHA confirmed before inspection.
- Runtime: Windows PowerShell, Node `v22.13.0`, package `ai-teaching-platform@0.1.0`.
- Configuration: OPENAI_API_KEY, OPENAI_MODEL and OPENAI_TTS_MODEL blank in the child shell; no env-file option; no database command; no paid provider call.
- Attempted the 18 test files below. Exit code **1**: **22 passing assertions** and **14 test-file import failures**. Missing `zod`/`server-only` caused those files to fail before their assertions. Existing node_modules directory was insufficient; no dependency installation or repair was attempted in the shared checkout.
- Passed: display acknowledgment (3), student assignment projections (8), journal projections (7), reader presentation (4). These are pure fixture assertions only.
- Remaining selected suites are **ENVIRONMENT BLOCKED**, not failed product acceptance. A dependency-ready isolated run by the root acceptance workstream must supersede this setup attempt. Browser, DB, actual model and hosted acceptance remain unrun by this audit.

Reproduce the attempted selection after dependency installation in the dedicated verification checkout:

```powershell
$studentTests = @(
  'tests/conversation.test.ts', 'tests/conversation-transport.test.ts',
  'tests/dialogue.test.ts', 'tests/dialogue-view.test.ts',
  'tests/dialogue-service.test.ts', 'tests/dialogue-preview.test.ts',
  'tests/dialogue-application.test.ts', 'tests/dialogue-controller-operation.test.ts',
  'tests/display-acknowledgement.test.ts', 'tests/evaluation-recovery.test.ts',
  'tests/evaluation-result.test.ts', 'tests/student-assignments.test.ts',
  'tests/student-dashboard.test.ts', 'tests/student-journal.test.ts',
  'tests/student-practice-topics.test.ts', 'tests/student-reader-presentation.test.ts',
  'tests/generated-controller.test.ts', 'tests/tutoring.test.ts'
)
$env:OPENAI_API_KEY = ''
$env:OPENAI_MODEL = ''
$env:OPENAI_TTS_MODEL = ''
node --experimental-strip-types --conditions=react-server --test @studentTests
```

## PR #113-specific acceptance and merge boundary

The compared PR changes eight files: assignment detail CSS, conversation scrolling, dialogue rendering, study session rendering, study CSS, completion helper, tutoring store and completion tests. It changes visible answer outcomes, shared conversation scroll structure and help exposure accounting. Its completion cases check incorrect/partial/uncertain results, missing or foreign concepts, superseded/wrong-attempt evaluations, and later answers. Run them at the PR's exact head; A has no `tests/tutoring-completion.test.ts`.

For A and #113 separately capture 1440x900, 1024x768, 390x844 and 320px-width screenshots. Exercise long question/response/help text; no horizontal overflow; question/source visibility; textarea reachability; keyboard traversal; 200% browser zoom; Back/Forward; reading return; user-scrolled older history while new help arrives; Jump to latest focus; clipped help awaiting display ACK; failed ACK retry; fresh follow-up visible without losing prior result. Do not claim screen-reader compliance without a screen-reader run.

No merge-readiness approval follows from this static audit or dependency-blocked run. Student result visibility and recovery/browser cases must be independently confirmed. PR #113 remains its own workstream; the acceptance branch contains verification documentation only.
