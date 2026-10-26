# Retained execution evidence

All records here refer to fictional local data. Credential files are excluded. `COPIED_HASHES.json` records byte-identical copied evidence before formatting of authored reports/utilities; raw execution outputs are preserved unchanged.

| Artifact | Meaning |
| --- | --- |
| `runtime-combined/runs/2026-10-25T04-15-26-557Z-init/` | Original isolated target initialization |
| `runtime-combined/runs/2026-10-25T04-15-38-755Z-build/` | Build/startup attempt; image built, network pool exhaustion prevented startup |
| `runtime-combined/runs/2026-10-25T04-18-20-708Z-build/` | Successful production build/start/seed on explicit private subnets |
| `runtime-combined/runs/2026-10-25T04-22-54-476Z-integration/` | All 89 command phases passed, including 21 repository checks plus SQL/restart/health/reseed/persistence |
| `runtime-combined/runs/2026-10-25T04-30-36-061Z-approval/` | Five passing phases, including authenticated synthetic approval/delivery/follow-up checks; `approval-details.json` provides identities/outcomes |
| `runtime-main/runs/` | Separate main initialization/build and 466-test unit baseline |
| `runtime-*/manifest.json` | Exact original target/source/configuration metadata; initial network label must be read with `network-adjustment.json` and actual compose file |
| `combined-unit.log` | Initial module-resolution setup failure; not a passing suite |
| `combined-unit-rerun.log` | Corrected dependency environment: 541 passed |
| `combined-colocated.log` | First route-glob attempt: 13 passed; four question tests not included |
| `combined-colocated-all17.log` | Explicit-import launcher: all 17 passed |
| `combined-{lint,typecheck,format}.log` | Combined static checks |
| `pairwise-merges.json` | Six clean textual merge checks only |
| `reproduction-receipt.json` | Second disposable composition produced exactly the recorded Git tree |
| `runner-collision-probe.log` | Existing project resource guard rejected a new state directory before creating credentials/resources |

Captured command lines include local `.env.acceptance` **paths**, never that file's contents. The logs are readable without local state but are not executable scripts. Existing final image and command receipts identify the tested source; a later runner hash does not alter older results.

Sibling directories contain the actual visual captures, browser-context evidence and bounded accessibility run. Review their reports for failure/unrun distinctions. Raw JSON and logs are evidence: formatting is intentionally skipped for captured output so hashes remain reproducible; authored reports and utilities still undergo formatting checks.
