# S2 field and feature parity

Base: N7 #133 `d486fc029941567f81257d7b8717b1cb3dab09d4`.
Backend: #131 `884dfb08de31c457a3eb618ad063fcbf701ac5f3`.
Design archive SHA-256: `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.

## Field mapping

All fields below are from the actual `StudentNotebook` public DTO. The frontend
retains validated DTO batches; it does not define a second evidence schema or
reconstruct joins. Existing current-data adapters and frozen v1 props remain intact.

| Prototype requirement                 | Authoritative field                                                           | Presentation / limit                                                                                                                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session identity and navigation       | `session.id`, `assignment_id`, `kind`, `resume_href`                          | New read-only `/study/history/[sessionId]`; existing work/study links retained. Teacher follow-ups retain the approval route.                                                                                                     |
| Individual question                   | `pages[].attempt_id`, `question.prompt_text`, `question_id`, `sequence_index` | Exact `?attempt=` selector, previous/next identities, original prompt; no text matching or latest-record substitution.                                                                                                            |
| Original submitted answer             | `submission.response_text`, `answer_id`, `submission_key`, `submitted_at`     | One canonical original, including empty strings, Unicode and whitespace. Linked message events point to it. HTML CRLF normalization is repaired with a plain text node after hydration.                                           |
| Accepted result                       | `assessment.current_evaluation_id`, matching current `assessment_recorded`    | Correctness enums only. A later failure does not replace the accepted pointer. Earlier accepted results are explicitly superseded.                                                                                                |
| Uncertainty                           | `assessment_recorded.assessment.uncertainty_recorded`                         | Generic uncertainty notice. No private reasons, rubric, hypothesis or model narrative.                                                                                                                                            |
| Missing / pending / failed assessment | `assessment.status`, pending `outcome`                                        | Distinct labels; absence never becomes an incorrect answer or proof that no evaluation was requested.                                                                                                                             |
| Displayed help                        | `help_displayed.aid.text`, `displayed_at`, `owner`, passage IDs               | Only backend-confirmed displayed bodies. Rendering never acknowledges display.                                                                                                                                                    |
| Generated but undisplayed help        | `pending_deliveries`                                                          | Body-free pending/unconfirmed/unavailable markers. No extra lookup or replay.                                                                                                                                                     |
| Help before an answer                 | `submission.assistance_at_submission`                                         | Exact stored assistance category; no calculation from event times. Event `counted_at_submission` is displayed as recorded.                                                                                                        |
| Precise event sequence                | `events[]`, `event_id`, `order`, `recorded_at`, `order_basis`, `time_basis`   | Server order and microsecond/offset strings preserved. Equal-time order is identified as a stable tie, not causal order.                                                                                                          |
| Current message status                | `messages.state`, `execution`                                                 | Separate status disclosure; no invented transition timestamp.                                                                                                                                                                     |
| Earlier / later question              | `parent_attempt_id`, `review_of`, `subsequent`                                | Links only from saved relations. No restart, same-text or same-concept lineage inference.                                                                                                                                         |
| Teacher review and fresh check        | `teacher_reviews`, `followup`, validated `href`                               | Explicit own-evidence/recipient relationships only. Dedicated review handoff; no S3 activity mounted in history. Delivery does not mean completion.                                                                               |
| Historical source                     | `source.lesson_id`, `lesson_version`, `content_ref`, question passage IDs     | Exact identities in source context. `source.title` is labelled current assignment wording, not a historical title. No current-version substitution.                                                                               |
| Partial history                       | `coverage`, `paging.total_attempts`, `gaps`                                   | Loaded/total count and explicit gaps. No claim of complete chronology.                                                                                                                                                            |
| Pagination                            | `snapshot.id`, `paging.next_cursor`                                           | Whole DTO pages; matching hash/scope/boundary required. A 409 `SNAPSHOT_CHANGED` invalidates appendability; validated fresh data replaces atomically. Failed replacement leaves explicitly stale data, never an appendable cache. |

## Feature parity and unavailable history

| Feature                                                          | S2 status                                         | Boundary                                                                                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session index and original saved-work links                      | Preserved, with additional Recorded history links | Existing metadata/class/source/section/topic/date/session-status filters remain.                                                                     |
| Individual saved question and answer                             | Implemented                                       | Native deep links, Back/Forward and refresh; read-only route.                                                                                        |
| Accepted results, uncertainty, displayed help and events         | Implemented from real projection                  | Not a reconstruction of unrecorded interactions.                                                                                                     |
| Session-local question/result/assistance filters                 | Implemented over loaded pages                     | Clearly labelled loaded scope. No global result/help search or eager fan-out.                                                                        |
| Cross-session question rows on global Notebook index             | Unavailable in current backend index              | #131 is session-scoped; current history metadata does not supply those rows. A separately reviewed bounded index projection is required.             |
| Bookmarkable global filters                                      | Existing limitation retained                      | Frozen N0 parser and current filter contracts do not define these parameters.                                                                        |
| Named per-concept results                                        | Partial                                           | Public evidence supplies concept IDs, not historical display titles. Display uses IDs with underscore spacing; UUIDs remain IDs. No invented labels. |
| Historical question-view time, duration, repeated reading visits | Unavailable                                       | `presented_at` is server release, not a viewport receipt.                                                                                            |
| Exact old clarification wording and missing transition times     | Unavailable                                       | Explicit gaps; only recorded messages/statuses shown.                                                                                                |
| Unsent drafts, arbitrary restarts, causal order among tied times | Unavailable                                       | Never synthesized.                                                                                                                                   |
| Teacher-review activity details                                  | Dedicated owner handoff                           | No ordinary-study identity wrapper or duplicate review controller.                                                                                   |
| Facing reader beside history                                     | Not activated                                     | N4 source/visibility/return gate remains separate; no assistance receipt on history reads.                                                           |
| Visual fidelity                                                  | Requires comparison and independent N6 decision   | Responsive geometry checks alone do not establish prototype parity.                                                                                  |

## Ownership and contract approval

N0 approved `recorded-history-adapter-v1` as an additive extension in
[decision 24f5b59](https://github.com/peterbucci/ai-teaching-platform/blob/24f5b59cf525e8482b17939131b7f62b771c0734/app/study/notebook/COORDINATION.md).
Actual implementation review and combined acceptance are separate gates.

N0 subsequently approved the actual implementation through application
`6aa2ce680d6ccea1f615e104e4f1792bcd502f38` and recorded the
[final evidence receipt](https://github.com/peterbucci/ai-teaching-platform/blob/984cd53051b8aa7910606c526e0aaa32e4852a72/app/study/notebook/COORDINATION.md).
Recorded-mode, current-data fallback and native clipboard checks pass on the
same production build. The [N6 handoff](N6_HANDOFF.md) links the real comparison
at all requested widths/native zoom and records remaining visual differences.
Full prototype parity remains NOT_ACCEPTED; combined N6 release approval is pending.

S2 owns new `app/study/notebook/recorded-history.ts`, `records/recorded-*`,
`records/exact-text.tsx`, `app/study/history/[sessionId]`, focused tests and this
acceptance directory. N3 `records.tsx` adds links and exact-text rendering;
`integration/notebook-history.tsx` retains its retry using a Next native-link
component with prefetch disabled. No frozen N0 files, S1/PR #113 controllers,
S3 review presenters, teacher application, evaluator, schema, or global styles
are edited. The seven D1 files enter through the exact pinned dependency merge.

Runtime requires `NOTEBOOK_RECORDED_HISTORY=1`. It remains off by default. The
isolated synthetic acceptance runtime may opt in under N0's diagnostic approval;
this does not authorize deployment or establish combined release acceptance.
Without the flag, the new route independently authorizes current-data work and
resolves the requested session/attempt; existing routes remain available.

The inherited `/study/loading.tsx` can stream an HTTP 200 shell before async
`notFound()` resolves. Browser denial checks require the final 404 document and
absence of protected work; the evidence API separately returns HTTP 404. No
shared loading/controller file is changed to conceal this framework behavior.
