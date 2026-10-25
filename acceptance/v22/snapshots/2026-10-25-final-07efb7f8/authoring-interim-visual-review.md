# Interim Lessons visual review — combined candidate

This is an independent inspection of unchanged original browser screenshots, not a new browser run. Application commit: `07efb7f821339538800f150f57b298eb2e606be3`; tree: `948b9a6005a056c97f10d181c589b5352d6221f3`. Four viewports were inspected: 1440 × 1000, 1024 × 768, 390 × 844 and 320 × 844. No application native 200% screenshot is included in this interim scope. No screenshot was cropped, resized, composited or otherwise modified.

## Source and state provenance

Application sources are `authoring-01/report.json` and `authoring-continuation-02/report.json`. The first run ended with a verifier timeout at “new version and history preservation”; its earlier screenshots remain evidence of their particular states, not proof the whole run passed. The second run passed after read-only reconciliation of the same records, without replaying prior authoring or assignment mutations.

The lesson is `2a18db3f-a6dc-4f61-b96d-f50647d574ad`, source `3243e3b8-0c5f-4669-a957-aefc27c279d8` version 1, and assignment `382f0724-3800-4e6c-8a15-40b4813cb4ab`. The fictional title is “Water changing state · verification 1792946023062”. There is one objective (Evaporation), four manually authored questions and one passage, p001. Provider access is disabled. The screenshots are not evidence of actual-model generation.

Approved-objective screenshots show the earlier draft v1 / revision 3 state. Student-preview and approved-bank screenshots show later v1 authoring states (revisions 4 and 5 respectively). Publication screenshots come from the continuation: immutable published v1 after draft v2 / revision 7 exists. Do not attribute the earlier authoring screenshots to current revision 7.

Prototype comparators are unchanged originals from `prototype-objectives-02` and `prototype-captures-01`, captured from the actual exported Teaching Workbench v2.2 HTML (SHA256 `c853369da1250adf24a741a38c3d94d3c97a976c012c352732cf4dd8d924cb54`). These contain the networking fixture, including an unreviewed suggested S1 objective, DBP11 selected question and published v3 with more objectives, questions and class assignments. Counts, text lengths, review state and lifecycle differ.

## Scoped classifications

These are provisional review classifications of visible states. “Accepted with documented deviations” does not mean a product owner has approved the deviations or that complete Workbench acceptance is granted.

| State | Classification at the four widths | Finding / limitation |
| --- | --- | --- |
| Approved objective | Accepted with documented deviations | Pane structure and responsive transitions are present; app controls are more compact and add review/save chrome. Screenshots were action-scrolled, so top-entry hierarchy remains for the fresh capture. |
| Selected-question editor | Not verified | Historical `05-bank-approved` captures show bank review, not the prototype’s selected-question editor. A matching editor capture is still required. |
| Student question preview | Accepted with documented deviations | Visible preview is readable at all four widths, with no visible private criteria. It is a different state from the selected-question editor and cannot replace that check. |
| Published lesson v1 after draft v2 | Accepted with documented deviations | Immutable publication and responsive structure are clear. Assignment preparation is primarily a handoff to the exact-version builder, whereas the prototype embeds its form. |
| Application native 200% for these states | Not verified | Not captured by the authoring runs reviewed here. Fresh capture remains required. |

## Objective density and responsive behavior

At 1440 the application follows the prototype’s approximately 330 / 750 / 360 outline, editor and reading pane structure. At 1024 the reading pane collapses behind an “Open reading” control, leaving outline and editor. At 390 and 320 the Outline / Editor / Reading tabs expose one pane, with fixed bottom navigation and no visible horizontal clipping.

The application uses smaller type and more compact form controls. The selected mobile tab is a pale outlined rectangular control instead of the prototype’s darker rounded treatment. A save/reload bar, lesson-title disclosure, order/remove controls, source-support badge and passage-review disclosure add visible chrome. The prototype’s unreviewed AI suggestion instead has a provenance/review notice and expanded supporting passages. These different states account for part of the density difference.

The approved-objective captures were scrolled by the preceding approval action: the main heading is above the visible editor region in several images. This is not evidence of a missing heading. At 320 the concept name, Emphasis field, objective textarea and source-support badge remain readable and within the pane. No visible density problem in these frames establishes a blocking defect, but the extra chrome and different hierarchy are a P2 visual deviation for the Lessons owner (#118) to disposition.

## Question bank and preview

The `05-bank-approved-*.png` images display “Review question bank” and a long evaluator-policy review. On mobile the policy occupies most of the visible pane. The prototype `questions-*.png` instead displays DBP11’s selected-question editor, including role, review note, prompt and private marking guide. Treating these as equivalent screenshots would produce an invalid comparison.

The long policy review is a remaining density concern for #118, but this evidence alone cannot establish a selected-question editor defect. The fresh scenario explicitly selects the real first question, `teacher-251fda60-a4de-49ce-b6cb-7334ee4eaeb1`, to resolve this verification gap.

The `04-student-preview-*.png` images show “What students will read” and a single projected question. The desktop/tablet structure is coherent. At 390 the question fits in the first viewport; at 320 the stacked return/save controls and explanatory text push it lower, but the question remains readable above the fixed navigation. The visible local preview label “Question 1” is not evidence that the underlying bank order or question identity is wrong. Screenshot evidence establishes only the visible preview; privacy and persistence assertions must use the separate browser/API receipts.

## Published lesson

The reconciled publication captures show Published version 1, its approved/immutable status, and the active assignment linked to that exact version. Desktop and tablet pane transitions align with the authoring shell; mobile retains the three pane tabs and fixed navigation.

The application emphasizes “Prepare assignment from version 1”, “Browse class assignments” and a collapsed “Quick assignment preparation” section. The prototype directly embeds class/version/title/instructions fields. This is a concrete workflow and hierarchy deviation requiring disposition by #118/#117; it is not evidence that assignment preparation is absent. The continuation separately verifies that the handoff preselects the immutable version.

The application also provides published reading, objectives, question bank, private criteria, tutoring sequence and policy disclosures. The long synthetic lesson/assignment title and immutable-version explanation increase mobile height. At 320 the primary preparation action is around the lower middle of the viewport and return-to-draft sits near the bottom; neither is visibly clipped. The prototype has four short class rows, so row count alone cannot explain pixel differences or justify equivalent-state claims.

## Original image inventory

For each suffix `1440x1000`, `1024x768`, `390x844`, `320x844`, the inspected originals are:

- Application: `authoring-01/03-objectives-approved-{suffix}.png`; prototype: `prototype-objectives-02/objectives-{suffix}.png`.
- Application: `authoring-01/05-bank-approved-{suffix}.png`; prototype selected editor: `prototype-captures-01/questions-{suffix}.png` (state mismatch documented above).
- Additional application preview: `authoring-01/04-student-preview-{suffix}.png`.
- Application: `authoring-continuation-02/published-v1-after-v2-reconciled-{suffix}.png`; prototype: `prototype-captures-01/published-lesson-{suffix}.png`.

The source reports record no horizontal overflow for these viewport captures. That is a browser measurement, distinct from this independent visual inspection. Scroll reachability, keyboard interaction, persistence and native zoom are not inferred from static images.

## Remaining work for final visual acceptance

1. Review fresh selected-question editor and top-entry objective captures at all four widths and measured native 200%.
2. Review published lesson native 200% and expanded reading where captured.
3. Carry the documented P2 density/hierarchy and assignment-handoff deviations to owner review; do not silently treat them as approved.
4. Preserve historical failing reports and source images alongside the fresh results.

