## Latest independent snapshot — October 25, 2026

**CHANGES REQUIRED.** [Current runner and reconciliation notes](snapshots/2026-10-25-final-07efb7f8/FINAL_RUNNER.md) tests combined application `07efb7f821339538800f150f57b298eb2e606be3` / tree `948b9a6005a056c97f10d181c589b5352d6221f3`. The new snapshot contains exact inputs, connected workflow evidence, all required visual sizes, recovery results and actionable owners.

The historical report below is preserved verbatim and applies to its original application snapshots, not this new candidate.

---

# Reproduce the fifth combined verification

Use [final-baselines.json](final-baselines.json), not a moving PR branch. This snapshot is commit `462cfb1b31d9108cec70d18b6553bd45048d2eed`, tree `03cca1fed3900a122e689c4a512afadd9052e5af`. Merge commit IDs may differ in a reproduction; the exact tree must match. The utility stops on conflicts without resolving or discarding them.

```powershell
node C:/path/to/acceptance/v22/compose-candidate.mjs C:/path/to/clone C:/path/to/new-worktree C:/path/to/new-receipt.json C:/path/to/acceptance/v22/final-baselines.json
```

All state/output directories must be private and outside the application/build context. Do not reuse the retained incident volumes, another workstream's runtime or an earlier snapshot's state. Check Docker and host network ranges before choosing new non-overlapping subnets. Preserve the shared storage guard unchanged: 20 GiB for initialization/build and 10 GiB for runtime, using the owner's verified Docker backing path and existing container volume probe. Every phase participates in the same host lock. Never remove another owner's lock or overlap build/database/browser work.

The commands below describe this host's executed target. On another machine use its real paths and existing verified probe container. The default fixed target is `shell`, project `lp-v22-shell5`, port 3350. Stop if that identity already belongs to another run. Provider credentials/model must remain blank; no paid calls are authorized.

```powershell
$bundle = 'C:/path/to/acceptance/v22'
$source = 'C:/path/to/disposable-combination'
$state = 'C:/private/path/runtime-final'
$sha = '462cfb1b31d9108cec70d18b6553bd45048d2eed'
$backing = 'C:/owner-verified/path/docker_data.vhdx'
$probe = 'owner-selected-existing-postgres-container'
node "$bundle/runner.mjs" init --target shell --source $source --sha $sha --state $state --browser-subnet 10.234.54.0/24 --internal-subnet 10.234.55.0/24 --docker-data-path $backing --storage-probe-container $probe
node "$bundle/runner.mjs" build --target shell --source $source --sha $sha --state $state
```

The runtime runner validates the actual checkout's exact commit. For a newly reproduced merge commit, pass that new commit to the generic runtime runner only after checking the expected tree. The dedicated final browser utilities are intentionally pinned to the original commit and tree; copy/adapt them in a new verification-only bundle with explicit provenance before using another merge identity. Do not mislabel the new execution as the original run.

Capture default screens before changing the fictional seed:

```powershell
node "$bundle/runner-final/guarded-browser.mjs" --target shell --helper capture-shell --state $state --safety "$bundle/safety.mjs" --out C:/private/path/new-default-captures
node "$bundle/runner.mjs" integration --target shell --source $source --sha $sha --state $state
node "$bundle/runner.mjs" approval --target shell --source $source --sha $sha --state $state
```

The generic integration runner writes per-command logs, storage observations, source/tree/image identity and a completion receipt. Passing command phases include infrastructure; do not count them as unique application cases. The final explicit six-file authoring launcher is `authoring-tests.mjs`; the intermediate unrun current preparation contained an older four-file copy and is documented separately.

For the browser chain use the [final guarded wrapper](runner-final/GUARDED_BROWSER_PLACEMENT.md) and [same-record continuation sequence](runner-final/INTERVENTION_CONTINUATION.md). First run the source-to-original-answer authoring helper. Retain any failed reports and diagnose the cause before choosing a new output folder; do not overwrite or silently repair application behavior. The synthetic continuation requires the actual successful authoring receipt and preserves its source, lesson, published version, assignment, student, session, attempt and original text. Separate context checks and optional curated activation do not count as that journey's approval/delivery steps.

The fixture adapter retains its owned lock after an uncertain/nonzero container execution. Reconcile the actual process/outcome before any further mutation or owner-authorized release; no automatic retry or lock removal is allowed. Respect normal follow-up retry timing. Synthetic evaluator/private-draft injections are declared seams, not actual-model evidence.

Run accessibility with the completed authoring receipt, following `runner-final/SHELL_ACCESSIBILITY_STATUS.txt`. It owns its shared guard directly. Publish only reviewed report JSON and PNGs; its browser profiles contain authentication and must stay private. Student regression has separate fresh fictional accounts and requires the curated assignment to be activated through the normal workflow first.

Screen-reader and actual-model checks remain unrun unless independently performed. No script merges, deploys, rewrites application code or mutates implementation PRs.
