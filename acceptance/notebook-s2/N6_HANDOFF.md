# S2 independent N6 acceptance handoff

**Draft integration; recorded evidence works in the isolated opt-in runtime.
Full prototype parity and complete chronology are NOT_ACCEPTED. Default
enablement remains off.** This handoff is not independent N6 acceptance,
permission to merge, deployment approval or a claim of live AI verification.

## Candidate and contract

- Application: `6aa2ce680d6ccea1f615e104e4f1792bcd502f38`.
- Production build: `GoinJqtqB2OaFL0DyOFbJ`.
- Application manifest SHA-256:
  `4b8a2eb00220429bfe5b528fde4a450e3d1fa085685b4cee0d60e76083723d2b`.
- Base: N7 #133 `d486fc029941567f81257d7b8717b1cb3dab09d4`, branch
  `codex/student-notebook-integration`. S2 branch: `codex/student-notebook-history`.
- Dependency: exact #131 `884dfb08de31c457a3eb618ad063fcbf701ac5f3`, merged
  without editing its seven files. Independent source review is in
  [S2_REVIEW.md](../../app/study/notebook/records/S2_REVIEW.md).
- [N0 approved the additive adapter](https://github.com/peterbucci/ai-teaching-platform/blob/7975cff4a523eadd001bff4cb4cb76e0b6058c4a/app/study/notebook/COORDINATION.md),
  including scoped actual-source review through this application commit.
  N0 independently ran 24 focused tests and reviewed S2 browser evidence;
  N0 did not independently rerun the browser. Frozen presentation v1 is unchanged.
- [N0 final evidence receipt](https://github.com/peterbucci/ai-teaching-platform/blob/984cd53051b8aa7910606c526e0aaa32e4852a72/app/study/notebook/COORDINATION.md)
  confirms that fallback/clipboard evidence is supplied, preserves the unresolved
  reader timing concern, and keeps default enablement/release at NO-GO.
- Approved prototype ZIP SHA-256:
  `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.

Later packaging commits contain evidence, documentation and verification-tool
portability only. Compare the manifest and [ownership receipt](quality/ownership.json)
before assuming that a later branch head has the same application.

## Evidence and what it proves

All records/accounts are fictional, PostgreSQL is isolated on loopback port5912
(`notebook_s2`), and the production app is on port3412. Providers were disabled;
zero paid calls. Authored assessments are not AI or educational-validation evidence.

| Check                                                                     | Result and scope                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Recorded app/PG](evidence/recorded-1792960319810/results.json)           | 13 grouped checks: authenticated identity, 12 distinct identical answers over two real batches, deep links/refresh/Back/Forward, strict displayed-help privacy, current accepted/uncertain/failed/missing results, historical source versions, teacher handoff, filters and exact originals.                                             |
| Snapshot conflict                                                         | Real operator display changes only the saved assistance evidence; stale HTTP cursor returns409 and the UI atomically replaces ten rows, then loads twelve. Separate injected transport409+503 tests at four widths keep old data visibly stale, stop append, bound retries and recover explicitly. These are distinct kinds of evidence. |
| Read-only navigation                                                      | Fingerprints across13 evidence tables unchanged; browser history routes send zero non-GET API requests. Fixture creation and intentional operator display happen outside the no-write baseline. Auth session tables are excluded from the evidence fingerprint.                                                                          |
| [Final flag-off fallback](evidence/fallback-1792960510209/results.json)   | Five grouped checks. Independently authorized current-data originals and existing filters work. CRLF, Unicode, tabs and spaces match stored text in the DOM and an actual native clipboard copy (`clipboard.exact=true`). Peer/teacher/invalid-selector denial and no writes pass.                                                       |
| [Final N7 journey](evidence/journey-1792960371217/journey.json)           | All13 existing assertions pass on this build: intended-answer routing, ambiguity/help fallback, exact original/source, accepted fixture feedback, saved work/navigation, standalone reading return and teacher fresh-check recovery.                                                                                                     |
| [Final mounted reader](evidence/mounted-reader-1792960476209/report.json) | All3 existing assertions pass: hidden delivery makes no receipt, exposure acknowledges the same delivery once, failed receipt requires explicit retry. Earlier reader failures remain listed below.                                                                                                                                      |
| [Prototype comparison](evidence/visual-1792960319253/COMPARISON.html)     | 16 actual prototype/application pairs,32 PNGs: index/session/question at1440,1024,390,320 and native Edge200%, plus100% control. Native zoom changes CSS viewport1416→708 and DPR1→2, while visualViewport.scale and CSS zoom remain1. No horizontal overflow. Geometry is not visual acceptance.                                        |
| Quality                                                                   | Full suite571/571, final Notebook subset80/80, lint, typecheck, production Webpack build, formatting and293 approved-content checks. See [quality receipt](quality/checks.json). The existing PDF extraction createRequire build warning remains.                                                                                        |

The unchanged N7 scripts are run through [regression.mjs](regression.mjs).
Only explicit host/database/output bindings and import resolution are adapted;
their assertions are preserved. Original/adapted hashes are in the two
`*-adaptation.json` receipts. S1/PR#113 controllers, reading implementation,
S3, teacher application, evaluator, schema and global styles are unchanged.
The original six-case #113 recovery harness was not rerun here; the final
13-check journey and deterministic recovery tests do not replace that matrix.

## Visual review and remaining limits

Direct screenshot inspection identified and repaired the excessive question-page
header space, restored the numbered paper gutter, preserved mobile provenance,
and moved stale notices above evidence. At native200%, the sidebar now collapses
to compact navigation. Original answers remain serif text and assessment colors
remain distinct without relying on color alone.

Full parity is **not accepted**. The global Notebook still lists sessions, whereas
the prototype groups question rows and teacher-review rows. The public #131
endpoint is session-scoped; a new bounded, authorized index contract is needed
for global question/result/help filters. S2 does not issue eager cross-session
fan-out or fabricate index fields. Existing global metadata filters are preserved.

Other visible differences: inherited N7 navigation/header, more explanatory
metadata and precise timestamps, separate canonical answer/assessment and event
list, previous/next links rather than all folded pages, and an evidence explanation
aside instead of facing reading. No original quote highlights, historical concept
titles, unrecorded viewing times, missing clarification wording, drafts or causal
ordering are synthesized. UUID concept IDs remain IDs. Different fictional answer
content is not evidence of matching density or per-pixel fidelity.

The [field/feature matrix](PARITY.md) separates supported evidence from absent
history. Native mobile keyboard and screen-reader acceptance remain unrun.

## Failure record

[Earlier run receipts](quality/prior-runs.json) preserve failed setup and verification
attempts. Material corrections were the owning-batch page wrapper, enabled-route
authorization for teacher follow-ups, exact disabled fallback selectors, preserving
CRLF after HTML parsing, and keeping status/provenance visible. No backend
validator or authority check was relaxed.

The final-build mounted-reader attempt `1792960382339` failed an immediate
`active=false` assertion after opening the account menu. Its failure screenshot
shows the reader hidden by capture time; a timing race is plausible, not proven.
The next attempt `1792960428275` encountered sign-in HTTP429. After the rate-limit
window, the same unchanged assertions passed at `1792960476209`. Retain this
timing concern for the reader owner/N6; do not present a uniformly clean first run.

The inherited `/study/loading.tsx` streams an HTTP200 shell before asynchronous
`notFound()`. Browser checks assert final404 content and absence of saved evidence;
the evidence API separately returns strict404. No shared loading file was changed.

## Reproduction and next gate

Use a fresh isolated fictional PostgreSQL17 database with the bindings above,
apply repository migrations and seed fictional accounts. Set the existing demo
credentials and auth secret locally; never commit them. Keep all provider keys
and model variables empty. Set `NOTEBOOK_CHECK_STATE=.setup/s2/backend-state.json`.
The commands below assume those environment variables are loaded and `.setup/s2`
exists. The local `.setup/s2/run.cjs` convenience launcher used in this run is
ignored and is not required; standard Node environment loading is sufficient.

1. Build/start the production app on port3412, with `NOTEBOOK_RECORDED_HISTORY=1`
   only for isolated acceptance.
2. Run `node --experimental-strip-types --conditions=react-server scripts/check-student-notebook.ts`.
3. Run `node --experimental-strip-types --conditions=react-server acceptance/notebook-s2/verify.mjs setup`,
   then `setup-exact`, then `recorded`. Setup refuses to overwrite existing fixture identities;
   recorded runs create one new pending aid before the immutable baseline.
4. Run the same Node prefix with `acceptance/notebook-s2/regression.mjs journey`
   and then `reader-mounted`. Allow the configured login rate-limit window between
   repeated suites; do not disable auth protections.
5. Restart the same production build with the flag absent or0; run `verify.mjs fallback`.
6. For screenshots, run `visual.mjs` with the flag1. Provide `PLAYWRIGHT_MODULE`,
   `S2_PROTOTYPE_DIR` and `S2_PROTOTYPE_ARCHIVE` when using another machine. The
   extracted `Main.dc.html` and ZIP hashes must match. Native zoom uses installed
   Windows Edge; a different platform needs an equivalent native-zoom capture.

N6 should independently inspect the strict public DTO adapter, authorization and
snapshot tests, audit all visual pairs and failures, and rerun relevant authenticated
checks against the combined S1/S2/S3 candidate. Reconfirm the #113 recovery and
reader gates after that composition. No matching N6 chat was available in the task
inventory; this is a ready-to-review handoff artifact, not a claimed review by N6.
Keep default recorded mode off until the combined approval is recorded. No merge,
deployment, main update or parent-issue closure was performed.
