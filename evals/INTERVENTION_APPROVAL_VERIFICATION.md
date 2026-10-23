# Intervention approval verification — Issue #45

## Runtime and evidence

The approval checks ran on October 22, 2026 (America/New_York), against real
PostgreSQL and the authenticated application. The final HTTP run at
`2026-10-23T03:25:41.915Z` used the production image `lp45-approval-check`, digest
`sha256:b69bf137dd639c7ea2fcb28c9edff72d22531a6e9447f0a5671169af3314229b`,
on `http://localhost:3045`.

The isolated `lp45-db` database on port 5545 was copied from the existing fictional
#44 database. The source database was read only. Existing migrations 001–005 and
009 were preserved; 014 and 015 were applied to the isolated copy. The application
had no model API key configured. This work made **zero new model calls**.

The previously generated #44 draft
`baaa38f1-8ebd-46b1-ab5b-003a99106e7e` retained its original `gpt-6.1-sol`
provenance, response identity, immutable content reference and synthetic evidence.
The automated checks used separate, clearly labelled copies, retaining the
original model provenance without claiming that the copies were new generations.
The fictional source assignment was activated through the existing authenticated
teacher approval endpoint before delivery testing.

## Automated PostgreSQL and authenticated HTTP checks

`scripts/check-intervention-approval.ts` passed against both the development server
and the production build. The final machine-readable report is
[`results/intervention-approval-http.json`](results/intervention-approval-http.json).

- Anonymous, student, unrelated teacher and mismatched profile/user identities
  cannot access or modify the teacher review.
- A saved edit advances one revision. Exact replay is idempotent; stale writes,
  stale approval, altered payloads under the same request ID, forged ownership,
  cross-origin writes and unauthorized source versions are rejected.
- Saved evidence, contrary evidence, uncertainty and generation provenance remain
  unchanged. A real saved #44 draft exercises normalization of source text.
- Recipient enrollment is rechecked after preview. Removing a temporary enrollment
  before approval rejects that selection. Delivery before approval is rejected.
- Concurrent duplicate approvals produce one approval of the exact reviewed
  activity/revision and two explicitly selected recipients. Approval without
  delivery remains inaccessible to students.
- Concurrent duplicate deliveries and a later new delivery request identity
  produce one durable delivery. Both recipients can retrieve it; an enrolled
  third student and the teacher cannot retrieve or acknowledge it as a student.
- Student responses use a strict public projection. Private answer guidance,
  rubrics, evidence identities, recommendations, uncertainty and provider traces
  are absent. A private guidance sentinel does not appear in the student payload.
- Listing and reading leave display timestamps empty. An explicit display
  acknowledgement records the first timestamp once for that student and does not
  mark another recipient's activity displayed.
- PostgreSQL rejects changes to final approvals, deliveries, recipients and
  terminal drafts, and rejects insertion of an unapproved third recipient.
- Dismissal is idempotent, preserves history and blocks approval/delivery.
  Approved and dismissed drafts reject regeneration before an injected provider
  is reached; its invocation count remains zero.
- Original answers, accepted evaluations and model-generation request counts
  remain unchanged throughout the check.

`scripts/check-assignments.ts` also passed against the production build. It covers
teacher-only approval, stale previews, activation gates in HTTP and SQL, exact
version and immutable approval scope, idempotent activation, student access and
historical evidence. It cleans up its temporary assignment/session records.

The existing reading, tutoring, metrics and pattern database probes were inspected
but were not run against this preserved browser demonstration database: they
append synthetic sessions/answers to its original assignment. Their omission is
not a claim that they failed. Repository-wide verification passed: 91 deterministic tests, lint, TypeScript,
formatting, 293 content checks, and the production Docker build. The build also
reported existing dependency advisories; dependency upgrades remain outside this
issue. These checks do not establish live adaptive tutoring acceptance.

## Browser checkpoints and persistence

The browser demonstration used the original saved model-generated draft. These
independent database/service checkpoints bracketed the browser actions:

| Checkpoint                                | Observed state                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `03:18:38.598Z`, after editing and saving | Revision 2, private draft, zero approvals, absent from all three student lists.                               |
| `03:19:46.931Z`, after approval           | Terminal draft revision 3, reviewed content revision 2, zero deliveries, absent from all three student lists. |
| After delivery                            | One approval, one delivery, exactly two recipients.                                                           |
| After recipient viewing                   | Student one's first display: `03:22:18.051Z`; student two's first display: `03:23:05.328Z`.                   |

The original approval identity is
`b3f368c2-1bee-4593-a33d-c8f718911e0e`. Reports:

- [`results/intervention-browser-before-approval.json`](results/intervention-browser-before-approval.json)
- [`results/intervention-browser-before-delivery.json`](results/intervention-browser-before-delivery.json)
- [`results/intervention-browser-persistence.json`](results/intervention-browser-persistence.json)

The approval's evidence and provenance match the untouched #44 source snapshot.
A read-only cross-database comparison also found the original 23 sessions,
64 attempts, 63 evaluations and 8 previously displayed interventions unchanged.
The persistence report records row counts and hashes, without copying private
student text into this report.

The primary implementation agent completed the visual browser walkthrough:

- Opened the previously model-generated draft, edited its title, explanation and
  private guidance, compared the student/teacher previews, saved revision 2,
  approved two explicit recipients, delivered separately and refreshed.
- Opened the delivered activity as each selected fictional student and refreshed.
  The authenticated third student's list omitted it and its direct URL showed
  the not-found page; the authenticated API independently returned 404.
  Display timestamps were recorded only for the two selected students.
- Exercised two stale browser tabs on the private labelled copy
  `abe459be-2097-43aa-b593-919aa0e7c993` against the production build. Tab B kept an
  unsaved title based on revision 1 while tab A saved revision 2. Tab B's save
  returned 409. Refreshing twice retained its local text and kept Save disabled;
  explicit discard then loaded the saved revision 2 title.
- Inspected a narrow 390-pixel viewport. The content area's client width and
  scroll width were both 375 pixels, with no horizontal overflow.

Screenshots were captured in ignored local `.setup` storage. These browser
observations are distinct from the automated HTTP and database checkpoints.

## Independent authorization and privacy review

A separate verification agent inspected `approval.ts`, `approval-validation.ts`,
`approval-contracts.ts`, the teacher/student endpoints, and migrations 014/015.

The review found one blocking runtime defect: #44's saved evidence schema trims
passage text, while the initial source check compared it to untrimmed loaded
passages. Legitimate saved drafts were rejected. The implementation now compares
the same normalized source text; the real-database edit/approval check passes.

The review also identified the need to guard recipient insertion after approval
at the database boundary. Migration 015 preserves applied 014 and binds approvals
to the exact draft snapshot, restricts recipient inserts to the frozen approved
set, and binds delivery to the approved identity and complete recipient set.
Real PostgreSQL negative checks exercised these protections.

After those changes, no further blocking authorization, approval transaction or
student projection issue was found in the inspected slice. Owner and profile
bindings are checked under locks; action IDs serialize per teacher; source and
enrollment are revalidated; terminal states and history are immutable; student
queries require both explicit recipient membership and current enrollment.
This is an independent agent review, not a substitute for the requested human
review of permissions, schema changes and educational accuracy.

## Remaining integration boundaries

- #46 owns collecting/evaluating later intervention responses and linking them
  through approval, draft, assignment, question and exact content identities.
  Display is assistance evidence; later work must carry that assistance into the
  existing evaluation path before any independence or retention claim.
- #52/#53 own imported immutable lesson resolution. This slice verifies the
  existing approved curated lesson and does not claim imported-lesson support.
- #98/R7 tutoring implementation remains a separate workstream. No new paid model
  behavior or integrated adaptive tutoring acceptance is claimed by these checks.
- The final activity's pedagogical accuracy still requires teacher review.
  Passing schemas, access checks and browser delivery do not validate efficacy.
