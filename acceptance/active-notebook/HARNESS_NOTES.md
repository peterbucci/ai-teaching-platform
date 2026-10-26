# S1 acceptance harness notes

These scripts exercise an isolated authenticated application with fictional records. Provider credentials are empty. Authored evaluations and help are acceptance fixtures, not model judgments. Private configuration and browser profiles remain in ignored `.setup/`; they must not be committed.

## Reuse and scope

- `operators-host.mjs` adapts only host paths, database guards and disposable fixture locations around the original #113 operators. The original operator and browser-helper hashes are pinned in `run-recovery.mjs`.
- `run-recovery.mjs`, `journey.mjs` and `reader-mounted.mjs` reuse N7's host harness with S1 isolation bindings. Original #113 assertions have not been weakened.
- `fixtures.mjs` calls existing authorized services. Generated-help cases use `scripts/fixtures/approved-r7-lesson.ts`, which publishes and activates a separate fictional lesson through the normal authoring services. The curated lesson's runtime policy is unchanged. The helper requires an accepted help result before a display test can start.
- `panes.mjs` covers actual display, pending identities, failed and unknown receipts, focus, draft restoration, natural paper scroll, prior/current selection and stale reading snapshots.
- `visual.mjs` compares first question and corrected help at exact viewport sizes and native browser zoom. Authored help wording, fictional metadata and approved lesson identities differ from the prototype. Outcome screenshots remain separate because no directly equivalent named prototype scenario exists for every accepted outcome.

## Preserved earlier runs and corrections

These are diagnostic records, not passing final-candidate evidence.

| Run                                              | Observation                                                                                                                                   | Harness correction / interpretation                                                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseline-1792957758380`                         | Old N7 first-question structure at four viewport settings. Some full-page captures exceed named viewport height and include a transient wait. | Historical baseline only. Final capture uses exact viewport bounds and settled state.                                                                                |
| `panes-1792958137387`                            | Immediate draft comparison ran before asynchronous restoration settled.                                                                       | Await exact restored text, retaining the exact text assertion.                                                                                                       |
| `panes-1792958178219` and `visual-1792958195274` | Live application edits/HMR changed source fingerprints; visual load saw a missing chunk.                                                      | Invalidated as final evidence. Stop development runtime and use frozen production candidate.                                                                         |
| `panes-1792959212006`                            | Retry control hid before its receipt was persisted.                                                                                           | Await persisted display state before identity/count assertions.                                                                                                      |
| `panes-1792959249743`                            | Unknown-response case checked request count before the scheduled acknowledgment completed.                                                    | Await the reader's acknowledged state.                                                                                                                               |
| `panes-1792959289369`                            | After retry, the reading body was below the viewport; the reader correctly withheld acknowledgment.                                           | Explicitly expose the body again. Hidden automatic acknowledgment is not expected. Screenshot retained.                                                              |
| `panes-1792959352696`                            | Curated lesson correctly rejected authored generated help under its disabled runtime-generation policy.                                       | Use a separately approved runtime lesson via existing fixture services; require accepted help. Do not alter curated policy.                                          |
| `panes-1792959462129`                            | Test assumed a normal-answer Refresh control that the existing presentation did not expose.                                                   | Reach refresh through genuine reading-recovery state. Select the prior page explicitly before displaying its feedback. First five compound cases passed in this run. |

The strong stale-snapshot cases submit through the existing one-composer fallback and explicit answer confirmation. Reading-recovery tests deliberately separate request completion from genuine passage exposure. A failed run does not prove a production defect until its setup and observed application state have been checked.

## Local execution

Use the private isolated runtime launcher after configuring its own fictional credentials and manifest. Never copy an unrelated key-bearing environment file.

```text
S1_RUNTIME=production node .setup/runtime/run.cjs acceptance/active-notebook/panes.mjs
node .setup/runtime/run.cjs acceptance/active-notebook/run-recovery.mjs --production
S1_RUNTIME=production node .setup/runtime/run.cjs acceptance/active-notebook/services.mjs
S1_RUNTIME=production node .setup/runtime/run.cjs acceptance/active-notebook/journey.mjs
S1_RUNTIME=production node .setup/runtime/run.cjs acceptance/active-notebook/reader-mounted.mjs
S1_RUNTIME=production node .setup/runtime/run.cjs acceptance/active-notebook/visual.mjs
```

Set environment variables using the host shell's syntax. Run login-heavy suites sequentially; do not disable the real sign-in limiter. Keep source SHA, build ID and source fingerprints with each final evidence set.

## Later production setup corrections

- `panes-1792959813782`: the question anchor exists in both the Pages rail and the folded-page strip. All four historical-page interactions now select within the Pages rail explicitly.
- `panes-1792959846183`: hidden-composer DOM check incorrectly expected an `aria-label` attribute. The real composer uses an associated label. Owned hidden-DOM and settle checks now use its stable `tutor-message-` ID; accessible-name checks remain.
- `panes-1792959934167`: all 11 compound pane checks passed on production `1810d48`, including both late-snapshot-after-original-save variants. This is valid evidence for that source; the later CSS candidate requires another run.
- `visual-1792959982477`: exact-size captures and native zoom mechanics passed on `1810d48`. Independent inspection found the help application/reference scroll positions differed; final help capture explicitly aligns the student-help event below the fixed header. The original gallery is retained.
- `recovery-2026-10-25T20-27-08-530Z`: original correct-result assertions passed at four widths. The next fixture's earlier feedback page was folded, so the original helper could not scroll its hidden feedback. The S1 host now supplies the existing `#question-<related_attempt_id>` presentation URL to the unchanged helper. It changes no saved identity, outcome, helper assertion, or operator hash.

