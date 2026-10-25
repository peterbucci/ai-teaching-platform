# Acceptance defects and owning workstreams

Exact source/environment information is in [REPORT.md](REPORT.md). All observations use isolated local builds, disposable PostgreSQL and fictional users. No paid calls or app fixes occurred.

## S-01 — Completed student conversation omits the accepted result

**Priority P2. Full student acceptance blocker.** Independently browser-confirmed on PR116 `5d6363d2867a6f0250f8220db0474342b1241d00` and main `723ed6fea41138b604a9d333ebcd4a07b2202c36`. Owner: student answer-result workstream [PR113](https://github.com/peterbucci/ai-teaching-platform/pull/113), [#76](https://github.com/peterbucci/ai-teaching-platform/issues/76), coordinated through #35.

1. Prepare the explicitly synthetic accepted-result fixture with `seed-student-result.mjs` in the isolated PR116 app. It uses a fresh normal session, not relabeled historical records.
2. Sign in as fictional Student Two.
3. Open `/study/assignments/30000000-0000-4000-8000-000000000001?tab=study&session=596fda0e-7186-4e13-bf4d-6e865cfa9d5c`.
4. Inspect the visible result, refresh and compare to the accepted evaluation.

Expected: the accepted correctness/uncertainty and meaningful feedback are visible, with assistance/source context and no unsupported mastery claim.

Actual: “Completed” and “Your answer — saved” appear with the original answer, but the accepted correct result is absent. Attempt `d6b4c388-f717-4bed-9b72-ab8559752621` points to evaluation `ac0ddce6-6bdf-4bdc-8d59-73a9d6727b54`, which marks both concepts correct. Persistence/refresh passed; this is a visible-result failure.

Evidence: [PR116 student report](evidence/pr116/browser-student/student-result-report.json), [desktop screenshot](evidence/pr116/browser-student/correct-result-1440x900.png), [320px screenshot](evidence/pr116/browser-student/correct-result-320x844.png). Main was independently reproduced in session `487e5e23-13f9-4497-8b62-c4d4cc410d79`, attempt `44d7e075-4824-4447-91dd-efb72afbd93f`, accepted synthetic evaluation `9409c564-2b03-4ea6-84db-bc18e3773d57`. See [main result report](evidence/main/browser-student-result-main/student-result-report.json) and [main screenshot](evidence/main/browser-student-result-main/correct-result-1440x900.png). PR113 is untested, not an accepted fix.

## S-02 — Initial answer-save 401 claims unsaved server work is saved

**Priority P2. Full recovery acceptance blocker.** Reproduced independently on both exact main and PR116 sources. Owner: [#76 student recovery](https://github.com/peterbucci/ai-teaching-platform/issues/76); coordinate with PR113 rather than introducing a competing fix.

1. Open the provider-disabled curated study session as the fictional student.
2. Choose the explicit intended-answer fallback and enter a new answer.
3. Intercept the first `POST /api/sessions/{sessionId}/answers` before it reaches the server; return HTTP 401.
4. Compare the local text and displayed recovery notice to the server attempt.

Expected: preserve exact local work and explain that its server save is unconfirmed, with a safe sign-in/recovery action.

Actual: exact local text survives and there is no automatic retry, but the notice says “Please sign in again. Your submitted work is saved.” The server still has `response_text: null`. No data loss was observed; the durability claim is false for this initial-save failure.

Main session: `a1058019-9170-43fc-8200-ad39f1734934`. PR116 session: `f1639d10-3745-4494-8c40-73a6a9f81d5c`.

Evidence: [main screenshot](evidence/main/browser-student/answer-save-401-preserved.png), [PR116 screenshot](evidence/pr116/browser-student/answer-save-401-preserved.png), each target's `student-browser-report.json`. This reproduces a precommit 401 through browser fault injection; a real session-expiry/sign-in-return cycle remains unrun.

## W-06 — Malformed over-limit URL has no actionable scope guidance

**Priority P3. Post-submission UX; not an authorization or release blocker.** Reproduced on PR116. Owner: [Workbench #114 / PR116](https://github.com/peterbucci/ai-teaching-platform/pull/116).

1. Sign in as the fictional demo teacher.
2. Open `/teacher/interventions?assignment=30000000-0000-4000-8000-000000000001&origin=synthetic_fixture&concept=transmission_delay` with 61 repeated `seedAttempt=50000000-0000-4000-8000-000000000001` parameters.
3. Observe the safe rejection.

Expected by the verification case: explain invalid/oversized selection and offer a safe route to select evidence again.

Actual: generic “This evidence isn't available” without a narrowing-specific hint. No original response is disclosed and no write occurs.

This is deliberately malformed duplicate-ID input, not a failure of the flow with 61 real responses. The separate fixture with 61 distinct students passed server rejection without truncation and explicit one-student narrowing on a 390 px browser. Its draft preparation retained the exact selected response and made generation available without invoking it.

Evidence: [Workbench report](evidence/pr116/browser-workbench-final2/report.json), [real oversized browser report](evidence/pr116/browser-oversized-verified/report.json), [narrowed scope](evidence/pr116/browser-oversized-verified/narrowed-390.png).

## Routing and retest rules

The student workstream received [S-01/S-02 reproduction details on PR113](https://github.com/peterbucci/ai-teaching-platform/pull/113#issuecomment-6393058350). The Workbench workstream received [scope, W-06 and focus findings on PR116](https://github.com/peterbucci/ai-teaching-platform/pull/116#issuecomment-6393058741). Link the verification PR in follow-up notifications. No production files were changed and no named human owner is invented.

Retest the accepted student changes on their own exact SHA, then rerun the integrated candidate independently. A passing unit test, historical model call or PR113 intention is not evidence that either defect is fixed. Preserve these failures and link the later passing run instead of rewriting this record.

## A11Y-01 — Browser Back restores list scroll but loses originating focus

**Post-submission keyboard-navigation improvement.** Observed independently on main `723ed6fea41138b604a9d333ebcd4a07b2202c36` and PR118 `d2dca515b1a926daf28e791044fe04d01bdf20a9`; not a controlled PR116 comparison. Owner: shared navigation / teacher evidence, coordinated through #114/#35. PR118's changed Lessons files do not own this inherited navigation path.

At measured native 200% zoom, sign in as Demo teacher with Tab/Enter, open the navigation drawer, choose Learning insights, Tab to Inspect session for `129120b0-f584-41f0-8e58-c3e190941799`, press Enter, then use browser Back. The list restores scrollY 2090.5 px, but focus becomes BODY instead of the initiating Inspect session link. Forward returns to the expected session route.

PR118 independently reproduced the same behavior from session `672fb0ec-1a04-4fef-805a-16c95843b2c8`: scroll restored to 1606 px, focus became BODY, and Forward returned to the correct session. See [PR118 results](PR118_REPORT.md).

No subsequent Tab-order or screen-reader claim is made. See [the exact method, measurements and limitations](ACCESSIBILITY_REPORT.md). This is an observed focus-restoration gap, not a claim of general keyboard failure or data loss.

## Environment blocker and unresolved observations

The combined PostgreSQL WAL/Docker failure is an [environment acceptance blocker](COMBINED_REPORT.md), not a diagnosed production code defect. No combined browser checks ran.

PR117's restored-textarea locator failure and subsequent login timeout remain incomplete browser observations. The first screenshot visibly contains restored local text; exact whitespace and accessible-name assertions did not complete. The second attempt never reached a new assignment write. Their causes are not confirmed and neither is promoted to an application defect. See [PR117's retained attempts and required retest](PR117_REPORT.md).
