# Reader visibility and display receipts

Coordination: N0 #125, N1 #128, N4 reading presentation #130, N7 integration,
and the existing study/composer/recovery owner in #113. This change does not
mount the Student Notebook or change its shared contracts.

## Owner contract

`StudentReader` now requires `active: boolean`. The standalone reading route
passes `active`. An embedded owner must pass `false` whenever the reading pane
is closed, another pane replaces it, or a responsive breakpoint hides it.
Pass `true` only when the reading surface is exposed. Mounting the component,
prefetching a route, or retaining its DOM is not that signal.

The reader also requires a visible, focused browser document before opening a
passage. An exposed but unfocused window conservatively pauses new requests and
receipts until focus returns. This also handles browser hosts that report a
background tab as visible. Focus/blur and document visibility events resume or
cancel the presentation check; every request boundary reads the current values.
After delivery, it waits for the actual passage body to intersect the viewport,
pass CSS visibility/opacity checks, and remain active through two animation
frames. The intervening rendering opportunity is evidence of presentation,
not proof that the student read or understood the passage. This is not a
general detector for opaque overlays: an owner covering the reading surface
must deactivate it.

Keep one reader instance across pane switches. Key it by authorized actor,
assignment, session and source scope when those identities change; never reuse
an old instance for a different session. Passage changes within that scope
continue through the existing selected/pending passage flow. Keep the student's
composer mounted and preserve its draft using #113's existing recovery owner.
The reader does not own or submit the student's answer.

## Lifecycle and recovery

| State                      | Meaning and allowed work                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Hidden/inactive            | No passage-open or display-receipt request starts. Existing requests may finish.                               |
| Visible, requested         | One authorized passage-open request; no assistance receipt.                                                    |
| Awaiting presentation      | Exact returned delivery retained, including while hidden. Fetch/DOM commit does not acknowledge it.            |
| Presented, receipt pending | Receipt sent for that delivery only after the visibility checks. Hiding now does not undo a real presentation. |
| Receipt failed/unknown     | Preserve the delivery ID and retry notice. Pane switches do not retry automatically.                           |
| Acknowledged               | Continue through the existing pending-passage flow; switching panes does not resend the acknowledged receipt.  |

Retry uses the existing intervention identity. Refresh can recover the server's
pending passage; Back/Forward waits for the pending passage before advancing.
An unknown response can mean the server already saved the receipt. The existing
idempotent endpoint reconciles that case without rewriting its display time.
There is no new request ID, client-generated display timestamp, source version,
assistance category, grading rule, API route or database schema.

The two existing writes remain:

- `POST /api/tutoring/{session}/reading`: create/recover the passage delivery;
  `delivery_status=created`, `visible_at=null` until acknowledged.
- `POST /api/sessions/{session}/interventions/{intervention}`: acknowledge the
  existing delivery; repeated receipts preserve its identity and display time.

## N4 and N7 handoff

N4 test fixtures that instantiate StudentReader directly must also supply active for an intentionally visible reader. The owner-supplied slot contract does not change.

N4 continues to accept the owner-supplied reader slot. Do not add a second
reading store, fetching effect or receipt effect to presentation components.
N7 must derive `active` from the shell's actual pane selection and responsive
layout together. A desktop facing pane can be active while the composer is
visible; a phone's hidden reading pane cannot. N1 currently keeps children
mounted across pane switches, so CSS-only hiding is insufficient.

Deactivation must be committed with the pane switch, including keyboard
switches, breakpoint changes and overlays. Activation may resume the existing
authorized pending delivery. Preserve the resolved return URL/current attempt
and pinned content reference. Do not enable answer submission around unresolved
reading recovery; use the existing server/session authority.

This contract permits isolated reader integration work; it is not evidence that
the combined N0/N1/N4/N7 Notebook has passed acceptance. That integration still
needs its own responsive, focus, draft-preservation and recovery verification.

## Focused checks

`node --experimental-strip-types --conditions=react-server --test
tests/reader-visibility.test.ts tests/reading.test.ts
tests/student-reader-presentation.test.ts` covers visibility scheduling and the
existing source/assistance/navigation contracts. Browser/database verification
must additionally exercise the real reader and endpoints with fictional records
and disabled model providers; helper tests alone do not establish that behavior.
