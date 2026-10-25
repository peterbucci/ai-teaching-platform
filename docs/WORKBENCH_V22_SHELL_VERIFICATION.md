# Workbench v2.2 shell verification

Coordination: [#114](https://github.com/peterbucci/ai-teaching-platform/issues/114).
Original base: repaired PR #116, `76b11ddfa0ce784f70290c0746efd94c7042f6fc`.
Approved dependency update: `94e4e534ea4d68d86ea0810067497bf07258e6d2`.
Scope and consumer API: [shell contract](WORKBENCH_V22_SHELL.md).

## Inspect the actual comparison

Open [the comparison viewer](../tests/artifacts/workbench-shell/comparison.html)
locally to compare the exported prototype, exact-base implementation and new
shell at **1440 × 1000, 1024 × 768, 390 × 844 and 320 × 844**. It includes
Overview, Progress and Student work / All answers: 36 unaltered viewport
screenshots. The viewer links to each original PNG for inspection at full size.
GitHub does not execute the viewer; the PNG links in its directory remain usable.

The prototype is the supplied HTML export, with its real navigation and bundled
runtime. Its main-file SHA-256 is
`c853369da1250adf24a741a38c3d94d3c97a976c012c352732cf4dd8d924cb54`.
The local Teacher Experience Blueprint and Workbench Fidelity Audit were read
as requirements context; they are not copied into the repository.

Before and after are the actual authenticated Next application, using the same
new, isolated PostgreSQL 17.10 database and existing fictional seed scripts.
The base was extracted from the exact required commit. The database contains
24 fictional students in the main class, 23 sessions, 64 responses, 63
evaluations and 8 interventions. A second authorized fictional class/assignment
exercises switching. The prototype uses 18 illustrative students and a short
version label; the app uses its real immutable curated content hash. These
counts and states are deliberately not edited to mimic the prototype.

The manifest records image hashes and the exact source-file hashes used for
the capture commit, `dd97767`. Browser: Edge 156.0.4314.42. No provider was enabled.
The dev-server indicator in app captures is not product navigation.

### Post-capture compatibility corrections

Coordination review then identified that a supplied server snapshot must replace
the complete URL context, including deliberate omissions. A focused regression
now proves that unmatched student/session/attempt/evaluation/search fields do
not reappear in shell links. The later dependency integration below refines
this behavior to PR #116's explicit authoritative-snapshot flag.
The related modal correction dismisses the workspace switcher when a page-owned
guard blocks a link, allowing the page's recovery feedback to receive focus.
Neither correction changes layout or screenshot pixels. The manifest separately
records the post-capture source hashes; the original capture hashes are retained.

The first remote CI run for `dd97767` passed the production build, unit/static
checks and intervention-approval job. Its quality job then failed an old HTTP
assertion that searched for the removed sidebar label `Class overview`.
That assertion now checks the unchanged page heading `Teaching Desk`; all
authorization, uncertainty and evidence-preservation assertions are retained.
See [PR #120's checks](https://github.com/peterbucci/ai-teaching-platform/pull/120/checks)
for the current remote result after these corrections. This report distinguishes
the captured browser evidence from the later focused fixes.

### Approved foundation dependency integration

The user approved merging PR #116's later repair `94e4e53` while retaining the
original `76b11dd` ancestry. Page-owned Evidence and Interventions changes,
the foundation navigation helper and its tests match that dependency verbatim.
Only the shared navigation conflict needed resolution. The shell forwards
`contextIsAuthoritative` and reuses the foundation's context and destination
scope helpers; explicit Progress/review/preview still carry #117's investigation
filters. New regressions cover canonical draft URL replacement, ordinary URL
updates and destination-specific scope (including no answer search in Roster).

After integration, **559 deterministic tests passed**, including **12 dedicated
shell/pane tests** and the foundation's 11 navigation tests. Full ESLint and
TypeScript (`--noEmit --incremental false`) passed. An independent source review
found no merge blocker and confirmed unchanged page ownership. Final source
hashes are recorded separately in `dependency-verification.json`; the earlier
capture and correction records remain intact. Application/database browser
journeys have not been repeated after this merge during the local acceptance
hold. The existing screenshots prove the captured geometry, not final combined
page behavior. Current remote production and integration results are on
[PR #120's checks](https://github.com/peterbucci/ai-teaching-platform/pull/120/checks).
The dependency-integration commit `a045def` subsequently passed both complete
remote CI jobs, including production build and all quality/integration steps:
[run 40164628446](https://github.com/peterbucci/ai-teaching-platform/actions/runs/40164628446).

### Final restoration compatibility correction

A subsequent review found that the shared shell could resurrect an earlier row
focus after the teacher moved to an anonymous filter control. Its URL-keyed
scroll snapshot could also compete with #116's new per-entry evidence list
controller. The shared-only correction excludes page-owned restoration regions,
clears stale focus after anonymous content controls and yields all placement
after the page has focused its own visible target. No page file was changed.

Shared snapshots now belong to individual browser history entries, using an
opaque token that preserves existing router/page state. Positions remain bounded
in memory and disappear on reload. Repeated visits to an identical URL have
distinct snapshots. Missing metadata after reselecting a page is renewed safely;
a browser rejecting metadata writes falls back to native behavior without
repeated writes or a misleading URL-based restoration.

**26 component browser regressions passed with zero errors**, using the actual
shared component, React 19.3 and native history, with mocked Next hooks and a
labelled page-restorer fixture. They exercise both restoration orders, anonymous
filters, repeated URLs, identical-URL Back/Forward, synchronous and delayed router
updates, metadata preservation, reload, rejected writes, and immediate departure
after the router resets metadata. Existing generic restoration and exact hashes
remain covered. These are component checks, not a new application/database run.
The report and final source hashes are in `restoration-browser-report.json` and
`restoration-verification.json`. Final remote checks remain tied to the PR head.

## Geometry and visual findings

| Surface                            | Exported prototype                                | Corrected shell                                                        |
| ---------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| Desktop header                     | 58px high; horizontal course navigation           | 58px; same three course destinations                                   |
| Desktop assignment band            | 99px; identity above four assignment destinations | 99.5px; server-owned identity/version above the same four destinations |
| Desktop content boundary           | Assignment content begins at y=201                | y=202.5; 45px contextual return/subnavigation row                      |
| Phone header                       | 57px, compact context                             | 57px; class and assignment stay available through the switcher         |
| Phone assignment bottom navigation | 65px at 390; about 80px at 320                    | 65px / 80px; four visible destinations                                 |
| Wide optional three panes          | 330 / flexible / 360px                            | 330 / 750 / 360px at 1440                                              |
| Wide optional two panes            | flexible / 380px                                  | 1060 / 380px at 1440                                                   |
| Tablet optional panes              | 300px navigation, main, contextual drawer         | 300 / 724px; 400px native modal drawer                                 |

The old left sidebar is absent from teacher navigation. Content uses available
width rather than reserving a sidebar column. Desktop course and assignment
navigation have separate rows, backgrounds and active states. The phone
navigation changes with context instead of collapsing into a hamburger.

Shell type uses the existing Inter/system font stack, compact 15px navigation,
26px desktop headings and 23px phone headings. No new remote font dependency
is introduced. Platform font fallback can differ from the prototype's external
Google Fonts load. Existing page-owned card typography and spacing remain an
explicit integration gap.

## Executed checks

- Full deterministic suite before the dependency merge: **523 passed**. The 10 dedicated shell/pane tests
  cover invalid or duplicate assignment context, complete server-resolved scope,
  cross-assignment clearing, safe links, destination mapping and pane URLs.
- Full ESLint, formatting and TypeScript checks passed during implementation.
  Final focused tests and targeted ESLint passed after the pane history fix.
  Final TypeScript (`--noEmit --incremental false`) passed after all source
  fixes. Final formatting was checked with the packaged evidence.
- Production `next build --webpack` passed before the last history-focus and
  compact phone-label fixes. A pre-existing materials-extractor warning remains.
  The normal Turbopack build could not resolve Next through this environment's
  external dependency junction. A final production rebuild was deferred when
  the shared host dropped to about 2.6 GiB free during storage recovery.

### Actual application browser checks

Reports are in [the artifact directory](../tests/artifacts/workbench-shell/).
The definitive navigation matrix passes **21/21**, the separate history check
**4/4**, assignment-scope checks **5/5** and subnavigation checks **4/4**. All
final reports contain zero browser errors; earlier failed or interrupted runs
were fixed and superseded, not counted as passes.

- Real keyboard Enter navigation across Progress, Student work, Interventions
  and Roster preserves assignment and origin. Course destinations and legacy
  Materials/Objectives/Insights/Evidence routes remain reachable.
- Workspace dialog traps keyboard focus, closes with Escape and restores its
  opener. Phone bottom navigation remains visible and reachable at 320px.
- Actual browser Back/Forward restores the original response link's focus and
  window scroll position (600px), at all four requested sizes. The defect found
  during this test was fixed and rerun; the final history report passes 4/4.
- Both authorized classes can be selected at all four widths. Switching clears
  old response/concept scope. An unknown assignment returns the existing 404
  and exposes no evidence instead of falling back to another class.
- All answers / By idea / Concerns active states follow their actual routes,
  hashes and Back/Forward history at all four widths.
- Actual **200% browser zoom** was exercised with Chromium's tab zoom API and
  verified using `getZoom() === 2`; the 1440px window became a 720px CSS viewport
  with device pixel ratio 2. This was not simulated by resizing the viewport.

Database hashes surrounding the initial browser checks match for classes,
assignments, sessions, attempts, evaluations and interventions (last sample
04:28:39 UTC). The later final matrix completed after that sample and recorded
no non-authentication mutation or provider requests; no new hash query was run
under the storage-recovery hold. Login/session bookkeeping is outside these
hashes. All owned app/database processes were then cleanly stopped, with source,
reports and fictional database files preserved.

### Optional pane component browser checks

**6 scenarios passed, no browser errors**, using the actual component, actual
CSS and repository React/ReactDOM 19.3.0. Only the Next URL hook was mocked in
this isolated fixture; this does not prove a page owner's adoption or backend.
Eight screenshots cover wide three/two panes, the tablet drawer, and phone main
and context panes. Keyboard arrows/Home/End plus Enter/Space, Escape, browser
history, saved focus/scroll, refresh selection, responsive modal-to-phone
transition and preservation of unsent input were exercised.

### Workspace switcher and page guards

Before the dependency merge, **20 component browser cases passed** using the
actual shell/CSS and React 19.3 in production and development StrictMode, at
1440px and 390px. Tests cover initial/remounted guards, listener re-registration,
mouse and Enter navigation, preserved dirty/pending state, focused recovery
feedback, Escape and ordinary navigation exactly once. Next routing and
assignment metadata are mocked; these are not database acceptance checks.
The fixture documents the supported passive-effect guard order and preserves
the failed diagnostic for an arbitrary earlier external guard. The newer
foundation guard also closes its containing dialog before focusing feedback.

## Remaining deviations and acceptance boundaries

1. PR #116's assignment page does not yet implement `view=progress`. Its actual
   content remains assignment review in these captures. The grid and assignment
   page belong to #117. This shell does not claim progress-page fidelity.
2. Existing Evidence/Students, Interventions and #118 authoring content have not
   been rewritten or made to consume the new pane/metric/row contracts. Their
   page-local layouts remain visibly different. The optional pane fixture is
   labelled separately from the real application captures.
3. Prototype Find, course/term metadata and simulated history controls are not
   backed by repository authority. Actual class metadata and real contextual
   links replace them. No course-wide metrics or fabricated status are shown.
4. The phone pane switcher is a compact 42px control rather than the prototype's
   roughly 59px combined toolbar. Pages can add their own labelled actions; the
   shell does not invent record-level controls. Tablet drawers use native modal
   semantics and focus handling.
5. Scroll/focus snapshots are bounded, memory-only and disappear on reload.
   URL selection survives refresh. Page editors continue to own durable draft
   recovery and dirty-navigation behavior.
6. No live-model evaluation, hosted deployment, full page parity, assistive
   technology audit or independent human approval is claimed. Final remote build
   and integration status must be checked against the current PR head; the
   successful dependency-integration run above does not certify later changes.
   The combined application browser journey remains deferred during serialized
   local acceptance. This is a stacked draft; it must not merge automatically.

Next integration: page owners adopt the documented pane and URL contracts on
their own branches, then rerun the relevant real page journeys after #116 and
the shell are accepted. Keep the shell PR based on #116 until it is merged;
only then rebase and retarget to main.
