# Latest-head intake: merge conflict, no accepted combined candidate

Observed October 25, 2026 at approximately 05:10–05:13 UTC. This is a third intake, separate from the executed first combination and the compatible second shared-shell snapshot. No results are transferred between them.

| PR   | Exact latest head                          | Independent GitHub workflow                                                            | Combined status                                                                     |
| ---- | ------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| #113 | `2fc0d49a63f046a99e62805398b83cdada01a87a` | [Success](https://github.com/peterbucci/ai-teaching-platform/actions/runs/40164036028) | New production answer-recovery code; fresh combined regression unrun                |
| #116 | `94e4e534ea4d68d86ea0810067497bf07258e6d2` | [Success](https://github.com/peterbucci/ai-teaching-platform/actions/runs/40163886032) | Conflicts with #120; no accepted latest combined tree                               |
| #117 | `9f300ce6e975ab460328a8aa4428c26d441ee0ab` | [Success](https://github.com/peterbucci/ai-teaching-platform/actions/runs/40162556775) | Same head as second snapshot                                                        |
| #118 | `9c44fe8eb1b122c0e7c1181e1f937ab4b3044445` | [Success](https://github.com/peterbucci/ai-teaching-platform/actions/runs/40163833773) | Ten verification artifacts only since `7b82197`; application files unchanged        |
| #120 | `dd97767cda2e445bb1cf669b94363d1d9e9500b4` | [Failure](https://github.com/peterbucci/ai-teaching-platform/actions/runs/40162725785) | Navigation conflict with current #116; stale-label integration assertion also fails |

Main remains pinned to `723ed6fea41138b604a9d333ebcd4a07b2202c36`. Independent passing workflows do not establish combined application behavior.

## M01 — P1 integration blocker: #116 / #120 navigation conflict

All ten pairwise `git merge-tree --write-tree --messages` checks ran: nine clean, one conflict, zero command errors. The latest #116 and #120 conflict in `app/teacher/navigation.tsx`. Both also change `presentation.tsx` and `docs/TEACHER_WORKBENCH_CONTRACTS.md`; those textually merge but still require owner review.

The actual composition runner was then executed with main → #116 → #117 → #118 → #113 → #120 in a fresh disposable local worktree. The first four PR merges succeeded. The #120 merge returned exit 1 and the runner stopped with the navigation conflict intact. It did not choose either side, edit application code, abort away the evidence, or produce an accepted full-combination commit/tree. The partially merged worktree must not be built or treated as a candidate.

Reproduction: use `compose-candidate.mjs` with the [latest conflict manifest](latest-conflict-baselines.json) as its fourth absolute argument, after fetching those exact commits. Use fresh destination/receipt paths. See the [composition receipt](evidence/latest-conflict-receipt.json), [console failure](evidence/latest-conflict-compose.log), and [all pairwise commands/results](evidence/latest-intake-review.json).

Owners: #116 and #120. Reconcile navigation/context contracts in their implementation branches, then publish reviewed commits for a new disposable composition. This verification PR does not provide a competing fix.

## T01 — P2 test compatibility blocker: #120 uncertainty-page assertion

On exact #120 head `dd97767`, GitHub quality job `121077473669` passed unit, lint, type, format, production build and the preceding database/service phases, then failed “Check uploaded-lesson uncertainty and authorized teacher pages.” Its separate intervention-approval job passed.

The failure is `scripts/check-lesson-uncertainty.ts:617` asserting `/Class overview/` on the teacher page. The captured response is HTTP 200 and displays the new “Teaching Desk” / “Overview” structure. The new shell removed the old navigation label that had satisfied the assertion. This is an observed stale-label test failure, not evidence of a failed page render, authorization bypass or lesson-version corruption. Later steps in that quality job were skipped and cannot be counted as passing.

Owner: #120 with the existing acceptance-script owner. Reproduction: run `npm run lessons:uncertainty:check` against the isolated #120 runtime after its normal fixtures/prerequisites. Preserve the assertion failure. A reviewed update should assert the meaningful authorized page contract; do not weaken or silently skip the existing check in order to report green. [Failure excerpt](evidence/shell-ci-failure-excerpt.txt).

## Evidence boundaries

The compatible second snapshot `1a9d95b3be3e30d08d9dafc7ec6d1a14208368ac` / tree `c2f1c30b3f62391283ced9f798bbcae5cc7ca794` still contains older #116 `76b11dd` and #113 `2b49086`. Its offline checks and any later runtime captures apply only to those pins. Latest #113 recovery changes and latest #116 context changes require their own new integration after M01 is resolved.

The #118 artifact-only update is recorded transparently: its author's build/menu receipts name application commit `7b82197`. This is not independent verification of the latest combined application.

Our verification-only PR #122 commit `13982a97c3c32dedb9d823920fd7ee21cef21796` passed its own [CI workflow](https://github.com/peterbucci/ai-teaching-platform/actions/runs/40163629500). That checks the verification branch, not any of the disposable combined trees. [Observed workflow receipts](evidence/latest-branch-ci.json).
