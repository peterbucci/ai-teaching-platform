# Same-record intervention browser continuation — execution reported separately

These utilities extend a successful `shell-authoring-browser.mjs` record on commit `462cfb1b31d9108cec70d18b6553bd45048d2eed`, tree `03cca1fed3900a122e689c4a512afadd9052e5af`. They do not create a substitute lesson, assignment, learner or answer. They require its final `teacher-original-evidence` stage, exact original whitespace/text, content/source version, student, session and attempt identities. The fixture checks those against existing services and database records before changing anything.

Runtime status is recorded in retained phase receipts and AUTHORING_EXECUTION.md. The first preparation recorded a synthetic original-answer evaluation, then stopped at the real hourly draft limit; it did not produce a draft or complete intervention delivery. Syntax/style checks alone remain preparation evidence. Neither script establishes actual-model behavior or educational benefit.

The focused adapter recovery tests passed with mocked process, filesystem and guard boundaries. They execute the actual adapter control flow for a Docker client timeout, failure to write its timeout log, and a nonzero transport failure. They verify an uncertain receipt, retained lock and no subsequent operation. They make no Docker call and acquire no real shared lock:

```text
node --experimental-vm-modules --test guarded-container-fixture.test.mjs
```

## Explicit sequence

1. After the shared storage owner grants an exclusive runtime window, run the authored browser journey. Preserve its report unchanged, including failures. Only a report that reached teacher inspection of the original saved answer can continue. A responsive failure can continue functionally but remains a visual failure.
2. Under the reviewed host storage guard and shared lock, copy that report and `intervention-continuation-fixture.mjs` into the dedicated shell app container. Invoke fixture mode `prepare`. The fixture injects one clearly named synthetic evaluator into the existing shared evaluator and one synthetic draft proposal into `generateInterventionDraft`. Existing accepted evaluation is reused; unresolved/failed recorded evaluations are not silently retried. A deterministic generation request/draft identity avoids duplication. Pending or failed generations stop; normal draft quotas remain enforced. This seam creates only a private draft and records exact request/evaluation/draft IDs and actual timing. It does not approve, activate, deliver, choose final recipients or submit an answer.
3. Copy the fresh preparation receipt out. Run browser phase `review-and-submit`. The same teacher inspects original evidence, edits and saves the private activity, previews it, chooses only the same student, approves, confirms student access is still denied, and separately delivers. The same student opens the review from the assignment list, starts the fresh check and submits exact fictional text. Blank provider configuration produces a real saved response with visible evaluation failure. The teacher inspects that linked response beside the original answer. Preserve this phase's report and screenshots.
4. Observe `followup.retry_after` and respect the normal minute-long retry delay. Do not mutate timestamps, clear a reservation or replay an unknown operation. Under the same reviewed host guard and lock, invoke fixture mode `evaluate-followup` using the browser phase's report. It calls only the existing follow-up retry service with an explicitly injected evaluator. Accepted evaluations are reused; pending/unknown outcomes and unavailable retry permission stop. The student's answer and teacher decisions remain unchanged. The receipt records the actual seam timing, request ID, evaluation ID and `injected_fixture` provenance.
5. Run browser phase `inspect-followup`. The student sees the accepted result explicitly labeled “Fixture evaluation for testing.” The teacher expands original evidence and linked follow-up and inspects the exact original answer, source/version and later response. Captures use the four required viewports.

This is one connected set of authorized records across browser stages and two documented operator seams. It is not an uninterrupted model-driven browser journey. Private-draft generation and both evaluation decisions are synthetic; approval, delivery and both student answers remain actual browser/application actions. The initial source→lesson→assignment authoring controls belong to the preceding authoring report.

## Invocation contracts

The container fixture accepts only `/tmp/acceptance-<name>.json` input/output paths and refuses existing output. Retain a failed output and choose a fresh name after diagnosing its cause. The guard requires:

- `ACCEPTANCE_PROJECT=lp-v22-shell5`, `AUTH_URL=http://localhost:3350`.
- `ACCEPTANCE_SOURCE_SHA=462cfb1b31d9108cec70d18b6553bd45048d2eed` and `ACCEPTANCE_SOURCE_TREE=03cca1fed3900a122e689c4a512afadd9052e5af`.
- `PGHOST=db`, `PGDATABASE=learning_platform`, blank `OPENAI_API_KEY` and `OPENAI_MODEL`.
- Existing fictional demo teacher/student-one identities and their configured `@example.invalid` emails.

```text
node --experimental-strip-types --conditions=react-server /tmp/acceptance-intervention-continuation-fixture.mjs prepare /tmp/acceptance-authoring-report.json /tmp/acceptance-intervention-preparation.json
node --experimental-strip-types --conditions=react-server /tmp/acceptance-intervention-continuation-fixture.mjs evaluate-followup /tmp/acceptance-intervention-browser-report.json /tmp/acceptance-intervention-evaluation.json
```

The browser utility takes six arguments and requires `BROWSER_EXECUTABLE` pointing to the installed Edge executable. Supply the exact reviewed PR #121 `safety.mjs`; its hash is checked. It acquires the shared host lock, checks the imported runtime preflight before launch and each explicit write action, blocks off-origin page requests, and releases only its own lock. It never starts/restarts a stack or cleans Docker resources.

