# Pinned integration matrix

First GitHub baseline observed at 2026-10-25T04:09:19Z. This table preserves that snapshot; [SHELL_INTAKE.md](SHELL_INTAKE.md) records the newer #117/#118/#120 heads and separately composed candidate. Exact check URLs and completion times are in [baselines.json](baselines.json). All four PRs were open drafts; this verification does not constitute human approval.

| Snapshot           | Exact commit                                                                          | Branch-specific evidence                                               | Combined status                                               |
| ------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| Main               | `723ed6fea41138b604a9d333ebcd4a07b2202c36`                                            | Locally executed 466 tests, production build and 36 seeded screenshots | Base                                                          |
| Repaired #116      | `76b11ddfa0ce784f70290c0746efd94c7042f6fc`                                            | GitHub quality + intervention-approval jobs successful                 | Integrated; shared navigation/evidence defects remain         |
| #117               | `6f9dd8991abef5efa8108e50b2274dc3bdc13ce6`                                            | GitHub quality + intervention-approval jobs successful                 | Integrated; assignment context/return and handoff gaps remain |
| #118               | `d2dca515b1a926daf28e791044fe04d01bdf20a9`                                            | GitHub quality + intervention-approval jobs successful                 | Integrated; scoped search/handoff concerns remain             |
| #113               | `2b490863cc6de69a7659f1df1e4628bc22dd7d9a`                                            | GitHub quality + intervention-approval jobs successful                 | Integrated; new student browser scenarios unrun               |
| Shared-shell delta | Unavailable at first inspection; subsequently published as #120 (see second snapshot) | Unrun                                                                  | Second snapshot composed; runtime retest pending              |

Branch-specific CI was inspected, not rerun locally for every individual PR. Its passing status cannot prove interactions between branches. PR author descriptions are context, not independent execution evidence.

## Pairwise and combined compatibility

All six pairwise `git merge-tree --write-tree` checks exited zero; outputs are retained in [pairwise-merges.json](evidence/pairwise-merges.json). No overlapping text conflict was force-resolved. Functional/design observations below come from the four-way combined candidate; each pair was checked for textual compatibility only, not separately run as an application.

| Combination                | Text merge       | Functional/design assessment                                                                                                               |
| -------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| #116 + #117                | Clean            | Shared frame composes; C1 implicit assignment scope and browser-confirmed C2 return destination remain                                     |
| #116 + #118                | Clean            | Shared frame composes; C4 page-local search leakage and old shared hierarchy remain                                                        |
| #116 + #113                | Clean            | Separate teacher/student surfaces; combined service regressions pass, student browser result/scrolling unrun                               |
| #117 + #118                | Clean            | Exact-version inactive creation and separate activation pass HTTP checks; C5 published-version CTA not wired to new builder                |
| #117 + #113                | Clean            | Assignment resolver and student service checks pass in four-way composition; pair alone not separately runtime-tested                      |
| #118 + #113                | Clean            | Authored/curated version and tutor service checks pass in four-way composition; pair alone not separately runtime-tested                   |
| #116 + #117 + #118 + #113  | Clean            | 558 deterministic tests, production build, service/HTTP/restart checks pass; full browser journey incomplete and visual acceptance blocked |
| First heads + shared shell | Not yet composed | No test result can be inferred from the existing combination                                                                               |

## Exact local composition

| Step | Merged snapshot | Resulting local commit                     |
| ---- | --------------- | ------------------------------------------ |
| 0    | Main            | `723ed6fea41138b604a9d333ebcd4a07b2202c36` |
| 1    | #116            | `5ae255c2169092de060ba7b4b6116661be808d28` |
| 2    | #117            | `d080710ee6c6223b5beec8b1cf29c33cc2f27881` |
| 3    | #118            | `dc523029aff211be12aa086f3a4d93a29eaf4dd8` |
| 4    | #113            | `eba2fba3eee223bb43c0eea5fe197e9569285ea9` |

Final tree: `016e8aeebd3b1f584cc7bd5a1036afcfeb8eac5c`. Independently recomposed tree matched exactly. No application changes were made to resolve merges. These are temporary local merge commits; they were not pushed to any implementation branch or main.

The runtime used image `sha256:b45d71e75a64d57b7803db92ee4c9ee65249073fce7fd9fdfac7a3fb2f38c965`, project `lp-v22-integration5`, loopback origin `http://localhost:3349`, and a new PostgreSQL volume. Its app and database were on an internal network with blank model credentials. Default Docker subnet exhaustion initially blocked startup; retained network adjustment records describe explicit non-overlapping private subnets. That setup failure is not classified as an application conflict.

## Recheck rule

Record new PR and shell commits before any repeat. Create another disposable composition, stop on conflicts, retain the old results unchanged, and rerun consequential combined checks. In particular repeat assignment context, lesson handoff, evidence/intervention URLs, authorization/version identity, student result/scrolling and every screenshot viewport after shared-shell integration. Never use another agent's uncommitted working tree as a reviewed snapshot.
