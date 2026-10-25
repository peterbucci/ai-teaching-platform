# Intervention workspace component verification

**Result: 15/15 browser scenarios passed, with zero observed browser errors across all scenarios, including both native-zoom pages, and zero paid model calls.**

Application source: `b0608f6c69f47c48ed85876a992ccc3011bd2a66`.
The complete final run is recorded in [component-report.json](component-report.json).
[component-source-manifest.json](component-source-manifest.json) records the SHA-256
of each principal application component/style used in the browser bundle.

This report verifies the real composed `InterventionWorkspace`, its editor and
evidence presentation, and the shared teacher shell/panes. It is a component
browser test with explicitly synthetic API responses and mocked Next navigation
hooks. It is separate from production build, database and integrated browser
acceptance.

## Executed cases

| Scenario                            | Observed result                                                                                                                                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 320px three-pane retention          | Evidence, Activity and Steps are all reachable. Edited title and selected recipient survive pane and Activity-view changes. Request count stays unchanged and no mutation occurs.                                                                                       |
| 390px three-pane retention          | The same state-preservation and request-count checks pass at 390px.                                                                                                                                                                                                     |
| Save from Steps                     | Native form-associated Save submits exactly one synthetic save with the original expected revision; the returned private revision appears in the workspace.                                                                                                             |
| Invalid hidden Activity field       | Saving an empty required title from Steps reveals Activity and the unfinished field. No save request occurs.                                                                                                                                                            |
| Lost save response                  | The fixture records a save then loses its response. Pane browsing adds no write; the explicit retry reuses the exact original request payload/identity. The fixture records one completed save. This checks client replay behavior, not database idempotency.           |
| Stale revision conflict             | A synthetic 409 preserves local text. Refresh is a GET, the newer revision does not replace the local edit, saving remains blocked, and explicit discard makes no additional write.                                                                                     |
| Evidence anchor from Steps          | A recipient suggestion opens and focuses the exact saved response. Its new history entry receives a distinct shell token while retaining Next's marker. Native Back restores the original token, URL, link focus and Steps scroll position (748px). No mutation occurs. |
| 320px keyboard tabs                 | ArrowRight/Enter selects Steps, Home/Space selects Evidence, and End moves focus to Steps.                                                                                                                                                                              |
| 1024px contextual Steps pane        | Steps opens as a native modal. Escape closes it and returns focus to its opener. Selected recipient state survives reopening.                                                                                                                                           |
| 1024px Steps to saved evidence      | Inspect saved evidence closes the modal and focuses the exact Evidence heading. Both pointer opening and a programmatic opening that retains prior Activity-input focus preserve the edited title, with no extra requests or writes.                                    |
| Unsaved navigation and reload       | A shared shell link is blocked while text is dirty, actionable feedback is revealed, and actual page reload restores the actor/draft-scoped local text without a write.                                                                                                 |
| Preparation and pending generation  | Teaching direction survives pane changes and actual reload. A pending generation is resumed with a GET; pane changes do not repeat it or start a provider call.                                                                                                         |
| Hash, pane history and reload       | After inspecting an exact response and switching to Activity, reload respects the selected pane while retaining the evidence hash. Back/Forward restores Activity/Steps without forcing Evidence or writing.                                                            |
| Completed generation reconciliation | An explicit status GET returns a synthetic completed draft. Its canonical draft identity is retained, the pending request parameter is removed, and Activity is selected without a new generation.                                                                      |
| Native 200% browser zoom            | Browser-level zoom doubles device pixel ratio and halves the CSS viewport at the same physical window size. All three panes remain reachable, with no horizontal overflow or mutation.                                                                                  |

The synthetic endpoint permits read operations and explicit private-draft save
only. It does not emulate approval or delivery. Those lifecycle operations and
their actual service/database authorization remain the responsibility of the
integrated verification report.

## Native zoom evidence

Two separate temporary Edge profiles were launched with `viewport: null` and
`--window-size=1440,1000`. Their native `Default/Preferences` file set
`partition.default_zoom_level.x` and `.0` to `log(zoom) / log(1.2)`.
No CSS `zoom`, transform, device-scale emulation or pinch zoom was used.

