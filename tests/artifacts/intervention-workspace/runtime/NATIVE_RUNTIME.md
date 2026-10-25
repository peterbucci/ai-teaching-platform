# Isolated native PostgreSQL fallback

Executed against final application source `b0608f6c69f47c48ed85876a992ccc3011bd2a66`. [Final execution and limitations](../native/EXECUTION.md) record passing lifecycle, follow-up, native zoom measurements and restart checks; complete 200% screenshot capture remains unavailable. Prior receipts retain their original `5f2d8dcf819b950dc1dfc31780859bf5e69ce16b` source. Docker Desktop initially failed at host IPC; its owner subsequently repaired Docker while this isolated native path was established. This path proves native PostgreSQL/pg + Next behavior, not local Docker acceptance; CI Docker/API results retain their own execution context.

These are executed verification recipes, not permission to replay a completed runtime. Artifact commits follow the frozen application commit. For fresh reproduction, copy this reviewed harness to a private bundle and use a separate source checkout pinned to `b0608f6`, updating task-specific paths deliberately. Preserve raw executed snapshots and use a newly coordinated test window. Never repeat initialization, preparation or completed mutations against the retained final database.

`native-runner.mjs` preserves the exact PR121 host lock and storage thresholds, setting `dockerRequired:false` because this run neither starts nor queries Docker. Ports are loopback PostgreSQL **54362** and Next **3362**. PostgreSQL uses a fresh private data directory, SCRAM authentication, durable defaults, and the same restricted `learning_app` role (`NOSUPERUSER NOCREATEDB NOCREATEROLE`). It registers no service, deletes no files, and never touches another data directory. Provider configuration is blank throughout. Credentials, native database, logs, browser profiles and receipts remain outside the application repository.

The read-only reusable binaries were located at:

`C:/Users/sb128/.codex/visualizations/2026/10/25/01a17320-652c-7f80-8314-33c0d238576e/runtime-quality/pgsql/bin`

The adjacent owner's completed `native-postgres-provenance.json` records PostgreSQL17.11-5 Windows x64, official EDB download/checksum URLs, archive SHA256 `80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`, and bin/lib/share-only extraction. A byte copy of that provenance is included here. The runner records the actual executable version and SHA256 before initializing our separate data. It never edits those shared binaries or Agent A's runtime.

After the root coordinator's build and global-lock handoff, set `$bundle` to this folder, `$state` to a fresh `intervention-native-runtime` directory in this chat's private task folder, `$pgBin` to the path above, and `$buildReceipt` to the exact passing root `native-quality.mjs` `results.json`:

```powershell
node "$bundle/native-runner.mjs" init $state $pgBin
node "$bundle/native-runner.mjs" adopt-build $state $buildReceipt
node "$bundle/native-runner.mjs" start $state
node "$bundle/native-runner.mjs" prepare $state
node "$bundle/native-runner.mjs" integration $state interventions:http
```

Initialization verifies free ports and an empty state, then initializes PostgreSQL, creates the restricted app role/database, runs existing migrations and seeds the existing fictional class. `adopt-build` verifies the receipt's passing status, exact source SHA/path, successful build command and BUILD_ID modification during that recorded build. This avoids rebuilding a source already verified by the coordinator. If no passing receipt exists, an explicit `build` mode performs the normal production Next build with the20-GiB guard.

Preparation invokes existing `scripts/check-interventions.ts` with its injected synthetic provider once. Its fresh output directory contains `fixture.json`, the input required for the native-aware browser helper. Use that exact receipt as `$fixture`; use fresh directories for every browser phase:

```powershell
node "$bundle/browser.mjs" activate $state $fixture "$privateOutput/native-activation-01"
node "$bundle/browser.mjs" journey $state $fixture "$privateOutput/native-browser-01"
node "$bundle/browser.mjs" zoom $state $fixture "$privateOutput/native-zoom-01"
node "$bundle/native-runner.mjs" approval $state
node "$bundle/native-runner.mjs" followup-fixture $state $approvalReceipt
node "$bundle/browser.mjs" followup $state $uploadedFixture "$privateOutput/native-followup-01"
node "$bundle/native-runner.mjs" durability $state
```

The browser verifies the exact committed checkout, BUILD_ID and actual recorded Next process command line, source path, port and loopback binding. It uses host-only preflight; it makes no Docker image claim. The separate synthetic assignment activation remains explicit. Pane navigation itself cannot issue a mutation.

