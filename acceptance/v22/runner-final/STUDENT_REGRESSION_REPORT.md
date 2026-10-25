# Final student regression execution

Pinned application: `462cfb1b31d9108cec70d18b6553bd45048d2eed`, tree `03cca1fed3900a122e689c4a512afadd9052e5af`; isolated `lp-v22-shell5` on port 3350. These are separate synthetic curated-account regressions, not the authored source→intervention record.

`final-curated-activation-01` passed actual UI review of reading, learning goals and question-bank content. The exact curated assignment was already active at `2026-10-25T05:54:56.909Z`; no new approval was performed and its content reference remained unchanged. `final-student-regression-fixture-01` then created three new fictional students via the guarded fixture. Accepted results are explicitly synthetic. No provider was called.

`final-student-regression-01` executed six cases: five passed, one failed on a test selector. Passing observations were accepted result visibility; unchanged reload and cross-student HTTP 404; actual wheel navigation and the Jump control returning focus to the conversation region; help fallback leaving the original attempt ungraded with zero provider requests; and injected precommit HTTP 401 recovery preserving exact local text, refusing retry until an explicit authorized save check, then retrying the same original submission identity. Both answer POSTs in the 401 case were intercepted before the server; real session expiry was not tested.

The long-response scroll result is narrow: initial/after-Jump scrollTop 78, manual upward wheel 0, clientHeight 480, scrollHeight 3846. It shows wheel navigation and return/focus to the start of the latest long response. It does not establish scrolling to the end of history, correct newest-message targeting across multiple turns, or multi-turn model conversation stress.

The retained reading/back/reload history is:

- Run 01 expected the obsolete Open reading label. The completed-session sidebar actually has Reading and links to the exact session.
- Focused run 02 used that observed link but its blanket read-only guard blocked the normal reading-open POST. The run explicitly failed on the blocked mutation. No reading POST reached the server in that run.
- Focused run 03 allowed only the exact long-session passage-open and displayed-text acknowledgement. It stalled before producing a completed browser case. The original report and guard receipt remain failed, not reclassified as passing.
- Read-only reconciliation showed the same sole 10,292-character answer hash and accepted evaluation, with reading intervention `4b54075e-3a8e-48d4-9420-93f14e0982fb` displayed at `2026-10-25T06:27:00.507Z` and no active database work. This establishes the narrow stored outcome, not completion of browser Back/reload.
- After coordinator authorization, only verified owned browser descendants were stopped. The helper/wrapper exited, finalized failure and released their own lock; every verified process was absent afterward. No app/container restart, reseed, answer/evaluation replay, or manual lock deletion occurred.

Focused run 04 passed at `2026-10-25T06:39:54.485Z`, using the same fixture and reviewed bounded helper `aeb205251b80b7b807467d66a49413bc6f959f89885aeaf501af42747e774ef7`. Its other five cases are explicitly `unrun-filtered`. Reading-open and display acknowledgement both returned HTTP 200. The rendered article, matching displayed intervention, exact original session URL after Back/reload, complete public attempts and exact 10,292-character answer were checked. The existing display timestamp remained unchanged. No off-origin request or disallowed mutation was attempted. The guarded wrapper exited successfully and released its own lock.

Run 04 uses bounded 15-second response JSON/read/history waits and persists progress before waits. Its two allowed POSTs are the normal application passage-open and displayed-text acknowledgement for the exact long-response session. It does not replay an answer or evaluation. The passing focused result supplements the five passing run 01 cases; it is not a claim that one full six-case invocation passed.

Raw reports, guard receipts and actual screenshots are under `../evidence/final-browser/final-student-regression-01` through `-04`; reconciliation is under `../evidence/final-browser/final-reading-reconciliation-01`. Exact historical helper sources are preserved under `executed-student-helpers`, including the explicitly labeled hash-matched run 02 reconstruction. Earlier raw failures and provenance are unchanged.

Actual-model evaluation, screen readers, real session expiry and multi-turn generated conversation remain unrun in these student checks. Native 200% coverage belongs to the separate accessibility evidence.
