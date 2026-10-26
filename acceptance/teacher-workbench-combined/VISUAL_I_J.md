# Interventions and Lessons comparison

Application: `c26664e49b7cc15fa7c63828f5c582c9b8cac2d8`. Compared original application and actual approved prototype screenshots at 1440×1000, 1024×768, 390×844, 320×844 and native 200% (708×454 CSS viewport; 1416×908 physical screenshot). Native comparison uses the full `*-native200-cdp.png` surface. Images were visually inspected, not judged solely by capture success. Independent acceptance is pending.

## Interventions: R07 and R09

At 1440 the three Evidence / Activity / Steps panes are present. At 1024, Activity and Steps remain side by side, with an Open Evidence control: the original R09 tablet pane inversion is corrected. At 390 and 320, all six completed/current step headings fit in the initial viewport, and follow-up counts and the caution about assisted success are readable. At native 200%, four completed steps plus the beginning of step five appear; the prototype shows four completed rows. The previous paragraph-heavy Steps density is corrected. The compact summaries still retain saved revision and approval/delivery state.

The application capture is a delivered synthetic curated activity with fourteen selected responses, one recipient and a recorded follow-up. The prototype is an approved, undelivered activity with five answers and two recipients, in the editing view. The application center pane is Student preview. Different text, selected mode, counts and the absence of an active Deliver button in the delivered state are not layout regressions. The new connected browser journey separately exercises actual editing, approval and delivery; these images alone do not prove those operations.

The exact original R07 draft was rechecked across three locale/time-zone combinations and all four widths, plus native 100%/200%. Fourteen states passed with no page/console errors and unchanged saved lifecycle timestamps. The first attempt stopped on a login rate limit before checking any state; it is retained separately. No hydration error was reproduced in the completed run.

## Lessons: R08

At desktop/tablet, the library retains source identity, objective/question counts, saved-draft continuation, immutable published version and class count. At 390 and 320, metadata is compact, the continuation action has visible separation, and the first complete lesson appears in the initial viewport. At 320 three full rows and part of a fourth are visible; native 200% now shows the first full lesson row and its Details control. The original R08 no-row-at-zoom and abutting-text defects were not reproduced.

The application has six long synthetic lesson titles, including identifiers deliberately embedded in fixture titles. The prototype has three shorter curated titles. These are fixture titles, not a recurrence of the R03 student concept-label defect. Consequently the teaching-material section falls farther down the application page; the different row count prevents treating that position alone as a spacing failure. Each application row is still taller than the compact prototype because it includes explicit draft/status/continuation information. Search/Clear at mobile and native zoom and keyboard Details/focus checks passed in the capture helper's separate functional probes.

Remaining P3 fidelity differences: Lessons lacks the prototype's visible desktop column-heading row and uses different status/type styling; compact source details move behind Details at small widths. These do not demonstrate inaccessible records. Final reviewers should assess density with representative approved lesson titles as well as the intentionally long synthetic ones. No P0/P1 issue was demonstrated by this comparison.

## Evidence

- [Interventions comparison](comparison-gallery.html#interventions)
- [Lessons comparison](comparison-gallery.html#lessons)
- [Application capture receipt](application-01/report.json)
- [Prototype capture receipt](prototype-01/report.json)
- Hydration, lifecycle and read-only functional receipts are retained in the verification bundle.

These observations support the scoped R07/R08/R09 corrections. They are an integration comparison, not independent acceptance or permission to merge.
