# N5 final-prototype verification — October 25, 2026

Existing implementation `e1d23e0` is preserved on the same branch, based on main
`723ed6fea41138b604a9d333ebcd4a07b2202c36`. Only N5's reserved paths change.
No model/database calls, merges, routes or shared controllers.

## Authoritative reference

Verified user-supplied `Student-Notebook-Final-Prototype-fa69c2d0.zip`:

- ZIP: `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
- Main: `70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4`.
- V1440-HelpMsg: `d8066c41c9ad9f0c07a7a3063346a30c3cc48b15c77cb937b38ef8d6f9b79682`.

Main was rendered with its bundled runtime at all four widths; its actual Open
review interaction was inspected. V1440-HelpMsg shows **Help request · not
graded**, an unanswered question and one composer. [Help reference](screenshots/final-help-reference-1440.png).
This is prototype inspection, not application classification or real AI proof.
Attachment instructions did not authorize application changes. ZIP/raw exports
and the external project reference remain outside the repository.

## Corrections and boundaries

- Match 19px section/16px panel headings, retain the 18px title, and match the
  teacher tag, compact status pills, metadata leading and feedback padding.
- Add distinct correct/partial/incorrect/uncertain result marks with full text
  labels. An accepted evaluation uses an information badge; acceptance itself
  does not signal correctness.
- Stack rows at 819px. A local container query also handles a narrow card inside
  a desktop parent. Preserve 44px actions and wrapping long identifiers.
- Scope typography/link/focus rules to N5 elements so the controller retains its
  headings, paragraphs and links.

Deliberate differences: status stays unknown until actually loaded; viewing is
recorded only by its existing owner. No unread count, teacher name, objective
number, due date or extra teaching content is invented. New-row padding stays
contained instead of using negative margins. Approved content always wins.
Explanation/excerpt/practice layout and fresh-check controls remain with the
existing shared renderer/controller, outside this leaf's ownership.

## Visual comparisons

Normalized comparisons use final-export row structure/CSS above the actual
presenter, with identical fictional approved canal content and public DTO
fields only. Raw full-interface captures are separate; normalization is not
presented as the entire unmodified prototype.

| Iframe viewport | N5 row and 16-state gallery         | Normalized comparison                               | Raw Main reference                                |
| --------------- | ----------------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| 1440px          | No horizontal overflow; two columns | [Comparison](screenshots/final-comparison-1440.png) | [Reference](screenshots/final-reference-1440.png) |
| 1024px          | No horizontal overflow; two columns | [Comparison](screenshots/final-comparison-1024.png) | [Reference](screenshots/final-reference-1024.png) |
| 390px           | No horizontal overflow; stacked     | [Comparison](screenshots/final-comparison-390.png)  | [Reference](screenshots/final-reference-390.png)  |
| 320px           | No horizontal overflow; stacked     | [Comparison](screenshots/final-comparison-320.png)  | [Reference](screenshots/final-reference-320.png)  |

[Measurements](screenshots/final-layout-checks.json) record real iframe viewport
widths, not scaled desktop screenshots. [Review detail reference](screenshots/final-review-reference-390.png)
and [accepted feedback/source](screenshots/final-feedback-source-320.png)
show the separate reference and implementation scopes.

Reference-only observation: the raw scrollable prototype root has 15px less
client width than its iframe; hidden phone horizontal overflow measures 387/375
and 319/305. These are reference-root measurements, not N5 overflow. No shared
shell files were changed.

## Passed

- **480 unit tests**, including 14 N5 tests: accepted identity, rejected/pending
  output privacy, original text, missing/mismatched follow-up, exact version
  links, escaping, no side effects, result markers and one visible controller slot.
- Full ESLint, TypeScript and formatting. Initial formatting flagged three new
  measurement JSON files; the files were formatted and the check rerun.
- Webpack production build: `node node_modules/next/dist/bin/next build --webpack`.
  The existing PDF extractor emits a `module.createRequire` parsing warning.
- Tab order P01 → P02 → disclosure, visible focus, Enter opens/Space closes.
  Expanded exact source/feedback fit at 320px. Original response survives a
  fixture reload unchanged. [Keyboard results](screenshots/final-keyboard-checks.json).
- Narrow desktop slot and 768/819/820px checks stack without overflow. Synthetic
  controller slot mounts once; heading size/leading/margin match an unwrapped
  baseline. [Composition results](screenshots/final-composition-checks.json).

The React DOM helper, gallery, controller slot and reload use fixtures. They do
not establish database evidence, unsent draft recovery, receipts or idempotency.

## Failed, limited and unrun

No scoped presenter check remains failed. Earlier default Turbopack failed to
resolve externally junctioned dependencies; Webpack is verified. No build or
dependency configuration changed. The prior 293-check content result is
historical; this pass did not edit content or repeat that unrelated check.

N0 PR #125's review seam was inspected at `6ad1709`; the owner was notified and no
shared contract edit was needed. This package remains **unmounted**. Route
integration, complete final-design activity layout, authenticated cross-role
flow, PR #113 browser recovery, actual draft preservation across shell changes,
server cross-student isolation, screen-reader/200% zoom/device review, hosting
and independent human acceptance are **unrun**. Approvals may have multiple
recipients; public follow-ups have no student ID, so the loader owns authorization.

The older verification report and non-final screenshots are historical. The
`final-*` captures supersede them. No paid calls or merges.
