# Remaining merge and acceptance gates

Latest intake: [M01 navigation conflict and T01 shell CI assertion failure](LATEST_INTAKE.md) are additional merge gates. They concern newer heads and do not change the historical snapshot results below.

The combined candidate is **not accepted for the complete Learning Pulse / Workbench v2.2 refactor**. This is an acceptance report, not a request to merge any implementation PR.

1. **Pin the shared shell.** The first baseline had no committed shell delta. PR #120 and newer #117/#118 heads have now been composed separately; see SHELL_INTAKE.md. Complete their own runtime and visual checks. Do not integrate uncommitted shared files or force conflicts.
2. **Resolve or explicitly decide the visual gaps V01–V05.** Global/assignment navigation, evidence context panes and mobile transitions fail the reference comparison. Recheck every required size after changes.
3. **Complete the continuous browser journey.** Current HTTP suites cover source/version, publication, inactive creation, activation, tutoring, approval, delivery and linked follow-up through separate synthetic fixtures. They do not prove that one teacher/student browser journey succeeds end to end. Preserve separate content approval, assignment activation and intervention delivery decisions.
4. **Resolve contextual navigation findings.** C2 is browser-reproduced. C1/C3/C4 need their precise multi-class/saved-scope/search reproductions on the final shell. C5 needs a deliberate exact-version handoff into the new assignment builder. Keep verified authorization separate from context correctness.
5. **Finish student recovery and accessibility.** Run the prepared #113 accepted-result, long-response, reading, reload, pending/failed operation and precommit-401 checks. Retest unsaved work, mobile panes, Back/Forward and focus after shell changes. Native 200% zoom was genuinely exercised on a bounded evidence route, not certified across the entire workflow. Screen-reader verification is unrun.
6. **Capture equivalent populated states.** Main and combined default seeds match, but the prototype has richer lesson/intervention/class data. Capture populated authoring, selected assignment, original evidence and follow-up states with equivalent fictional data before passing information density or contextual-detail fidelity.
7. **Restore safe storage capacity first.** New builds/database/browser mutations are on hold pending the coordinating recovery task's clearance and shared disk/lock preflight. Preserve the old failed volume and the current successful run's artifacts. Low host headroom must not be bypassed because Docker's internal filesystem has free space.

Actual-model verification remains unrun by design because this task prohibits paid calls. Provider-disabled simulations cannot establish the project's real agentic decision/tool/observation/adaptation acceptance. That requires a separately authorized scope and must not be silently substituted with fixtures.

No issues are closed by this verification. No implementation PR was changed, merged or closed. The next narrow step is a storage-cleared, pinned shared-shell combination followed by the prepared continuous browser checks and matched populated screenshots.
