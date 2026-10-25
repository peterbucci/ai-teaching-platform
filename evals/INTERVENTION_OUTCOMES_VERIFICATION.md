# Intervention follow-up verification — Issue #46

## Isolated runtime and provenance

Verification used the `feature/46-intervention-outcomes` worktree and an isolated
PostgreSQL 17 database, `lp46-db`, on port 5546. It was copied from `lp45-db`
without changing the source records. The copied baseline had 23 sessions,
64 attempts, 63 evaluations, 10 intervention drafts and three approvals.
Existing applied migrations were preserved. Additive migrations 016 and 017
provide the follow-up linkage, evaluation dispatch journal and reviewed dispatch
completion constraints.

The checks reuse saved #44 draft `baaa38f1-8ebd-46b1-ab5b-003a99106e7e` with its
original `gpt-6.1-sol` generation provenance. They create clearly labelled private
copies, then approve and deliver them through authenticated teacher endpoints.
They do not regenerate the activity. All accounts and responses are fictional.

The automated follow-up run uses authored provider fixtures through the existing
`evaluateSubmittedAttempt` implementation, with the application model key empty.
The student/teacher contract marks these results `injected_fixture`; the saved
report records five follow-up fixture calls and four evaluator regression fixture
calls, with **zero actual model calls**. Fixture acceptance proves persistence,
authorization and reference validation, not educational model quality.

## PostgreSQL and authenticated HTTP checks

Run `scripts/check-intervention-outcomes.ts` against the isolated application.
The authoritative executed result, identities, counts and timestamps are in
[`results/intervention-outcomes-http.json`](results/intervention-outcomes-http.json).
The run covers:

- Two explicitly selected recipients. Student A starts and submits an assisted
  correct response; student B has not started or submitted and remains missing,
  not failed. A third enrolled student cannot read, start, submit or retry.
- Anonymous requests, unrelated teacher access, student access to teacher
  comparisons, forged profile/user bindings and cross-origin writes are denied.
  Browser-supplied ownership fields are rejected by the strict action contract.
- Reads do not start work. Submitting before an explicit start is rejected.
  Concurrent starts create one dedicated session and one approved question.
- Concurrent exact submissions invoke the injected provider once. Exact HTTP
  replay returns the saved response; conflicting payloads, second answers and
  retrying accepted judgments are rejected.
- The immutable question snapshot and exact source reference match the approval.
  The response retains its own identity, original text and assistance snapshot.
  Private rubrics and generation/evidence identities are absent from student
  responses.
- Explanation display before starting or before submission is carried into the
  existing assistance evidence. Established teacher metrics count one assisted
  correct student and one missing student, without calling the result independent
  learning or long-term retention.
- Original evidence and contrary observations remain available in the teacher
  comparison. The comparison uses distinct recipients and the existing metrics
  definitions rather than an AI-generated count.
- Accepted uncertainty is counted separately from failure. Unknown provider
  timeouts remain pending and cannot cause an automatic or explicit duplicate
  paid request. A real authenticated HTTP submission with missing evaluator
  configuration retains the response and reports the failure.
- Known provider failure rejects an immediate retry. After the real one-minute
  cooldown, explicit recovery evaluates the same answer and retains both the
  failed evaluation and the accepted later evaluation.
- Dedicated follow-up sessions cannot enter ordinary tutor controller, restart,
  history or dashboard-selection paths. Additional evaluator regressions cover
  timeout, connection and provider-error persistence and replay.
- PostgreSQL rejects mutation of follow-up links and completed dispatch history.
  Migration 017 rejects a terminal dispatch with a null completion timestamp and
  a completed dispatch without an accepted saved evaluation. These negative SQL
  probes are rolled back, including if an assertion unexpectedly fails.
- Hashes of all sessions, attempts, evaluations and tutoring assistance present
  before the run remain unchanged. The source #44 draft and generation-request
  count also remain unchanged.

The independent completion-constraint probe also has a separate executed report:
[`results/intervention-outcomes-integrity.json`](results/intervention-outcomes-integrity.json).
It can be repeated with `--verify-integrity` without creating another response or
calling a provider.

