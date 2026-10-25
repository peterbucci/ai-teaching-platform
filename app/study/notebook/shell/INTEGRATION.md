# N1 Student Notebook shell

N1 is an unmounted presentation package. It preserves the original implementation
and adds a small adapter for N0 PR #125 at
`00929bca7d7072a683940b5485d55b4442dd9514`. The PR is stacked on
`codex/student-notebook-contracts`. N0 files are inherited unchanged, not copied
or edited in the N1 diff.

The authoritative design is `Student-Notebook-Final-Prototype-fa69c2d0.zip`,
SHA-256 `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
`Main.dc.html` supplies the full interface; `V1440-HelpMsg.dc.html` supplies the
corrected help example. The source archive stays outside the repository. The
comparison is component-level; full application visual acceptance is still open.

## Exports and ownership

Import implementations from `app/study/notebook/shell/index.ts`. N1 owns only
`app/study/notebook/shell/**` and `tests/student-notebook-shell.test.ts`.

| Export                                        | Purpose                                                                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `N0NotebookShell`, `N0NotebookShellProps`     | Takes N0's exact `navigation` and `slots` types plus optional local `presentation` labels. Preferred integration entry.                                          |
| `NotebookShell`, `NotebookShellProps`         | Original standalone frame: title, destinations, page groups, context, notices and a stable `children` slot. This local type is distinct from N0's contract type. |
| `NotebookPage`                                | Optional paper/gutter around a leaf, with supplied marker and accessible label. Does not infer chronology.                                                       |
| `NotebookState`                               | Empty, loading, pending or unavailable presentation with an optional owner-provided action. No save or assessment inference.                                     |
| `StudentNavigation`, `NotebookPageNavigation` | Native link navigation using owner-supplied destinations and exact identities. No tablist or menu-widget arrow-key semantics.                                    |
| `notebookNavigationLink`                      | Uses N0 `notebookHref`; invokes N0's navigation callback on ordinary clicks and preserves native modified/new-tab clicks.                                        |

The CSS module is local to N1. `verification/fixture.css` is used only by the
standalone preview and is never imported by the shell. No existing route, global
CSS, Workspace, domain service, provider, storage or authentication file changes.

## N0 slot mapping

| N0 slot      | Placement / rule                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `header`     | Replaces the default brand/title content, once. Supply header content, not a second application header.                              |
| `navigation` | Replaces the default three student destinations, once. Use links with the owner's navigation handlers.                               |
| `index`      | Left page rail / mobile Pages pane. The owner supplies authorized page groups and current selection.                                 |
| `page`       | One stable central position across every breakpoint and pane switch.                                                                 |
| `context`    | One facing pane; hidden below 1280px until selected. Hidden content is not evidence of display.                                      |
| `composer`   | Absent while `page` contains intact StudySession. Available only after #113's owner approves an extraction. Never add another input. |
| `notice`     | Outside switchable panes, so errors, feedback and recovery actions remain available when navigation or reading is open.              |

`presentation` optionally supplies `title`, `subtitle`, `eyebrow`, `account`,
`questionContext`, `indexTitle` and `contextTitle`. These are display values from
authorized projections, never permission or routing authorities. The default
navigation is My learning / Notebook / Reading. Teacher-review links come from
N5 in My learning or the index; there is no invented review-list route.

Example for the future integrating owner (not installed by this PR):

```tsx
import { N0NotebookShell } from "./notebook/shell/index.ts";
import type { NotebookShellSlots } from "./notebook/contracts.ts";

const slots: NotebookShellSlots = {
  page: existingStudySession, // exactly one existing <StudySession ... />
  index: authorizedPageLinks,
  context: existingVisibilityAwareReader,
  notice: existingRecoveryAndFeedback,
  // composer deliberately absent
};

return (
  <N0NotebookShell
    navigation={ownerNavigation}
    slots={slots}
    presentation={{ title: authorizedAssignmentTitle }}
  />
);
```

Do not key the shell or its stateful child by breakpoint, pane, or selected
read-only page. Do change/reconcile identity through the controller owner when
the actual actor/assignment/session changes. N1 never retargets a controller.

## N2–N5 and PR #113 handoff

- N2: place My Learning / assignment overview in `page`; keep the existing
  AssignmentAction and optional N5 review cards in the leaf's supplied slots.
- N3: place authorized saved-work index links in `index`, and the selected
  current-data leaf in `page`. Never expose undisplayed help or invent chronology.
- N4: mount the existing reader once in `page` for standalone reading or once in
  `context` for facing reading. Preserve exact version/passages and return links.
  Its existing visibility owner must gate display receipts; CSS mounting alone
  is not permission to acknowledge. N1 performs no acknowledgements.
- N5: mount the existing delivered-activity controller in `page`, with review
  identity and teacher-approved activity unchanged. Do not mount ordinary
  StudySession alongside it or copy instructional text from the prototype.
- PR #113 at `71898a8a72908577065bcc7c7fb9035d6cc29ebf` retains StudySession,
  StudyDialogue, scrolling, completion and save recovery ownership. That owner
  must supply the persistent notice slot and verify hidden-pane observers before
  active-study integration. N1 cannot move existing session errors/feedback out
  of the controller without that handoff. This is an explicit integration gate.

## Responsive behavior and preservation

At 1280px and above, the rail, central page and context share one grid. Between
820px and 1279px, Pages expands above the page and selected context sits beside
it. Below 820px, Pages, context and navigation are single-pane presentations;
the same learning subtree remains mounted but is CSS-hidden. Notices stay outside
that selection. Hidden DOM is removed from normal keyboard/accessibility flow.

Opening a pane focuses its region. Escape or Back to page restores the triggering
button; selecting a page focuses the central region. Tab/Shift+Tab, Enter and
Space use native control behavior. No shell handler submits or evaluates.
The compact header and gutters follow the final prototype; complete headings
remain in the page when the narrow header title truncates.

The shell does not replace the existing conversation scroll root or pin a second
composer. It uses natural page height and `dvh` for side-pane limits; short
keyboard-sized viewports can scroll to the one composer. Native mobile keyboards
and the real #113 conversation still require integrated device verification.

N0 owns route serialization and the host owns history. Browser Back/Forward
retains mounted state when that host keeps the same subtree; a full route reload
still relies on existing controller recovery. The fixture verifies the former,
not the latter. Native modified/new-tab links keep normal browser behavior.

## Remaining review boundaries

No N0 contract update was necessary: shared slots/navigation are consumed directly.
N0's freeze/coordination wording must be reconciled by its owner with the now
authoritative design; N1 does not edit it. The local `presentation` labels are an
adapter detail, not a new shared contract.

Remaining full-application checks include notice extraction, display receipts,
live reader return, PR #113 scroll/Jump-to-latest behavior, real save recovery,
screen readers and native mobile keyboards. See `verification/RESULTS.md` for
executed checks, source identities, screenshots and comparison differences.
