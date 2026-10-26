# Published-content density fixture

Prepared offline and subsequently executed for candidate `462cfb1b31d9108cec70d18b6553bd45048d2eed`, tree `03cca1fed3900a122e689c4a512afadd9052e5af`. The coordinator granted the serialized runtime window on October 25, 2026. All four phases completed separately; the 24-view read-only capture passed at 07:11:03.734 UTC. Original pre-runtime static/review receipts remain unchanged. No application or protected documentation is changed.

The unchanged approved-content loader produces five concepts, **nineteen** question snapshots, and thirteen passages. The raw bank contributes fifteen questions; the bounded tutoring sequence contributes `D01`, `D02`, `D05`, and `D06`. A pure source-contract check caught the initial fifteen-count assumption before any database operation. All nineteen are retained. This is a useful populated comparison, but the prototype's exact fifteen-row density remains non-equivalent. This fixture does not exercise R4 objective/question-bank approval; its already approved attributed content follows the existing `approved-r7-lesson.ts` service-fixture pattern.

`published-density-fixture.mjs` accepts only four fixed phases. Each invocation takes the previous JSON receipt and a fresh output path, and the existing container adapter supplies the exact provider-disabled runtime. It refuses a wrong phase, actor, source/tree/project/origin, original authoring05 receipt, or changed source/version/count. All provider/HTTP calls are disabled. Neither this helper nor its adapter starts a stack or changes quotas.

1. `density-prepare`: copy the approved attributed reading into a new owned source version, save a distinctly named unapproved lesson draft, and record provenance. It uses no authoring-bank metadata and disables runtime generation.
2. `density-approve`: explicitly approve that saved revision through `approveLessonDraft`. This is an operator-created synthetic service approval, not evidence of a teacher's browser review or a model judgment.
3. `density-publish`: separately call `publishLessonVersion`, then reread the immutable version and verify exact identity/counts.
4. `density-assignment`: create four distinctly named empty fictional classes with the same parameterized fixture insert used by existing publication checks; call the regular `createLessonAssignment` service for each. Assert all four have `teacher_approved_at = null`, zero enrollments, and the same pinned version. No activation occurs.

The fixture hashes all pre-existing profiles, classes, enrollments, sessions, attempts, evaluations and displayed interventions before/after each phase; only the four newly created class IDs are excluded. It separately hashes unrelated source documents/versions, lessons/versions and assignments. Original water-lesson IDs are retained solely for provenance and exclusion checks. No original evidence or existing class is rewritten. Partial failure receipts remain inspectable; never rerun blindly.

Run one phase at a time after GO, checking its completed receipt before continuing. The paths below are examples for this local package and must remain fresh:

```powershell
$root = 'C:/Users/sb128/.codex/visualizations/2026/10/25/01a1713e-abef-7833-aa2a-a0ffa25ec46e'
$guard = 'C:/Users/sb128/.codex/worktrees/workbench-verification-report/LearningPlatform/acceptance/v22/safety.mjs'
node "$root/runner-final/guarded-container-fixture.mjs" density-prepare "$root/runtime-final" "$root/final-authoring-05/report.json" "$root/final-density-prepare-01" $guard
node "$root/runner-final/guarded-container-fixture.mjs" density-approve "$root/runtime-final" "$root/final-density-prepare-01/fixture.json" "$root/final-density-approve-01" $guard
node "$root/runner-final/guarded-container-fixture.mjs" density-publish "$root/runtime-final" "$root/final-density-approve-01/fixture.json" "$root/final-density-publish-01" $guard
node "$root/runner-final/guarded-container-fixture.mjs" density-assignment "$root/runtime-final" "$root/final-density-publish-01/fixture.json" "$root/final-density-assignment-01" $guard
```

The adapter imports the same reviewed `safety.mjs`, checks the pinned container image and private network, and uses the shared lock plus storage preflight before every Docker action. Any uncertain container execution retains its lock for owner reconciliation. Do not wrap this adapter in another lock holder.

The capture helper accepts only a completed density-assignment receipt whose fixture helper hash matches the adjacent published utility. It allows one fictional teacher login and then same-origin GET/HEAD requests only. It takes six actual views at each of 1440×1000, 1024×768, 390×844 and 320×844: published top, outline pane, expanded published question list, reading pane, four-row assignment context, and the first inactive assignment review. It asserts 5/19/13 in the DOM, exact route/title and four assignment IDs; records pane geometry, typography, focus, scroll and font readiness; retains failed captures; and reports overflow separately. Twenty-four captures are expected. No profile/storage-state files are exported.

```powershell
node "$root/runner-final/guarded-browser.mjs" --target shell --helper capture-published-density --state "$root/runtime-final/manifest.json" --safety $guard --fixture "$root/final-density-assignment-01/fixture.json" --out "$root/final-verification/published-density-01" --docker-data-path 'C:/Users/sb128/AppData/Local/Docker/wsl/disk/docker_data.vhdx' --storage-probe-container lp-v22-integration5-db-1
```

Keep published placement as sibling `runner-final/` and `final-verification/` directories so the allowlisted script and fixture hash references resolve. Existing raw guard/capture receipts retain their executed helper hashes; new wrapper files do not retroactively change earlier provenance. Publish allowlisted helpers, docs, receipts, PNGs and screenshot text only.

Offline validation:

```powershell
node --experimental-strip-types --conditions=react-server "$root/runner-final/check-published-density.mjs" 'C:/Users/sb128/.codex/worktrees/workbench-final-verification/LearningPlatform'
node --experimental-vm-modules --test "$root/runner-final/guarded-container-fixture.test.mjs"
```

The first check reads the exact candidate's real schemas/resolver and validates an in-memory attributed copy; it makes no database calls and rejects a mismatched question source version. It cannot establish persistence or successful approvals/publication. The three adapter tests preserve the existing timeout/transport-uncertainty lock behavior.

Remaining differences: nineteen versus fifteen published questions; version 1 versus prototype version 3 and its old versions; four inactive empty classes versus three active populated classes and one inactive class; longer explicit fixture labels; no editable five-family bank; intervention/follow-up comparison is now separately recorded in [INTERVENTION_VISUAL_REPORT.md](../final-verification/INTERVENTION_VISUAL_REPORT.md). Existing curated progress/roster may be captured read-only under its own identity and measured counts. The stock expanded class fixture has 24 students rather than the prototype's 18; do not relabel that broader density test as equivalent data or transfer its evidence to this owned copy.

## Recorded execution

Actual phase receipts are in ../evidence/final-browser/final-density-{prepare,approve,publish,assignment}-01/. All four completed with unchanged pre-existing evidence and unrelated-content fingerprints. The new source is 92422089-7e62-4036-bb01-871bfb3a9708 v1; the new lesson is d9c5d9f4-5f3a-4556-b880-fdffa91dc6ec v1. Four empty classes received inactive assignments; no activation was performed. Capture ran 07:10:51.683–07:11:03.734 UTC with 24 HTTP200 states, zero horizontal overflow, zero blocked requests/page errors and one allowed demo login POST. Guard completed; the shared lock was confirmed absent. See [PUBLISHED_DENSITY_VISUAL_REPORT.md](../final-verification/PUBLISHED_DENSITY_VISUAL_REPORT.md) for the actual visual differences; capture success is not visual acceptance.
