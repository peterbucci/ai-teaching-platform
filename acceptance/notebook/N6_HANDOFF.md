# N6 independent acceptance handoff — Student Notebook integration

**Disposition: inspectable draft candidate with verified safe route mounts;
complete active-Notebook integration remains gated.** This is an independent
agent review and evidence handoff, not human approval, permission to merge,
deployment approval or closure of any parent issue.

## Candidate and evidence identity

- Application commit: `1726c9c12f171095fed8c327b8a5852e8057c924`.
- Branch: `codex/student-notebook-integration`.
- Isolated worktree: `C:/Users/sb128/.codex/worktrees/student-notebook-integration/LearningPlatform`.
- Composition commit: `e7cbf3d6930e892e91f4170ed2aa08c9b8649e67`;
  exact source PRs and stacked ancestry: [source matrix](SOURCE_MATRIX.json).
- Production Webpack build ID: `UkrMmCmcVA8hwLEP9-iHL`.
- Approved prototype archive SHA-256:
  `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
- Runtime: loopback `http://127.0.0.1:3407`, separate PostgreSQL database
  `reader_visibility_n7_01a1742c`, fictional accounts and synthetic evidence.
  Providers were disabled; **zero paid calls**. The other acceptance environment
  and its shared lock were left untouched under the user's separate-runtime
  authorization.

The application was committed before the clean production build and production
journey/visual runs. Their empty tracked-diff hash is recorded where supported.
Evidence-only publication may produce a later commit; bind that commit to these
application file hashes rather than relabeling old runs as newly executed tests.

## Executed checks and their limits

| Evidence                                                                                                                                                                                               | Result                                                      | Scope and provenance                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Final deterministic suite                                                                                                                                                                              | 543 passed                                                  | Integration owner executed the complete suite. Synthetic tests do not establish live AI behavior.                                                                                                                                                                                                                                                                                                                                                             |
| Clean production Webpack build                                                                                                                                                                         | Passed                                                      | Build ID above. Retains the inherited `lib/materials/extract.ts` `module.createRequire` parsing warning; no Notebook build failure was reported.                                                                                                                                                                                                                                                                                                              |
| [Authenticated production journey](evidence/journey-1792951916781/journey.json)                                                                                                                        | 13/13 passed                                                | Exact commit recorded. Teacher approval/delivery, My Learning, overview, help/ambiguity fallback, explicit answer, exact original Unicode/whitespace, accepted synthetic evaluation, N3 saved work, Back/Forward, reading return, review draft/fresh check and cross-student denial.                                                                                                                                                                          |
| [Actual mounted production reader](evidence/mounted-reader-1792951909176/report.json)                                                                                                                  | 3/3 passed                                                  | Root executed the real standalone route: delayed delivery behind mobile drawer creates no display receipt; closing acknowledges the original ID once; account/drawer transitions retain receipt time/identity; failed receipt remains pending until explicit retry. The JSON has no SHA field; execution is associated with this build by the production runner and private `.setup/runtime/reader-mounted-production.log`, not inferred from the JSON alone. |
| [Independent portable reader matrix](reader/RESULTS.md)                                                                                                                                                | 17/17 passed                                                | Earlier combined development candidate; report records hashes and its uncommitted state. Four widths, real background focus, hidden/in-flight/failed/lost receipts, offscreen body, exact navigation and unsent draft return. It is supplemental evidence, not a final production rerun of all 17 cases.                                                                                                                                                      |
| [Reading HTTP](reader/reading-http-check-rerun.txt), [dialogue recovery](reader/dialogue-recovery-check.txt), [R7 controller](reader/controller-check.txt)                                             | Passed; 7 recovery groups; 6 controller groups              | Independent provider-disabled checks against the separate database. Includes authorization, immutable original work, source checks, unknown operation handling and saved-result recovery.                                                                                                                                                                                                                                                                     |
| [Production outcome/recovery matrix](evidence/recovery-2026-10-25T18-15-11-310Z/run-identity.json) / [six recovery cases](evidence/recovery-2026-10-25T18-15-11-310Z/independent-recovery-report.json) | All four outcome matrices and all six recovery cases passed | Independent quiet production rerun on `1726c9c`; original #113 assertions unchanged. Correct/partial/incorrect/uncertain each cover four widths. Recovery includes precommit 401, offline unknown save, lost postcommit response, acknowledged save with evaluation 401, real auth expiry/new-tab return and duplicate/original identity.                                                                                                                     |
| [Production prototype comparison](evidence/visual-1792951898180/COMPARISON.html) / [raw results](evidence/visual-1792951898180/visual-results.json)                                                    | Four widths and native 200% passed                          | Independent visual owner confirmed 31 comparison pairs/63 PNGs across six surfaces. No horizontal page overflow or browser errors. Fresh Edge native zoom verified DPR 1→2 and CSS viewport 1416→708 while CSS zoom and visual-viewport scale remained 1. Existing composer remained reachable.                                                                                                                                                               |

The final independent production recovery run recorded the same source-tree
SHA-256 before and after:
`f4f7ac6d87143da88bff913543ee52a6d0281ea71d62c42135a9a8a344848089`.
Its [identity record](evidence/recovery-2026-10-25T18-15-11-310Z/run-identity.json)
binds the source commit, production build ID, original helper hashes and all ten
outcome/recovery groups. The application SHA remains `1726c9c`; the draft PR head
may add evidence and documentation only. Those later commits do not represent
newly executed application tests.

