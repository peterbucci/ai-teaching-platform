# R03 student fresh-check concept labels

Application fix: `9b4f5e357146338e6d0b99dadc1a0104714ba406`, based on the requested `07efb7f821339538800f150f57b298eb2e606be3`.

The student result now displays **Evaporation: correct**, matching the teacher's same accepted follow-up. The server uses the existing student-authorized assignment resolver, which pins the immutable lesson version. The mapper compares the complete resolved and saved content references, and sends only fresh-check concept IDs and public titles to the client. Missing/blank names, out-of-question concepts and a mismatched source identity produce no mapping; the student displays **Concept name unavailable**. A source authorization/load failure retains the existing unavailable-activity behavior.

No teacher page, N5 review component, #113 recovery/controller implementation, evaluator, persisted contract or database schema changed. Immutable IDs remain the React keys and saved evaluation identities. No latest-version or global concept lookup is used.

## Executed checks

- All 636 deterministic repository tests passed. The four new tests cover matching teacher/student names for curated and uploaded sources; complete source/lesson/version/hash/owner/attribution mismatches; missing/blank/out-of-question names; and source field order. Existing follow-up tests retain accepted uncertainty and assistance semantics. After correcting missing fields in the new test fixture, its four tests passed again.
- Repository lint, explicit `npm run typecheck`, and production Webpack build passed. The build reported the existing `lib/materials/extract.ts` createRequire parsing warning, outside this change. The first build caught missing approved-concept fields in the new test fixture; the corrected final build and explicit typecheck passed.
- Prettier checks passed on changed source files; the receipt/report were formatted. All 293 approved-content checks passed. `git diff --check` passed.
- Actual authenticated production student route tested at **390 x 844** and **320 x 844**. Both displayed `Evaporation: correct`, with no document overflow and no captured student browser warnings/errors. The exact original response, accepted status, assistance warning and fixture provenance remained visible. A reload at 320px retained the accepted result.
- The actual teacher Steps > Read follow-up panel at 320px displayed the same result and linked to attempt `8ad2d8b8-a662-4647-a1be-a90b4fcbca9d`. Its accepted evaluation is `b2e02dda-4b3b-4ddf-a818-ea7906c0e601`, under approval `608d1c43-4cdb-407e-b809-bf373f016372` from R03.
- A canonical SQL export of the saved approval snapshot, complete attempt row (including question, original text and assistance), and all linked evaluations had the same SHA-256 before and after browser verification: `03b0e8f1e8f33e0c624d81700c46cd1b95f5ce189cb68553e877c4e8ff34c05e`. The export itself and private configuration are not published.

Verification used a separate database/container (`lp-fresh-labels-l-db`, port 5921) copied read-only from the preserved fictional acceptance dataset, plus the patched production app on port 3421. Original services and data were not changed. Provider credentials were absent; **zero paid model calls**. These checks establish presentation and persistence continuity, not live AI behavior or educational effectiveness. Physical-device and screen-reader checks were not run.

## Evidence

- [Machine-readable result and identity receipt](browser-results.json)
- [Actual student page, 390px](student-390.png)
- [Actual student page, 320px](student-320.png)
- [Same teacher follow-up, 320px](teacher-320.png)

The PNGs are original browser captures; no pixels were edited. Student captures show the complete page, so their height exceeds the viewport height.

## N7 / PR #133 handoff

The four-file implementation commit is `9b4f5e357146338e6d0b99dadc1a0104714ba406`. A scoped three-way application against N7 head `66e559f2632db9f79588aae28dfd434c5914713b`, using `07efb7f821339538800f150f57b298eb2e606be3` as the patch base, completed without conflicts and changed exactly those four files. The resulting student page retains N7's `TeacherReviewFrame`, review CSS, single `DeliveredActivity` instance and existing back link; it adds only the authorized title mapping and `conceptNames` prop.

Integrate this implementation commit onto N7, rather than merging the broader Workbench base. Then rerun the actual N7 wrapped review route at 390px/320px and its normal integration checks. The combined N7 runtime was not exercised here. This draft does not merge, deploy, close #46, or approve the broader Notebook integration.
