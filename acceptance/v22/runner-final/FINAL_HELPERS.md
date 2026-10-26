# Fifth combined snapshot — helper preparation provenance

> This document records initial preparation, before execution. Current actual results and retained failed runs are in [FINAL_FUNCTIONAL_REPORT.md](../FINAL_FUNCTIONAL_REPORT.md) and [SHELL_BROWSER_READINESS.md](../SHELL_BROWSER_READINESS.md). Later narrow helper revisions carry their own review and execution hashes; the original preparation manifest is unchanged.

This bundle targets commit `462cfb1b31d9108cec70d18b6553bd45048d2eed`, tree `03cca1fed3900a122e689c4a512afadd9052e5af`, from `C:/Users/sb128/.codex/worktrees/workbench-final-verification/LearningPlatform`. Its target remains `shell`, project `lp-v22-shell5`, origin `http://localhost:3350`; the fresh state directory is `runtime-final`. The older `runner-work` and `runner-current` bundles and all historical evidence remain separate and unchanged.

`COPY_PROVENANCE.json` records the original helper hashes before adaptation. `FINAL_HELPERS.json` records this bundle's final owned helper hashes and validation status. These are tool provenance, not application acceptance results.

The previous preparation bundle contained a four-file authoring launcher. That launcher was not used for its recorded 24-test run: the raw receipt names the separately published six-file launcher. This final bundle copies that proven six-file launcher unchanged (SHA-256 `30693ed1cc75f93cde5e0c579b6bf56042832c3a6bcd120d1f1d17ac3770f372`). The previous bundle and its truthful execution receipt remain intact; no result is transferred to this fifth application snapshot.

The current student regression matches PR #113's revised recovery contract. It waits for the exact intercepted answer POST's 401 response, checks the unchanged original text and unconfirmed save message, and requires retry to remain disabled. Only an explicit **Check answer save** action and a successful authorized GET confirming that exact attempt remains unsaved can enable **Retry original answer**. The explicit retry is intercepted with another 401; its original answer bytes, attempt ID and submission key must be identical. The server still must have no saved answer. This is a browser-injected authentication rejection; real session expiry remains unrun.

Run authoring and student regression only through the reviewed guarded browser wrapper described in `GUARDED_BROWSER_PLACEMENT.md`. Run the intervention continuation and synthetic fixture steps through the commands in `INTERVENTION_CONTINUATION.md`. The latter owns its guard directly; do not double-lock it. Blank provider configuration and explicit synthetic provenance remain mandatory. Approval, activation and delivery are separate application/UI decisions.

The copied host fixture adapter preserves its reviewed fail-closed behavior: an execution error or nonzero result is uncertain, records the reconciliation requirement before any log I/O, retains its own shared lock, and performs no further Docker operation. Its three mocked recovery tests make no Docker call and acquire no real shared lock:

```text
node --experimental-vm-modules --test guarded-container-fixture.test.mjs
```

No browser, database, Docker, preflight or build operation was run while preparing this current bundle. Actual runtime results must be captured in new output directories after the coordinator releases the shared runtime window. Actual-model and screen-reader checks remain unrun.
