# Original-answer capture gap closed

**The teacher's complete original answer is now visible in actual screenshots at all four requested sizes.** This closes the screenshot gap identified in the [continuation visual review](POPULATED_CONTINUATION_VISUAL_REPORT.md). The previous page-top images and failed-run provenance remain unchanged. This is a capture addendum, not an application layout fix or an uninterrupted journey claim.

The reviewed read-only helper ran on October 25, 2026, **06:35:29–06:35:31 UTC**, against source `462cfb1b31d9108cec70d18b6553bd45048d2eed`, tree `03cca1fed3900a122e689c4a512afadd9052e5af`, origin `http://localhost:3350`. It used the exact run05 receipt SHA256 `7e99672e7cf7e6689d1bcc53d57a68f1a052eecd6b09ee77ea7a8d9de3970051`. [Raw capture report](original-answer-selected/report.json) and [guard receipt](original-answer-selected.guard.json) retain execution details. All four PNGs were opened for visual inspection after capture.

The guard verified the exact clean source, provider-disabled state, reviewed safety module and 10 GiB storage preflight. The helper performed one authorized fictional-teacher login, then same-origin read-only navigation. No other mutation, blocked request, page error or document horizontal overflow occurred. The browser closed and the guard released its own lock immediately after capture, before publication or further accessibility work.

## What the new evidence establishes

At each viewport the helper selected the exact existing attempt element, compared its `textContent` with the original response **including leading/trailing spaces and the newline**, then scrolled that element into view. It did not change text, focus, source records, approval, evaluation or assignment state. The matched response SHA256 is `a007b66ac2172e2e772eb65b872dbd343b106cc8c802b6d19325d4bb302564a1`.

| Viewport    | Original-response bounds in CSS pixels                | Actual screenshot                                                                      |
| ----------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1440 × 1000 | x293, y526.125, width854, height92; bottom618.125     | [Full answer](original-answer-selected/teacher-original-answer-selected-1440x1000.png) |
| 1024 × 768  | x85, y338.125, width854, height92; bottom430.125      | [Full answer](original-answer-selected/teacher-original-answer-selected-1024x768.png)  |
| 390 × 844   | x35, y338.03125, width320, height168; bottom506.03125 | [Full answer](original-answer-selected/teacher-original-answer-selected-390x844.png)   |
| 320 × 844   | x33, y337.53125, width254, height168; bottom505.53125 | [Full answer](original-answer-selected/teacher-original-answer-selected-320x844.png)   |

The complete question and response are readable in all four images. The phone answer is clear of the 57px sticky header and 65px/80px bottom navigation. Desktop navigation has scrolled out of view. The computed answer style is a sans-serif stack beginning with Inter, 16px text and 28px line height; the prototype's original-answer reference uses serif reading typography. These captures do not change the previously reported pane/layout differences.

Exact record identity:

- Assignment `ebc4eb03-22ba-409b-b1c4-10bc54a86967`.
- Session `07c3336c-108a-4e79-bca3-02c382b3756a`.
- Attempt `280d524b-0b14-41df-a287-3e29bfdd5646`.
- Source `48bae4f7-63a2-4876-bc6d-b5b2d99a6b9f`, version1; lesson `d1468c98-b268-4566-9301-114be6f836da`, published version1.

Route/attempt/text were independently checked in this capture. Source and lesson identity comes from the hash-pinned run05 reconciliation receipt; this helper did not independently fetch a new content-reference payload.

## Later synthetic evaluation is a separate state change

The screenshots visibly contain **Incorrect** and **AI evaluation · synthetic-same-browser-journey**. That is an injected synthetic test judgment, **not an actual model result**. Run05 at06:08 still had no accepted evaluation. The subsequent `final-intervention-prepare-01` fixture added accepted evaluation `bfa4701d-550b-4eaa-bce1-3eef49bcfb0c`, created at **06:09:01.972 UTC**, before intervention preparation was rejected by its draft quota. The earlier pending-review entry belongs to that same lifecycle.

The fixture is implemented in the prepare phase of [intervention-continuation-fixture.mjs](../runner-final/intervention-continuation-fixture.mjs). Its [host receipt](../evidence/final-browser/final-intervention-prepare-01/host-receipt.json), [read-only reconciliation log](../evidence/final-browser/final-fixture-reconciliation-01/quota-and-original-read-only.log) and [container receipt](../evidence/final-browser/final-fixture-reconciliation-01/container-receipt.json) establish the later synthetic state. The original response remained unchanged. This capture performed no provider call and did not create or deliver an intervention.

The [initial-view versus selected-answer gallery](original-answer-selected/gallery.html) is explicitly a comparison of capture framing and later fixture state on the same source commit. It must not be presented as before/after application improvement. Earlier images are retained at their original scroll position.

## Remaining limits

This bounded capture passed text identity and visual framing. It does not pass prototype fidelity, keyboard focus restoration, actual 200% zoom, screen-reader behavior, real-model decisions, teacher approval/delivery or linked follow-up. Those require their own executed evidence. No original raw result was rewritten to convert a failure or an unrun step into a pass.