Run `interventions:http` while the fixture remains private; do not run it against the same fixture after browser approval. Its existing contract explicitly checks `private_draft`. The intervention-specific `scripts/check-intervention-http.ts` regression checks semantic Evidence/Activity/Steps headings and lifecycle markers, replacing the obsolete oversized-heading text expectation. This test-only update is within the authorized intervention regression scope; all privacy, original-evidence and request-validation assertions remain required. The prior `5f2d8dc` HTTP run passed. Final `b0608f6` additionally corrects tablet focus acknowledgement, compacts repeated content and bounds workspace scrollers above the mobile navigation; it requires its own runtime verification after upgrade.

Approval executes the existing curated/uploaded approval+follow-up suite with `--setup-fixtures --with-followups`. That existing setup already executes and validates the curated and uploaded intervention suites; do not run an extra standalone lessons check immediately before it. It emits the actual completed draft/approval IDs for subsequent teacher browser inspection. It is separate service/API evidence from the private→edited→approved-undelivered→delivered browser journey. Respect normal hourly generation quotas; do not rerun preparation or alter timestamps to bypass them.

`followup-fixture` only reads this runtime's successful private approval receipt and database. It verifies the uploaded draft's actual approval/delivery/assignment/owner, restricts the owner to the suite's fictional `intervention-lesson-*` actor, and produces a credential-free receipt with the exact saved concept/source/version. The browser derives that already-provisioned synthetic actor's test password using the same existing HMAC convention privately, logs in, and performs only authorized reads. It invokes the independently written teacher label helper, checks human concept names and exact before/after text at1440/1024/390/320, and captures page geometry plus expanded original/follow-up responses. This is a separate uploaded fixture, never claimed as the curated browser journey. The private copied helper differs only by avoiding an attempt to re-open an already-open tablet drawer; original helper SHA256 is `c992328d5b133c9a7fa02ba72fabe47afadc0981d0a366a50cdfc273f25669d1`.

The actual Next journey additionally checks Steps→Inspect saved evidence, exact citation→native Back with Activity focus/scroll restoration, hidden required teacher guidance revealed by invalid Save without a request, and dirty navigation feedback on the correct pane. These cases explicitly exercise real Next history markers; component fixtures alone are not credited as that verification.

Durability uses the existing persistence test to prepare a labeled synthetic record, restarts only our own PostgreSQL cluster with normal fast shutdown, re-seeds idempotently, then verifies the durable record and authenticated access. The application stays running and reconnects through its existing pg pool. Per-task TEMP/TMP keep restart receipts separate from other agents. This is PostgreSQL restart durability; no container restart is claimed.

Every command is guarded and gets a fresh receipt. Unknown/nonzero mutation outcomes preserve the owned shared lock and all state; a coordinator must reconcile logs/processes before any next mutation or owned-lock release. No auto-retry, automatic cleanup, service registration, paid calls or merge occurs. Never remove another owner's lock. `status` reads our database identity but performs no domain mutation.

## Upgrade after a presentation correction

The initial native run and its later upgrade are documented in the [earlier checkpoint](../prior-native/CHECKPOINT.md) and [final execution](../native/EXECUTION.md). Do not initialize or prepare again. For a future authorized correction, the old manifest's source must be an ancestor of the new pin. Run `stop-for-upgrade` only while its private-draft preconditions hold, before rebuilding. The final retained draft is delivered, so that earlier upgrade recipe must not be blindly replayed. Final shutdown instead used the bounded `stop-owned-runtime.mjs` identity check and preserved PostgreSQL/data.

```powershell
node "$bundle/native-runner.mjs" stop-for-upgrade $state
# Coordinator performs the final guarded production build and supplies its receipt.
node "$bundle/native-runner.mjs" adopt-build $state $newBuildReceipt
node "$bundle/native-runner.mjs" start $state
node "$bundle/native-runner.mjs" upgrade-fixture $state
```

Use the last command's fresh `fixture.json` in the full `journey` mode. The upgrade validates exact source ancestry, build provenance, old process identity, role/database, original preparation receipt, current private revision and evidence hash before and after rebuild. The fixture records the original generation source separately from the new rendering source. It performs no provider call or domain mutation. The final browser journey always includes the tablet focus checks; the old bounded core-only diagnostic mode is retained only in the immutable historical run05 harness snapshot. Each new authorized edit uses a title based on its next revision rather than replaying the already saved title.