- `recovery-2026-10-25T20-32-21-933Z`: the selected-question URL changed only its hash after an operator advanced the session outside the browser. That was same-document navigation and retained the previous server view. The host now visits `about:blank` before the unchanged helper performs its normal full URL load, and before completed-result capture. No controller or assertion changes.
- `recovery-2026-10-25T20-34-45-109Z`: all four outcome matrices at four widths and all six original #113 recovery cases passed on `26ce188`; source tree SHA-256 `3439631ae2fb76def0c8070c07c7e3dfe77490d80595fe86209df5ce800b825c`. This is valid evidence for that source.
- `panes-1792960249442`: all 12 compound checks passed on `26ce188`, including single-row phone suggestions and keyboard reveal of the final suggestion.
- `visual-1792960290304`: corrected first/help captures and native zoom passed mechanically on `26ce188`. The shorter application document can clamp desktop help scrolling before the same top offset as the prototype; later canonical capture records actual event position, requested offset and maximum scroll. No artificial page padding is added to force alignment.

## Supplemental interaction assertions

- S1 host recovery adds an explicit completed-session restart check after the unchanged correct-result helper. It uses the existing Start new session action, verifies a new active session with one unanswered question, compares the entire prior teacher evidence view, and permits exactly one restart POST with no answer/evaluation writes. This is reported separately from the six original #113 recovery cases.
- Final pane coverage adds keyboard Enter on a folded earlier page and return to current with exact draft preservation.
- Final native 200% capture adds a real draft / Reading summary / Escape interaction and requires zero writes. Final help geometry records scroll clamping instead of modifying page content for screenshots.

- Final-run preparation: a Python write using the Windows default encoding truncated only the untracked `panes.mjs` when a new Unicode fixture was added. The file was restored from this task's original source-write command and every ordered later harness transformation in local history, then the new disclosure assertion was added using explicit UTF-8. Syntax and ESLint checks passed. Application files and prior evidence were unaffected; no run is claimed for the truncated file.
- Final panes additionally verify honest header draft status, composer Open the reading with zero writes, and accepted help arriving beneath the question disclosure with no display acknowledgment or focus theft until explicit return and actual exposure.

- `visual-1792961585688`: real sign-in limiter returned HTTP 429 immediately after the service/pane suites, before any visual capture. Preserved as setup failure and waited the normal 60-second window. No rate-limit configuration changes; canonical gallery uses a fresh run directory.

## b3609dd integrated checkpoint