| Measurement            | 100%        | 200%        |
| ---------------------- | ----------- | ----------- |
| Outer browser window   | 1440 × 1000 | 1440 × 1000 |
| CSS viewport           | 1416 × 908  | 708 × 454   |
| Device pixel ratio     | 1           | 2           |
| `visualViewport.scale` | 1           | 1           |
| Root computed CSS zoom | 1           | 1           |
| Document scroll width  | 1416        | 708         |
| Shared pane layout     | Wide        | Compact     |

[Native zoom screenshot](component-native200-real-components.png).
The receipt contains the assertions and measurements, not merely the requested
zoom setting.

## Fixture and authority boundary

[component-fixture.json](component-fixture.json) is the review-only subset of the
previous PR #116 synthetic component fixture. It contains one fictional teacher
actor, 24 eligible fictional recipients, 32 original observations from 17
distinct fictional students, and three approved networking source passages for
Transmission delay. All observation origins and the selected origin are
`synthetic_fixture`; the fixture explicitly records `fictional_only: true` and
`paid_calls: 0`.

A focused inspection found no private-key blocks, OpenAI-key patterns,
GitHub-token patterns, or password/access-token/refresh-token/API-key/secret/cookie
fields. The fixture contains no authentication credentials or real student
records. This is a bounded fixture inspection, not a repository-wide security
certification.

The harness validates its initial review and allowed save request using the
application's Zod schemas. Its API implementation is deliberately small and
synthetic: it supplies GET snapshots, a saved revision, an injected 409, or a
lost response after the synthetic save. It does not reproduce the domain
services, authorization, grounding, persistence, rate limits or provider
execution. Next's URL hooks and Link are adapters around native browser history;
the shared pane, shell, navigation restoration and editor components are the
actual source files. The adapter models the installed Next 16.4.3 history
boundary: writes carrying `__NA`/`_N` bypass hook synchronization, external URL
writes copy Next's private markers, and metadata-only writes do not notify.
Hooks read stored router snapshots rather than the live browser URL. The
snapshot context publishes inside React `startTransition`, matching the installed
Next `sequential-router-queue.restore` boundary. Urgent local state can therefore
commit before the pane URL update, exercising focus requests made while a tablet
dialog still makes the target inert. This catches accidental forwarding of
internal state and premature focus completion but does not reproduce the full
router or replace actual Next integration verification.

No model/provider request was made. The harness replaces `fetch`, rejects
external origins and non-allowlisted API paths, and uses a temporary loopback
HTTP server for its page and bundle. It requires no database or provider
credentials. Synthetic completion of a generation status read is not an AI
generation or evidence of agentic behavior.

## Reproduction

Tested dependencies: Node 22.13.0, React/ReactDOM 19.3.0,
Next 16.4.3 (its bundled Webpack), TypeScript 6.0.3, Playwright 1.62.1 and Edge
156.0.4314.42. The project `node_modules` must already be available. This harness
adds no package dependency or production route.

From the isolated checkout, run in PowerShell:

```powershell
Set-Location 'C:/Users/sb128/.codex/worktrees/v22-intervention-workspace/LearningPlatform'
$env:COMPONENT_BUILD_DIR = 'C:/Users/sb128/.codex/visualizations/2026/10/25/01a17320-9237-72d1-ae74-b3b08bc97dae/intervention-component-build'
$env:COMPONENT_SOURCE_COMMIT = 'b0608f6c69f47c48ed85876a992ccc3011bd2a66'
$env:PLAYWRIGHT_MODULE = 'C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:BROWSER_EXECUTABLE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node tests/artifacts/intervention-workspace/component-build.mjs
node tests/artifacts/intervention-workspace/component-browser.mjs
```

On the shared verification host these commands ran under the unchanged private
`intervention-verification/safety.mjs` guard, with a 20GiB build gate and a 10GiB
browser gate, `dockerRequired: false`, and an exclusive owned lease. Both gates
measured more than 42GiB available. The [guard receipt](component-guarded-receipt.json)
records the safety-module hash, command outcomes, preserved prior artifacts and
release of this run's own lease. The exact guarded invocation was:

