# Evidence workspace verification

**Passed:** 230 browser checks, 562 unit tests, lint, typecheck, formatting and the normal production build. The tested application source is `4ce513c81d2f2fc9450cffb4085c8d40a8a6e617`; browser harness SHA256 is `b88d1a30142e879af082f9cd667c561add71610234ea71aa02e3e7eaf2e6832b`. All 20 evidence/workflow table fingerprints were unchanged after browsing. Model providers were disabled; no model calls were made.

[Prototype / before / after gallery](comparison-gallery.html) · [230-check browser receipt](corrected/report.json) · [full quality/build receipts](../../../app/teacher/evidence/verification/quality/report.json) · [reference provenance](PROVENANCE.md).

## Visual comparison: V02 and V03

The actual approved HTML export was independently opened in Edge and exercised through its own controls at all four required sizes. [Eight fresh prototype captures and measurements](prototype-fresh/report.json) accompany unchanged PR #122 combined-implementation screenshots and 51 corrected-application screenshots. Fictional names, counts and source versions differ between these datasets; this is a comparison of structure and access, not equal-data pixel fidelity.

| Viewport  | Approved export                                      | Previous combined implementation (PR #122)               | Corrected application                                                                       |
| --------- | ---------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1440×1000 | Panes 330 / 750 / 360, top y201; record title y275.6 | Two columns 330 / 1052, start y≈575; source below y≈1690 | Panes **330 / 750 / 360**, top y202.5; record title y294.5; adjacent source/context         |
| 1024×768  | Panes 300 / 724; record title y323.6                 | Two columns 285 / 681, start y≈575; source below y≈1754  | Panes **300 / 724**, top y246.5 with Context trigger; title y338.5; reversible right drawer |
| 390×844   | Single selected pane; title y213.6                   | Selected title y≈1547 below filters/list                 | Single selected Record pane; title **y220**, original-answer heading y565.3                 |
| 320×844   | Single selected pane; title y213.6                   | Selected title y≈1666 below filters/list                 | Single selected Record pane; title **y220**, original-answer heading y589.1                 |

The prior-combined measurements are those recorded for V02/V03 in PR #122's `acceptance/v22/DEFECTS.md`; new prototype and corrected measurements are in the linked raw reports. The corrected selected and unselected captures were inspected at all four sizes. No horizontal overflow was observed. Selection leaves the outer document at scrollY 0. At 390px and 320px, pane bodies end at y778/y763, above the persistent bottom navigation at y779/y764. Longer records scroll inside their actual pane; the 320px answer box can require a small internal scroll. Source/context is separately accessible on phones and a modal drawer on tablet.

## F1 and browser behavior

The passing run uses actual Tab/Enter to open a response and native browser history to return. It does not refocus the expected target after navigation or wait for a preferred focus result.

- At all four sizes, Back restores the originating response row and list scroll. A second scenario opens the final row from a nonzero list position, then checks exact selected identity, original focus and scroll on Back. Forward restores the exact selected record and visible `response-detail-title` focus in both scenarios.
- Both phone sizes pass the page's **Back to responses** link and the Responses tab, preserving selection and position. Direct attempt links show Record immediately. Direct row hashes and fragment-only navigation from an explicit Record pane reveal and focus the response row; Back returns to Record.
- Search and concept filters survive Back. A selected attempt remains the exact record even when outside current search results. Empty results and empty record/context states are explicit.
- Manual list scrolling away from a focused row survives Context → Responses without jumping to the old offscreen row. Tablet Escape closes the context drawer and restores its opener.
- Exact selected original questions and answers, the 271-character longest fixture answer, pending/failed/uncertain evaluations, displayed assistance, approved passage text, lesson version and a two-response GET-only preparation handoff pass. Unaccepted selected results do not expose a preparation link.

The valid class fixture contains 24 fictional students, 63 submitted responses and 33 responses for the long transmission-delay list. Exact-text assertions cover six distinct selected originals, including the longest answer, across the required viewports and zoom scenarios; this does not claim that all 63 records were individually opened.

## Actual 200% browser zoom

Native Edge profile zoom changed device pixel ratio from 1 to 2 and the CSS viewport from 1416×908 to 708×454; root CSS zoom remained 1. The selected Record pane was immediately reachable. After scrolling the answer within the pane, its rectangle was y222.89–310.48 inside the body y145–388, above fixed navigation at y389. Exact text, no horizontal overflow and outer scrollY 0 passed.

**Screenshot limitation:** Edge/Playwright's native-zoom PNG capture produced a cropped upper-left region at 200%. `native200.png` and `native200-answer.png` are preserved but are not full-viewport visual proof. The native-zoom result rests on recorded browser zoom and DOM geometry assertions. The four required size comparisons are uncropped and unaffected.

## Data integrity and execution

A fresh isolated PostgreSQL 17.11 database was migrated and seeded with the existing fictional class fixture, then used by the production Next application. Docker was unavailable for the initial setup; no old database/configuration was reused. The unchanged reviewed storage guard covered full quality, production restart, browser work and before/after fingerprints under one lease. No competing large stack was started by this workstream.

[Before](corrected/evidence-before.json) and [after](corrected/evidence-after.json) read-only counts and row digests match across all 20 evidence/workflow tables. Authentication tables are excluded because fictional teacher sign-in writes authentication state. The browser request guard recorded no unexpected mutation or off-origin request. Preparation was inspected as a bounded GET handoff; no intervention was generated, approved or delivered.

Independent review found original text, current accepted pointers, concept-specific independence, displayed help, content/source identities, related/contrary records and authorized preparation fields preserved. No evaluator, database, authorization or intervention lifecycle service was changed. Existing page-owned restoration remains under `data-workspace-restoration="page"`; no shared-shell files or restoration interface were changed.

## Preserved initial findings

[Run 01](run-01/README.md), source `0fb4170`, retains 212 checks, 9 failures and 45 screenshots. Four failures were an ambiguous harness search selector; five were real tablet/mobile focus or fragment-navigation failures. Separate screenshot inspection found pane-height overlap and outer scrolling. Those observations prompted the Evidence-owned fixes and narrower accessible selector. Run 02 preserved the substantive navigation assertions and added viewport/zoom-reading checks; no failed run was overwritten or relabelled as passing.

## Remaining limitations

- Rejected evaluations and historical accepted-pointer combinations are covered by deterministic [teacher-evaluation-display.test.ts](../../../tests/teacher-evaluation-display.test.ts) and [teacher-evidence-selection.test.ts](../../../tests/teacher-evidence-selection.test.ts). The browser fixture does not supply every such combination; they are not labelled browser-tested.
- No valid class fixture represents an unavailable approved passage lookup. Empty/unselected source context passed, but the actual missing-passage fallback remains unrun in the browser. No invalid snapshot or corrupted database was introduced to force it.
- Native 200% screenshot capture is cropped as documented above. Actual-model, screen-reader, physical mobile/touch and hosted-release checks remain unrun. Synthetic acceptance does not prove live AI behavior or durable mastery.

Next integration step: compose this verified Evidence application revision with the independently reviewed shell, Assignment and Intervention candidates, then repeat the cross-page return-navigation checks in that combined build. This report covers the exact requested shared-shell base, not that later composition.
