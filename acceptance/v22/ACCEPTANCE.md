# Learning Pulse Workbench v2.2 acceptance

**Do not treat this candidate as accepted for merge.** The pinned combination passed its executed database/service checks, but the continuous cross-role browser journey is incomplete and the captured layout does not meet the v2.2 reference. This package changes verification assets only.

Coordination: [#35](https://github.com/peterbucci/ai-teaching-platform/issues/35), [#76](https://github.com/peterbucci/ai-teaching-platform/issues/76), [#114](https://github.com/peterbucci/ai-teaching-platform/issues/114). Capture date: October 25, 2026. Accounts and records are fictional. Providers were disabled; no paid calls were made. Screen-reader and actual-model verification remain unrun.

The shared shell and newer assignment/lesson heads arrived during packaging. See [second-snapshot intake](SHELL_INTAKE.md); it is separate from the completed first-snapshot results below.

## Review entry points

- [Integration matrix and exact commits](INTEGRATION_MATRIX.md)
- [Functional coverage and its limits](FUNCTIONAL_REPORT.md)
- [Visual acceptance report](implementation-verification/VISUAL_ACCEPTANCE_REPORT.md) and [actual prototype/main/combined comparison gallery](implementation-verification/comparison-gallery.html)
- [Severity-ranked defects and owners](DEFECTS.md)
- [Remaining merge blockers](MERGE_BLOCKERS.md)
- [Runner instructions](RUNNER.md), [harness execution status](HARNESS_STATUS.md), and [raw evidence index](evidence/INDEX.md)

## What actually ran

| Verification                                 | Result                                                                                                                                    | Boundary                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Four pinned PR heads                         | Both existing GitHub check jobs successful on each                                                                                        | Branch CI is not combined application proof                                  |
| Six pairwise merges and four-way composition | Clean; independently recomposed identical Git tree                                                                                        | Textual compatibility only                                                   |
| Combined deterministic checks                | 541 repository tests plus 17 colocated authoring tests passed; lint, typecheck, format, content checks and production Docker build passed | No model or continuous browser claim                                         |
| Combined database/service/HTTP checks        | 89 passing command phases, including 21 repository checks, SQL, restart and persistence; approval run added five passing phases           | Counts include infrastructure phases, not 94 unique application test cases   |
| Main before baseline                         | 466 repository tests, production Docker build and default fictional seed completed                                                        | Main is a separate runtime and database                                      |
| Visual capture                               | 41 prototype + 36 main + 36 combined images at four required sizes                                                                        | Main/combined data match; populated prototype data parity remains incomplete |
| Browser context and accessibility            | Assignment return defect reproduced; keyboard login, Escape focus return, evidence selection and native 200% zoom exercised               | Bounded run; reload/remaining mobile/recovery cases incomplete               |
| Complete cross-role browser journey          | **Unrun**                                                                                                                                 | Storage hold interrupted planned further work                                |

The combined commit is `eba2fba3eee223bb43c0eea5fe197e9569285ea9`, with tree `016e8aeebd3b1f584cc7bd5a1036afcfeb8eac5c`. It merges main → repaired #116 → #117 → #118 → #113. No implementation branch or main was changed. The separate verification branch is based on main and contains only `acceptance/v22/` assets, not these application merges.

## Reproduce the composition

Obtain the five commits recorded in [baselines.json](baselines.json) in a local clone. This utility creates a new local `codex/verification-combined-*` branch and disposable worktree. It stops at conflicts without resolving or discarding them, records the merge order, and verifies the resulting tree. Commit IDs can differ because merge timestamps differ; tree equality is the content check.

```powershell
node C:/path/to/acceptance/v22/compose-candidate.mjs C:/path/to/clone C:/path/to/new-worktree C:/path/to/new-receipt.json
```

The successful second composition is recorded in [reproduction-receipt.json](evidence/reproduction-receipt.json). Follow [RUNNER.md](RUNNER.md) for fresh isolated database/runtime setup, checks and browser utilities. Read the current storage-recovery clearance before starting any build or database/browser mutation; this bundle does not supersede that hold. Do not reuse or delete the older failed `lp-accept-combined_postgres_data` volume.

## Evidence interpretation

The original exported v2.2 prototype is the visual authority, identified by archive and HTML hashes in [PROTOTYPE_BASELINE.md](prototype-verification/PROTOTYPE_BASELINE.md). The bundle includes actual captures, not generated reconstructions. Main and combined use equivalent default fictional data. The prototype contains populated lessons, interventions and multiple classes that the default application seed lacks; those density/state comparisons are explicitly unaccepted rather than scored as passing empty pages.

The earlier [verification PR #119](https://github.com/peterbucci/ai-teaching-platform/pull/119) covers a different, older combination and a storage incident. Its results are not reused as proof of this repaired combination. This run used fresh `lp-v22-integration5_postgres_data` and `lp-v22-main5_postgres_data` volumes. Passing their completed persistence checks does not establish that the earlier damaged volume recovered.

Raw logs retain failed setup attempts and later successful reruns. Some early run manifests predate the runner's explicit `runCompleted` field; completion here is based on all recorded phases, final exit and the preserved logs. Subsequent harness improvements are identified separately and are not retroactively attributed to earlier runs. No environment files, cookies, browser profiles, provider secrets or exported vendor runtime are published.
