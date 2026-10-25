# Second snapshot: shared-shell intake

The shared shell became available while the first verification package was being prepared. **Earlier application results remain valid only for their recorded first snapshot.** The old heads in `baselines.json` are intentionally unchanged.

At 2026-10-25 04:46 UTC, GitHub listed these current heads:

| PR   | Exact commit                               | Relation to first run                              |
| ---- | ------------------------------------------ | -------------------------------------------------- |
| #116 | `76b11ddfa0ce784f70290c0746efd94c7042f6fc` | Unchanged repaired foundation                      |
| #117 | `9f300ce6e975ab460328a8aa4428c26d441ee0ab` | Updated assignment hierarchy/progress              |
| #118 | `7b82197f5c0b665a955d5dc47a07e13d8a19627a` | Updated persistent authoring panes                 |
| #113 | `2b490863cc6de69a7659f1df1e4628bc22dd7d9a` | Unchanged; further student repair work is separate |
| #120 | `dd97767cda2e445bb1cf669b94363d1d9e9500b4` | New shared shell, stacked on repaired #116         |

All were open drafts. The new local composition merges main `723ed6fea41138b604a9d333ebcd4a07b2202c36` → #116 → #117 → #118 → #113 → #120 without conflicts or manual application changes. Resulting commit: `1a9d95b3be3e30d08d9dafc7ec6d1a14208368ac`; tree: `c2f1c30b3f62391283ced9f798bbcae5cc7ca794`. The [composition receipt](evidence/shell-composition.json) records the exact operations.

The repository unit suite passed **557 tests**, all six colocated authoring files passed **24 tests**, and lint, typecheck, formatting and 293 content checks passed on this second snapshot. This does not inherit the first snapshot's database, build, browser or visual passes. A separate runtime is being prepared; its actual results must be recorded before acceptance.

Host free space subsequently rose to about 51 GiB. The coordinating recovery task requested a serialized fresh PostgreSQL WAL/restart gate and acceptance window. New heavyweight builds and database/browser activity in this task remain held until that window ends and the shared guard permits execution. The earlier low-space observation is historical, not a current capacity measurement.

Static re-review distinguishes defects already changed by newer heads from remaining defects. See the separate `independent-review/shell-review.txt` when available; do not apply all first-snapshot findings to the updated shell unchanged. A clean merge and unit tests still do not establish full integration or visual acceptance.

The second snapshot also passed all ten pairwise text merges. A separate disposable recomposition produced the identical tree; see evidence/shell-reproduction-receipt.json. To reproduce this snapshot, pass the absolute path to shell-baselines.json as the composition utility's fourth argument. Omitting that argument still reproduces the first snapshot.
