# Current combined snapshot — verification tools prepared, runtime unrun

This bundle targets commit `e6126016c9b4ec2b479d252ff45e4e16a6a633f7`, tree `fc9dd9f5db5e0843a6d46327df6be1e631dada94`, from `C:/Users/sb128/.codex/worktrees/workbench-current-verification/LearningPlatform`. Its target remains `shell`, project `lp-v22-shell5`, origin `http://localhost:3350`; the fresh state directory is `runtime-current`. The older `runner-work` bundle and all historical evidence remain separate and unchanged.

`COPY_PROVENANCE.json` records the original helper hashes before adaptation. `CURRENT_HELPERS.json` records this bundle's final owned helper hashes and validation status. These are tool provenance, not application acceptance results.

The current student regression matches PR #113's revised recovery contract. It waits for the exact intercepted answer POST's 401 response, checks the unchanged original text and unconfirmed save message, and requires retry to remain disabled. Only an explicit **Check answer save** action and a successful authorized GET confirming that exact attempt remains unsaved can enable **Retry original answer**. The explicit retry is intercepted with another 401; its original answer bytes, attempt ID and submission key must be identical. The server still must have no saved answer. This is a browser-injected authentication rejection; real session expiry remains unrun.

Run authoring and student regression only through the reviewed guarded browser wrapper described in `GUARDED_BROWSER_PLACEMENT.md`. Run the intervention continuation and synthetic fixture steps through the commands in `INTERVENTION_CONTINUATION.md`. The latter owns its guard directly; do not double-lock it. Blank provider configuration and explicit synthetic provenance remain mandatory. Approval, activation and delivery are separate application/UI decisions.

The copied host fixture adapter preserves its reviewed fail-closed behavior: an execution error or nonzero result is uncertain, records the reconciliation requirement before any log I/O, retains its own shared lock, and performs no further Docker operation. Its three mocked recovery tests make no Docker call and acquire no real shared lock:

```text
node --experimental-vm-modules --test guarded-container-fixture.test.mjs
```

No browser, database, Docker, preflight or build operation was run while preparing this current bundle. Actual runtime results must be captured in new output directories after the coordinator releases the shared runtime window. Actual-model and screen-reader checks remain unrun.
