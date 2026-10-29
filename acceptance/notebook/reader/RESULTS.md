# N7 independent reader and recovery checks

Verified on October 25, 2026 against the isolated development application at
`http://127.0.0.1:3407`, PostgreSQL database `reader_visibility_n7_01a1742c`
on loopback port 5907. The database was freshly created, migrated, seeded with
fictional accounts and activated through the existing assignment-review service.
OpenAI credentials and model were explicitly empty. **Zero paid calls.**

This tests the combined source candidate based on
`e7cbf3d6930e892e91f4170ed2aa08c9b8649e67` with uncommitted N7 route mounts.
It is not final-commit or production-build acceptance. [PROVENANCE.json](PROVENANCE.json)
records the dirty worktree, exact source hashes, runtime and limitations. The three
reader production files still matched the complete browser run when collected.

| Check                                                   | Observed result                     |
| ------------------------------------------------------- | ----------------------------------- |
| Complete reader browser/PostgreSQL run C                | **17/17 passed**                    |
| Existing authenticated `scripts/check-reading.ts`       | **Passed unchanged rerun**          |
| Existing synthetic `scripts/check-dialogue-recovery.ts` | **7 groups passed**                 |
| Existing synthetic `scripts/check-r7-controller.ts`     | **6 groups passed**                 |
| Temporary reader fixture cleanup                        | **Passed; generated route removed** |

The complete [browser report](browser-run-c.json) preserves actual fictional
session, attempt, delivery, source-version and receipt identities. It covers the
baseline hidden-mount defect, fixed hidden/visible behavior at 1440×1000,
1024×768, 390×844 and 320×844, keyboard switching, hiding an in-flight opening,
pending/failed/lost receipts, offscreen passages, exact Back/Forward navigation,
refresh, unsent draft return, and genuine background-tab focus changes before
and during opening. Separate simulated document-visibility cases are identified.

The real unsent-draft case traversed the combined assignment and reading routes,
returned to the same question, refreshed, and preserved the exact draft without
changing attempts or accepted evaluation identities. A failed or unknown receipt
retained its original delivery identity and required explicit reconciliation.

The HTTP reading check additionally verified anonymous and cross-student denial,
private-criteria exclusion, exact source/citation identity, unknown references,
display-only assistance, duplicate requests, blocked premature submission and
immutable prior answers. The dialogue/controller checks use synthetic provider
results and existing services; they do not establish actual-model behavior.

## Retained failed and interrupted attempts

- [Run A](browser-run-a.json) passed its first 11 cases, then stalled in the
  unsent-draft case's unbounded wait. Its [log](browser-run-a.txt) is retained.
  Only that test process tree was stopped. No application change was made.
- The ignored local harness copy added 30-second action/function waits,
  60-second navigation waits and failure screenshots/state diagnostics. It
  preserved every assertion. [Run B](browser-run-b.json) passed all six remaining
  cases, including the same draft case; [run C](browser-run-c.json) then passed
  all 17 in one run. The initial stall's cause was not established.
- The first [reading HTTP run](reading-http-check.txt), immediately after the
  temporary route was removed, received a 500 instead of the expected 404.
  The development server logged `Unexpected end of JSON input` for that request.
  The [unchanged rerun](reading-http-check-rerun.txt) passed after recompilation.
  This transient development-runtime failure is retained, not represented as a
  successful first attempt or proof of a production defect.

The portable source harness remains at `tests/browser/reader-visibility/`.
Its preparation guard requires the exact loopback origin, a dedicated database
whose name begins `reader_visibility`, and disabled provider credentials. The
guarded cleanup removed only unchanged generated files and retained all evidence.
The local bounded copy and preparation helper remain in ignored `.setup/runtime/`;
their source hash is recorded in the provenance file.

## Screenshots and remaining boundaries

[1440](reader-harness-1440.png) · [1024](reader-harness-1024.png) ·
[390](reader-harness-390.png) · [320](reader-harness-320.png).

These screenshots show the explicit **test wrapper**, not the approved Notebook
prototype or an enabled live facing pane. They are reader regression evidence.
The standalone reading route remains the supported destination. This run does
not approve a hidden facing pane or the #113 active-study presentation handoff.
Native 200% zoom, mobile software keyboards, screen-reader behavior and the full
teacher-review/fresh-check journey require separate N6 evidence.
