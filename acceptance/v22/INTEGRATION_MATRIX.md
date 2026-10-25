# Integration matrix and exact snapshots

Current execution uses the fifth composition in [FINAL_INTAKE.md](FINAL_INTAKE.md). Branch-specific CI is distinct from local combined tests. Pairwise checks establish textual compatibility only; individual pairs were not separately run as complete applications.

| Input             | Current pinned commit                      | Branch-specific evidence                                                            | Combined fifth snapshot                                                                    |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Main              | `723ed6fea41138b604a9d333ebcd4a07b2202c36` | Separate main baseline: 466 tests, production build and 36 default screenshots      | Base                                                                                       |
| #116 foundation   | `94e4e534ea4d68d86ea0810067497bf07258e6d2` | Both CI jobs passed; run 40163886032                                                | Included exactly; service checks pass; current visual/context findings separately reported |
| #117 assignments  | `9f300ce6e975ab460328a8aa4428c26d441ee0ab` | Independent CI metadata retained in earlier intake evidence                         | Included exactly; assignment service/version/activation checks pass                        |
| #118 lessons      | `9c44fe8eb1b122c0e7c1181e1f937ab4b3044445` | Artifacts-only delta from 7b82197; author evidence is not reused as combined proof  | Included exactly; authoring/publication service checks pass                                |
| #113 student      | `71898a8a72908577065bcc7c7fb9035d6cc29ebf` | Artifacts-only delta from 83114ef; workflow status retained in final branch receipt | Included exactly; conversation/recovery services pass; browser result separately recorded  |
| #120 shared shell | `dd7401edcabe80b8308da30431ae06f05f0f1a9b` | CI run 40165995189 passed on this head                                              | Included exactly; actual shell screenshots captured and history/focus tested separately    |

[Exact baseline JSON](final-baselines.json), [latest branch-workflow observation](evidence/final-branch-ci.json), [final composition receipt](evidence/final-composition.json), [offline receipt](evidence/final-offline/final-offline-verification.json).

## Current textual compatibility

All ten pairs are clean: 116+117, 116+118, 116+113, 116+120, 117+118, 117+113, 117+120, 118+113, 118+120, 113+120. Exact arguments/results are preserved in `evidence/final-pairwise.json`.

Merge order main→116→117→118→113→120 produced local commit `462cfb1b31d9108cec70d18b6553bd45048d2eed`, tree `03cca1fed3900a122e689c4a512afadd9052e5af`. Independent reproduction produced commit `6ef9bd9e7aed13fca34d4475beee28293b318cb0` with the identical tree. No manual merge resolution or application fix was used. The application composition remains local; the verification PR contains acceptance assets only.

## Combined execution matrix

| Relationship             | Combined evidence                                                                                     | Limit / remaining gate                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Shell + assignment page  | Production build, assignment/auth checks and all four-size screenshots                                | Course return/selected-cell context and double-padding findings require their own browser/visual disposition |
| Shell + Lessons          | Production build, authoring/source/version suites and actual library/authoring screenshots            | Populated pane/unsaved/focus results are separately recorded; count parity is limited                        |
| Lesson → assignment      | Exact-version inactive creation and separate activation service checks; same-record browser stages    | Generic published-page handoff may require explicit teacher re-selection; no version corruption inferred     |
| Evidence → intervention  | Original/counterevidence/source/draft/authorization suites and approval/follow-up fixtures            | Saved-context browser regression and Evidence layout acceptance remain distinct                              |
| Student conversation     | Deterministic and synthetic-provider conversation/controller/recovery services                        | These do not prove live-model behavior or browser focus/scroll by themselves                                 |
| Authorization + identity | Class/enrollment/role checks, private projections, immutable source/version, SQL evidence constraints | Tested cases only; no blanket security certification                                                         |

Use [FINAL_FUNCTIONAL_REPORT.md](FINAL_FUNCTIONAL_REPORT.md) and the current visual/accessibility reports for actual browser results and defect reproduction.

## Snapshot history

| Snapshot              | Exact composition / tree                                                                | Actual execution boundary                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First                 | `eba2fba3eee223bb43c0eea5fe197e9569285ea9` / `016e8aeebd3b1f584cc7bd5a1036afcfeb8eac5c` | 541+17 tests, production, service/persistence,36 screenshots; full connected browser journey unrun                                                                    |
| Second shared shell   | `1a9d95b3be3e30d08d9dafc7ec6d1a14208368ac` / `c2f1c30b3f62391283ced9f798bbcae5cc7ca794` | 557+24 offline tests/static checks; runtime never initialized                                                                                                         |
| Third conflict intake | #116 94e4e534 + #120 dd97767                                                            | Nine of ten pairs clean; actual composition stopped at navigation.tsx conflict; no accepted full tree or build                                                        |
| Fourth repaired shell | `e6126016c9b4ec2b479d252ff45e4e16a6a633f7` / `fc9dd9f5db5e0843a6d46327df6be1e631dada94` | 601+24 offline tests/static checks, ten pairs clean; superseded before runtime                                                                                        |
| Fifth current         | `462cfb1b31d9108cec70d18b6553bd45048d2eed` / `03cca1fed3900a122e689c4a512afadd9052e5af` | 601+24 offline tests/static checks, production, complete combined service/persistence/approval runs, actual four-size screenshots; browser stages reported separately |

[First pins](baselines.json), [second intake](SHELL_INTAKE.md), [third conflict](LATEST_INTAKE.md), [fourth intake](CURRENT_INTAKE.md), [fifth intake](FINAL_INTAKE.md). The former M01 merge conflict and T01 stale-label failure are repaired for the fifth snapshot; their historical evidence is retained. The fifth actual uncertainty suite passed.

A later PR update needs a new recorded input set and consequential retests. Never attribute these results to unreviewed moving heads, another worktree, or a new tree merely because independent branch CI passed.
