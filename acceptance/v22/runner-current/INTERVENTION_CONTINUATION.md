# Same-record intervention browser continuation — prepared, unrun

These utilities extend a successful `shell-authoring-browser.mjs` record on commit `e6126016c9b4ec2b479d252ff45e4e16a6a633f7`, tree `fc9dd9f5db5e0843a6d46327df6be1e631dada94`. They do not create a substitute lesson, assignment, learner or answer. They require its final `teacher-original-evidence` stage, exact original whitespace/text, content/source version, student, session and attempt identities. The fixture checks those against existing services and database records before changing anything.

No runtime has been performed. Syntax/style checks are preparation only. Neither script establishes actual-model behavior or educational benefit.

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
- `ACCEPTANCE_SOURCE_SHA=e6126016c9b4ec2b479d252ff45e4e16a6a633f7` and `ACCEPTANCE_SOURCE_TREE=fc9dd9f5db5e0843a6d46327df6be1e631dada94`.
- `PGHOST=db`, `PGDATABASE=learning_platform`, blank `OPENAI_API_KEY` and `OPENAI_MODEL`.
- Existing fictional demo teacher/student-one identities and their configured `@example.invalid` emails.

```text
node --experimental-strip-types --conditions=react-server /tmp/acceptance-intervention-continuation-fixture.mjs prepare /tmp/acceptance-authoring-report.json /tmp/acceptance-intervention-preparation.json
node --experimental-strip-types --conditions=react-server /tmp/acceptance-intervention-continuation-fixture.mjs evaluate-followup /tmp/acceptance-intervention-browser-report.json /tmp/acceptance-intervention-evaluation.json
```

The browser utility takes six arguments and requires `BROWSER_EXECUTABLE` pointing to the installed Edge executable. Supply the exact reviewed PR #121 `safety.mjs`; its hash is checked. It acquires the shared host lock, checks the imported runtime preflight before launch and each explicit write action, blocks off-origin page requests, and releases only its own lock. It never starts/restarts a stack or cleans Docker resources.

```text
node intervention-continuation-browser.mjs review-and-submit <runtime-current> <preparation.json> <fresh-browser-output> <playwright-package> <reviewed-safety.mjs>
node intervention-continuation-browser.mjs inspect-followup <runtime-current> <evaluation.json> <fresh-final-output> <playwright-package> <reviewed-safety.mjs>
```

The container fixture cannot acquire the host-user lock from inside Docker. Use `guarded-container-fixture.mjs` below: it owns the reviewed shared lock, reruns the reviewed preflight before each Docker operation, checks the exact pinned worktree/container/image, copies only the allowlisted fixture, and retains its receipt. A stale earlier clearance is insufficient. Do not run it concurrently with the recovery/integration owner. Stop on failure and preserve receipts. Browser/API functional errors and responsive overflow produce nonzero exit and distinct report status. Screen readers, native 200% zoom and fresh actual-model verification remain unrun.

## Guarded host commands

Set `work` to this runner-current folder, `state` to the coordinator's runtime-current folder, `authoringReport` to the successful same-journey report, and `guard` to the reviewed `acceptance/v22/safety.mjs`. Every output folder below must be fresh. Do not execute before runtime GO.

```powershell
node "$work/guarded-container-fixture.mjs" prepare $state $authoringReport "$root/intervention-prepare" $guard
node "$work/intervention-continuation-browser.mjs" review-and-submit $state "$root/intervention-prepare/fixture.json" "$root/intervention-browser-submit" $playwright $guard
# Respect the saved retry_after timestamp before this explicit synthetic retry.
node "$work/guarded-container-fixture.mjs" evaluate-followup $state "$root/intervention-browser-submit/report.json" "$root/intervention-evaluation" $guard
node "$work/intervention-continuation-browser.mjs" inspect-followup $state "$root/intervention-evaluation/fixture.json" "$root/intervention-browser-final" $playwright $guard
```

The same adapter also supports the separate student-result regression fixture (it does not contribute to the continuous authoring record). That mode requires the curated assignment to have already been explicitly activated through the teacher workflow; the seed refuses to bypass activation.

```powershell
node "$work/guarded-container-fixture.mjs" student-regression $state unused "$root/student-regression-fixture" $guard
```

The adapter does not start or restart containers and never removes another owner's lock. It checks the exact `lp-v22-shell5-app-1` name, Compose project/service labels and pinned image identity without logging environment variables. Any Docker fixture execution error, timeout or nonzero exit stops immediately and retains its owned shared lock: the client result alone cannot distinguish a completed fixture failure from a transport failure with the container process still running. No receipt-copy or retry follows that outcome. The coordinator must reconcile the process and container receipt before any further mutation or owner-authorized lock release; the adapter never removes that retained lock automatically.
