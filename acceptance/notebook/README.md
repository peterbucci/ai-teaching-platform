# N7 Student Notebook integration candidate

This draft composes the approved presentation packages into authenticated student
routes while retaining the existing tutoring and review controllers. It is a
**safe integration candidate, not complete Notebook or release acceptance**.
No merge, deployment, main change, parent-issue closure, or paid model call occurred.

## Exact source and scope

- Main: `723ed6fea41138b604a9d333ebcd4a07b2202c36`.
- Ancestry-preserving composition: `e7cbf3d6930e892e91f4170ed2aa08c9b8649e67`.
- Application mounts: `1726c9c12f171095fed8c327b8a5852e8057c924`.
- Production build ID: `UkrMmCmcVA8hwLEP9-iHL`.
- Branch: `codex/student-notebook-integration`.
- [Exact source matrix](SOURCE_MATRIX.json). All nine GitHub heads were fetched
  and rechecked. N4 advanced from the supplied `509cfdf` to `3632c11`; the latest
  head changes its visibility fixture/handoff. N0 ancestry inherited by N1/N3/N4
  is merged once, with no cherry-picked duplicate history. No merge conflicted.
- Approved prototype ZIP SHA-256:
  `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
  Main and corrected-help hashes were also checked. The archive/source remain
  outside the repository; only comparison evidence is included.

| Destination                                | Integrated behavior                                                                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/study/assignments`                       | N1 shell, N2 My Learning, N5 safe delivered-review summaries. No instructional review body is sent through the home slot.                                                           |
| Assignment `tab=overview`                  | N2 approved overview, existing AssignmentAction and native deep links.                                                                                                              |
| `/study/history` and assignment `tab=work` | N3 authorized session index and exact submitted originals through N0's frozen `current-data` adapter. Assessment absence stays explicitly unavailable.                              |
| `/study/reading`                           | N4 around one unchanged #132 reader in the existing standalone Workspace. Actor/source/session/citation keys retained; actual pane exposure and covering overlays control `active`. |
| `/study/interventions/[approvalId]`        | N5 frame around one unchanged DeliveredActivity. The existing owner retains display, fresh-check submission, feedback and recovery.                                                 |
| Assignment `tab=study`, legacy `/study`    | Existing #113 StudySession/StudyDialogue and Workspace remain intact. Notebook active-study shell mounting is deferred to its explicit owner handoff.                               |

N7 adds no schema, endpoint, evaluator, classifier, conversation store, reader
receipt, or alternate composer. Original authorization loaders and exact saved
links remain authoritative. Protected project documents and all #113-owned
controller/style/store files are unchanged. Next dev's generated AGENTS addition
was removed under the user's explicit restoration authorization.

## Verification

The separately authorized runtime uses PostgreSQL on loopback port 5907 and the
application on 3407, with fresh fictional accounts and explicit empty model/key
settings. Other worktrees, the existing acceptance lock, and other containers
were not modified. The final build uses `next build --webpack`; initial browser
runs used development mode and are identified separately.

| Evidence                                                                                                       | Observed result                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Deterministic tests](quality/unit.txt)                                                                        | 543/543 pass at the application commit.                                                                                                                                                                                            |
| [Production build](quality/build.txt)                                                                          | Pass, including TypeScript. Existing material-import `createRequire` warning remains.                                                                                                                                              |
| [Repository lint](quality/lint.txt)                                                                            | Pass.                                                                                                                                                                                                                              |
| Approved content validation                                                                                    | 293/293 pass.                                                                                                                                                                                                                      |
| [Production authenticated journey](evidence/journey-1792951916781/journey.json)                                | 13 checks pass: home/overview, help and explicit answer fallback, exact Unicode/whitespace, accepted synthetic feedback, saved record, Back/Forward, reading return, teacher-approved review/fresh check and cross-student denial. |
| [Production mounted reader](evidence/mounted-reader-1792951909176/report.json)                                 | 3 compound checks pass: covered delayed delivery has zero receipts, reveal records the original delivery once, failed receipt requires explicit retry with the same identity.                                                      |
| [Independent reader/HTTP/database report](reader/RESULTS.md)                                                   | Full 17-case reader browser matrix, reading HTTP, 7 dialogue recovery groups and 6 controller groups pass. These source-hashed reader tests ran in development mode.                                                               |
| [Independent production recovery](evidence/recovery-2026-10-25T18-15-11-310Z/independent-recovery-report.json) | All six original #113 cases pass, including interrupted/unknown saves, 401, refresh, and real expiry/new-tab sign-in recovery. All four correct/partial/incorrect/uncertain result matrices also pass at four widths.              |
| [Production comparison gallery](evidence/visual-1792951898180/COMPARISON.html)                                 | 31 pairs / 63 PNGs. Six actual destinations at 1440, 1024, 390 and 320px; native 200% Edge zoom. No horizontal page overflow or browser errors.                                                                                    |
| [Independent N6 handoff](N6_HANDOFF.md)                                                                        | Independent outcome/recovery evidence, remaining gates and owner-specific next steps.                                                                                                                                              |

