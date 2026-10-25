# Fourth snapshot: repaired shared-shell candidate

> Historical fourth snapshot: runtime was never initialized; the fifth snapshot in FINAL_INTAKE.md supersedes the queued work below.

Observed October 25, 2026 at 05:27 UTC. This candidate supersedes the queued second snapshot for the next runtime pass. The second snapshot remains offline-tested only; its unrun runtime slot was never initialized. Earlier passing evidence and the third snapshot's unresolved conflict worktree are preserved.

| Input             | Exact commit                               |
| ----------------- | ------------------------------------------ |
| Main              | `723ed6fea41138b604a9d333ebcd4a07b2202c36` |
| #116 foundation   | `94e4e534ea4d68d86ea0810067497bf07258e6d2` |
| #117 assignments  | `9f300ce6e975ab460328a8aa4428c26d441ee0ab` |
| #118 lessons      | `9c44fe8eb1b122c0e7c1181e1f937ab4b3044445` |
| #113 student      | `83114efdb2a5c7deb5238a0b28756429b1952b21` |
| #120 shared shell | `a045defe11712b5c8f7ef88c7dae991ef9a33506` |

The new managed disposable worktree merges main → #116 → #117 → #118 → #113 → #120 without manual application changes. Combined commit: `e6126016c9b4ec2b479d252ff45e4e16a6a633f7`; tree: `fc9dd9f5db5e0843a6d46327df6be1e631dada94`. All ten pairwise object-only merges are clean. The published composition utility independently reproduced the identical tree in another disposable worktree (commit `01425ea7681ba0bf8cc16ae813b63775cdb9a6a7`).

Reproduce with [current-baselines.json](current-baselines.json) as the utility's fourth absolute argument. [Composition receipt](evidence/current-composition.json), [independent reproduction](evidence/current-reproduction-receipt.json), [all pairwise commands/results](evidence/heartbeat0527-pairwise.json).

## What changed

- **M01 conflict is resolved in the new source.** #120 now includes #116's repair as an actual merge parent and preserves its page-owned changes. The old conflict was real and remains recorded; this is a different commit combination.
- **T01 assertion is repaired.** The owner changed the obsolete sidebar-label expectation to the unchanged “Teaching Desk” heading while retaining the surrounding response, authorization and uncertainty checks. New #120 [CI passed](https://github.com/peterbucci/ai-teaching-platform/actions/runs/40164628446).
- **C3 has a source-level repair.** The shell forwards the explicit authoritative saved-snapshot context flag, preserving omitted identities; acknowledged generation URLs use canonical saved scope. Current combined browser verification is still required.
- **S1 remains a source-confirmed P2 concern.** Course Assignments/mobile Back retain the assignment query, while #117 selects detail whenever it is present. A browser check is prepared.
- Latest #113 `83114ef` changes its verification utility only compared with `2fc0d49`; the production answer-recovery changes introduced in `2fc0d49` still require this new combined regression. Its [independent CI passed](https://github.com/peterbucci/ai-teaching-platform/actions/runs/40164671022).
- #118's `9c44fe8` update remains verification-artifacts-only compared with `7b82197`.

[Independent static review](evidence/heartbeat0527-review.txt) distinguishes these findings from executed application results. Passing branch workflows and clean merge trees do not establish a working combined application.

## Execution boundary at intake

Offline combined checks completed at 05:36 UTC: **601 unit tests and 24 colocated authoring tests passed** (625 total; zero failures or skips). Lint, route type generation, TypeScript, formatting and all 293 content checks also passed. These results apply to this exact combined commit/tree; they do not establish runtime behavior. See the [offline verification receipt](evidence/current-offline/current-offline-verification.json), [unit log](evidence/current-offline/current-unit.log) and [six-file authoring log](evidence/current-offline/current-authoring-all.log).

No production/runtime/browser pass is claimed for this candidate. The recovery workstream still owns the serialized runtime window; its explicit release and a fresh storage/lock preflight are prerequisites.

The next isolated runtime will use the unused shell slot `lp-v22-shell5` at port3350, with a fresh private `runtime-current` state directory and database volume. Its manifest must name this new commit/tree. The historical second snapshot's pinned helpers remain unchanged; current helpers live separately in `runner-current/` and `current-verification/`. The old `runtime-shell` target was never initialized.

Default screenshot capture must precede fixture changes. Then run the actual combined integration suites, explicit source-to-follow-up browser stages, synthetic seams, student regression, accessibility and populated screenshots. Keep original failures, image identities, source/version links, approvals, activation and delivery distinct. No paid calls, application fixes or implementation-PR mutations are authorized.