```text
node intervention-continuation-browser.mjs review-and-submit <runtime-final> <preparation.json> <fresh-browser-output> <playwright-package> <reviewed-safety.mjs>
node intervention-continuation-browser.mjs inspect-followup <runtime-final> <evaluation.json> <fresh-final-output> <playwright-package> <reviewed-safety.mjs>
```

The container fixture cannot acquire the host-user lock from inside Docker. Use `guarded-container-fixture.mjs` below: it owns the reviewed shared lock, reruns the reviewed preflight before each Docker operation, checks the exact pinned worktree/container/image, copies only the allowlisted fixture, and retains its receipt. A stale earlier clearance is insufficient. Do not run it concurrently with the recovery/integration owner. Stop on failure and preserve receipts. Browser/API functional errors and responsive overflow produce nonzero exit and distinct report status. Screen readers, native 200% zoom and fresh actual-model verification remain unrun.

## Guarded host commands

Set `work` to this runner-final folder, `state` to the coordinator's runtime-final folder, `authoringReport` to the successful same-journey report, and `guard` to the reviewed `acceptance/v22/safety.mjs`. Every output folder below must be fresh. Do not execute before runtime GO.

```powershell
node "$work/guarded-container-fixture.mjs" prepare $state $authoringReport "$root/final-intervention-prepare-01" $guard
node "$work/intervention-continuation-browser.mjs" review-and-submit $state "$root/final-intervention-prepare-01/fixture.json" "$root/final-intervention-submit-01" $playwright $guard
# Respect the saved retry_after timestamp before this explicit synthetic retry.
node "$work/guarded-container-fixture.mjs" evaluate-followup $state "$root/final-intervention-submit-01/report.json" "$root/final-intervention-evaluate-01" $guard
node "$work/intervention-continuation-browser.mjs" inspect-followup $state "$root/final-intervention-evaluate-01/fixture.json" "$root/final-intervention-inspect-01" $playwright $guard
```

The same adapter also supports the separate student-result regression fixture (it does not contribute to the continuous authoring record). That mode requires the curated assignment to have already been explicitly activated through the teacher workflow; the seed refuses to bypass activation.

Before using that seed, run the separate `curated-activation` browser phase below. It opens the exact fictional curated assignment's teacher review, reads its current authorized approval receipt, and records already-active status without approving again when appropriate. Otherwise it inspects the reading, goals and question-bank section, checks the normal review confirmation and clicks **Approve and activate** using the application's existing review token. Its receipt preserves the exact content reference and activation timestamp, and is separate from the authored assignment journey. Do not use the seed to probe activation state.

```powershell
node "$work/intervention-continuation-browser.mjs" curated-activation $state "$root/final-intervention-prepare-01/fixture.json" "$root/final-curated-activation-01" $playwright $guard
```

```powershell
node "$work/guarded-container-fixture.mjs" student-regression $state unused "$root/final-student-regression-fixture-01" $guard
```

The optional `context-checks` phase uses its own output and action counts. Run it after preparation with the same saved draft receipt. C3 derives the expected scope from the authorized persisted draft, then opens conflicting concept/origin/starting-response query values with the same assignment. It checks displayed scope, the saved-scope return link, desktop/mobile Student work links, and the followed Evidence destination; shared navigation intentionally clears starting-response selection. C4 submits the actual Lessons title search. If the course shell has no Evidence link, the case is recorded **unreachable**, without claiming search isolation passed. No approval or delivery is performed in this phase; requests other than reads are blocked after teacher login.

```powershell
node "$work/intervention-continuation-browser.mjs" context-checks $state "$root/final-intervention-prepare-01/fixture.json" "$root/final-context-01" $playwright $guard
```

The adapter does not start or restart containers and never removes another owner's lock. It checks the exact `lp-v22-shell5-app-1` name, Compose project/service labels and pinned image identity without logging environment variables. Any Docker fixture execution error, timeout or nonzero exit stops immediately and retains its owned shared lock: the client result alone cannot distinguish a completed fixture failure from a transport failure with the container process still running. No receipt-copy or retry follows that outcome. The coordinator must reconcile the process and container receipt before any further mutation or owner-authorized lock release; the adapter never removes that retained lock automatically.

## Independent curated review while the draft budget is exhausted

Only `curated-activation` may also accept the exact passed `final-authoring-05/report.json` (SHA-256 `7e99672e7cf7e6689d1bcc53d57a68f1a052eecd6b09ee77ea7a8d9de3970051`). It checks the final source/tree, project/origin, student identity and zero paid calls, and labels that input as an independent authoring receipt. It does not pretend a completed intervention preparation exists. Other phases still require their completed seam receipt. This narrow mode supports the separate curated student regression while preserving the authored journey's natural quota wait and all normal approval controls.

```powershell
node "$work/intervention-continuation-browser.mjs" curated-activation $state "$root/final-authoring-05/report.json" "$root/final-curated-activation-01" $playwright $guard
```

The coordinator's read-only reconciliation of failed preparation01 found one accepted original synthetic evaluation and no authored draft; the container process had exited. The coordinator then released only that reconciled owned lock. Natural draft capacity was measured at `2026-10-25T06:53:38.699297Z`; do not retry preparation before `06:53:40Z`. Do not reset timestamps, quota records, or the accepted evaluation. Retain the first failed/uncertain receipts unchanged.
