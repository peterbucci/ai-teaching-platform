# Reviewed storage guard integration

The verification runner now imports the exact storage guard and ten pure tests from [PR #121](https://github.com/peterbucci/ai-teaching-platform/pull/121), commit `fe8323ae8406e4d6415e4486849317fb48a91821`. The source checkout was clean when its Git identity was read. No second storage policy or cleanup mechanism was introduced.

| File                 | SHA256                                                             |
| -------------------- | ------------------------------------------------------------------ |
| `safety.mjs`         | `af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485` |
| `safety.test.mjs`    | `819efd0de539780581236109fcbe72cde23352748942c77c80392eb235dd30d3` |
| Adapted `runner.mjs` | `9edadf9d6cf38231bb539162065f450c360525ca78e4722162e3873a6b64996a` |

The imported files are byte-identical to that reviewed source. New reports record their hashes and provenance alongside the current runner hash. Previous application results retain their original harness identities; this later guard is not retroactively claimed for them.

The shared user lock covers initialization and command execution, and only its token owner can release it. Initialization checks storage before Docker resource inventory or credential/configuration creation. Every non-report child command is preceded by the imported preflight; failed commands and failed preflight stop the run immediately, so no later restart occurs. Thresholds are 20 GiB for initialization/build/quality/explicit-preflight and 10 GiB for runtime. Quality mode does not query Docker. Report mode only reads Docker status. Browser/fixture scripts need separately coordinated exclusive access and a successful guarded preflight; they do not hold the runner lock.

## Actual validation

- [Ten pure tests](evidence/storage-guard/safety-tests.log): 10 passed, 0 failed. They inject measurements and Docker responses; the low-space test asserts that no Docker probe occurs.
- Syntax, ESLint and Prettier checks passed for the runner, helper and helper tests.
- [Real preflight receipt](evidence/storage-guard/guard-preflight-receipt.json), [runner result](evidence/storage-guard/lock-rejection-results.json), and [output](evidence/storage-guard/guard-preflight.log): at 2026-10-25 04:46:53 UTC, an existing shared lock rejected this invocation with exit 1. The result is aborted/incomplete, with no subsequent check. No manifest, compose configuration or credentials were created, and the existing lock remained present.
- The intended real low-space demonstration did not run because the shared lock stopped the invocation first. The outer evidence probe expected a disk gate and reported that mismatch; this is not an application failure. Later coordination reported increased host headroom, so no second probe was attempted. Current runtime readiness is not inferred from the earlier low-space observation.
- Application builds, database checks and browser acceptance with this guarded revision remain **unrun**. Recovery coordination must supply current clearance before they resume.

[Machine-readable provenance](evidence/storage-guard/provenance.json) records the copied hashes and validation scope. No raw earlier evidence was modified.