```powershell
node C:/Users/sb128/.codex/visualizations/2026/10/25/01a17320-9237-72d1-ae74-b3b08bc97dae/intervention-verification/component-guarded.mjs C:/Users/sb128/.codex/worktrees/v22-intervention-workspace/LearningPlatform b0608f6c69f47c48ed85876a992ccc3011bd2a66 C:/Users/sb128/.codex/visualizations/2026/10/25/01a17320-9237-72d1-ae74-b3b08bc97dae/intervention-component-finalb060-run01 C:/Users/sb128/.codex/visualizations/2026/10/25/01a17320-9237-72d1-ae74-b3b08bc97dae/intervention-component-build
```

For a rerun, use a fresh receipt directory and coordinate the shared lease first.
The wrapper asserts the pinned HEAD and clean application source before running.

Adjust the checkout, output and installed dependency paths on another machine.
Without `COMPONENT_BUILD_DIR`, the scripts use an operating-system temporary
directory. The build rejects an output directory inside the application checkout.
The browser runner creates fresh private profile directories beneath that output
directory for native zoom. Its other cases use fresh isolated browser contexts.
It closes the browser and temporary HTTP server at completion.

The generated bundle and private browser profiles are excluded from the source
checkout and are not deliverables. The original bundle/profiles were preserved
under the task's private `intervention-component-build/pre4882-original` directory
when the harness was moved outside the application build context. The source
`.setup` directory was confirmed absent afterward.

The browser script writes the current report and component screenshots in this
artifact directory. A complete rerun overwrites those current outputs; retain a
copy first if comparing executions. `COMPONENT_CASE` can select a case-name
substring for a bounded rerun; that mode writes `component-report-recovery.json`.

## Preserved verifier history

The initial run passed ten cases and failed the preparation reload locator.
React had restored the textarea text, as the
[failure screenshot](component-390-preparation-direction-recovery-and-generation-read-only-failed.png)
shows. That initial text became part of the wrapping label's searchable text,
so an exact label match no longer found the textarea. The test changed to a
label-prefix match. No application change or assertion weakening was needed.
The isolated correction passed, followed by complete 14-case runs before the
tablet focus regression was added.

Preserved evidence:

- [Initial report](component-report-initial.json) and its [original bytes](component-report-initial.json.raw.txt).
- [Bounded correction report](component-report-recovery.json) and its [original bytes](component-report-recovery.json.raw.txt).
- [Earlier expanded run](component-report-pre4882.raw.txt) and [its source manifest](component-source-manifest-pre4882.raw.txt).
- [4882 run](component-report-4882.raw.txt) and [its source manifest](component-source-manifest-4882.raw.txt), retained before strengthening the Next/history checks.
- Historical 5f2d [raw report](component-report-5f2d.raw.txt), [raw source manifest](component-source-manifest-5f2d.raw.txt) and [raw guard receipt](component-guarded-receipt.raw.txt).
- Final b060 [raw report](component-report-b060.raw.txt), [raw source manifest](component-source-manifest-b060.raw.txt) and [raw guard receipt](component-guarded-receipt-b060.raw.txt).
- [Original receipt SHA-256 values](component-original-receipts.json).

The guard also preserved every previous component screenshot byte-for-byte under
its private `prior-artifacts` directory before overwriting current outputs; paths
and hashes are in the guard receipt. The strengthened final run passed all 15
cases on the first execution. The component scripts had passed ESLint before
the final history additions; the complete final static checks are reported by
the integrated verification.

A subsequent verifier review found that the earlier runs did not attach browser
error listeners to the separate native-zoom pages. Their zero-error observation
therefore covers the standard contexts only, while zoom assertions still ran.
The final 15-case b060 run adds those listeners before both zoom-page navigations
and observed no errors in either zoom profile or any standard context. The
earlier receipts remain unchanged; their broader wording is qualified here.

## Screenshot limitations

The harness loads the actual application CSS through a small component-test
loader, but does not run the production Tailwind compilation/reset pipeline.
It uses a minimal test reset and injected display metadata rather than the full
server-rendered page and loader context. Its screenshots show component
visibility, focus/state checks and native zoom; their typography, control
styling and spacing do **not** establish production visual fidelity or V09
acceptance. Compare the actual production application and actual exported
prototype in the separate integrated visual report.

Screen-reader behavior, physical touch/keyboard behavior, production server
navigation, real authentication expiry, actual database recovery, authorization,
approval/delivery/follow-up services, and model behavior are outside this suite.
