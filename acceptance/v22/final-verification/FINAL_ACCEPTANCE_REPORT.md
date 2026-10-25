# Workbench v2.2 — final candidate visual verification

**36/36 actual captures completed; visual acceptance is NOT PASSED.** Shared course/assignment navigation now follows the prototype's hierarchy. Evidence still lacks the required pane structure and places a selected record far below the initial phone viewport. Assignment spacing also remains inconsistent with the reference.

- Exact source: `462cfb1b31d9108cec70d18b6553bd45048d2eed`
- Exact tree: `03cca1fed3900a122e689c4a512afadd9052e5af`
- Source checkout: `C:/Users/sb128/.codex/worktrees/workbench-final-verification/LearningPlatform`
- Runtime: `http://localhost:3350`, target `shell`, project `lp-v22-shell5`, private state `runtime-final`.
- Root supplied production-build/default-seed readiness, image `sha256:1aedb0a89e97a99480c4dc3d02a55bb388b9d3b332c65bcc2c8c2511fa93873a`. The capture guard independently verified checkout HEAD/tree, clean application, exact manifest identity, blank provider declarations, authentication origin and the reviewed storage preflight; it did not independently inspect the running image ID.
- Earlier `shell-verification` and `current-verification` packages remain preserved and were not run. Actual historical comparisons come from the prototype, main `723ed6f` and first combined `eba2fba` captures.

Capture occurred **2026-10-25 05:47:11–05:47:37 UTC**, using Edge `156.0.4314.42`, device scale factor 1, at 1440 × 1000, 1024 × 768, 390 × 844 and 320 × 844. Every PNG was opened for visual inspection; all 36 geometry records and PNG dimensions were checked offline. No screenshot pixels were edited.

The [four-column gallery](comparison-gallery.html) links the actual prototype, main, first-combined and final captures. [Raw capture metrics](screenshots-default/report.json), [guard receipt](screenshots-default.guard.json) and [offline comparison](visual-comparison.json) preserve provenance. The reproducible offline analyzer is [analyze-captures.mjs](analyze-captures.mjs).

## Capture health, distinct from acceptance

- 36 successful page responses (HTTP 200); 36 requested-size PNGs; no page JavaScript errors; no document horizontal overflow in these views.
- One authorized POST, the fictional teacher demo login. No other mutation was attempted; no mutation was blocked.
- 518 failed-request events were `net::ERR_ABORTED` Next.js `_rsc` prefetch requests during navigation. No other failed request was recorded. These are retained in raw receipts rather than hidden as a blanket network pass.
- Reviewed safety module SHA256: `af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485`; wrapper SHA256: `0d2016be66272a93a4c1899f99342afd28e7ae48e8b19a6a58332fc9022604c8`. The 10 GiB preflight passed, and own-token lock release completed before the parent started service checks.
- PNG total: 1,809,850 bytes. Authentication state, environment files, browser profiles and runtime directories are excluded from this package.

HTTP success and screenshot completion do not establish journey, authorization, recovery, accessibility or visual acceptance.

## Fixture equivalence and limits

The final default seed again shows one inactive curated assignment, three enrolled fictional students, two with saved work, five concept responses, no authored lessons/materials and no saved intervention draft. Main and the first combined comparison use the same seed. The prototype has different fictional names, multiple versions/classes, richer activity histories and an approved-undelivered intervention. Empty library/intervention states are fixture limitations, not proof that authoring or delivery is missing.

The final selected-assignment route explicitly requests `view=progress`; the earlier implementation screenshots show the default review selection. Prototype concern aggregation and the response-led Evidence page are different investigations. These differences are labeled in the gallery. Counts and page density are not treated as pixel-equivalent.

## Severity-ranked layout findings

| ID / severity     | Finding and owner                                                                                                                                                                                     | Observed disposition                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V02 / P1          | Phone selected evidence remains below filters and the entire response list. **PR #116**, coordinated with **PR #120** pane contract.                                                                  | Open at 390 and 320. The selected student heading starts at y=1546.97 / 1665.56; original-response heading at y=1899.75 / 2042.14. Prototype selected title starts at y=213.59 with Details active. No Evidence pane controller/tab was present in captured DOM.                                                                                                                         |
| V03 / P1          | Evidence has two desktop columns and no contextual source pane; tablet source remains later in the same page. **PR #116**, coordinated with **PR #120**.                                              | Open. At 1440, final work starts at x=28,y=574.69 with 330/1052px columns, versus prototype x=0,y=201 with 330/750/360px panes. Final Approved source starts at y=1689.84 (1440) / 1754.23 (1024).                                                                                                                                                                                       |
| V05 / P2          | Assignment browse receives both shell padding and page padding. **PR #117 + PR #120**.                                                                                                                | Open. At 1440 `.tw-main` has 24px/28px top/side padding and `.awa-workspace` adds the same again: heading x=56,y=173.59 versus prototype x=28,y=148.59. At 320 the content begins x=28 versus prototype x=12; assignment heading y=160.59 versus y=97.59. The extra path row, nested padding and filters consume substantial phone height.                                               |
| V04 / P2          | Assignment browse grouping improved, but default curated version identity is displayed as a wrapping hash and the first lesson appears much later. **PR #117**, with shared spacing from **PR #120**. | Partial. The old workflow strip/combined browse-review layout is gone; lesson → version → class grouping is visible. At 320 the first lesson heading is y=559.66 versus prototype y=287.69. One seeded version cannot verify grouping across multiple published versions. Hash-length differences are explicit fixture/content differences; the crowded presentation still needs review. |
| V01 / previous P1 | Global sidebar / missing navigation hierarchy. **PR #120**.                                                                                                                                           | Addressed in captured structure: horizontal Overview/Assignments/Lessons, assignment Progress/Student work/Interventions/Roster, and phone bottom navigation are present. This does not certify switcher history, keyboard behavior or focus restoration.                                                                                                                                |

