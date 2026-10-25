# N2 — My learning and assignment overview

N2 is an isolated presentation package based on main `723ed6fea41138b604a9d333ebcd4a07b2202c36`. Existing routes, shared shell, PR #113, services and storage are unchanged. Refs #73 and #114; this package does not close either issue.

## Mounting for N0

Import `MyLearning` and `AssignmentOverview` from `./learning/index.ts`. Each component imports its own CSS module. Mount one instance in N1’s page slot; do not also render the existing overview/list around it. No new route or global CSS entry is needed.

```tsx
<MyLearning dashboard={dashboard} teacherReviews={n5ReviewArea} />

<AssignmentOverview
  key={lesson.id}
  lesson={lesson}
  savedWork={{ assignmentId: lesson.id, work }}
  reader={authorizedReader}
/>
```

Use the existing server-authorized `StudentDashboard` and its selected `DashboardLesson`. An unavailable/foreign assignment must produce `lesson={null}`, never substitute the dashboard’s current assignment. Load saved work through the existing assignment-work service; the wrapper’s assignment ID must be the ID used for that read. The component checks it again before displaying sessions. Preserve the service’s session order and exact session IDs.

N0’s `NotebookState` from PR #125 is not duplicated or imported here. Map `ready.data` to the existing domain props, `loading` to `loading={true}`, and unavailable to a null dashboard/lesson. Represent a successful empty dashboard with its actual empty `lessons` array. A `pending` state with usable data should retain that data and its server-owned session status; put any additional loading/recovery notice in N1’s notice slot. A pending state without data must remain loading/unavailable. Never create a fictional dashboard to fill it.

The provisional N0 saved-work adapter can be mapped back to the original `StudentAssignmentWork` by retaining each entry’s `session` and each question’s exact `response`. Prefer the existing raw public DTO already loaded by the route. This leaf’s saved-work input is not an event chronology and does not require a new backend projection. `workLoading` shows loading, `savedWork={null}` shows unavailable, and `undefined` leaves the list unloaded here while linking to the existing saved-work route when the dashboard records work.

`AssignmentAction` is composed directly, with a key per assignment, for every Start/Continue/Review/Reading action. N0 can use these defaults or supply `renderAssignmentAction` on MyLearning and `assignmentAction`/`readingAction` on AssignmentOverview, matching PR #125’s composition seam. A render callback belongs in an integrating client wrapper; do not pass a non-serializable function across a server/client boundary. Supply the existing action once per position, never an alternate start controller or duplicate set of controls. Start is the existing explicit button; no N2 lifecycle hook starts, submits, evaluates, fetches reviews or acknowledges assistance. A completed or unevaluated session retains the existing “Review session” label. The existing component owns busy/error handling and idempotent start semantics.

Inject N5’s existing review presentation via `teacherReviews`. N2 supplies only its position above continuation/assignments. N5 owns its heading, delivered-only data, loading/error/empty state and approval links. A missing slot renders nothing. There is no intervention loader or second controller here.

## Exact reading and progress

`DashboardLesson` contains authorized source labels and configured practice topics, but no content-version field. Its reading action uses the existing assignment-scoped reader, which resolves the immutable assigned version on the server. An optional authorized `StudentReaderView` supplies the exact version/attribution for display. N2 checks assignment/class identity and withholds mismatched reading context. N0 must supply a consistent authorized reader projection for the selected assignment; this client check is not authorization and cannot verify a version absent from the dashboard DTO.

No source metadata is reconstructed from titles or topic IDs. The overview renders every configured topic objective, without claiming every source concept is assessed. Coverage counts distinct `practiced` configured topics, not response counts, correctness, grades or mastery. Completion refers to the latest saved session. Pending evaluation and teacher-support-needed remain distinct statuses.

The current DTO has no archived/scheduled/due state, question-family totals, recent question previews or recommendations. Those categories and prototype-only fields are omitted. Earlier sessions can be revisited through the actual loaded saved-work records and existing notebook/history route.

## Navigation and compatibility

All leaf links preserve the existing route family:

- Overview: `/study/assignments/A?tab=overview`.
- Start/Continue/Review: the existing `AssignmentAction` and `assignmentStudyHref` behavior.
- Loaded historical session: `/study/assignments/A?tab=study&session=S` with the exact saved identity.
- Saved work: `/study/assignments/A?tab=work`.
- Notebook: `/study/history`.
- Reading: existing `AssignmentAction` with `kind="reading"`.
- Topic fragments: `#topic-CONCEPT_ID`.

No draft/storage namespace, original answer, session identity, submission identity or accepted evaluation is rewritten. Search/class/source/status filters affect only the rendered authorized collection. N0 owns URL filter persistence, native page focus restoration and route integration; N2’s local filters reset when unmounted. N0 must retain session/version/fragment validation and reader return context. Do not replace the existing StudySession/StudyDialogue lifecycle with the fixture.

## Design and verification

The authoritative reference is **Student-Notebook-Final-Prototype-fa69c2d0.zip**, supplied and approved by the user. Archive SHA-256 was verified as `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`. Extracted `Main.dc.html` SHA-256 is `70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4`. Main provides the complete interface; `V1440-HelpMsg.dc.html` provides the corrected help-request interaction. Neither its scripts nor fictional instructional content are application logic.

The final export’s home/overview markup and CSS match the previously inspected reference. Its review changes restore the teacher-approved wording, which remains N5’s authorized input. N2 hardcodes no replacement review content. The existing N2 implementation was retained. Final corrections compact the phone class/source controls into one row and expose the N0 action-composition slots. The help reference was inspected and captured; N2 has no composer or help-delivery lifecycle to replace, so the real single composer, guarded answer confirmation and PR #113 recovery remain with their current owners.

See [verification/RESULTS.md](verification/RESULTS.md) for final-reference comparisons, actual checks and limitations. The separate browser fixture uses real N2 components and the real `AssignmentAction`, with native-anchor/router seams and a deliberately rejected start endpoint. It is not a mounted production route. Fixture source has no production importer. Final-reference N2 component comparison passed within current-data limits; N0/N1/N5 composition and authenticated browser/database regression gates remain open.
