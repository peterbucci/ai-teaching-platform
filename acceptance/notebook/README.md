# N7 Student Notebook integration candidate

**Full Notebook integration and visual acceptance are not complete.** This draft
mounts safe authenticated routes and preserves the verified tutoring controllers.
After the user's screenshot review, avoidable presentation regressions were
corrected and matching destinations were recaptured. Viewport/zoom checks are
functional checks, not proof of prototype fidelity.

[Corrected comparison gallery](evidence/visual-1792954086544/COMPARISON.html) ·
[Correction record](VISUAL_CORRECTIONS.md) · [Independent N6 handoff](N6_HANDOFF.md)

## Exact source

- Current application: `35b21a2908cfc42d02a21651fc337826e8e73c16`.
- Production build: `OSi94hZSaMmZ8UE2it5pB`.
- Application source-tree SHA-256:
  `a946338deaf74aa7e10a56aba3339ec65849f69976cbea2ea1db905c9519d965`.
- R03: source implementation `9b4f5e357146338e6d0b99dadc1a0104714ba406`
  from #134, cherry-picked without its teacher Workbench base. A tests-only
  adaptation removes the absent Workbench label-helper dependency. See the
  [combined R03 report](R03_INTEGRATION.md) and [check record](quality/r03/checks.json).
- Ancestry-preserving composition: `e7cbf3d6930e892e91f4170ed2aa08c9b8649e67`,
  based on main `723ed6fea41138b604a9d333ebcd4a07b2202c36`.
- Branch: `codex/student-notebook-integration`.
- [Exact source matrix](SOURCE_MATRIX.json): all nine requested heads verified;
  eight composed without duplicate cherry-picked ancestry. N4 advanced from
  supplied `509cfdf` to verified `3632c11`. #131 is reviewed but excluded.
