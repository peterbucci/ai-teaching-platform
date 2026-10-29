# Correction after prototype comparison review

The first N7 comparison did not establish prototype fidelity. It checked
viewport dimensions, overflow and native zoom, but the report described those
checks too broadly. The user's screenshot review exposed genuine presentation
gaps. The draft remains **not visually accepted**.

## Findings and corrections

| Finding                                                                                                                                   | Correction                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The prototype's global Notebook index was compared with an assignment's full saved-work page.                                             | The new comparison uses `/study/history` on both sides. Assignment saved answers retain their separate journey checks.                                                                      |
| The initial history mount dropped existing search, class/source/section, date and session-status filters, plus retry after a failed load. | A scoped N7 wrapper restores those supported controls and retry, using existing history helpers and exact N3 session links. It adds only an idea filter supported by the same public input. |
| Standalone Reading retained the old Workspace sidebar.                                                                                    | It now uses the N1 Notebook header, with one unchanged reader and explicit visibility gating for N1 navigation and account overlays.                                                        |
| Legacy reading CSS overrode the intended N4 grid, borders, spacing and tools.                                                             | Scoped integration styles restore the intended presentation without changing the reader controller or source identities.                                                                    |
| N5 review actions stacked despite enough room in the actual desktop column.                                                               | A scoped container rule keeps the action beside the summary when that column is wide enough.                                                                                                |

The revised gallery explicitly separates functional layout checks from visual
acceptance. Earlier screenshots and failed attempts remain as historical
evidence; they are not silently replaced or relabeled as passing fidelity tests.

## Remaining presentation coverage

- The current-data Notebook index contains session summaries. The prototype
  includes question/answer pages, accepted feedback, displayed-help chronology
  and review grouping within the index. Those are substantial coverage gaps.
  This pass does not fabricate the missing projection or enable #131.
- Active study retains #113's established presentation and controller. Its
  full Notebook mount still requires the explicit owner handoff.
- Reading uses the exact approved source text, passage titles and source tree.
  Prototype fixture wording is not substituted into the live reader.
- Delivered review retains its existing controller frame. Facing reading stays
  disabled, and source-version/receipt recovery rules remain in force.

The corrected verification runs and exact build identity are recorded in the
main acceptance report and N6 handoff. Passing functional checks does not remove
these visual and feature gates.