- `services-1792961398293`: all five provider-disabled service regressions passed (tutoring, reading, synthetic dialogue, dialogue recovery, R7 controller), source unchanged.
- `panes-1792961551733`: all 13 compound cases passed, including explicit question-disclosure gating for delayed help, honest tab draft status, composer reading-summary zero writes and folded-leaf keyboard return.
- `visual-1792961665732`: all 11 pairs captured; true native 200% zoom and draft/Reading/Escape interaction passed, source unchanged. Independent review found desktop help's event moved after the earlier scroll (event top 166.53, requested 70, document not clamped). The next capture aligns only after layout settles, then makes one measured correction. This supersedes the earlier clamping hypothesis for this run.
- `facing-layouts-1792961694795`: integration failures preserved at all four widths. At 1440/1024 the nested reader retained its wide-screen contents column, compressing the passage and leaving actual body exposure unachieved; zero receipt was correct. At 390/320 actual reading and receipt identity passed, but reader return reset document scroll from 160 to 0. These require application review, not weaker test assertions. The owned app was stopped before repair; prior receipts retain their source identity.

- `facing-layouts-1792962130669` on `8d4221a`: desktop 1440 and phones 390/320 passed every original assertion; tablet 1024 exposed and acknowledged correctly but its return scroll changed 160 to 144. `facing-diagnostic-1792962171678` preserved timed `scrollTo` traces: the shell restored 160, then the conversation owner's resize-follow callback moved to 143.84375 six milliseconds later. This is an application scroll-coordination defect; tolerance stays unchanged. Diagnostic instrumentation lives in a separate harness and does not modify the application.

## Final 273551b browser gate

- `facing-layouts-1792962391484`: all four original viewport cases passed with unchanged scroll tolerance. Actual passage delivery and one display receipt, draft/DOM identity, no answer writes, disclosure suppression/focus and mobile chip keyboard exposure passed.
- `panes-1792962406806`: all 13 compound pane/recovery cases passed with source unchanged.
- `visual-1792962439243`: canonical final 11-pair gallery; native 200% zoom and real draft/Reading/Escape interaction passed. Final help event position is 69.53 px against requested 70 at all four viewports and 70.03 px at native 200%, with no document clamping. Independent visual review approved all frames. Earlier galleries remain historical.

- `recovery-2026-10-25T21-07-56-597Z` on `273551b`: all four outcome matrices at four widths, supplemental restart, and original recovery R1–R4 passed. Cumulative real sign-in limits rejected R5/R6 fixture setup with HTTP429; those two are not passes. The host now supports `--recovery-only` to rerun all six unchanged recovery cases after the normal cooldown without repeating already-passing outcome capture. The source-bound outcome/restart receipt remains valid and separate; the limiter and all original helper assertions are unchanged.

- `recovery-2026-10-25T21-09-57-615Z`: all six unchanged original recovery cases passed after a full idle cooldown on `273551b`; source tree unchanged. Combined with the preceding same-source four-outcome/restart receipt, all recovery/outcome criteria passed.
- `mounted-reader-1792962635963`: all three standalone-reader cases passed on `273551b`, confirming the default path still withholds hidden receipts and retries the same delivery explicitly.
- `journey-1792962690440`: teacher fixture setup succeeded; the first student sign-in returned429, so student assertions did not start. Inspecting the installed limiter confirmed reset uses `now - lastRequest >= window`, so aging the oldest login is insufficient during repeated accepted logins. The retry waits a full idle window; no application configuration or limiter state is changed.

- `journey-1792962795814`: first nine journey checks passed. The inherited immediate assertion read the standalone reader's active attribute before the account-overlay visibility update settled; the failure screenshot already showed it hidden. The host now waits, with the same bounded timeout, for the exact inactive state before its unchanged assertion. Both account and mobile-menu checks use this synchronization; dedicated zero-hidden-receipt checks remain separate and passed.
- `journey-1792962848049`: all 13 journey checks passed on `273551b`, errors empty and source unchanged. This includes single-composer help/ambiguity fallback, exact original Unicode/whitespace save, accepted synthetic evaluation, saved records, browser history, reading return, teacher-approved review draft/save and cross-student denial.

All final browser checks use production source `273551bb48287dd38843256d22c26b4bc8f449fd`, build `kzvgmL197lNEtYn7qD7Kk`. The five service checks remain bound to `b3609dd`; subsequent application-only presentation/scroll changes did not alter their backend, provider or script source. Synthetic acceptance does not establish actual-model behavior. Private access details stay in ignored `.setup/runtime/REVIEW_ACCESS.txt`; the local runtime is left running for review.
