# Same-record intervention execution

The provider-disabled journey completed through teacher inspection of the linked accepted follow-up on application `462cfb1b31d9108cec70d18b6553bd45048d2eed`, tree `03cca1fed3900a122e689c4a512afadd9052e5af`, isolated project `lp-v22-shell5`, `http://localhost:3350`. Final inspection passed at `2026-10-25T07:07:02.812Z`. This is a chain of preserved runs and narrowly pinned resumes, not one uninterrupted successful invocation.

The source review, lesson/question approval, publication, inactive assignment creation, separate activation, help and original answer are documented in [AUTHORING_EXECUTION.md](AUTHORING_EXECUTION.md). Every continuation below uses those same records. The original evaluation, private draft and follow-up evaluation are explicitly injected test results through existing application services; no real model or paid call occurred. Teacher approval, delivery and the student's follow-up answer were actual browser actions.

## Identity

| Record                                  | Exact identity                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Approved source                         | `48bae4f7-63a2-4876-bc6d-b5b2d99a6b9f`, version 1                               |
| Published lesson                        | `d1468c98-b268-4566-9301-114be6f836da`, immutable version 1                     |
| Assignment                              | `ebc4eb03-22ba-409b-b1c4-10bc54a86967`                                          |
| Fictional student                       | `10000000-0000-4000-8000-000000000002`                                          |
| Original session / attempt              | `07c3336c-108a-4e79-bca3-02c382b3756a` / `280d524b-0b14-41df-a287-3e29bfdd5646` |
| Original accepted synthetic evaluation  | `bfa4701d-550b-4eaa-bce1-3eef49bcfb0c`                                          |
| Intervention draft                      | `1d5a7619-340e-42ab-8cbd-4ebff2b9176f`                                          |
| Approved revision / approval            | revision 2 / `c42219b5-9c46-4682-b3fd-97146a281f91`                             |
| Delivery                                | `aca206a9-1557-4c12-8f8c-80efe80b0924`                                          |
| Follow-up session / attempt             | `dab8c498-762c-403d-8ec4-e9b8c694f948` / `9993e44c-9fed-45fd-aa30-67b8f62a5738` |
| Accepted synthetic follow-up evaluation | `321d29af-8b2c-4aba-9338-d5d16a20bdd8`                                          |

The exact original answer SHA-256 remained `a007b66ac2172e2e772eb65b872dbd343b106cc8c802b6d19325d4bb302564a1`. Its saved whitespace and text were preserved. Both the original and follow-up questions retain the same immutable lesson/source reference. The follow-up records corrective-feedback assistance and does not establish independent mastery or long-term retention.

## Executed phases

1. **Preparation 01, retained failure:** the service accepted the explicitly synthetic original evaluation at `06:09:01.972Z`, then rejected private-draft generation at the rolling hourly limit of 10 requests. No intervention draft, approval or delivery was created. The coordinator reconciled the retained lock and measured natural capacity at `06:53:38.699297Z`; no quota or timestamp was changed.
2. **Preparation 02, completed:** started after UTC `06:53:40`. It reused the existing accepted original evaluation, then created the private draft through the existing service at `06:53:58.586Z` using a labeled synthetic proposal. Approval and delivery were still null. It did not submit or replace the original answer.
3. **Context 01:** C3 passed against the authorized persisted draft. Conflicting same-assignment concept/origin/starting-attempt URL values did not replace stored scope in displayed controls, desktop/mobile Student work links, or the followed Evidence destination; the draft was unchanged. C4 is **unreachable**: the course-level Lessons search shell has no Evidence link, so no search-isolation pass is inferred. Counts are one passed, zero failed, one unreachable; no application writes after login.
4. **Submission 01, completed writes then retained harness failure:** the teacher inspected original evidence, edited and saved a private revision (`06:54:49.226Z`), previewed the activity and synthetic provenance, selected the exact student, approved separately (`06:54:50.695Z`), and delivered separately (`06:54:51.907Z`). Student access returned HTTP 404 after approval but before delivery. The delivered public projection retained the exact content reference and excluded rubric/answer guidance. The student opened the review, started the fresh check (`06:54:54.690Z`) and submitted the exact follow-up (`06:54:55.875Z`). All five action responses were fully received HTTP 200 and passed the helper's relevant identity/state checks. With provider configuration blank, the answer was saved and evaluation visibly failed, with normal `retry_after=06:55:55.856Z`. The teacher comparison API linked both records correctly. The helper then counted recipient nodes before the asynchronous comparison view finished loading and failed `0 !== 1`. This remains a failed run, not a product defect or a passing full invocation.
5. **Submission 02, read-only resume passed:** only the exact prior receipt hash was accepted. After demo login, application writes were blocked. Authorized GETs and the loaded teacher comparison confirmed the same approval, delivery, original evidence and saved follow-up; separate original/follow-up screenshots were captured. No save, approval, delivery, start or answer was replayed. The completed stage was `teacher-inspected-provider-disabled-followup` at `07:01:24.646Z`.
6. **Evaluation 01, retained fixture failure:** the old fixture rejected the new `inspect-submitted` receipt phase before any evaluation seam. Its adapter conservatively retained the lock. The coordinator retrieved the finalized container receipt, confirmed no active fixture process/database work and unchanged original/follow-up evidence, and released only that owned lock at `07:04:02Z`. The failure and reconciliation remain preserved.
7. **Evaluation 02, completed:** the independently reviewed fixture accepts only the exact passing submission02 hash and its prior submission01 chain, keeping all source, original-evaluation, approval, recipient, delivery, attempt and timestamp checks. After the ordinary retry allowance was true, it invoked the existing retry service with a labeled synthetic evaluator, accepting evaluation `321d29af…` at `07:05:35.826Z`. No answer was resubmitted. An initial launch command had a mistyped local state path and exited before acquiring a lock or reaching Docker; correcting that local path did not replay a runtime operation.
8. **Inspection 01, passed:** the student saw **Evaluation accepted** and **Fixture evaluation for testing**. The teacher inspected original and linked follow-up evidence, with one intended, started, submitted and accepted recipient; failed/pending/uncertain counts were zero. This phase blocked all application writes after login, attempted no blocked or off-origin request, closed its browser and released its own guard normally.

