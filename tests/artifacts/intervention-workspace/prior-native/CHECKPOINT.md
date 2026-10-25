# Native verification checkpoint — incomplete

The production app and isolated PostgreSQL runtime ran against source `5f2d8dcf819b950dc1dfc31780859bf5e69ce16b`, tree `06fdd3774306fc1516659753b910841b8f0e0d5b`, build `STRvzJ-M-fiRLjdULuhfd`. The application and PostgreSQL bind only to `127.0.0.1:3362` and `127.0.0.1:54362`. No paid model requests occurred. All commands used the unchanged PR121 shared guard and storage checks. Runtime work is on hold following coordinator handoff to the next owner.

## Completed evidence

- Root's `intervention-quality/final-05/results.json` records the exact passing final source checks and production build.
- PostgreSQL initialization was reconciled after a Windows inherited-stdio timeout: the server had started, while app role/database did not yet exist. The immutable failed init receipt remains; separate startup reconciliation and coordinator lock-release receipts prove that only the remaining setup continued. No second initdb or start occurred. The runner now uses file descriptors for future pg_ctl operations.
- `intervention-native-runtime/runs/2026-10-25T13-55-18-607Z-resume-initialization/report.json`: migrations and fictional class seed passed. Restricted role has no superuser/create-database/create-role privileges. fsync, full_page_writes and synchronous_commit are on.
- `.../2026-10-25T13-55-32-901Z-adopt-build/report.json` and `.../2026-10-25T13-55-37-169Z-start/report.json`: verified build adoption and app startup passed.
- `.../2026-10-25T13-55-47-456Z-prepare/report.json` and `fixture.json`: existing synthetic-provider service regression passed; five synthetic calls, zero paid requests. Generation was not repeated.
- `.../2026-10-25T13-55-55-229Z-integration/report.json`: private-draft intervention HTTP regression passed before any browser approval or delivery.
- The one explicit fictional assignment activation returned HTTP200. Page response-body capture timed out; authenticated GET proved the persisted activation and exact source identity. `activation-reconciliation.json` and `activation-lock-release.json` preserve the read-only reconciliation. No activation replay occurred.
- Browser03/04/05 contain private-state screenshots at 1440×1000, 1024×768, 390×844 and 320×844, with distinct Evidence/Activity/Steps on phones. Actual workspace starts at y202.5 on desktop/tablet. No document horizontal overflow was observed.
- Native tablet modal, inert background, keyboard traversal and Escape/focus return passed. Native browser-chrome traversal is recorded distinctly from background control focus. Roving mobile pane keys and visible tab order passed.
- Citation → exact expanded original evidence → browser Back passed, restoring Activity focus and scroll (1085px) with a distinct shared shell history entry.
- Browser04 proves phone Steps → Inspect saved evidence and invalid Save → visible Activity edit form focus/open required guidance with no request/revision change. The corresponding tablet focus check failed and is unresolved in this checkpoint.
- Browser05 proves dirty-navigation blocking, reload recovery of the unsaved title, student preview, and saving while the edit form remains mounted. A single UI save was acknowledged by HTTP200, authenticated GET, and visible `Private draft / Revision 4 · saved`. Edited-saved screenshots exist at all four viewports.

## Persisted fixture state

Draft `256d7b47-6ad9-4a75-8a5f-fbe161da4fc2` remains a **private draft at revision 4**, title `Synthetic v2.2 reviewed intervention`, for fictional assignment `30000000-0000-4000-8000-000000000001`. Save request `be84508d-7442-40d1-96af-11f5e9468cf6` advanced revision3 →4 once. There has been **no approval or delivery POST**. No provider or activation request may be replayed to resume verification.

## Failures and outstanding work

Every browser journey report currently has status `failed`; none is a full passing lifecycle run. Browser01/02 exposed an overly strict harness assumption about native browser chrome during modal Tab traversal. Browser03 had an exact-label locator mismatch for a server-rendered textarea. Browser04 found a real tablet focus problem: the workspace effect can mark focus handled while the target remains behind the open modal. Browser05 was a bounded core capture, explicitly recording that unresolved supplementary check; it stopped after save because its recipient disclosure selector also matched nested summaries. The latter selector is corrected in the current helper but has not executed yet.

Remaining: fix and rebuild the tablet focus behavior, rerun the actual tablet check, complete separate recipient selection/approval/undelivered/delivery UI operations without replaying save, verify uploaded follow-up labels and exact texts, run remaining lesson/approval/follow-up integrations, actual native200% zoom, and PostgreSQL restart durability. Preserve every original failed/uncertain receipt when combining evidence. Docker acceptance and screen-reader verification have not run.

## Publication boundaries

Use the [publication allowlist](../runtime/PUBLISH_ALLOWLIST.md); do not copy runtime state recursively. The prepared verification bundle now also contains immutable executed harness snapshots (`native-runner.initial-start.mjs`, `browser.initial-activation.mjs`, `browser.first-journey.mjs`, `browser.tablet-diagnostic.mjs`, `browser.invalid-field-diagnostic.mjs`, `browser.tablet-reveal-diagnostic.mjs`, `browser.core-save-run05.mjs`) to match report hashes. Review exact bytes before publication. Reconciliation helper/source changes and receipt hashes must retain their actual execution provenance. No credentials, state manifests, native profiles, PostgreSQL data, raw logs, binaries, or project-context references belong in the PR.
