# Independent acceptance handoff — teacher Workbench integration

Draft [PR #142](https://github.com/peterbucci/ai-teaching-platform/pull/142) is an integration candidate. Acceptance must be performed by a reviewer who did not author this integration or its conflict resolutions. CI, the integration team's checks, screenshots, and this handoff do not establish independent acceptance. Record a separate verdict and ranked defects; do not merge or deploy as part of this review.

**Pin the application, not the moving PR head.** Application commit: `c26664e49b7cc15fa7c63828f5c582c9b8cac2d8`; tree: `333b73e1cae1daddf6edd61300655d0b4825ed67`. Baseline: `07efb7f821339538800f150f57b298eb2e606be3`. Later evidence-only commits must not become the application under test silently.

## Evidence and composition

Extract the published verification bundle into a new directory; below, `$v` means the directory containing `runner.mjs`. The publication's `MANIFEST.json` identifies exact archive/member hashes and any explicitly redacted derivatives. Preserve originals, failed receipts, and earlier acceptance evidence. `REPORT.md` supplies the integration team's final results; preparation/provenance files can retain an earlier `prepared` status and must not replace actual execution receipts.

Read `SOURCE_MATRIX.json`, `composition/composition.json`, `composition/REPORT.txt`, `review.txt`, `BROWSER_COMMANDS.txt`, `STRUCTURE_HANDOFF_COMMANDS.txt`, the four `VISUAL_*.md` reports, and `comparison-gallery.html`. Read raw case reports in `returns-*`, `navigation-*`, `evidence-*`, `hydration-*`, `r03-labels-*`, `structure-handoffs-*`, `new-intervention-*`, `application-01`, `prototype-01`, and packaged `runtime/` receipts. Check each case result; process exit or screenshot count alone is insufficient.

| Owner              | PR   | Exact source head                          | Integration order      |
| ------------------ | ---- | ------------------------------------------ | ---------------------- |
| K Navigation       | #139 | `e88e45acea1478d562a2fb3fd2ebb9caa5403ed8` | 1                      |
| I Interventions    | #136 | `83bba436ab148f9b2ddaa4de61d29b857458a138` | 2                      |
| J Lessons          | #135 | `c56d31d594d9eedb30b0313c2ab3f22ce65e94a7` | 3                      |
| F Overview         | #138 | `798f32438b1807d625e5c9b9ac9f0a5439dd5b41` | 4                      |
| H Concerns         | #137 | `afd91d6749129a77b88f020b2ac98201058cf082` | 5                      |
| G Roster           | #140 | `af4eec9c1df2e20658400881e94ff9dbbc7f012e` | 6                      |
| R03 student labels | #134 | `9b4f5e357146338e6d0b99dadc1a0104714ba406` | Exact cherry-pick only |

All six teacher heads must be ancestors of the application. The R03 source is deliberately not an ancestor: its patch is preserved by the final cherry-pick, with stable patch ID `5b7ab4f01d47d03287fe383ad7eaaab01b86684d`. Do not import the rest of #134 or N7.

Use a separate checkout containing all recorded commits. Confirm `git rev-parse HEAD` and `git rev-parse 'HEAD^{tree}'`. For object-only recomposition, copy `composition/audit.cjs` into a new reviewer output directory, then run `node <copied-audit.cjs> <absolute-repository-path>`. It writes only beside that copy, uses source objects read-only, and must reproduce the exact tree above. The receipt should show 302 source-union files, 30 production owner files matching their heads, no unexpected owner differences, and preserved baseline recovery/evidence scopes. It uses the two recorded resolved test blobs; it cannot independently prove those resolutions are correct.

Independently inspect both conflict resolutions: `scripts/check-lesson-uncertainty.ts` must preserve F's Overview/exact new evidence assertions and H's By idea/uncategorized provenance assertions; `scripts/check-metrics.ts` must preserve H's concept investigation and G's Roster → exact answer work-log assertions, ownership/privacy and source/version checks. Landing-page link expectations changed to follow the actual redesigned routes; evidence assertions must not have disappeared. Confirm K/I's identical shared drawer implementation occurs once, default `tabletDrawer="context"` remains, and I explicitly selects `navigation`. Check contextual return contracts from both G and H.

## Isolated rerun setup

Reuse PR #122's harness and PR #121's resource safeguards. The supplied harness is pinned to the integration team's project `lp-teacher-combined-01a174be` and origin `http://localhost:3449`; do not launch it unchanged against that project. In a separate copy of the verification bundle, allocate a new owned Docker project, unused port and nonoverlapping subnets. Review and record the corresponding runner and browser-wrapper identity changes together. Preserve exact application/tree checks, provider-disabled assertions, and the safety implementation/hash:

`af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485`

Keep fresh runtime state and outputs outside the application checkout. Supply an owner-verified Docker storage path and existing storage-probe container. Preflight requires 20 GiB for initialization/build/quality and 10 GiB for runtime. The shared per-user lock serializes builds, database work, browser work and logins; never nest guards, bypass a busy lock, or remove one without reconciling its owner/process. Do not alter another project's containers, credentials or volumes. Use fictional accounts only; provider keys/model remain blank. Keep private environment files, profiles and database dumps out of published evidence.

After the copied harness identities are reviewed, commands have this form (PowerShell; substitute real paths and selected storage values):

```powershell
$sha = 'c26664e49b7cc15fa7c63828f5c582c9b8cac2d8'
$common = @('--target', 'shell', '--source', $source, '--sha', $sha, '--state', $state)
node "$v/runner.mjs" init @common --docker-data-path $dockerStorage --storage-probe-container $probe --internal-subnet $internalSubnet --browser-subnet $browserSubnet
node "$v/runner.mjs" quality @common
node "$v/runner.mjs" build @common
node "$v/runner.mjs" integration @common --only metrics:check
node "$v/runner.mjs" integration @common --only lessons:uncertainty:check
node "$v/runner.mjs" integration @common --only patterns:check
```

Run sequentially and inspect receipts before the next stage. The quality mode includes tests, types, lint, format, build, authoring tests and content validation; `--only` can select a justified focused check. The build mode creates the application runtime. Select additional combined service checks from the final report's scope; do not repeat every owner's complete suite by default. Recheck intervention authorization/lifecycle, tutoring/recovery and persistence where combined evidence or a failure requires it.

## Fixture scope and browser review

The original lesson authoring, source publication, original answer and accepted evaluation were inherited from the explicitly cloned fictional baseline. They were not freshly authored/evaluated on this candidate. The lineage is in `journey-bundle/inherited-fixture.json` and clone receipts: assignment `382f0724-3800-4e6c-8a15-40b4813cb4ab`, original session `c619a811-af67-4aeb-9348-686fe439db98`, original attempt `ae652658-924b-485d-9a87-7281a7501099`, accepted evaluation `2531aac6-c71d-400a-948d-4bb29ac79535`, uploaded source `3243e3b8-0c5f-4669-a957-aefc27c279d8`, source/published version 1. R03 uses its separate exact saved attempt/evaluation specified in the browser runbook.

The public evidence bundle excludes the private database dump and actual prototype export. Arrange owner-controlled fixture access or create a separately documented fictional fixture; do not pretend an arbitrary replacement reproduces these exact record assertions. A new fixture requires reviewed descriptors/selectors and an explicit scope difference. Existing clone/reconciliation helpers are pinned to the original projects and receipts: do not replay them blindly.

Use `BROWSER_COMMANDS.txt` for focused authenticated navigation, returns, Evidence, hydration and R03 commands, and `STRUCTURE_HANDOFF_COMMANDS.txt` plus its revision provenance for current structure checks. Replace output names with fresh reviewer directories. Read preserved failed reports alongside later corrected or resumed runs.

| Finding | Required independent recheck                                                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01     | Roster → exact session/answer → displayed Back preserves student, assignment, search/concept and work-log origin.                                                 |
| R02     | By idea and populated Concern → exact original evidence → Back preserves investigation/concept/context; cover both paths.                                         |
| R03     | The same saved teacher/student record shows the human concept label, such as Evaporation, rather than the raw UUID.                                               |
| R04     | Whole-course Overview decision list, all-assignment rail, and real saved private lesson/intervention resume links work with exact records.                        |
| R05     | Roster concept trails and intervention state; selected student's Ideas, Work log and Summary, including cross-session evidence and meaningful assistance context. |
| R06     | Concerns lives in Student work / By idea, retains supporting and contrary/original context, and prepares the correct intervention preview without losing scope.   |
| R07     | Delivered intervention hydrates without React 418 or locale/timezone mismatch at all required sizes and native zoom.                                              |
| R08     | Mobile Lessons density, search, Details, saved revision and Continue are usable at 390, 320 and native 200%; test keyboard access.                                |
| R09     | Tablet intervention Activity/Steps and Evidence drawer, completed-stage mobile density, and actual draft/approval/delivery/follow-up states.                      |

Also retain prior functional Evidence navigation, source/version authority, privacy, original-response preservation and tutoring/recovery checks. Do not mark a finding resolved solely because a heading or screenshot exists.

## Connected lifecycle checkpoint

For a fresh reviewer run, use the runbook's new nonce-derived private draft from inherited accepted evidence, then review → edit/save → fictional recipient → approve → verify pre-delivery denial → separately deliver → student start/submit → teacher linked follow-up. Providers stay disabled: the first evaluation failure must honestly retain the answer. Only after normal `retry_after` eligibility may the documented synthetic evaluation seam verify accepted follow-up linkage; record it as synthetic, not model behavior.

The integration run's first browser continuation stopped after acknowledged teacher writes. Preserve `new-intervention-browser-01/report.json` and `RESUME_DELIVERED_PROVENANCE.json`; review the subsequent resume, evaluation and final inspection receipts rather than overwriting that failure. Before continuing any interrupted run, reconcile the exact draft, approval, delivery, session and attempt against saved records. Never repeat approval, delivery, start, submission or preparation to make a failed verifier green. A resumed helper must be narrowly reviewed against the actual checkpoint; existing receipt-pinned helpers are not general retry commands. The independent reviewer should verify before/after original evidence and distinguish newly executed transitions from inherited history.

## Actual prototype and final verdict

Use the approved Workbench v2.2 export, not a reconstruction. Recorded `Main.dc.html` SHA-256 is `c853369da1250adf24a741a38c3d94d3c97a976c012c352732cf4dd8d924cb54`; archive SHA-256 is `74bc909dffba839d6850823b35b8c8fc3c67adf1a64b14d67f245560fb87768f`. Inspect paired application/prototype images and the live controls at 1440×1000, 1024×768, 390×844, 320×844 and native browser 200% zoom. For the recorded zoom runs use the full `*-native200-cdp.png` surfaces and accompanying zoom metrics, not cropped ordinary captures or CSS zoom.

The nine captured states are Overview, Assignments, Lessons, Evidence, original response, Interventions, Roster, populated Concerns and selected Roster Work log. Judge information hierarchy, density, visible actions, pane behavior and functional destinations. Distinguish fixture differences (one concept versus five, different enrollment/activity and lifecycle states) from missing capability. The recorded Roster fixture has 27 enrolled students, not three; three is selected-student response activity. Review all ranked differences in `VISUAL_F_H.md`, `VISUAL_G.md`, `VISUAL_I_J.md` and `VISUAL_A_E.md`, including real structure/summary differences. Native200 and screenshots alone do not prove accessibility.

Report pass/fail/unrun per original finding and lifecycle transition, identify the exact application and fixture scope, rank remaining defects, and state whether the evidence supports acceptance. Explicit unresolved limits include real model/agent decisions (zero paid calls), physical devices, screen readers, real authentication expiry, and a valid saved evidence record whose originally available source later becomes unavailable. Invalid IDs or missing versions do not substitute for that last scenario. If the approved prototype or inherited fixture cannot be obtained, mark the affected comparison/reproduction unverified. Do not convert these limitations into an accepted claim.
