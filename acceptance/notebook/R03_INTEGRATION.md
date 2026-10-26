# R03 combined N7 verification

**R03 integration checks passed. Full Notebook integration and prototype visual
acceptance remain NOT_ACCEPTED.** This is verification of the combined N7
application, not a restatement of Agent L's isolated results.

## Exact composition

- Source PR #134 head: `5b2cefe45aee1077c79c52fa98e5ec1af6b64aba`.
- Requested implementation: `9b4f5e357146338e6d0b99dadc1a0104714ba406`.
- N7 prior head: `bc3b85613788a56d7d447271a99d29e656c1d39c`.
- Cherry-pick: `d765f2200d19cbbf2c492bd112dd3d6d6d1f2d2f`.
- Combined tested application: `35b21a2908cfc42d02a21651fc337826e8e73c16`.
- Production build: `OSi94hZSaMmZ8UE2it5pB`.
- Application source manifest SHA-256:
  `a946338deaf74aa7e10a56aba3339ec65849f69976cbea2ea1db905c9519d965`.

The implementation cherry-picked cleanly. The only adaptation is in its test:
N7 does not contain the Workbench `followupConceptLabel` helper, so the test
asserts the expected public names directly and retains all source/version,
ownership, missing-label and evidence-immutability cases. Cross-view agreement
is verified independently through the actual authenticated application below.
The teacher Workbench base `07efb7f821339538800f150f57b298eb2e606be3` is not
an ancestor. No teacher production code or source acceptance artifacts were
imported. [Source matrix](SOURCE_MATRIX.json).

The existing `TeacherReviewFrame`, single keyed `DeliveredActivity`, navigation,
draft and recovery logic remain in place. The activity receives only public
concept names from the student-authorized pinned-content resolver. Accepted
results use those names; unknown or mismatched names remain unavailable.
No schema, stored result, source identity or accepted-evaluation selection
logic changed. All ten protected #113 files remain byte-identical.

## Combined production checks

The separate Notebook runtime used ports 3407/5907, fictional accounts and a new
synthetic uploaded water-state lesson with a UUID concept. The actual services
approved, published, assigned, reviewed and delivered the fixture. Model
providers were disabled; **zero paid calls**. Accepted evaluations were authored
test fixtures, not model judgments.

| Check                                              | Result                                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository tests                                   | 547/547 passed                                                                                                                                                        |
| Lint, explicit typecheck, production Webpack build | Passed; inherited material-extraction `createRequire` warning remains                                                                                                 |
| Approved-content checks                            | 293/293 passed                                                                                                                                                        |
| Existing authenticated Notebook journey            | 13/13 passed on this exact application/build; includes original text, help/ambiguity, saved work, reading return, fresh-check draft recovery and cross-student denial |
| Focused R03 browser/database checks                | 7/7 passed, including 390×844 and 320×844                                                                                                                             |
| Independent concept-name/N5 tests                  | 18/18 passed                                                                                                                                                          |

[Quality receipt and logs](quality/r03/checks.json) ·
[New full journey](evidence/journey-1792955490831/journey.json) ·
[R03 result and identities](evidence/r03-fresh-check-1792955650134/r03-fresh-check.json)

At both mobile widths the actual student page displays **Evaporation: correct**,
with exact original whitespace/text, accepted status, assistance warning and
fixture provenance. There is no horizontal page overflow. Refresh and browser
Back/Forward retain the same result. Exactly one review frame, activity and
fresh-check controller were found. The unsent answer survived refresh and
Back/Forward. A deliberately lost submit response recovered through “Refresh
saved status”; the browser sent one start, one submission and zero retries.
No browser page errors were recorded.

The authenticated teacher API, follow-up UI and exact evaluation anchor agree
with the student view on these identities and the saved correctness/response:

- Approval: `a2fb7b06-7186-4ff3-9207-e51784832f6f`.
- Attempt: `51ac9363-8e8b-4d07-b1fc-3662761e14f2`.
- Accepted evaluation: `94961fd4-5117-4fbf-95b3-d158e16e79e4`.
- Concept: `1da7f6b0-9126-4c2e-b49d-0d2a476dce98`.

**N7's teacher follow-up still prints the concept ID.** This verifies the same
accepted result, not matching human-readable labels across teacher and student
pages. The separate Workbench label presentation was deliberately not imported.

## Saved evidence and screenshots

After the intended fixture creation and accepted evaluation, a canonical
baseline covered the complete saved approval row, complete attempt row
(including original text, question, source and assistance), and every linked
evaluation. Its SHA-256 was identical at all six comparison stages: student
390px, its refresh/history transitions, student 320px, its refresh/history
transitions, teacher comparison and final verification:

`1a4bafdf821f7d72fd340c45d36046a3a6abe31e96c73ef42699e6d27d015e42`

This proves those saved rows were unchanged across the browser comparison;
setup intentionally created new fictional evidence before the baseline.
Only fingerprints and synthetic public identities are published, not a raw
database export. Source/version and accepted-result identities remain intact.

- [Student 390px](evidence/r03-fresh-check-1792955650134/student-fresh-check-390.png)
- [Student 320px](evidence/r03-fresh-check-1792955650134/student-fresh-check-320.png)
- [Teacher's same accepted result](evidence/r03-fresh-check-1792955650134/teacher-same-accepted-fresh-check.png)

These are unedited full-page browser captures. The existing review frame and
activity both show a title, and the focused skip link is visible in the student
captures. These are not duplicate controllers or a claim of prototype parity.
The teacher capture uses 1440px; the required student checks use 390/320px.

## Limits and retained failures

- The initial journey launch hit the local network permission boundary before
  fixture creation. The guarded run with authorized access passed; its failure
  log remains in the quality folder.
- The first R03 fixture failed the existing qualitative-content validator because
  its activity title included digits in “R03”. Only that synthetic title was
  corrected. No validator or assertion was weakened. The failed
  [run](evidence/r03-fresh-check-1792955605217/r03-fresh-check.json) is retained.
- Current-data chronology, the disabled facing reader and the #113 active-study
  ownership boundary remain unchanged. Earlier reader, four-width prototype,
  native-zoom and genuine sign-in-expiry evidence retains its original revision;
  it was not rerun as part of this label fix.
- Remaining presentation gaps include the teacher's raw concept ID and repeated
  review title (P3), plus the broader Notebook gates in [N6](N6_HANDOFF.md).
  Native mobile keyboard and screen-reader checks remain unrun.

No merge, deployment, main change or parent-issue closure was performed.

Independent N6 review of the exact source, script, report and all three images
accepts this bounded R03 update. The reviewer verified all six reported source
hashes and the six immutable comparison stages; it did not run a second browser
session. Full Notebook acceptance remains unchanged.