Native zoom was measured, not simulated by resizing: DPR changed from 1 to 2,
CSS viewport from 1416 to 708, while visual viewport scale and CSS zoom stayed 1.
The existing composer remained reachable. External prototype fonts were blocked;
the gallery labels font fallback and differences in actual authorized content.

Synthetic evaluation/activity fixtures exercise real services, authentication,
persistence and UI; they do not establish actual-model behavior. Help classification
with disabled providers is explicitly the clarification/confirmation fallback.
No real student records or secrets are included.

The [final check record](quality/final-checks.json) binds production results to
the application commit and build. Final repository lint and formatting passed;
the evidence scan found no configured credentials or unredacted session cookies.

## Chronology and visibility gates

#131 `884dfb08de31c457a3eb618ad063fcbf701ac5f3` was independently reviewed and its
13 focused tests rerun. No blocking defect was found in the reviewed DTO privacy,
actor authorization, accepted-result pointer, displayed-help or snapshot-conflict
scope. It remains draft with no submitted GitHub review. **Its code is excluded**
from this candidate. N0 has not approved a chronology adapter; no backend mode,
new browser joins, schema clone or teacher-evidence endpoint is used. Current-data
fallback is the only enabled saved-work mode.

#132 is composed for standalone reading, but its live facing-pane gate remains
closed. The N7 route wrapper was independently reviewed; a bootstrap deadlock
found during implementation was fixed before final build/acceptance. It deactivates
the retained reader synchronously before account/navigation overlays and measures
the independently rendered pane rather than its initially hidden child. The reader
still owns all actual delivery and acknowledgment logic. No facing reader is
mounted behind the tutor.

## Retained failures and limits

- The first synthetic activity setup used a title with a digit; the existing
  qualitative-content validator rejected it. Only fixture wording was corrected.
- A development journey timed out before save confirmation; diagnostic rerun and
  final production journey passed. No controller was modified to force success.
- Reader run A stalled at an unbounded wait. A bounded copy with identical
  assertions passed the remaining cases, then all 17 in one run. A transient
  development reading HTTP 500 passed an unchanged retry after recompilation.
- Initial production build encountered stale generated types for the removed
  temporary reader test route. Only the verified candidate `.next` cache was
  cleared; the [clean build](quality/build.txt) passed.
- Development recovery encountered reload/network errors. An initial production
  rerun reached the real sign-in limiter during concurrent suites; setup could
  not enter its last three cases. After the cooldown and competing runs ended,
  a complete quiet production rerun passed all four result matrices and all six
  recovery cases without changing application code or weakening the limiter.
  Failed evidence remains present and credentials are redacted.
- Native mobile keyboards, assistive screen readers, a human teammate rehearsal,
  active-study Notebook parity, live facing reading, and recorded chronology are
  not claimed complete. See the ranked handoff gates.

## Local reproduction

The retained private `.setup/runtime/` holds fresh fictional credentials and
explicit isolation guards. It is ignored and must never be committed. On this
machine, with this candidate and its dedicated database running:

```text
node .setup/runtime/run.cjs acceptance/notebook/journey.mjs
node .setup/runtime/run.cjs acceptance/notebook/reader-mounted.mjs
node .setup/runtime/run.cjs acceptance/notebook/run-recovery.mjs --production
node .setup/runtime/run.cjs acceptance/notebook/visual.mjs
```

Run login-heavy suites sequentially; the real 10-sign-in/60-second limiter remains
enabled. Each run creates new output and preserves previous results. The recovery
host adapter verifies pinned #113 operator hashes and changes only exact Docker
environment/import paths to the guarded local equivalent; original browser
assertions are imported unchanged. A fresh machine must explicitly configure its
own disposable runtime rather than weakening these local guards. The portable
reader harness and its cleanup instructions remain under
`tests/browser/reader-visibility/`.

Refs #73, #114, #35 and #76. This package closes none of them.
