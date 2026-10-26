# Fifth snapshot: shared-shell runtime acceptance

This is the active verification candidate observed October 25, 2026 at 05:40 UTC. Its shared-shell update changes browser history and focus restoration, so it supersedes the fourth candidate before any runtime was built for that earlier composition. The fourth candidate retains its 601 repository tests, 24 authoring tests and static checks; those results are not attributed to this snapshot.

| Input             | Exact commit                               |
| ----------------- | ------------------------------------------ |
| Main              | `723ed6fea41138b604a9d333ebcd4a07b2202c36` |
| #116 foundation   | `94e4e534ea4d68d86ea0810067497bf07258e6d2` |
| #117 assignments  | `9f300ce6e975ab460328a8aa4428c26d441ee0ab` |
| #118 lessons      | `9c44fe8eb1b122c0e7c1181e1f937ab4b3044445` |
| #113 student      | `71898a8a72908577065bcc7c7fb9035d6cc29ebf` |
| #120 shared shell | `dd7401edcabe80b8308da30431ae06f05f0f1a9b` |

Combined local commit: `462cfb1b31d9108cec70d18b6553bd45048d2eed`; tree: `03cca1fed3900a122e689c4a512afadd9052e5af`. Merge order: main → #116 → #117 → #118 → #113 → #120. All merges completed without manual application changes. Implementation branches and main remain unchanged.

Compared with the fourth snapshot, #113 adds verification artifacts only. #120 changes `workspace-restoration.tsx`: distinct history-entry tokens, handling for repeated URLs, and coordination with page-owned evidence restoration. Its source changes require actual combined Back/Forward and focus verification.

The fresh runtime is `lp-v22-shell5` at `http://localhost:3350`, with private state `runtime-final`, a fresh `lp-v22-shell5_postgres_data` volume and browser/internal subnets `10.234.54.0/24` / `10.234.55.0/24`. No fourth-snapshot runtime was initialized. Providers are disabled and the data are fictional.

The reviewed shared storage guard passed before initialization and build; host/backing free space was approximately 47 GiB against the 20 GiB build minimum. Production build, health checks and default fictional seeding passed. Image: `sha256:1aedb0a89e97a99480c4dc3d02a55bb388b9d3b332c65bcc2c8c2511fa93873a`. Default screenshots must precede further fixture changes.

Offline verification passed 601 repository tests, 24 authoring tests, lint, route types, TypeScript, formatting and 293 content checks. All ten pairwise merges were clean; independent composition reproduced the exact tree. The combined integration run passed 89 command phases plus 89 storage preflights, and separate approval/follow-up verification passed five phases plus five preflights. Default capture completed all 36 screens at the four required sizes. These are separate evidence categories. The same-record browser journey and scoped recovery/accessibility checks completed with explicit synthetic seams; visual acceptance has not passed. See FINAL_FUNCTIONAL_REPORT.md and runner-final/INTERVENTION_EXECUTION.md for the retained sequence and limits. Approval, assignment activation and intervention delivery remain separate decisions. Explicit synthetic evaluator/private-draft seams do not establish actual-model verification. Screen-reader verification remains unrun.

At 07:14 UTC, a final read-only GitHub intake confirmed all five implementation heads remain exactly pinned, open, draft and unmerged. [Completion head receipt](evidence/completion-pr-heads-recheck.json). The application worktree remained clean with the exact candidate commit/tree and remote main unchanged; [identity receipt](evidence/final-completion-clean-identity.json).