## Refresh and application restart

The main run reads saved student and teacher state repeatedly through authenticated
HTTP. After restarting the application, run the same script with
`--verify-persistence`. It compares the saved responses, questions, assistance,
evaluations and teacher comparisons to pre-restart fingerprints and rechecks the
original evidence hash. The fingerprint omits only the clock-dependent
`retry_allowed` eligibility flag; saved retry timing and status remain included.

A passing restart result is recorded separately in
[`results/intervention-outcomes-persistence.json`](results/intervention-outcomes-persistence.json).
The application was restarted into its production build and the saved fingerprints
passed on October 23. The browser also reloaded the actual-model teacher comparison
after restart and retained the same answer, accepted judgment and distinct counts.

## Actual-model student-to-teacher browser walkthrough

The walkthrough reused original #44 draft
`baaa38f1-8ebd-46b1-ab5b-003a99106e7e` and #45 approval
`b3f368c2-1bee-4593-a33d-c8f718911e0e`, approved revision 2. No activity was
regenerated. A fictional recipient explicitly started the fresh check, entered
an answer, refreshed across an application restart with the unsent text preserved,
and submitted through the production student page at 12:26:51 UTC on October 23.

One actual `gpt-6.1-sol` evaluation accepted the answer as correct for both
transmission delay and propagation delay. Its saved provider usage is 3,613 input
and 454 output tokens, 4,067 total. The one dispatch produced a pending marker and
an accepted evaluation; those two records do not represent two model calls.
The saved result and exact question/source/response are in
[`results/intervention-outcomes-live.json`](results/intervention-outcomes-live.json).
The model key was removed from the isolated runtime after this bounded check.

The student saw the saved response, accepted status, correctness for both concepts,
recorded corrective feedback and configured-model provenance. After signing out
and signing in as the owning teacher, the intervention workspace showed two
intended recipients, one started, one submitted, one missing, one accepted, zero
pending, zero failed and zero uncertain. Expanding Student One showed the original
incorrect answer and contrary evidence beside the later correct response, its
assistance, exact lesson version and saved session link. Student Two remained
"No response yet." Student C's denial was tested by authenticated HTTP, not by a
separate manual browser login.

An independent code-review agent checked the actual result against passage P08,
the private approved criteria, both concept results and all three quote offsets.
The correct answer was assisted and is not independent or long-term retention
evidence. The inherited first-display timestamp is not a complete viewing history;
the elapsed assistance value cannot establish how recently help was last viewed.

## Repository regression checks and independent review

- `npm test`: 96 tests passed, including evaluator regressions and five new
  focused follow-up projection tests.
- TypeScript, lint and formatting checks passed.
- `content:check`: 293 checks passed.
- Production build passed. The installed Next.js version emitted a pre-existing
  security advisory; the first build stopped on that reminder and the repeated
  build succeeded with the warning. No dependency upgrade or warning suppression
  is included in this feature branch.
- Independent agent review covered schema integrity, permission boundaries,
  provider uncertainty, replay protection and the actual-model artifact. It found
  a terminal-timestamp SQL NULL loophole; additive migration 017 fixes it and the
  negative database probes pass. Human review remains a merge gate.

The focused authenticated HTTP suite also runs against the production server
using injected providers, separately from the single actual-model browser call.
Its latest checked timestamp is recorded in the HTTP result artifact. Repository
CI status is reported on the PR for the exact committed head, not inferred from
local checks.

## Remaining acceptance distinctions

The automated report describes deterministic fixture scoring against real
PostgreSQL and authenticated HTTP; the browser/model check above is separate.
The approved curated networking lesson is the verified source path. Exact uploaded-lesson integration remains
subject to the merged resolver and publication contracts; no uploaded-lesson
acceptance is claimed here.

Passing the mechanical checks does not establish causation, educational efficacy,
independent learning or long-term retention. Issue #46 and the R2 epic remain open
until the agreed actual follow-up acceptance gates are reviewed.