The portable reader run retained an interrupted unbounded-wait attempt and a
transient development-server JSON parse failure. Its bounded full rerun and
unchanged HTTP rerun passed; [the retained record](reader/RESULTS.md) does not
erase those failures. The earlier production recovery run passed four outcome
matrices and R1–R3, then encountered fixture sign-in/navigation failures during
competing localhost suites before R4–R6 assertions. That failed evidence remains.
The final quiet production rerun recorded nine successful authentication events
and passed all six unchanged recovery cases, including genuine expiry recovery.

## Exact preservation of PR #113 ownership

Static comparison used Git blobs from PR #113
`71898a8a72908577065bcc7c7fb9035d6cc29ebf` and application commit
`1726c9c12f171095fed8c327b8a5852e8057c924`. Every file below is identical between
those commits. These are exact Git content hashes, not a claim that tests were
run at both commits in this review.

| Protected owner file                              | Matching Git blob in both commits          |
| ------------------------------------------------- | ------------------------------------------ |
| `app/study/session.tsx`                           | `839ba41df4a49d31cb0a42421a5f1e7c46ebb69c` |
| `app/study/dialogue.tsx`                          | `640c5ad484e9e1b727a32d6ab905ec186c62b2b0` |
| `app/study/answer-recovery.ts`                    | `3bc99d2255434b6146529d9735b01970031d8d5e` |
| `app/study/conversation-scroll.tsx`               | `6a4c18fd83a0d17319cad8e743a5a9297fa7d781` |
| `app/study/study.css`                             | `fa6a8850b14b3c2ea4a9ee226f7bd82700f62384` |
| `app/study/assignments/[assignmentId]/detail.css` | `a6ce8ab27090a7cba2baba3a3ef053582194c5c5` |
| `lib/tutoring/completion.ts`                      | `aa2e3dbeb41325c2dc327191543fadbddb4b11b9` |
| `lib/tutoring/store.ts`                           | `5d678eb516767627cf26f9ffdf96135096d5b3a8` |

The existing owner retains the single composer, original answer/submission
identity, scrolling, accepted evaluation selection, help acknowledgments and
save recovery. N7 keeps active study on its existing route and does not mount a
second composer or stateful tutoring controller.

## Ranked open gates and observed defects

Priorities below rank remaining work; an unimplemented gated mode is not evidence
that the retained route is defective. No P0 defect was established by the checks
completed here.

| Priority | Kind                           | Open item and required next action                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Ownership and completion gate  | **Active study is not mounted in the full N1 Notebook shell.** Obtain an explicit coordinated #113 owner handoff for mounting, persistent notice placement and hidden-pane help receipts. The owner must preserve one composer, drafts, identity, scrolling and safe recovery through mobile pane transitions. Keeping the current route is deliberate; do not claim active-Notebook parity or complete N7 delivery yet.                                                          |
| P1       | Review and activation gate     | **Live facing reading remains disabled.** #132 is composed and standalone mounted-reader tests pass, but no submitted GitHub review was present when checked. Obtain the required review/CI acceptance and test the actual combined facing pane, responsive selection and covering overlays before activation. Passing standalone tests does not grant that approval.                                                                                                             |
| P1       | Human acceptance gate          | **No human independent acceptance reviewer has been assigned.** The agent-run production matrix now passes, but select a human reviewer explicitly rather than inventing ownership or treating this handoff as human sign-off.                                                                                                                                                                                                                                                    |
| P2       | Contract and feature gate      | **Recorded chronology remains excluded.** #131 at `884dfb08de31c457a3eb618ad063fcbf701ac5f3` received independent agent review but is not included in the candidate. N3 uses N0's authorized `current-data` adapter. Any new presentation adapter requires N0 approval, public-DTO-only imports, authorization/privacy/accepted-result/displayed-help/snapshot-conflict tests and retained current-data fallback. Do not invent chronology, joins, missing assessments or events. |
| P2       | Accessibility verification gap | **Native mobile software keyboard and screen-reader checks are unrun.** Four viewport sizes, keyboard controls and native desktop 200% zoom do not substitute for these checks.                                                                                                                                                                                                                                                                                                   |
| P3       | Visual defect                  | **N5 home review cards stack their action at the desktop home-column width.** The inherited container breakpoint reduces density and pushes assignments lower than the prototype's compact right-aligned action. Content and actions remain available; route this focused presentation correction to the N5 owner.                                                                                                                                                                |

## Prototype parity boundaries

The approved archive hash was verified. External prototype fonts were blocked,
so comparisons use available local fallback fonts. Teacher-approved assignment,
review and reading content remains authoritative even where prototype fixtures
differ. N3 intentionally shows current saved data, not a fabricated complete
timeline. Active study retains #113's layout; standalone reading and delivered
review retain their existing Workspace around the mounted N4/N5 presentation.
These are explicit parity limitations, separate from the P3 card-density defect
and from data-integrity or authorization failures.

## Handoff action

The next narrow integration step is a coordinated #113 owner change supplying
the active-study mounting and persistent-notice/visibility contract, followed by
an independently repeated combined browser/database recovery matrix. Keep the
reader facing pane and recorded chronology disabled until their separate gates
are satisfied. Publish this evidence with the new draft PR, preserve unresolved
issues, and request an identified human reviewer. **Do not merge, deploy, change
main or close parent issues on the strength of this handoff.**
