# R7 approved-lesson resolver verification

Verified October 23, 2026, using fictional accounts and synthetic student responses.
The tested PR #98 implementation is `9ffdec6546f177d2535f8426c3d547cb453c8731`.
PR #98 remains a draft; no PR was automatically merged or issue closed.

## Result and provenance

R7 now uses #93's approved assignment/version resolver and published activity
policy. In the actual student browser, an approved uploaded Moonlight lesson
provided grounded help, accepted explicitly confirmed answers, generated a
source-grounded diagnostic, assessed the new response once, and completed through
the original controller. The authorized teacher inspected the saved conversation,
proposals, validations, executions, evaluations and display receipt.

The resolver integration at `4ae3992` includes main's reviewed #93 squash merge
`939c766d5cd82fa1347b731eabbba24331a836a4`. It preserves the original PR #81/#94/#95/#96
integration history. The assignment-ID environment allowlist is removed; runtime
permission comes from the exact immutable published lesson. An unavailable or
unauthorized uploaded version cannot silently resolve to the networking lesson.

Authoring/browser verification used a separate temporary checkout, final tested
revision `2e247ab1d08d47d61cfedd0459903c9b74a553c2`, combining the exact PR #98 code
above with #102 head `6893bbe32caa999c4e1acc0fb353e0d6db71af8a`. The initial temporary
merge was `e19941ac383a22f77915f3278ea05d6fc3875cc7`. This is a verification artifact;
#102 was not landed in PR #98. The #102 owner subsequently reported importer-only
changes through `edb9dfd`; those later importer changes are not claimed as browser-tested
here. The reviewed publication-contract workflow did not need another paid
question-authoring run.

After this browser run, main gained #97's approved importer at
`d2d145c1f7ea175c788b7ed67a644be60d95173f`. The final integration reconciles that
main update without applying #102's authoring stack. Its only textual conflict
was CI ordering: both uncertainty and material checks use the existing fresh-app
isolation wrapper. Authentication limits and the database/restart checks remain
unchanged. Independent review confirmed no dialogue, evaluator, controller,
resolver or migration overlap. The importer is not claimed as a new browser/model
run; the actual uploaded tutoring evidence remains tied to the revisions above.
The reconciled checkout passed 273 unit tests, lint, TypeScript and repository
formatting locally. Its final CI result is linked from PR #98.

Sanitized evidence:

- [Uploaded Moonlight application record](results/2026-10-23-r7-resolver-moonlight.json): original messages, public questions/help, exact source identity, proposals, validations, actual execution, observations, display receipts and provider metadata.
- [Curated policy control](results/2026-10-23-r7-resolver-curated.json): one classified help request, disabled runtime generation and the preserved historical fallback.
- [Authenticated HTTP and database audit](results/2026-10-23-r7-resolver-http-audit.json): authorization, replay, safe projections, original evidence hashes and unchanged v1 baseline.
- [Post-restart database audit](results/2026-10-23-r7-resolver-restart-audit.json): final comparison after the application/database restart and student/teacher browser recovery.

These exports omit credentials, raw provider prompts/output and private rubrics.
SQL establishes saved state; browser claims below come from actual browser checks.

## Reconciliation and preserved architecture

Dialogue, evaluation, tutoring, reading and teacher evidence now share authorized
assignment resolution. The complete source reference, concept/passage scope,
published activity policy, installed adapters and current controller state are
checked before dispatch and again at commit. `applyTutoringInTransaction`
re-resolves content under the session lock. A caller's copied policy cannot
establish authority.

Approved question-bank entries may have generated provenance. Exact approved
snapshots retain their bank activity IDs; runtime questions retain immutable UUIDs
and receive a server-owned `controller_node_id` for an authorized activity slot.
Publication rejects runtime bindings in bank questions. Diagnostic selection,
retry bounds and retest tracking use the existing controller slots. #93's
concept-specific hypothesis protections and `other_or_uncertain` behavior remain.
There is no second controller, evaluator, database or agent framework.

Private criteria, exact original answers, accepted evaluations, both display
acknowledgment paths, idempotent operation identities and shared model-call budgets
remain intact. Runtime assessed prompts remain unscaffolded. Existing migrations
`006`, `008` and `009` were preserved unchanged; #102's authoring migration stack
remains a separate dependency.

## Deterministic and database checks