To reproduce V02/V03, start the exact final candidate with the default fixture, use Demo teacher, and open:

```text
/teacher/evidence?assignment=30000000-0000-4000-8000-000000000001&origin=synthetic_fixture&concept=transmission_delay&session=40000000-0000-4000-8000-000000000001&attempt=50000000-0000-4000-8000-000000000001&evaluation=60000000-0000-4000-8000-000000000001
```

At 390 × 844 or 320 × 844, the selected original record is below the filters and list. At 1440 × 1000, compare the two-column work area and lower in-document Approved source with the prototype's simultaneously visible context. [Final 320](screenshots-default/evidence-original-answer-320x844.png), [final 1440](screenshots-default/evidence-original-answer-1440x1000.png), [prototype 320](../prototype-verification/screenshots/evidence-original-answer-320x844.png), [prototype 1440](../prototype-verification/screenshots/evidence-original-answer-1440x1000.png).

To reproduce V04/V05, open `/teacher/assignments` at 1440 × 1000 and 320 × 844 with the same seed. Inspect nested content insets, version wrapping and first lesson position. [Final 320](screenshots-default/assignments-320x844.png), [prototype 320](../prototype-verification/screenshots/assignments-320x844.png). These are layout findings; no competing application fix was made.

## Exact evidence geometry

All coordinates are CSS pixels from the initial direct-navigation state, without a hash or restored scroll.

| Viewport    | Prototype selected title y | First-combined title y | Final selected title y | Final original response y | Final work columns / start y |
| ----------- | -------------------------: | ---------------------: | ---------------------: | ------------------------: | ---------------------------- |
| 1440 × 1000 |                     275.59 |                 525.05 |                 626.69 |                    911.08 | 330 / 1052; y=574.69         |
| 1024 × 768  |                     323.59 |                 511.05 |                 622.69 |                    907.08 | 285 / 681; y=574.69          |
| 390 × 844   |                     213.59 |                1630.19 |                1546.97 |                   1899.75 | Single 360; y=713.19         |
| 320 × 844   |                     213.59 |                1750.97 |                1665.56 |                   2042.14 | Single 294; y=790.19         |

The final header is 58px desktop/tablet and 57px phone, matching the reference heights. The desktop assignment band is 99.5px, versus prototype 99px. Final bottom navigation is 65px at 390 and 80px at 320, matching the prototype's responsive heights. Those shell similarities do not compensate for the different content structure.

Typography is only partly aligned: the final assignment title now uses 26px, matching the reference. Prototype receipts show loaded Inter font faces; final `document.fonts` records are empty even though CSS lists Inter first. The actual fallback face was not identified, so exact font-face equivalence is not claimed.

## All captured surfaces reviewed at all four sizes

| Surface                      | Observed result                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview / Teaching Desk     | Course hierarchy present; implementation remains a selected-class priorities dashboard, while prototype overview covers a fuller course. Phone filters precede decision content.      |
| Assignments browse           | Lesson/version/class grouping visible. Nested spacing, filters and long curated version identity reduce density, particularly at 320.                                                 |
| Selected assignment Progress | Inactive state and separate Review and activate action remain visible. Desktop Details region and tablet/phone Details opener are present; no open/close interaction was tested here. |
| Lessons                      | Course/lesson-tools navigation present. Empty library and material state reflect this default fixture. Populated authoring is not verified.                                           |
| Materials                    | Actual source-entry form renders at all sizes, with explicit save/import limitations. No text entered or source saved.                                                                |
| Concept evidence             | Response list/detail layout appears, with no prototype-equivalent aggregate concern/context composition.                                                                              |
| Original answer              | Exact selected fictional response is present in text/geometry, but offscreen on phones and below a large filter area on desktop.                                                      |
| Interventions                | Actual preparation/evidence state renders. The prototype's approved-undelivered activity is not equivalent to this empty default state.                                               |
| Roster                       | Three fictional students render with assignment navigation; phone search and context consume the initial viewport. No cross-role or cross-class action tested.                        |

## Functional and accessibility boundary

No new functional defect is established solely by these read-only screenshots. All layout defects above remain distinct from the parent's service/browser findings. This pass did not exercise keyboard navigation, focus restoration, Back/Forward, unsaved work, pending/failed operations, native 200% browser zoom, screen readers, cross-role/class isolation, student conversation or the full lesson/intervention journey. Those results must come from their actual executed suites, not these images. Screen-reader verification remains **unrun** unless a later report records a real test.

Provider-disabled capture makes no actual-model claim and made no paid call. Populated source/lesson/intervention/follow-up captures require a separate GO after authorized fixture preparation. The P1 Evidence pane findings remain visual merge blockers for full Workbench v2.2 fidelity.
