# N5 component verification — October 25, 2026

**Historical pre-final record.** Superseded by
[final-prototype verification](FINAL_VERIFICATION.md), which uses the verified
authoritative `fa69c2d0…c570` archive. Pending-export statements below describe
the earlier pass only.

Base: `723ed6fea41138b604a9d333ebcd4a07b2202c36` (`main`).
Fictional approved canal activities are used throughout; no model or database
calls were made for this package.

## Automated checks

- Full unit suite: **480 passed**, including 14 focused N5 tests.
- Full ESLint, TypeScript, and Prettier checks: passed.
- Approved-content check: **293 checks passed**.
- Production build: **passed with Webpack** using
  `node node_modules/next/dist/bin/next build --webpack`.
  The existing PDF extractor emits a `module.createRequire` parsing warning.
  Default Turbopack failed to resolve the externally junctioned dependencies in
  this isolated checkout. No package or build configuration was changed.

The default Node test runner sets `react-server`; the small `render.mjs` helper
runs normal React DOM in a child process so tests inspect real rendered HTML.
It uses the existing TypeScript dependency to compile TSX, adds no dependency,
and is never imported by production code.

Coverage includes delivery/display versus start/submission, missing/loading
follow-up, approval mismatch, submitted/pending/failed/accepted states, missing
accepted-evaluation identity, original text, per-concept results/uncertainty,
assistance wording, curated/uploaded exact-version reader URLs, privacy
allowlisting, escaped untrusted text, absence of writes/receipts/composers, stale
list suppression, and one visible controller slot.

## Component-level visual comparisons

The final corrected Claude export is **still pending**. These comparisons use
the available local `student-notebook-reference.html` export, SHA-256
`b0399dc8216b88713e0faf21c94c6308eec5d08026591619f189a051b9f77a7c`.
They are provisional comparisons, **not final corrected-design acceptance**.

Each comparison renders the export's review-row structure and CSS above the
actual React presenter. Both use the same fictional approved title/objective.
Unsupported prototype-only teacher names, due dates and concept metadata are
omitted. The original export and project reference are not copied into this PR.

| Component viewport | Row and 16-state gallery horizontal overflow | Open action height | Comparison                                     |
| ------------------ | -------------------------------------------- | ------------------ | ---------------------------------------------- |
| 1440px             | None (`scrollWidth = clientWidth = 1440`)    | 44px               | [Desktop](screenshots/comparison-1440.png)     |
| 1024px             | None (`scrollWidth = clientWidth = 1024`)    | 44px               | [Tablet](screenshots/comparison-1024.png)      |
| 390px              | None (`scrollWidth = clientWidth = 390`)     | 44px               | [Phone](screenshots/comparison-390.png)        |
| 320px              | None (`scrollWidth = clientWidth = 320`)     | 44px               | [Narrow phone](screenshots/comparison-320.png) |

The browser used exact-width iframe viewports, not a scaled screenshot of a
desktop layout. [`layout-checks.json`](screenshots/layout-checks.json) records
the measurements. The 16 gallery cases include long unbroken content, empty
sources, unknown/loading/unavailable follow-up, all lifecycle presentations and
uncertainty. Accepted feedback and an expanded source-version disclosure were
also inspected at 320px with no overflow; Enter toggled the disclosure with a
visible focus outline: [feedback and exact source](screenshots/feedback-source-320.png).

The design's ink/green/amber palette, approved title/objective hierarchy,
two-column desktop row, stacked phone action, paper panels, and original-answer
serif treatment are retained. Deliberate differences: a visible **status not
loaded** label replaces prototype-inferred progress; new-row padding stays
inside its container; delivery/viewing use recorded timestamps; no mockup
teaching text is copied. Explanation/excerpt layout remains in the existing
shared activity renderer under its owner's control.

## Remaining integration gates

This is an unmounted presentation package. The existing route owner must mount
it and retain the dedicated fresh-check controller, then verify authenticated
delivery → actual display → explicit start → original answer → accepted feedback
→ teacher follow-up comparison against the combined commit. This PR does not
claim that journey passed.

Public DTOs do not carry recipient identity on a follow-up. Unit tests prove
approval correlation and absence of shared presenter state, **not** server
cross-student authorization for a shared approval. That service boundary is
unchanged; fresh authenticated database isolation checks were not run here.
Final corrected-export comparison, combined N0/N1/N2 mounting, full keyboard
journeys, screen-reader review, zoom/device testing, hosted verification and
independent human acceptance remain open. No paid calls or merges occurred.