| Check                                                                                                                      | Executed result                                                                      | Evidence type                                                              |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [PR #98 CI 39951459851](https://github.com/peterbucci/ai-teaching-platform/actions/runs/39951459851), revision `9ffdec6`   | Green; 211 unit tests and all configured checks passed                               | Final PR #98 CI                                                            |
| [Resolver CI 39948809100](https://github.com/peterbucci/ai-teaching-platform/actions/runs/39948809100), revision `4ae3992` | Green; 207 unit tests                                                                | Earlier resolver checkpoint                                                |
| Dialogue PostgreSQL suite                                                                                                  | 18 groups passed                                                                     | Synthetic provider callbacks with real persistence                         |
| Controller PostgreSQL suite                                                                                                | 5 groups passed                                                                      | Synthetic generation/judgments with real resolver, controller and evidence |
| Lesson resolver check                                                                                                      | Passed                                                                               | Approved version, authorization and persistence                            |
| Initial temporary #98 + #102 checkout                                                                                      | Production build, 309 tests and lint passed                                          | Combined local checkpoint before the final two R7 fixes                    |
| Provider-wire compatibility regression                                                                                     | 7 provider tests, focused lint and full TypeScript passed; independent review passed | Mocked transport, zero paid calls                                          |
| Final uploaded HTTP/replay audit                                                                                           | Passed; database hashes unchanged after reads/replay                                 | Real authenticated HTTP plus read-only SQL                                 |

The five controller checks cover exactly-once generated diagnostic application,
private-snapshot evaluation, assistance only after display, generated retests through
the same sequence, refresh and teacher evidence, invalid-source rejection, authored
fallback, and rejection of a forged caller policy. Their uploaded fixture is
published through the existing source/draft/approval/publication/assignment services;
no override enables generation on the curated lesson. These checks made no model
calls. Existing failure tests cover duplicate/changed requests, stale/cancelled
operations, invalid generated content, unsupported tools, source/permission failures
and uncertain timeouts. They are not presented as newly induced live-model failures.

## Moonlight v2: service preparation and actual teacher UI

The workflow used an isolated database clone. Lesson
`5d208961-a50e-45c1-9f29-692cd5d82ef8` version 1 and its original student evidence
were preserved. The original database was not rewritten to enable generation.

The existing `saveLessonDraft` service prepared version 2 after authenticating the
original fictional teacher. This was a service preparation step, not browser
editing: revision 9 became 10; the root and all four question snapshots received
the complete version-2 reference; runtime generation was enabled and `GIVE_HINT`
was added while retaining the existing actions. Canonical saving invalidated bank
approval, removed the derived sequence and cleared whole-lesson approval. It made
zero model calls and did not approve, publish or assign anything.

The actual teacher browser then approved the bank at revision 11, assembled it at
revision 12, approved the lesson, published version 2, and activated assignment
`7f11450b-53dd-46a4-bad3-634356bae03d`. It reused the four reviewed questions without
new paid authoring. #102 does not expose editing of the content-version identifier
or the full activity-action policy; those controls remain an authoring UI gap.

After publication and the student workflow, the HTTP/database audit confirmed
version 1's counts and hashes still matched the pre-change baseline: one published
version, one assignment, one session, three attempts, six evaluations, two
interventions and no dialogue records. The audit contains the ten-group baseline;
the original local baseline file SHA-256 was
`391e532aad2482c70dfc69ea32099e4afcde035e965e111ffb7d8b1f8bcc6561`.

## Actual uploaded student and teacher workflow

Session: `21b2831d-e2aa-4cce-ac76-bd498a6a7fb4`.
Source version: `1`; lesson content version: `2`; approved passage: `p001`.
The real provider was `gpt-6.1-sol`, with bounded stages and zero automatic retries.

| Student observation                                                                                                            | Model proposal and permitted choices                                                                                                                                                 | Accepted application result                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Asks what reflected light means without answering the assignment                                                               | `QUESTION_OR_HELP`; `explain` with `alternative_explanation`; only `explain` permitted by this lesson's help policy                                                                  | Independently reviewed help describes light reaching an object and bouncing off. Browser displayed it; one later display acknowledgment recorded hint assistance. No answer was graded.          |
| Says the lamp, mirror, white card and Moon all produce light because they look bright                                          | `ANSWER`, followed by explicit student confirmation. Existing evaluator records a conceptual error. Model chooses `generate_diagnostic` from `[generate_diagnostic, advance_lesson]` | Reviewed runtime question asks what happens to a bright white card when the only lamp is turned off. The existing controller creates an immutable assessed diagnostic tied to its approved slot. |
| Predicts the card stops looking bright because it reflected the lamp's light; brightness alone did not prove it produced light | `ANSWER`, explicitly confirmed and assessed correct. The new accepted observation changes controller state; `advance_lesson` is now the sole permitted tool                          | The model proposes advancement and the server executes `END_SESSION`. The saved rationale explicitly notes prior help and does not claim independent retrieval or lasting mastery.               |

The actual browser refreshed the generated diagnostic before the second answer;
the same activity and conversation recovered. Both answers preserve the exact
original message and stable submission key and have exactly one accepted
evaluation each. The two original pending evaluator reservations remain immutable
audit records, not extra grades.

Help was created at `12:15:02.857Z` and acknowledged after display at
`12:15:02.990Z`; the first answer was submitted at `12:16:07.117Z`. The diagnostic
response also retains the prior hint and the diagnostic-prompt evidence. One
intervention and one unique display receipt are saved. No unresolved provider
operations remained in this completed session.

The authorized teacher browser displayed the full conversation/action trace and
both accepted assessments. The authenticated audit returned 401 for anonymous
requests and 404 for another student's access to tutor, conversation, reading and
teacher evidence, and denied student access to teacher evidence. Exact replay of
the known settled request returned 200; a changed payload returned 409. Read/replay
checks added no model calls, display acknowledgments, accepted judgments or database
changes, and the student projections contained no private fields.

After an operator-managed restart of the combined application and cloned database,
the teacher browser reloaded with its existing cookie and retained the full trace,
original answers, exact version and display receipt. After signing out and signing
in once as the fictional student, opening Review session recovered the completed
conversation, original help and answers, generated diagnostic and completion. No
new message or session was created. The final read-only audit at
`2026-10-23T12:26:06.802Z` confirmed all 11 source/assignment/evidence snapshot hashes
and the complete v1 baseline remained unchanged, with no additional model calls or
display acknowledgments. The SQL helper compares persistence; the operator and
actual browser checks establish the restart and recovery behavior.

This new uploaded case demonstrates a real diagnostic choice and a changed next
action after a new student observation. It is not a second new misunderstanding
comparison under identical tool choices. The earlier distinct networking
misunderstandings and their different diagnostic/explanation decisions remain
[prior application evidence](R7_APPLICATION_VERIFICATION.md); they were not rerun.

## Provider failure and policy fallback found during the run

The first Moonlight help request classified successfully, then its proposal step
settled as `invalid_request`; it displayed a safe fallback. Its reservation and
original message remain saved. Local deterministic reproduction showed that the
SDK successfully converted the proposal/help/question schemas, but their uploaded
attribution URL fields emitted `format: uri`, which is outside the
[Structured Outputs supported string formats](https://developers.openai.com/api/docs/guides/structured-outputs).
Nullable URLs still advertised that unsupported branch.

Revision `9ffdec6` removes only that URI annotation from the fresh provider wire
schema. Canonical Zod URL validation, required/strict fields, UUID validation and
exact authorized source/version checks remain unchanged. Regression tests capture
the actual outgoing proposal/help/question schemas, reject malformed returned URLs,
and preserve rejection of changed lesson/source references. Independent code
review passed. A subsequent explicit browser message on the fixed build completed
the real proposal/generation/review/display path above; no automatic paid retry was
introduced and the failed historical operation was not rewritten.

The failed record has no response ID or usage. The adapter stores the same
`invalid_request` code for local schema errors and HTTP 400/422, so that record
alone cannot prove network dispatch or paid usage. Its settled reservation is
counted separately from proven successful calls; elapsed time is not billing proof.

The curated control session `71677467-a6b2-4778-94db-866d640b0ff9` retained
`allow_runtime_generation: false`. One real classifier recognized the help request;
no proposal, generation, review or evaluation followed. Its historical fallback
incorrectly said the help limit was reached. The same fix commit distinguishes
unavailable policy/tools from actual limits, with deterministic regressions.
Browser recovery continued to display the immutable historical limit message;
corrected wording is fixture-verified, not claimed as a fresh browser result.

## New call accounting

| Scope                         | Stored reservations | Proven successful calls | Settled failed reservations | Recorded dialogue tokens |
| ----------------------------- | ------------------- | ----------------------- | --------------------------- | ------------------------ |
| Moonlight dialogue            | 12                  | 11                      | 1 `invalid_request`         | 29,445                   |
| Moonlight evaluator           | 2                   | 2 accepted assessments  | 0                           | Not persisted            |
| Curated classifier            | 1                   | 1                       | 0                           | 3,609                    |
| Total for this resolver phase | 15                  | 14                      | 1                           | 33,054                   |

The 12 successful dialogue calls have response IDs; the two legacy evaluator
calls produced accepted linked results but do not persist usage/response-ID/latency
metadata. The 33,054 tokens cover dialogue only and are not a complete billing
total. Failed reservations still consume the shared budget. The evidence exporter,
authorization/replay audit and v2 preparation made zero model calls. The previous
22-call R7 application run and seven-call #102 authoring/student workflow (four
authoring calls and three evaluations) are separate prior phases. They were not
rerun or added to this new total.

## Remaining acceptance limits

- Unknown/interrupted provider work still requires operator reconciliation. Refresh
  recovers committed evidence but does not resume arbitrary paid stages or an
  interrupted commit; new identities must not bypass an unresolved reservation.
- The classifier remains advisory: both new intended answers required explicit
  confirmation. No new model-proposed ambiguous message or alternative-help turn
  was added in this bounded phase; those browser cases remain prior evidence.
- Runtime assessments remain unscaffolded. Generated retests have deterministic
  PostgreSQL coverage and neutral follow-ups have fixture coverage; neither was
  newly selected live here. R1 visuals and uninstalled tools remain unavailable.
- #102's missing version/action-policy editing controls require the explicit
  service preparation described above. Its temporary verification merge is not
  permission to land its code in PR #98 or to claim its later importer head tested.
- Human educational/security review and coordinated PR landing remain required.
  These bounded demonstrations are not evidence of educational effectiveness,
  durable mastery or completion of all #76 acceptance.

See [R7 integration guide](../docs/R7_INTEGRATION.md) for architecture and the
original-PR ancestry/landing plan. The earlier verification reports are historical
records; this report supersedes their outstanding #93 resolver/temporary-allowlist
gate without changing their recorded results.
