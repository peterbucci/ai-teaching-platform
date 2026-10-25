# Final candidate browser package

This is a preserved-copy adaptation for commit `462cfb1b31d9108cec70d18b6553bd45048d2eed`, tree `03cca1fed3900a122e689c4a512afadd9052e5af`. The earlier `runner-work` and `shell-verification` packages remain unchanged. Target remains `shell`, project `lp-v22-shell5`, origin `http://localhost:3350`; the new private state directory is `runtime-final`.

Preserve this relative placement when publishing or copying the verification package:

```text
acceptance/v22/
  safety.mjs
  runner-final/
    guarded-browser.mjs
    shell-authoring-browser.mjs
    student-regression-browser.mjs
    GUARDED_BROWSER_PLACEMENT.md
  final-verification/
    capture-shell.mjs
    capture-original-answer.mjs
    comparison-gallery.html
    FINAL_ACCEPTANCE_REPORT.md
```

The capture helper resolves at `../final-verification/capture-shell.mjs`. Other allowlisted helpers resolve beside the wrapper; their owning verification agent supplies the matching copies. No arbitrary script path or shell string is accepted. The working directory does not affect helper resolution.

After the parent gives runtime GO, the local default capture command is:

```powershell
node C:/Users/sb128/.codex/visualizations/2026/10/25/01a1713e-abef-7833-aa2a-a0ffa25ec46e/runner-final/guarded-browser.mjs `
  --target shell `
  --helper capture-shell `
  --state C:/Users/sb128/.codex/visualizations/2026/10/25/01a1713e-abef-7833-aa2a-a0ffa25ec46e/runtime-final/manifest.json `
  --safety C:/Users/sb128/.codex/worktrees/workbench-verification-report/LearningPlatform/acceptance/v22/safety.mjs `
  --out C:/Users/sb128/.codex/visualizations/2026/10/25/01a1713e-abef-7833-aa2a-a0ffa25ec46e/final-verification/screenshots-default
```

For another machine, pass its absolute runtime directory or `manifest.json` using `--state`, and its absolute copy of reviewed `safety.mjs` using `--safety`. The safety SHA256 must remain `af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485`; it is verified before import. Runtime source is derived from the verified manifest but must match the fixed commit and tree. No source pin is inferred from a moving branch.

The output parent must already exist. OUT and its sibling `.guard.json` receipt must be fresh; the guard does not create OUT before the child starts. Runtime and output paths must resolve outside source, including through junctions. A failed lock/storage check starts no browser. The reviewed 10 GiB runtime preflight and own-token release are reused without a second policy.

Optional `--fixture` supplies an actual populated scenario for capture or the synthetic student regression fixture. Installed dependency paths may be selected with `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE`; current local bundled Playwright and Edge defaults remain. Optional owner-verified storage paths/container names are forwarded to the reviewed preflight.

The additional `capture-original-answer` helper is read-only after its single authorized teacher login. It requires `--fixture` to point to the retained `final-authoring-05/report.json`, SHA256 `7e99672e7cf7e6689d1bcc53d57a68f1a052eecd6b09ee77ea7a8d9de3970051`. It verifies the exact session/assignment/attempt, scrolls the existing response into view at all four sizes, checks the exact rendered response text and saves new screenshots. It never submits, evaluates or replays the answer. Invoke with the same state/safety/storage options, `--helper capture-original-answer`, the pinned receipt as `--fixture`, and a fresh output such as `final-verification/original-answer-selected`. Runtime GO is still required from the coordinator. Earlier captures and their executed wrapper hashes remain historical records; changing this allowlist does not rewrite them.

Keep runtime state, `.env.acceptance`, browser profiles, cookies and endpoint files private and outside published assets. Do not copy `runtime-final` into the report worktree. Captures and guard receipts record execution provenance only after a real run.

Preparation validation is limited to syntax, formatting and static checks. No browser, database, Docker, build, preflight or lock acquisition ran as part of this preparation.
