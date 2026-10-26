# PR #118 independent Lessons acceptance

**Result: the tested provider-disabled Lessons component journey passed.** No new application defect was found in this bounded authoring-to-assignment path. This is a separate result for [PR #118](https://github.com/peterbucci/ai-teaching-platform/pull/118); it does not certify current main, PR #116, PR #117, a combined branch, a hosted release, or real-model behavior. The PR author's verification claims were used to identify scope, not counted as independent passes.

## Exact target and environment

| Item                     | Recorded value                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Source                   | `d2dca515b1a926daf28e791044fe04d01bdf20a9`                                                                      |
| Managed worktree         | `C:/Users/sb128/.codex/worktrees/acceptance-pr118/LearningPlatform`                                             |
| Final tested app image   | `sha256:df285087507c4477136ca463137bcdf65d04b31976d3eb68497bb30dba0833cf`                                       |
| Compose project / origin | `lp-accept-pr118` / `http://localhost:3324`                                                                     |
| Database                 | Fresh project-owned PostgreSQL 17.11 volume; fictional accounts and synthetic fixtures; no host database port   |
| Network                  | Separate internal `10.233.118.0/24` app/database network; only the gateway also joins `lp-accept-main_browser`  |
| Providers                | Model key/model blank; external app network access unavailable; synthetic dialogue explicitly enabled           |
| Host / Node              | Windows x64 / Node 22.13.0; production Linux Docker image                                                       |
| Browser authoring run    | 2026-10-25 03:49:50.095–03:50:05.832 UTC                                                                        |
| Native zoom/keyboard run | 2026-10-25 03:50:22.961–03:50:30.197 UTC                                                                        |
| Source protection        | Production checkout remained clean after all checks; all new scripts/docs are in the separate acceptance branch |

Manifest, command logs, configuration overrides, and exact image identities are retained in `.setup/acceptance-pr118`. No model-provider request was made and no paid tests were authorized.

## Independent automated results

| Check                                       | Result                                                 | Evidence distinction                                                                               |
| ------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Repository `npm test`                       | **466 passed, 0 failed**                               | Deterministic repository fixtures                                                                  |
| Four focused authoring test files           | **17 passed, 0 failed**                                | Executed separately because the normal npm test glob excludes them                                 |
| Lint / typecheck / format check             | Pass                                                   | Exact PR source                                                                                    |
| Local production build                      | Pass                                                   | Exact PR source                                                                                    |
| Docker production build and runtime startup | Pass after documented network configuration correction | Final image above                                                                                  |
| Curated content package                     | **293 checks passed**                                  | Content validation                                                                                 |
| `materials:check`                           | Pass                                                   | Actual importer/database/HTTP; includes supported and invalid PDF cases                            |
| `objectives:check`                          | Pass                                                   | Synthetic provider proposals plus real ownership/revision/grounding persistence                    |
| `questions:check`                           | Pass                                                   | Injected provider results plus real bank validation/persistence                                    |
| `lessons:check`                             | Pass                                                   | Actual lesson service/database boundaries                                                          |
| `lessons:uncertainty:check`                 | Pass                                                   | Existing synthetic uncertainty regression fixture                                                  |
| `publishing:check`                          | Pass                                                   | Existing synthetic publication fixture and immutable version rules                                 |
| `publishing:http:check`                     | Pass                                                   | Actual HTTP publication/assignment authorization checks                                            |
| `assignments:check`                         | Pass                                                   | Actual ownership, enrollment, activation, version and history boundaries                           |
| `reading:check`                             | Pass                                                   | Exact authorized reading resolver path                                                             |
| `tutor:check`                               | Pass                                                   | Actual persistence/authorization and injected evaluation recovery, including its existing cooldown |

The four additional test files are `app/teacher/materials/import-draft.test.ts` (4), `app/teacher/objectives/draft-recovery.test.ts` (4), `app/teacher/lessons/authoring-state.test.ts` (5), and `app/teacher/lessons/[lessonId]/questions/workbench-state.test.ts` (4). Each was invoked with `node --experimental-strip-types --conditions=react-server <file>`; individual commands, timestamps and logs are retained under `focused-authoring-tests/`.

## Manual authoring → assignment → student journey

`authoring-workbench-browser.mjs` repeats the original main/PR #116 synthetic evaporation fixture, adapting only the staged UI controls. All application writes were manual UI actions in the fictional database. Generation controls were never used.

| Step                                                                                                    | Result                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Paste permitted original material; preview and compare exact extraction                                 | Pass                                                                                                                            |
| Review attribution/permission; save private source version 1                                            | Pass                                                                                                                            |
| Follow exact-version objective handoff; manually author, ground, save and approve objective             | Pass, revision 3                                                                                                                |
| Manually author initial/alternative/diagnostic/retest questions with private criteria and source quotes | Pass                                                                                                                            |
| Save bank; inspect student preview; review and approve all four questions                               | Pass, revisions 4 and 5; private answer and criterion absent from preview                                                       |
| Prepare tutoring sequence                                                                               | Pass, revision 6                                                                                                                |
| Review and explicitly approve lesson; navigate separately to publication                                | Pass                                                                                                                            |
| Explicitly publish immutable version 1                                                                  | Pass; returned source ID, source version and lesson content version asserted                                                    |
| Select the owned fictional demo class; create inactive assignment                                       | Pass                                                                                                                            |
| Enrolled student checks assignment list before activation                                               | Pass: new assignment absent                                                                                                     |
| Teacher reviews and separately activates assignment                                                     | Pass                                                                                                                            |
| Enrolled student opens exact assignment and approved reading                                            | Pass; original source text retained                                                                                             |
| Student opens first question with one composer                                                          | Pass; public session API excludes private answer and criterion                                                                  |
| Start successor lesson draft version 2                                                                  | Pass, revision 7; fresh review required                                                                                         |
| Reopen original student session and version 1 reading                                                   | Pass; public session/presented attempt exactly equal before/after successor creation; published version 1 remains source-pinned |

No answer was submitted in this browser journey. Its preservation assertion covers a **presented attempt**, not a previously submitted and evaluated answer. The separate service suites exercise their own historical answer/version fixtures.

| Fixture identity              | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| Run label                     | `Manual authoring pr118 1792900190095`                             |
| Source ID / version           | `2f7e9cb9-4bb1-483a-ba69-a3ad71715e30` / 1                         |
| Original document SHA-256     | `d1048e7be31909142dfbb28e54e0c2b7657a6d04f5eeeafaebb139f3056af2b6` |
| Lesson ID / published version | `f73f0e83-1e4e-4d75-97b7-16c23a7bed4f` / 1                         |
| Assignment ID                 | `d9e98b7e-1dc6-43c2-b170-6f32fec10cd2`                             |
| Class ID                      | `20000000-0000-4000-8000-000000000001`                             |
| Student session ID            | `f462e6f4-7ac1-4b9b-82b2-53796cfda2b5`                             |
| Presented attempt ID          | `748567cd-b4e0-49f5-82d3-ac0df4655d3a`                             |

## Responsive and accessibility evidence

The authoring run captured **40 viewport measurements**: nine actual teacher stages and student reading, each at **1440 × 900, 1024 × 768, 390 × 844 and 320 × 844**. All had `document.documentElement.scrollWidth <= innerWidth`. There are **53 screenshots**, including ordinary journey captures and those width variants. Representative 320px question-bank review and 390px objective views were visually inspected and their text/forms were contained. This does not establish every hidden editor panel or every long response state.

Native 200% zoom was measured independently on this target using the fresh Edge profile method in `ACCESSIBILITY_REPORT.md`: fixed 1440 × 900 outer window, DPR **1 → 2**, CSS viewport **1416 × 808 → 708 × 404**, while CSS zoom and visual-viewport scale both remained 1. All visited pages had no document-level overflow. Direct browser surface screenshots preserve the real native-zoom viewport.

Tab/Enter reached teacher login, navigation, Learning insights and an original session; student assignment details, reading, study session and composer were also reachable. The exact unsent test message was typed and cleared without submission. Reached controls had a green 3px focus outline. Browser Back/Forward were history API operations, separately recorded rather than counted as keyboard shortcuts.

**A11Y-01 reproduced in inherited teacher navigation:** Back from synthetic session `672fb0ec-1a04-4fef-805a-16c95843b2c8` restored list scroll to 1606px but active focus became BODY. Forward reached the correct session. This matches the main observation and belongs to shared navigation/teacher evidence (#114/#35), outside PR #118's changed files. It is a post-submission focus-restoration improvement unless the release owner applies a stricter gate. No repair was made.

Screen-reader operation, comprehensive WCAG compliance, full keyboard-only authoring/intervention editing, saved-intervention keyboard review, nested reading scroll restoration, and all-page focus recovery remain **unrun**. The authoring report's original zoom/keyboard unrun entry is supplemented by the separate accessibility run; it is not silently changed. The shared accessibility harness's generic final limitation mentions PR #116 Forward; this target's actual Forward result is separately present and passed as recorded above.

## Retained harness/environment failures

1. The first Docker image compiled, but startup failed because Docker's default address pools were exhausted. Its original build/log remains under `runs/2026-10-25T03-41-19-089Z-build`. An unused explicit internal subnet was checked and applied to this test environment only; prior compose/manifest were preserved under `configuration-overrides/`. No existing network was deleted. The subsequent successful build uses the final image recorded above.
2. The formerly shared browser bridge on localhost:9337 was no longer running. Connection failed before any browser context or app interaction. `browser-launch-environment.json` records this; the acceptance harness gained an optional `BROWSER_EXECUTABLE` launch path and used its own headless Edge instance. The following full browser journey passed without a selector retry or production change.

Neither event is an application failure. No application failure was silently repaired.

## Reproduction and evidence

Use `acceptance/runner.mjs` with target `pr118`, exact source/SHA above and state `C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-pr118`. Fresh initialization on a host with exhausted default pools can use `--browser-network lp-accept-main_browser --internal-subnet 10.233.118.0/24` only after verifying that bridge exists and the subnet is unused. Keep each target on its own database/network. Run `quality`, `build`, then `integration --only <suite>` for the ten named service suites. Reset the disposable app process with `restart` before browser verification to isolate the existing authentication limiter.

```powershell
$env:BROWSER_EXECUTABLE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
$env:ACCEPTANCE_AUTHORING_OUT = "C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-pr118/browser-authoring-$(Get-Date -Format yyyyMMdd-HHmmss)"
node acceptance/authoring-workbench-browser.mjs `
  C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-pr118 `
  C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-browser-endpoint.txt `
  C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright
```

The browser script is parameterized by the state manifest and can be reused for a separately identified combined target. It refuses an existing report, non-loopback origin, paid authorization or configured model values. `browser-authoring/report.json`, `api-evidence.json`, and PNGs are the completed run's artifacts. `browser-accessibility/report.json` and PNGs are the separate native-zoom/keyboard artifacts. **Never collect browser `profile-*` directories, cookies, storage, or `.env.acceptance`.**

## Merge readiness and release protection

**Component assessment: acceptable for combined integration review on this exact SHA.** The verified manual authoring path, immutable publication/assignment handoff, service boundaries and requested viewport samples pass. No new blocker was found in that bounded component scope.

**Combined and final-release readiness remain separate gates.** PR #118 does not contain PR #116's shared shell or PR #117's assignment redesign. Their composed navigation/context and handoffs need their own exact-build browser acceptance before merge readiness can be claimed for the application as a whole. The current main fallback was preserved; no branch was merged or production code edited.

Unrun or later work includes browser file-upload variants (service importer checks passed), full reload/two-tab UI recovery, multi-concept and multi-family browser authoring, broad empty/unavailable library states, full assistive technology testing, hosted release verification, and fresh actual-model instructional quality. Synthetic provider/service fixtures and manually authored content are not evidence of live generation or the hackathon's real agentic decision cycle. No new paid tests are authorized by this report.