- Approved prototype ZIP SHA-256:
  `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
  Prototype source remains outside the repository.

Later evidence-only commits do not represent new application test runs. The
private isolated runtime uses ports 3407/5907, fictional accounts, disabled model
providers and zero paid calls. Other runtime locks and resources were untouched.

## Mounted routes

| Destination             | Behavior                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| My Learning             | N1/N2 with N5 safe teacher-review summaries; instructional bodies are not sent through the home slot.                                                                               |
| Assignment overview     | N2 and existing AssignmentAction/native deep links.                                                                                                                                 |
| `/study/history`        | N1/N3 index, restored class/source/section/search/date/session filters, supplied-idea filter and failed-load retry. Exact session links and server order retained.                  |
| Assignment saved work   | N3 exact original answers through N0 current-data mode; unavailable assessment/history remains explicit.                                                                            |
| Standalone reading      | N1/N4 with one unchanged #132 reader. Pane exposure and navigation/account overlays control `active`; source/session/citation identity and pending receipts remain with the reader. |
| Teacher-assigned review | N5 around one DeliveredActivity, retaining approval, display, fresh checks and draft recovery. R03 adds pinned public concept titles to accepted results.                           |
| Active study            | Existing #113 StudySession/StudyDialogue and Workspace remain intact. Full Notebook mounting awaits the explicit owner handoff.                                                     |

No schema, evaluator, classifier, provider, reader controller, alternate composer
or tutoring state machine was added. Protected documents and #113-owned
controller/style/store files remain unchanged. The generated AGENTS addition was
restored under the user's explicit authorization.

## Executed checks

[Corrected check record](quality/corrected-checks.json) binds the earlier visual
correction runs below to application `32de9a6` and build `zNNbymqsGD9WxvdnO-vvQ`.
The later [R03 checks](quality/r03/checks.json) record 547 passing unit tests,
lint, explicit typecheck, production build, 293 content checks and a new 13/13
authenticated journey on `35b21a2`. Earlier screenshot and recovery runs are not
relabeled as executions against this newer application.

| Check                                                                                             | Result and scope                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Production build/TypeScript](quality/corrected-build.txt) and [lint](quality/corrected-lint.txt) | Passed on the final corrected source. Inherited material-import createRequire warning remains.                                                                                                                      |
| [Deterministic suite](quality/corrected-unit.txt)                                                 | 543/543 passed after the route/filter corrections, before final reading CSS/heading adjustments.                                                                                                                    |
| Content validation                                                                                | 293/293 passed in the initial integration; content is unchanged.                                                                                                                                                    |
| [Production journey](evidence/journey-1792954205408/journey.json)                                 | 13/13 passed on the final build: exact text, help/ambiguity fallback, explicit answer, accepted synthetic feedback, saved work, Back/Forward, reading return, approved review/fresh check and cross-student denial. |
| [Production mounted reader](evidence/mounted-reader-1792954171307/report.json)                    | 3/3 compound browser/database checks passed: hidden delivery has no receipt, reveal records the same delivery once, failed receipt requires explicit retry.                                                         |
| [Corrected comparison](evidence/visual-1792954086544/visual-results.json)                         | 31 matching pairs/63 PNGs; 15 functional checks; 1440, 1024, 390, 320px and native 200% Edge zoom; no horizontal page overflow or browser errors. Visual acceptance remains NOT_ACCEPTED.                           |
| [Independent recovery/outcomes](evidence/recovery-2026-10-25T18-15-11-310Z/run-identity.json)     | Four outcome matrices at four widths and all six original #113 recovery cases passed on the earlier application `1726c9c`. Protected owner files remain identical; this is not represented as a new run.            |
| [Independent reader/HTTP/database checks](reader/RESULTS.md)                                      | Supplemental earlier development evidence: 17-case reader matrix, reading HTTP, 7 dialogue recovery groups and 6 controller groups passed.                                                                          |

The revised visual checks verify exact links, zero filter requests, responsive
filter controls, one retained reader, keyboard overlays, source-preserving native
reading links, style precedence and toolbar placement. Native zoom changed DPR
from 1 to 2 and CSS viewport from 1416 to 708 with CSS zoom and visual viewport
scale remaining 1. These do not establish full visual fidelity.

Synthetic evaluations and activities exercise real authentication, authorization,
services, persistence and UI. They do not demonstrate live AI behavior. External
prototype fonts were blocked; fallback and authoritative content differences are
labeled.

## Remaining work, ranked

1. **P1:** Active-study Notebook mounting requires the coordinated #113 handoff
   for one composer, persistent notices, scrolling, hidden-pane help receipts and
   draft/recovery behavior.
2. **P1 activation:** Facing reading remains disabled pending #132 review/CI and
   acceptance of the actual combined facing pane. Standalone success is insufficient.
3. **P2:** The current-data index shows sessions, not the prototype's combined
   question/original-answer/accepted-feedback/displayed-help records. #131
   `884dfb0` passed independent review and 13 focused tests but is excluded. An
   adapter requires N0 approval, with current-data fallback retained.
4. **P2 verification:** Native mobile software keyboard and screen-reader checks
   remain unrun.
5. **P3 visual:** Reading retains extra gutter at 1024px, source-tree/heading
   density and mobile Menu instead of the prototype's compact tabs. Review and
   active-study presentation still retain their original controller frames.

The initial gallery incorrectly compared the global Notebook prototype with an
assignment work-detail route. It also failed to distinguish functional checks
from fidelity. Its evidence remains historical and is superseded by the corrected
gallery. Earlier fixture-validation failures, development reloads, stale generated
types, sign-in-rate-limit setup failures and one incorrect search-role test locator
are retained; none was fixed by weakening application behavior or assertions.

## Local reproduction

Private `.setup/runtime/` contains disposable credentials and isolation guards.
It is ignored and must not be committed. With the dedicated production runtime:

```text
N7_JOURNEY_RUNTIME=production node .setup/runtime/run.cjs acceptance/notebook/journey.mjs
N7_READER_RUNTIME=production node .setup/runtime/run.cjs acceptance/notebook/reader-mounted.mjs
N7_VISUAL_RUNTIME=production node .setup/runtime/run.cjs acceptance/notebook/visual.mjs
```

Set the environment variables using the host shell's syntax. Run login-heavy
suites sequentially; the real sign-in limiter remains enabled. The recovery host
adapter verifies original #113 operator hashes and imports its unchanged browser
assertions. Fresh machines need their own explicitly configured disposable runtime.

Refs #73, #114, #35 and #76. No merge, deployment, main change or parent-issue
closure occurred. Independent agent review is not represented as human sign-off.
