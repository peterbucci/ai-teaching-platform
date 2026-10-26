# Publication allowlist

Copy only the named reviewed utilities and reviewed execution evidence below into `tests/artifacts/intervention-workspace/`. Do not recursively copy this task directory or a runtime/output folder. Every runtime/browser report records exact harness, unchanged guard and applicable helper/provenance hashes. New edits after a run must not be described as the source that executed earlier.

## Reviewed utilities

- `native-runner.mjs`
- `browser.mjs`
- `followup-label-check.mjs` (private adapted copy; original source hash and the one tablet-visibility change are documented)
- `safety.mjs` and `safety.test.mjs` byte-identical to PR121
- `native-postgres-provenance.json` (official archive URLs/hash, no credentials)
- `NATIVE_RUNTIME.md`, this allowlist, and the final execution report written after actual verification
- Optional root-owned `native-quality.mjs` and `native-dependencies.mjs`, after root review of their exact bytes
- The eight `reference/*.png` files and `reference/provenance.json`; keep prototype approved-undelivered and PR122 delivered-state labels distinct

The earlier Docker runner/fixture scripts are prepared but unexecuted for this native acceptance. Publish them only if the final report explicitly needs them as unrun preparation; do not imply a Docker pass.

## Credential-free execution evidence

Inspect each file before copying, then preserve its bytes and hash:

- Native `runs/<invocation>/report.json` including failures, source and harness identities, storage gates, and database durability/role assertions.
- Synthetic preparation `fixture.json`, uploaded `approval.json`, and the read-only uploaded followup `fixture.json`. These contain fictional IDs and, for uploaded teacher login, a fictional `@example.invalid` email/auth-user ID. They must contain no password, AUTH_SECRET, cookie, HMAC value or session token.
- Browser `report.json`, including actual requests only when they are the recorded synthetic intervention action payloads. Assignment activation intentionally records no review token. Reports identify separate curated browser and uploaded service-fixture journeys.
- Actual `.png` screenshots named by those reports, including retained failed-run screenshots where relevant. Inspect their pixels before publication. Mobile-sized CSS captures and native200 captures retain distinct labels.
- Root quality `results.json` and any separately reviewed deterministic test summary. Raw logs require explicit content review before inclusion; do not copy them by glob.

## Never copy

- `.env.acceptance`, `runtime.env`, `.env*`, bootstrap password files, cookies, login responses or derived passwords.
- `manifest.json`, `runtime.json`, any private state manifest, `private-profile-*`, browser profiles/storage, `postgres-data`/`native-data`, database dumps, native binaries or archives.
- `app.log`, `postgres.log`, arbitrary `.log` files or process inventories without separate review.
- Exported prototype HTML/vendor/runtime files, the project reference, user project mirrors, or any unrelated files.

The local PostgreSQL and application remain owned disposable verification processes with retained state. Publishing evidence neither removes their data nor changes their status. No automatic merge is authorized.
