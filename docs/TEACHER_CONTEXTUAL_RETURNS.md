# Teacher contextual returns — K handoff

Base: `07efb7f821339538800f150f57b298eb2e606be3`. Coordination: #8, #21, #114, #120.

G owns Roster outgoing links and destination restoration; H owns Insights/Concerns
outgoing links and destination restoration. K owns the shared contract,
`workspace-session-context.ts`, session receiver and focused regression tests.
No Roster, Insights, Evidence, intervention or student page is changed here.

## Outgoing links

Use `teacherWorkspaceHref('/teacher/sessions/' + session.id, context)` from
`lib/teacher/workspace-contracts.ts`. Start with the current authorized page
selection, not an older shell snapshot. Optional target `session`, `attempt`,
`evaluation` must identify the exact inspected evidence. No answer, rubric,
draft/request identity, arbitrary destination or selector belongs in this URL.

| Origin      | Required discriminator | Original bounded context                                                                                            |
| ----------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Roster (G)  | `returnTo: 'students'` | `assignment`, `origin`, optional `student`, `concept`, `q` (trimmed, at most 120 characters), `participation: 'all' | 'submitted' | 'opened' | 'missing'`, `rosterPane: 'navigation' | 'main' | 'context'` |
| By idea (H) | `returnTo: 'insights'` | `assignment`, `origin`, optional `concept`, `misconception`, `student`                                              |
| Concern (H) | `returnTo: 'patterns'` | Same investigation fields; omit `misconception` for an uncategorized concern                                        |

`origin` remains `all|live_demo|synthetic_fixture`. Roster senders capture the
current `workspacePane` as `rosterPane`; these names are deliberately distinct.
The two new Roster fields are parsed only for `returnTo=students`. No generic
pane/view schema changes. H infers its ideas/concerns view from `returnTo`; no
extra shared view parameter is needed.

## Receiver and displayed Back

The existing session loader first authenticates and loads the authorized session
and pinned assignment content. The resolver rejects mismatched assignment,
student, session, origin, attempt or evaluation; contextual concepts/categories
must exist in that pinned content. An explicit selected student must match the
inspected session. Invalid/stale context uses the existing not-found behavior.
URL validation never grants access. Missing original selections remain absent.

The displayed Back preserves assignment/origin and the original page selections,
including `returnTo`, while removing target session/attempt/evaluation and seeds:

- Roster: `/teacher/students`, preserving name search and participation;
  `rosterPane` maps back to `workspacePane`. Focus fragment is
  `roster-attempt-{validated attempt}` for explicit main/Work log returns,
  otherwise `roster-student-{selected student}`, otherwise `roster-main`.
- Concern: `/teacher/insights#patterns`, retaining concept/category.
- By idea: `/teacher/insights#concept-{selected concept}`; a legacy bare session
  deep link returns to its authorized assignment's Insights `#responses`.

Fragments are encoded identities or fixed tokens. G/H own resolving these fixed
targets after rendering, with a visible fallback when a changed filter removes
the target. A displayed Back is an ordinary Link. Native Back/Forward retains its
separate history entry, original URL, focus and scroll; no `history.back`, referrer
guessing or storage replacement is introduced by this patch.

## Existing boundaries

Class Progress namespaced selections and return anchors are unchanged (C2).
Course Assignments remains bare discovery (S1). Evidence keeps its page-owned
restoration boundary (F1). Assignment switching starts from new assignment/origin
and clears stale identities. Shell navigation, draft guards, private work and
default pane behavior remain unchanged.

End-to-end R01/R02 completion requires G/H's links and receiving selection/focus
controllers together with this receiver. A receiver-only test cannot establish
that their page implementations work. Shared label redesign is outside this fix.
