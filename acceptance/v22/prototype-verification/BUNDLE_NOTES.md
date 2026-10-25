# Published visual evidence bundle

The sibling prototype and implementation folders contain 113 unchanged PNG screenshots (9,488,410 bytes; about 9.05 MiB), per-capture visible text, capture manifests, reports and screenshot runners. The HTML comparison gallery keeps relative paths between these two folders.

The exported prototype HTML and its runtime/vendor files are deliberately **not included**. Browser profiles, authentication storage, environment files, local runtime manifests, databases and unrelated files are also omitted. Obtain the exact authorized archive identified in PROTOTYPE_BASELINE.md and extract it to a separate local directory. Set PROTOTYPE_EXPORT_DIR to that directory and serve it on loopback port3352. The runner's HTML hash guard verifies its identity.

Published runners are formatted copies with environment overrides for portable package/browser/runtime locations and the corrected default prototype port3352. Existing capture manifests preserve the SHA of the code that actually executed at capture time. They have not been rewritten to claim that these later formatting/configuration changes executed earlier.

For the application capture runners, set ACCEPTANCE_STATE_DIR to the externally prepared runtime-main or runtime-combined directory. It must contain the original exact-SHA manifest and provider-disabled .env.acceptance, which must never be committed. PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE optionally override installed dependency paths. Use a fresh output directory for every rerun. The code still rejects an unpinned source/origin, enabled provider configuration or any mutation other than fictional teacher sign-in.

No protected project documentation or application files were edited while preparing this bundle. No Git staging or commit was performed by the visual acceptance subagent.
