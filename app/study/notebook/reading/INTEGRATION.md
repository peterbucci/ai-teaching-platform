# N4 reading presentation handoff

This package consumes frozen N0 presentation v1 from PR #125 at
`16c0ed33e02c28be39aa30f4ea6d1eeb23077c27`. It is an isolated leaf, with no route,
API, database, reader-controller, shell, teacher UI or PR #113 changes. The draft
PR targets the N0 branch so its diff contains only N4 files; retarget after the
dependency is merged, preserving the frozen contracts.

The approved reference ZIP has SHA-256
`fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
See [verification/RESULTS.md](verification/RESULTS.md) for comparisons, limitations
and reproducible checks. The external project reference was read at the
user-authorized `PROJECT_CONTEXT.md` replacement; it was not copied here.

## Inputs and composition

Import `NotebookReading` and `NotebookReadingCitations` from `reading/index.ts`.
Import the shared types and helpers from N0's `notebook/index.ts`. N4 exports its
own implementations without changing N0's barrel.

`NotebookReading` accepts exactly `NotebookReadingProps`:

- `state`: the existing authorized, resolved `StudentReaderView`, wrapped in
  `NotebookState`. Never reconstruct it from a URL or prototype data.
- `context`: `notebookReadingContext(view, returnToSession)`, wrapped in
  `NotebookState`. Derive it from the same resolved view. Keep assignment, source
  identity, exact version, selected passage and session together.
- `reader`: exactly one node supplied by the existing reader owner. This node
  owns all passage rendering, delivery/recovery, search, preferences, bookmarks
  and return actions. N4 adds identity, consistency checks and presentation only.

For the **existing visible reading route**, after the integrating owner approves
route changes, the composition is:

```tsx
const context = notebookReadingContext(view, returnToSession);
<NotebookReading
  state={{ status: "ready", data: view }}
  context={{ status: "ready", data: context }}
  reader={existingReaderNode}
/>;
```

Keep the existing `reader.css` loaded once, before N4's CSS module. N4 adapts its
markup through scoped selectors; it does not import global styles into other
student pages. Do not replace or rewrite the existing `StudentReader`. Its
`--reader-size` value and controls remain authoritative. Disabled class/source
selectors are omitted visually when all choices are disabled and identity is
already shown; enabled selectors remain available. Passage bodies and source
links are rendered by the existing bounded `ReadingBody` path, including its
existing treatment of standalone source-line references.

For same-scope refreshes, use `pending` with the current view and matching context.
The same reader stays mounted and retains its search, text sizing and bookmark
state. Missing, empty, unavailable or mismatched inputs render a status instead
of mounting the supplied node. A new assignment/session/source selection must
receive a newly authorized view; old data must not be relabeled as that selection.
The consistency check is not authorization or a replacement for server validation.

## Citations and return

`NotebookReadingCitations` receives `view`, its matching `context`, the actual
server-issued `passageIds`, and optionally the server-issued `citationId`. It
shows approved passage IDs/titles, without pre-rendering their bodies. An unknown
passage or mismatched context becomes unavailable, without a fallback to another
source or the latest version. Links are ordinary native anchors to the existing
reading route, preserving modified-click/new-tab behavior. They encode the exact
assignment, version, passage, optional session, citation and study-return intent.

Use the citation component at the existing owner's citation/action seam; do not
introduce a second set of actions that bypasses a controller's busy/recovery gate.
N4 performs no prefetch, request, display acknowledgment or persistence operation.

Set `returnToSession` only for the current route's citation / `from=study` entry
with a resolved session. `notebookHref(context.returnTo)` preserves the resolved
assignment, session and current attempt. Without a current attempt it retains the
session without inventing an anchor; independent reading returns to the assignment
overview. N0 v1 cannot promise a cross-route return to a different historical launch
attempt. Never alter `currentAttemptId` or add an arbitrary return URL.

The existing reader's return controls must remain in charge of pending display
receipts. N4 deliberately adds no competing return button that could bypass them.
For future in-place return, the owner must provide a reviewed action that respects
those same pending/error states and restores focus to the preserved question or
composer. Do not navigate away or unmount the study controller merely to switch
the visual pane.

## Facing pane gate and responsive responsibilities

**Live facing-pane integration remains NO-GO under N0 #125.** The reader at this
dependency base opens/acknowledges session reading from effects without pane
visibility checks. A hidden mount is not inert. Neither N4's CSS nor mounting a
reader once fixes that. Until the reader owner's separate visibility change is
reviewed and accepted on a pinned combined head, use the existing visible reading
route for live session reading. Do not clear session context, invent receipts or
patch the controller inside this package. An independently reported owner fix is
not combined acceptance; it is not included in this branch.

The owner has now published [visibility PR #132](https://github.com/peterbucci/ai-teaching-platform/pull/132)
at `22990f2e47ea15b72af47245ea2d14da04f3e0b9`. Its required `StudentReader.active`
input leaves N4's reader-slot contract unchanged. N7 must derive it from actual
pane exposure, breakpoints and covering overlays; the reader additionally checks
document visibility/focus and actual passage presentation. Preserve one instance
within the same authorized scope and change its active signal with the visual
switch. Re-key only when actor/assignment/session/source scope changes, as the
reader-owner contract specifies. Do not set a hidden instance permanently active.

N4's direct verification fixture now supplies `active: !pane || open` alongside
its existing props, using a spread compatible with both reader versions. Its pane
test exposes no covering overlays and makes the open reading visible at all tested
widths; a production shell needs its own full exposure calculation. This is fixture
compatibility, not a new production visibility owner. A read-only compiler overlay
against the clean PR #132 checkout passed; no controller source was copied, changed
or merged. See the verification report for the exact check and remaining gates.

N1 owns the responsive grid: 268px rail / flexible page / 384px facing context at
1280+, 372px facing context below 1280, and full-width reading replacing the visible
question below 820. Keep the question/conversation/composer mounted and inaccessible
while visually hidden; restore focus on return. N4 uses container queries to adapt
the same reader to each slot, with a contents disclosure below 901px and extra
spacing adjustments below 361px. It adds no nested page scroll owner, focus trap,
route state or second reader store. The shell/display owner must coordinate actual
pane exposure, document visibility, focus and acknowledgments before live mounting.

The isolated fixture verifies a mounted draft and conversation surviving local
visual switches. It uses a **session-free** actual reader, so it is inert with
respect to tutoring assistance. It does not establish the live session visibility
gate or PR #113 draft recovery. Its return button and responsive layout are test
seams, not additional production components.

Next integration step: combine reviewed N0/N1/N4, the accepted visibility-aware
reader and PR #113 under N7 ownership; then run authenticated exact-version,
draft/conversation return, hidden/visible receipt, browser history, keyboard,
actual zoom and recovery acceptance. No issue is closed by this presentation PR.
