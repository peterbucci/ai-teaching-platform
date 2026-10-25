# N5 teacher-review presentation

**S3 integration update:** The authenticated review route now mounts N1's existing
`NotebookShell` around one unchanged `DeliveredActivity`, using page-local
`ReviewWorkspace`/`ReviewSectionLink` presentation. The frame's optional `embedded`
flag delegates the visible title to N1. Summary status metadata is disclosed rather
than repeated on every row; saved results remain unknown until the owner loads them.
Optional read-only feedback presenters accept pinned public `conceptNames` and
use “Concept name unavailable” when absent, never a raw ID.

The review route accepts an optional bounded `returnTo` for Notebook/My Learning/
assignment saved-work navigation. It is never authorization input. Source context
contains links and identity only; original excerpts stay under the controller's
observer. The generic missing/unauthorized route reveals no activity identity.
See [S3 results and deviations](verification/s3/REPORT.md) and
[N6 handoff](verification/s3/N6_HANDOFF.md). Independent acceptance is pending.

The original N5-only package description below is preserved as implementation
history; its unmounted status is superseded by N7 and this S3 integration.

These components consume the existing public `StudentIntervention` and
`StudentInterventionFollowup` types. They have no loaders, mutations, state,
storage, model calls, display acknowledgments, or ordinary tutoring composer.
All changes are inside N5's two reserved paths. Existing routes are not mounted
by this package.

## Components

| Component                | Intended use                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `TeacherReviewList`      | My learning review slot; delivered activities from the existing authorized list                             |
| `TeacherReviewSummary`   | One approved title/objective, delivery/viewing metadata, status, dedicated review link                      |
| `TeacherReviewFrame`     | Detail heading and one visible slot for the existing controller                                             |
| `ReviewActivityStatus`   | Explicit unloaded/loading/unavailable, not started, unanswered, submitted, pending, failed, accepted states |
| `ReviewSourceReferences` | Exact assignment/version/passage links and a source-identity disclosure; no excerpts                        |
| `LinkedReviewFollowup`   | Read-only original submitted response and its accepted public feedback                                      |
| `ReviewFeedback`         | Accepted feedback/results, uncertainty, recorded assistance and retention limitation                        |
| `ReviewEmptyState`       | List empty/loading/unavailable presentation                                                                 |

Import `reviews.css` once from the integrating route/layout. No global or shared
intervention stylesheet is changed. The `.sn-reviews` namespace contains styles.

## Home/list integration — N0/N2

Use the existing `listStudentInterventions` loader and its recipient filtering.
Do not fetch individual follow-ups or acknowledge display while rendering the
home list. The absence of a loaded follow-up means **unknown status**, even when
`displayed_at` is present. The amber background means viewing has not been
recorded; it does not claim an unread count or incomplete activity.

```tsx
<TeacherReviewList interventions={authorizedInterventions} />
```

PR #125's `NotebookReviewCard` projection can also feed the narrow summary
input without adding a dependency on the unmerged N0 package:

```tsx
<TeacherReviewSummary
  intervention={{
    approval_id: card.approval_id,
    assignment_id: card.assignment_id,
    delivered_at: card.delivered_at,
    displayed_at: card.displayed_at,
    activity: {
      title: card.title,
      learning_objective: card.learningObjective,
    },
  }}
/>
```

Review links are derived from approval identity and retain the existing
`/study/interventions/[approvalId]` route, never `/study?session=…`.
Map N0 list `loading`/`unavailable`/`empty` states before supplying records; stale
records are hidden by a non-ready list status. No teacher names, reasons, due
dates, source titles, or revised mockup teaching copy are invented.

## Detail integration — existing review owner only

The existing `DeliveredActivity` remains the sole owner of first display,
visibility receipts, explicit fresh-check start, draft recovery, submit,
evaluation, refresh and permitted retry. It already renders the approved
exercise, questions, explanation, source excerpts and response controls.

```tsx
<TeacherReviewFrame intervention={intervention}>
  <DeliveredActivity intervention={intervention} studentId={studentId} />
</TeacherReviewFrame>
```

Mount exactly one controller. Do not mount hidden/desktop/mobile copies or render
another explanation/source quote outside its acknowledgment boundary. Reading
links here show passage identifiers only; the existing reader owns help display.
Do not replace the controller with StudyDialogue or a Notebook composer.

The read-only follow-up presenters are optional slots for the owner after an
explicit state handoff. **Do not show them alongside the controller's existing
response/feedback section as a duplicate.** This PR does not extract or edit
`activity.tsx` or introduce such a handoff.

```tsx
<LinkedReviewFollowup
  intervention={intervention}
  followup={{ status: "ready", followup: authorizedSavedFollowup }}
/>
```

Before loading use `{ status: "not_loaded" }`; during loading use `loading`;
on missing/failed access use `unavailable`. Never manufacture a `not_submitted`
DTO to fill an unloaded slot. N0 `ready.data` maps to `ready.followup`; other
availability states map explicitly. A submitted response with no accepted
evaluation stays submitted. Rejected/provider-failed output maps to the existing
public `failed` status, and no result/feedback from it is displayed.

## Identity, privacy and ownership

Authorization remains in the existing student loaders/APIs. Approval correlation
blocks accidental attachment of a different review's response. It is **not** an
authorization check: the public follow-up has no student identity, and one
approval may have multiple recipients. The owner must supply the authenticated
student's DTO, clear loaded state on account/approval changes, and key any
stateful integration by student plus approval. These presenters keep no cache.

Original response whitespace and line breaks are retained; React escapes all
content as text. Only public accepted feedback/results render. Neither private
rubrics/evidence nor raw evaluation payloads are inspected or serialized. Exact
source identity is carried in the public content reference; reader URLs retain
assignment, content version and passage. Source versions and lesson content
versions remain distinct. Dates are explicitly labeled UTC.

N0 owns route mounting and shared contracts/barrel. N5 does not edit N0, N2,
PR #113, the shared intervention renderer, teacher files, services, API handlers,
or the lifecycle. N0 was notified of this final-reference pass and its unchanged
review seam; no shared contract change was required. The read-only review
contracts were checked against PR #125 head `6ad1709` during this pass.

The authoritative final prototype archive is
`Student-Notebook-Final-Prototype-fa69c2d0.zip`, SHA-256
`fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
The review row now uses its heading hierarchy, teacher tag, status/result marks
and 819px stacking rule. The summary's container query also stacks a narrow card
inside a desktop parent. Typography/link rules target N5 elements and do not
reset the controller's headings or paragraphs.

`Main.dc.html` was rendered for home/review reference; the specific corrected
`V1440-HelpMsg.dc.html` was inspected as reference only. Its single-composer
help/confirmation behavior belongs to PR #113's owner, not these presenters.
Teacher-approved runtime activity content remains authoritative. No prototype
instructional text, objective numbering, teacher name, due date, opening-as-display
shortcut, or new lifecycle is copied into production components. Combined route
mounting and actual fresh-check recovery still require the existing owner.
