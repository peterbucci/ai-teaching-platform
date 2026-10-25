# Independent visual walkthrough

Review scope: direct screenshot inspection against the actual approved prototype, not an overflow-only assertion. The prototype ZIP SHA-256 is `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`. Different fictional text and recorded dates remain different; no data was invented for visual alignment.

## Recorded history — final candidate

Inspected [S2 gallery](history-review/s2/visual-1792966350602/COMPARISON.html) on application `b39e74d917d21fe662a98e23644b41bb8629826d`, production build `pFAtaZMHlK_WKmfYtwcfn`: index, session overview and saved-question frames at 1440×1000, 1024×768, 390×844, 320×844 and native Edge 200%, plus the 100% application control. This repeats the earlier c7bff74 visual inspection on the final source; all 16 approved-prototype reference PNGs are byte-identical across these capture sets.

**Readable and coherent, but full prototype parity is not accepted.** Desktop maintains the green navigation, paper treatment, serif originals and numbered question gutter. The recorded result remains distinct from the original answer and recorded event stream. At phone widths the question's original text, precise source timestamp, assistance and assessment wrap within the paper; controls do not overlap. Native zoom reflows global navigation into a compact menu rather than clipping the application's account control.

Specific remaining differences:

- **P2 — global index scope:** The application shows saved-session cards with response counts. The prototype shows individual question/review rows with original answers, accepted results and assistance in the global index. The application honestly limits search to available session metadata; it cannot supply the prototype's global question/result/help filters without a separately approved bounded data contract.
- **P2 — phone session browsing density:** At both 390 and 320px the recorded-session heading, status and initially expanded filters occupy the initial viewport before any saved question appears. The controls are readable and collapsible, but the first saved question is materially less discoverable than in the prototype's notebook index.
- **P2 — historical presentation:** The recorded question is a separate read-only leaf, with original answer, accepted assessment and an additional recorded-events list. The prototype uses a folded multi-question session with a facing reading rail, quote highlights and human-readable historical concept titles. Those absent fields/interactions are not fabricated. The R03 fresh-check name correction is a separate preserved path, not a claim that all historical DTOs contain names.
- **P3 — metadata density:** Long exact timestamps and explicit provenance/unavailable-history explanations create more vertical space than the prototype. Phone and native-zoom question pages therefore show less of the original answer in the first viewport. This is a density difference, not observed truncation or missing saved evidence.

The five `session` comparison references are the prototype global notebook index, not an equivalent prototype session-overview state. They must be read as nearest-reference comparisons and excluded from any count of equivalent-state parity evidence. Index and saved-question pairs compare equivalent user purposes, while still exposing the differences above.

The native-200 session header was reopened and inspected individually after an ambiguous multi-image review display. The original PNG includes the global header; no product defect or replacement capture is claimed from that transient review display.

## Teacher review — final candidate

Inspected [S3 captures](history-review/s3/visual-1792966413070/visual.json) on the same final build: My Learning and accepted review at all four widths; native 100%/200% review and the focused 200% accepted-feedback view. The four unavailable-review frames and 26 prototype frames are byte-identical to the earlier directly inspected c7bff74 set. Additional final-source direct inspection covered the real unanswered 1440px, draft 320px, pending 390px, uncertain 320px, lost-response failure and unavailable-status frames in [workflow evidence](history-review/s3/workflow-1792966393285/workflow.json).

The review is readable at each size, with a single fresh-check response area, clear saved-original versus assessment separation, and the corrected **Evaporation: correct** concept name. At 320px the toolbar shortens the title but the full title remains visible in the page. The multiline original remains legible, the uncertain result does not become an incorrect score, and the lost-response state explains that the saved answer remains available. Native 200% controls reflow and the focused assessment remains readable. Unavailable review pages reveal no review content and retain clear return links.

Specific remaining differences:

- **P2 — review hierarchy and earlier work:** the application retains the authoritative activity's practice-first order and a separate source-reference card. The prototype groups the purpose, explanation and source quotations differently. The application left rail provides authorized assignment/Notebook links instead of the prototype's numbered prior-question timeline. No duplicate activity was added to imitate that layout.
- **P2 — comparison framing:** accepted/draft/pending application captures include the full document, while prototype captures show the initial viewport of an inner-scrolling notebook. In particular, a prototype `check` or `pending` filename does not mean its fresh-check controls appear in the captured viewport. These are functional-state/purpose comparisons, not matching feedback-viewport or pixel-parity evidence. The native 200% application feedback closeup has no matched prototype feedback closeup.
- **P3 — My Learning summary:** several separate synthetic review records are present, while the prototype has one authored example. This changes the initial fold and pushes assignments down; these are actual distinct fixtures, not duplicate mounted controllers. The saved-work sidebar links to the Notebook instead of showing invented recent-question rows or unsupported completion claims.

The original c7bff74 `unavailable-saved-status.png` captured a transitional loading screen rather than the asserted unavailable-status alert. After this audit finding, the capture owner added settled-controller/alert waits without weakening the original checks. The final b39e74d image was independently reopened: it now shows the actual saved-response error, readable refresh control and no stale composer. The earlier image remains retained with its erratum and cannot establish the alert's presentation.

## Active study — final candidate

Directly inspected all 11 pairs in the [final active-study gallery](active/visual-1792966687797/COMPARISON.html): first question and displayed help at 1440×1000, 1024×768, 390×844 and 320×844; native 200% first/help and the 100% first-question control. Its source is b39e74d/build pFAtaZMHlK_WKmfYtwcfn. The earlier 64c78ab preview is not used as final-source acceptance.

The single paper page, numbered gutter and conversation remain coherent. Prompt and original help request wrap legibly at 320px; the one composer and its suggestions remain distinct from the displayed help. At native 200% the application toolbar fits its compact menu/account controls. The application does not reproduce the prototype's own clipped right-hand toolbar at this zoom. The [four facing-reader captures](active/facing-layouts-1792966621859/report.json) were also directly inspected: the full approved passage is readable beside the page at desktop/tablet widths and occupies its own phone pane. The returned 320px page preserves its visible draft and prior scroll position.

- **P3 — first-question hierarchy:** the application adds session metadata, status/elapsed time and a prominent focus outline on the question heading. Its actual approved passage cards contain titles/IDs rather than the prototype's excerpt previews. This changes spacing and emphasis without hiding the original prompt.
- **P3 — help density:** the displayed authored help has longer paragraphs and existing audio controls, so the composer is farther down than the prototype's shorter demonstration reply. The application uses a generic displayed-assistance label and lacks the prototype's per-message timestamps/per-concept help caption. Those fields are not invented. The missing historical metadata remains a contract limitation, not evidence of an undisplayed receipt.

## My Learning, assignment and standalone reading — final candidate

Directly inspected all 16 pairs in the [supplemental route gallery](routes/visual-1792966714179/COMPARISON.html), including all four widths, native 200% for the three routes and the native-100 My Learning control. The source/build matches the final candidate. The My Learning observations above still apply after the actual journey creates an additional teacher-reviewed record. Assignment headings, continuation controls and plain-language instructions remain readable at each width.

- **P2 — standalone reading density:** the application retains class/reading/chapter selectors and the source/version disclosure above the passage. These controls push the actual article below the initial 390/320px viewport, and well below the fold at native 200%; the compact prototype presents passage text sooner. The application has a readable full passage and functioning search/contents, but this is a material content-priority difference.
- **Comparison limit:** the overview application is an actual in-progress assignment with submitted practice, while its prototype reference is not started. They share the overview purpose but are not identical workflow states. Publication dates, teacher instructions, topic count and shortened reading titles also differ according to available approved content. No synthetic progress or teacher instructions were inserted to match the reference.

This walkthrough supplies inspectable visual evidence and specific differences. It does not grant full prototype parity, native mobile software-keyboard acceptance, screen-reader acceptance or human teammate sign-off.
