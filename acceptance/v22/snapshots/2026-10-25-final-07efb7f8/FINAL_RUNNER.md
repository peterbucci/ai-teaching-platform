# Reproduce or inspect this acceptance snapshot

This snapshot tests application commit `07efb7f821339538800f150f57b298eb2e606be3`, tree `948b9a6005a056c97f10d181c589b5352d6221f3`. Use the exact input heads in `INTEGRATION_MATRIX.md`; never substitute a moving branch while attributing results to this commit. PR #122 contains verification artifacts, not the combined application's code changes.

## Isolation and provenance

The fresh managed application worktree uses `codex/workbench-v22-final-integration`. Main was the recorded `723ed6fea41138b604a9d333ebcd4a07b2202c36`. Cumulative merges were #116 → #120 → #117 → #118 → #123 → #124 → #113, all without manual conflict resolution. The separate object-only recomposition produced the identical tree; different merge metadata is expected. Inspect `integration` and `independent-audit` receipts.

PR #122 helpers were copied outside the application build context. The new bundles record source hashes and verifier adaptations; they do not modify application behavior. `safety.mjs` is the unchanged reviewed PR #121 guard at SHA256 `af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485`. It requires20GiB free before builds and10GiB before runtime, including host temporary files and the explicitly verified Docker backing path. Every heavy operation acquires the same host lock.

Executed runtime identity: project `lp-v22-final-01a173d6`, origin `http://localhost:3396`, internal subnet `10.234.67.0/24`, browser subnet `10.234.66.0/24`, fresh project-owned PostgreSQL volume. The gateway binds loopback; app/database are on an isolated internal network. Provider model and credentials are blank. Initialization verifies that the new project resources do not already exist. These identities now belong to this retained run: **do not initialize them again or remove them to make a fresh attempt**.

For a new independent execution, choose genuinely unused project, port, subnets and external state directory; make a new verification-only bundle with recorded adaptations to those identities. Reconcile the candidate tree first. The existing helpers intentionally reject a different commit/tree/runtime identity. Do not weaken those checks or relabel a new run as this one.

## Executed command families

Paths below refer to the new snapshot's published verification bundles and to the private local state directory. The private environment, credentials, seeded account passwords, browser profiles and Docker configuration are intentionally not published. A new run creates its own fictional credentials through the guarded initialization/seed process.

```powershell
node "$bundle/runner.mjs" init --target shell --source $source --sha $sha --state $state --browser-subnet $browserSubnet --internal-subnet $internalSubnet --docker-data-path $ownerVerifiedBacking --storage-probe-container $ownerSelectedExistingProbe
node "$bundle/runner.mjs" build --target shell --source $source --sha $sha --state $state
node "$bundle/runner.mjs" quality --target shell --source $source --sha $sha --state $state
node "$bundle/runner.mjs" integration --target shell --source $source --sha $sha --state $state
node "$bundle/runner.mjs" approval --target shell --source $source --sha $sha --state $state
```

Default screenshots were taken before service tests changed the fictional fixture. Populated visual capture uses exact saved authoring and intervention IDs, not hardcoded claims that its counts match the prototype. `visual-bundle/application-scenario-final-01.json` declares each state; `application-aggregate-04.json` corrects its stale student-count label against the actual captured text while preserving the original label and receipt hash. The actual unchanged prototype export is locally supplied to `capture-prototype.mjs`; its vendor source is not republished. Native 200% capture records browser zoom metrics and both ordinary and CDP images. `build-gallery-v2.mjs` fixes the earlier verifier's null metadata lookup, validates hashes, uses a complete nonblank original CDP surface where appropriate, and preserves links to cropped ordinary captures without altering pixels. The original gallery-build failure remains intact.

The same-record journey uses `authoring-01` followed by read-only reconciliation and `authoring-continuation-02`. Exact receipt hashes pin the narrow continuation. `journey-bundle` contains the original-result, diagnostic, intervention, six-blocker and recovery verifiers. `student-bundle` separately prepares fictional student sessions and runs core/result/recovery matrices. The published seed receipt contains fictional IDs and a credential environment-setting name; credential values remain private. Publish only the reviewed allowlist.

## Recovery rules for reruns

Never replay a mutation because a helper exited nonzero. Inspect the saved submission/request identity, authorized API/database result and worker/process state first. Each failed run remains in a fresh output directory. The original authoring locator fault, diagnostic derived-state assertion fault, and draft quota stop were preserved and reconciled before narrow continuation. The quota continuation does not reevaluate the original answer or reapply tutoring. Legitimate derived outcomes are recorded separately from immutable original evidence.

A helper may retain its own lock after an uncertain child result. Reconcile the actual process and saved records before owner release, retaining the lock receipt. Never delete another owner's lock. The `legacy-outcomes-01` attempt stopped before execution because the separate Student Notebook workstream held the guard; it is not an application test failure. Neither that workstream nor any shared daemon/volume is modified by this task.

Wait for server-provided normal quota/cooldown eligibility. Do not edit timestamps, rates, counters or actors to obtain a pass. Real session-expiry test R5 is deliberately unrun because its older hook changes a saved expiry timestamp. Actual model checks are prohibited in this run; synthetic evaluator/generator adapters are explicitly labeled throughout.

The completed intervention browser saved, approved, delivered, started and submitted exactly once. A later ambiguous disclosure selector stopped the verifier after those acknowledged writes. `intervention-reconciled-01` inspected the saved outcomes read-only before the synthetic follow-up evaluator and `intervention-followup-browser-01` inspected the accepted, linked result. Do not replay those five actions to repair the verifier.

`shell-accessibility-02` separately passed 47 desktop-dialog and repeated Evidence-history checks, retaining one authoring wait failure. `authored-pane-retention-03` then stopped before editing because the verifier included a textarea's default value in its label text. The separate v2 helper removes that input child only when extracting the label. `authored-pane-retention-04` passed all four focused checks: pinned source text, local edit retention across Reading/Outline/Editor, restoration without saving, and identical saved-objective/approval hashes. Earlier reports and helpers remain intact; these scoped continuations do not turn the original runs into passes.

`journey-persistence-01` performed one restart of this run's own database after the entire journey. The original verifier stopped when Docker reordered its two identical mount entries. `reconcile-journey-persistence.mjs` has no restart path: it verifies the exact prior restart, full mount set, same app/image and all 17 saved record groups. `journey-persistence-reconciled-01` passed with every stored field unchanged and zero new restart commands. Its separate release receipt records preservation of this run's own guard. The original failure and private complete snapshots remain intact; the complete scoped SQL exports are excluded from publication by policy, with their hashes retained.

The reports distinguish unit/component, authenticated browser, API/server, real PostgreSQL, restart/persistence, native zoom and unrun screen-reader/physical-device cases. A passing runner, screenshot or text merge is never a substitute for the full acceptance verdict.
