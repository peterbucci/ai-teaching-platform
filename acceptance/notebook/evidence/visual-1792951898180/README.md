# N7 production visual comparison

Tested application source: `1726c9c12f171095fed8c327b8a5852e8057c924`.
Runtime: local production Next.js on the isolated, provider-disabled N7 database.
All accounts and records are fictional. Zero paid model calls.

Open [COMPARISON.html](COMPARISON.html) for 31 approved-prototype/application
pairs. [visual-results.json](visual-results.json) contains geometry, checks,
source identities and limitations. The directory contains 63 screenshots,
including a separate native-200% composer view. The full application/service
source hash inventory is in [production-source-files.json](production-source-files.json).
Its reported digest hashes the ordered entries serialized with `JSON.stringify`
in UTF-8, independently of the report file's indentation.

## Executed

- My Learning, assignment overview, saved work, standalone reading, teacher review
  and existing active study at 1440×1000, 1024×768, 390×844 and 320×844.
- All six surfaces at actual native 200% Edge zoom. Separate fresh 100% and 200%
  profiles measured DPR 1 → 2 and CSS viewport width 1416 → 708; visual viewport
  scale and CSS zoom remained 1. Captures use CDP `fromSurface: false`.
- The existing composer is reachable at native 200%.
- Standalone reading bootstraps from inactive state, keeps one reader mounted,
  deactivates for keyboard-opened account controls, and preserves layout height
  through cover/uncover at all four widths. Mobile navigation cover/uncover
  additionally passed at 390 and 320px.
- No horizontal application page overflow or browser errors observed.

The final PNGs were visually inspected, including 320px reading and native-200%
My Learning/composer captures. This is visual and host-composition evidence;
receipt failure/reconciliation and answer recovery require their separate suites.

## Comparison limits and remaining difference

The reference ZIP was rehashed to
`fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`;
`Main.dc.html` matched
`70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4`.
The source export was unchanged. Wrappers select its approved scenarios.
External Google Fonts requests were blocked, so prototype fonts use available
local fallbacks. Real authorized data and approved activity text remain
authoritative, rather than the prototype's scripted identities or instructional
content.

Active study, standalone reading and delivered review retain the existing
Workspace under controller/visibility ownership gates. These screenshots do not
claim complete Notebook shell parity. N3 remains current-data mode and explicitly
does not invent the prototype's chronology or per-attempt results.

**P3 presentation difference:** N5's inherited container breakpoint stacks its
action within the roughly 780px desktop home column. The prototype keeps that
action right-aligned. This reduces density and places assignments lower, while
all controls remain available. No leaf/controller file was changed for this run.

Two earlier development-run directories remain as failed harness evidence:
`visual-1792951573891` used the wrong accessibility role for a native summary;
`visual-1792951610602` waited for a brand label absent from the prototype focus
header. The corrected final run uses the account's accessible label and the
prototype's actual root marker. Those failures do not establish application bugs.

## Reproduction

Use the separately provisioned disposable N7 runtime with blank model credentials
and the exact database/origin guards in `acceptance/notebook/visual.mjs`. Provide
the verified final export under ignored `.setup/prototype`. Run the script through
`.setup/runtime/run.cjs`, with `N7_VISUAL_RUNTIME=production`, after a completed N7
journey supplies real session/attempt/approval identities. Playwright uses a fresh
context and one fictional-student login; native profiles live only under ignored
`.setup` and must never be committed. No existing user browser/profile is reused.
