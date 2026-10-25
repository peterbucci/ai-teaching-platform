# Reader visibility verification — October 25, 2026

The scoped reader fix passed **17 application/browser/PostgreSQL cases** against
`http://127.0.0.1:3397`, verified before browser authentication. The database was a
fresh isolated PostgreSQL instance on loopback port 5897, using fictional demo
accounts and newly created fictional sessions. Model credentials and model names
were empty; **zero paid model calls** were made.

[API requests and before/after database snapshots](2026-10-25.json) preserve the
actual intervention, attempt, passage and content-version identities. The baseline
reader was extracted from `723ed6fea41138b604a9d333ebcd4a07b2202c36`.

| Observed scenario                                      | API/database evidence                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Original reader, CSS-hidden mount                      | 2 POSTs; 1 intervention incorrectly became `displayed`.                                                                         |
| Fixed reader, hidden mount at each of four sizes       | 0 opening/receipt POSTs; 0 reading interventions.                                                                               |
| Hidden passage changes P09 → P10 → P11 → P10           | 0 writes while hidden; activation opened and acknowledged only P10.                                                             |
| Visible request hidden before its response             | The intervention remained `created`, `visible_at=null`; refresh while hidden added no writes; activation recovered the same ID. |
| Receipt pending during repeated pane switches          | No duplicate request or intervention; the existing receipt completed.                                                           |
| Failed receipt, then pane switches and context refresh | Error and retry control remained; only explicit retry saved the same delivery.                                                  |
| Response lost after the server committed the receipt   | Retry preserved the same intervention and exact original `visible_at`.                                                          |
| Passage body below the viewport                        | No receipt until the body was scrolled into view.                                                                               |
| Actual background tab before opening                   | Real `hasFocus()=false`; 0 opening/receipt POSTs and 0 interventions.                                                           |
| Actual background tab during opening                   | `created` with no display time until real focus returned; same intervention acknowledged once.                                  |
| Standalone Back/Forward and refresh                    | Exact P08/P09 navigation retained; stored assistance and timestamps were unchanged by replay.                                   |
| Actual standalone answer-draft roundtrip and refresh   | The exact unsent text returned; attempts, submissions and evaluation IDs were unchanged.                                        |

Responsive checks used **1440×1000, 1024×768, 390×844 and 320×844**, with keyboard
Show/Hide pane changes, repeated switching and mounted-draft preservation. The
standalone draft check separately used the real assignment composer and its
existing draft storage, not just the test wrapper's input.

Two browser checks explicitly inject the document-hidden visibility signal,
including hiding during an open request. Separately, two headed Chrome checks
switch real tabs with Playwright focus emulation disabled on both tabs. This
host reports `visibilityState=visible` even for a background tab, but the genuine
focus change is observable. The required focus gate blocked writes in that real
background condition and resumed them when the tab regained focus.

The test fixture contains one owner-controlled reader pane, never the full
Student Notebook. No N0/N1/N4 presentation, PR #113 composer/recovery, teacher
service, grading rule or database schema was changed. Combined Notebook
composition still requires N7 acceptance; these results do not grant permission
to mount it or establish combined focus/scroll behavior.

## Reproduction and review

[Portable browser regression instructions](../../../../tests/browser/reader-visibility/README.md)
include the temporary guarded fixture, baseline extraction, precise local-origin
check, database/provider guards and cleanup. The application fixture is removed
before production checks and is not a committed route. The historical machine
runs and screenshots remain in the task's ignored `.setup/reader-visibility/`.

The evidence JSON includes hashes of the three production source files tested.
Earlier harness failures were corrected by inspecting the actual database schema,
authorizing the fictional fixture through existing services, waiting for actual
navigation/draft restoration, and establishing genuine offscreen geometry. Those
failed logs were retained locally; failed setup attempts were not counted as
passes. Final evidence combines 15 passing ordinary/simulated cases from one run
and two passing native background cases from its headed-browser continuation.

Independent review found and resolved a recovery issue where refreshed pending
passage data could remove the acknowledgment failure's retry control. The final
visibility contract, focus guard, synchronous unmount guard and focused tests
were independently reviewed with no remaining blocking code findings.

## Completed checks

- 15 focused reader/source/navigation tests and all 473 regression tests passed.
- Full lint, TypeScript, repository formatting and diff checks passed.
- Standard `npm run build` (Turbopack) passed. Its first attempt could not resolve
  dependencies through an external directory junction; a local copy of the same
  installed packages resolved that environment issue without a package change.
- Existing authenticated `reading:check` passed against the isolated database.
- The packaged portable harness also passed a five-case smoke run: baseline
  reproduction, hidden/visible switching at 320px, lost-receipt reconciliation,
  hidden target changes and genuine background-tab behavior. Its temporary route
  was removed and cleanup retained the evidence.
