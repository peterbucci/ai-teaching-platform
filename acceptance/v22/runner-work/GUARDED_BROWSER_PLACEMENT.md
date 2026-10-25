# Guarded browser placement and invocation

The guard retains the exact shell and first-combined source pins. It uses the source path declared by a validated runtime manifest, then checks the checkout's HEAD, tree and application cleanliness after acquiring the shared acceptance lock. A different checkout location does not change the required commit or tree.

The reviewed safety module must have SHA256 `af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485`. The hash is checked **before import**. Its existing shared lock, 10 GiB runtime preflight and token-checked release are reused unchanged.

Preserve this layout when copying the verification-only package into the report worktree or another location:

```text
acceptance/v22/
  safety.mjs
  runner-work/
    guarded-browser.mjs
    shell-authoring-browser.mjs
    student-regression-browser.mjs
    GUARDED_BROWSER_PLACEMENT.md
  shell-verification/
    capture-shell.mjs
```

Helpers resolve relative to the wrapper, not the working directory. Only these three helper names are allowed. Do not flatten the folders. The safety module location is explicit in a published invocation; the original local report-worktree path remains the default for the current local setup.

Use `--state` with an existing absolute runtime directory or its absolute `manifest.json` path. Its `.env.acceptance` remains private beside the manifest. The default local directories remain `../runtime-shell` and `../runtime-combined` relative to the wrapper's directory. **Do not publish runtime directories, environment files, cookies, profiles or browser endpoints.**

Example after copying the package, with paths chosen for the receiving machine:

```powershell
node C:/verification/acceptance/v22/runner-work/guarded-browser.mjs `
  --target shell `
  --helper capture-shell `
  --state C:/private-acceptance/runtime-shell/manifest.json `
  --safety C:/verification/acceptance/v22/safety.mjs `
  --out C:/verification-output/shell-default
```

The output's parent must already exist. The output directory itself and its sibling `.guard.json` receipt must not exist. The guard does not create the child output directory; the child utility creates it only after verification and the shared preflight pass. OUT and state must resolve outside the source checkout, including through filesystem junctions.

Optional `--fixture` supplies the populated capture scenario for `capture-shell`, or the required synthetic fixture for `student-regression-browser`. `shell-authoring-browser` does not accept a fixture. Authoring and student regression perform their separately authorized fictional workflow; choosing the capture helper only permits its existing read-only workflow after demo login.

Optional `--docker-data-path` and `--storage-probe-container` are forwarded to the reviewed preflight. These must name owner-verified existing resources. The guard never creates a runtime or changes the source pins. Existing `PLAYWRIGHT_MODULE` and `BROWSER_EXECUTABLE` environment overrides can select installed local dependencies; otherwise the current machine's bundled Playwright and Edge paths remain the defaults. No dependency installation is performed.

The sibling guard receipt records the exact helper, wrapper and safety hashes, the runtime identity, preflight result and child exit outcome. An incomplete capture or failed child report returns nonzero. A failed preflight starts no child. The release function only removes its own lock token; an existing or changed lock is never cleared automatically.

Preparation validation: syntax and formatting checks only. No browser, Docker, database, preflight or lock acquisition was run while the shared runtime hold remained in effect. Runtime results require a later explicitly coordinated run.