## Receipts and screenshots

Raw evidence lives under `../evidence/final-browser/`. These report hashes identify the exact phase combination:

| Receipt                                            | SHA-256                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `final-intervention-prepare-02/fixture.json`       | `b1e564c271ab24698f581f93308db96e2c1178a47440d74ffd3619ba7bea89c3` |
| `final-context-01/report.json`                     | `43d333e735f29fc803b76d5c511971a65c4a79fbd026e6add7d9a835bf1ca53e` |
| `final-intervention-submit-01/report.json`         | `064d3a54fe7089a771a7c0b34939a0faa6f435f8884c143fee72a107470996a7` |
| `final-intervention-submit-02/report.json`         | `c699ff32b9298b48c8f71e9ca4650528e821d42314a3b092a376e3a03d90c781` |
| `final-intervention-evaluate-01/host-receipt.json` | `fc4496a06d4d4b3360308f3d27b447de5cd8028fa931e62fc0cbb8c3bb7df1b4` |
| `final-intervention-evaluate-02/fixture.json`      | `ac1cea0c4f315e020f61568d9bbd4c4e3d5045eac8cbff70c3dc0d9556c99d48` |
| `final-intervention-inspect-01/report.json`        | `106259bf28b260eeb006a5af4c8450273361e7ea6c63424b444e0f707183308b` |

Final inspection has 16 actual screenshots: student saved follow-up, delivered teacher page geometry, original response, and linked follow-up response, each at 1440×1000, 1024×768, 390×844 and 320×844. The 12 focused text captures verify exact text bytes, record viewport rectangle and scroll offset, deliberately center the text, and check top/center/bottom hit points for occlusion. For example, [original at 320 px](../evidence/final-browser/final-intervention-inspect-01/09-teacher-original-response-320x844.png), [linked follow-up at 320 px](../evidence/final-browser/final-intervention-inspect-01/10-teacher-linked-followup-response-320x844.png), and [delivered page geometry at 1440 px](../evidence/final-browser/final-intervention-inspect-01/08-teacher-followup-page-geometry-1440x1000.png). These capture delivered/accepted state; they do not make it equivalent to an approved-undelivered prototype. Separate visual review remains necessary.

## Utility provenance and limits

Preparation02 and evaluation01 used adapter `461ee1e` and fixture `73339c1a`; evaluation02 used the same adapter frozen in a private folder with reviewed fixture `627fe9a6`. The separately added density adapter modes did not affect this invocation. Context01/submission01 used browser helper `358874f3`; submission02 used `f527329b`; final inspection used `ffa4e2f2`. Their full hashes are in raw receipts and preserved helper manifests. The intermediate helper's error-response handling was strengthened afterward; no non-200 mutation was encountered in its actual run. Historical sources, tests and failures are not rewritten.

The final guard treats non-200, malformed/nonacknowledging HTTP 200 and transport uncertainty as requiring reconciliation before another mutation. Four focused isolated tests cover these cases and receipt-I/O ordering. Each real runtime phase also used the reviewed PR121 storage/shared-lock guard and blank provider configuration. All owned runtime locks were released after completed operations or explicit reconciliation. No implementation file, implementation PR, quota, historical answer or source version was changed.

This verifies provider-disabled continuity and explicit teacher control on the combined candidate. It does not prove real-model instructional decisions, model quality, learning effectiveness, long-term retention, hosted release readiness or screen-reader behavior. Actual-model and screen-reader verification remain unrun.
