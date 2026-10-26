# Intervention hydration and v2.2 fidelity — R07 / R09

Application source: `435dd0adcb4a59bf915ed7bb5a6116f80ab457f3`, based on requested `07efb7f821339538800f150f57b298eb2e606be3`. Later commits contain tests/evidence only. Refs #18, #114 and #124. No merge, deployment or paid model call.

## R07: established cause and correction

The original production application at `http://localhost:3396` was reproduced using the exact saved delivered draft `1e68ead8-23ae-442f-a200-91b41d266b37` and `workspacePane=context`. Its approval and delivery timestamps rendered as `10/25/2026, 4:33:22 PM` in server HTML, but `10/25/2026, 12:33:22 PM` in an en-US browser with America/New_York timezone. An en-GB browser also changed the date order to `25/10/2026`. React emitted #418 with `args[]=text` in each case.

The matching en-US/UTC control had no hydration errors at any width. New York en-US and en-GB each reproduced #418 at 1440, 1024, 390 and 320. Native 100% and 200% also reproduced it. This is direct production evidence, not an inference from the use of `toLocaleString()` alone. [Before receipt](before/report.json).

`interventionTimestamp` now produces deterministic, explicitly labeled UTC text. Approval/delivery `<time dateTime>` retains the exact stored timestamp, including offset/milliseconds. Follow-up dates use the same presentation. No state/persistence change, client-only date replacement, or hydration suppression was introduced. Timestamps remain in server HTML, including when their disclosure is closed.

The same original database was copied into a fresh, separately owned PostgreSQL database. K supplied a private custom-format dump from `lp-v22-final-01a173d6-db-1`, SHA256 `a5092aca42f34c0ab4f0883bd53d6c9f137d877ec087b46c73af6a609e65ffd6`. Original database untouched; credentials and dump excluded from Git. The fixed production build at `http://127.0.0.1:3372` passed all 14 browser states with zero page/console errors. The regression asserts server HTML date meaning, exact stored `dateTime`, and equal saved review before/after browsing. It waits for saved follow-up loading to settle. [After receipt](after/report.json), [executable regression](../../intervention-hydration-browser.mjs).

## R09: pane contract and compact stages

The existing shared component made `context` the tablet dialog, so CSS alone could not safely turn Evidence into a focus-contained drawer while keeping the existing slot identities, phone order and single mounted editor.

K implemented the agreed opt-in in upstream commit `56e49151504bd831a4437ed5cde172f8dd751be6`, included here as dependency commit `9f30bee`. The component, CSS and shared browser test were taken unchanged. Its unrelated contextual-return document hunk was omitted with K's agreement. No independent shared shell implementation was made in this workstream.

Exact interface:

```tsx
// Shared default remains "context" for existing consumers.
tabletDrawer?: "navigation" | "context";

// Intervention call site only:
<TeacherWorkspacePanes
  tabletDrawer="navigation"
  navigation={{ label: "Evidence", children: evidence }}
  main={{ label: "Activity", children: activity }}
  context={{ label: "Steps", children: steps }}
/>
```

At 1024, Activity and Steps remain adjacent; Evidence uses the existing native modal mechanism. Desktop/phone slot order and `workspacePane` identities are unchanged. No alternate editor, pane controller or mutation path was added.

Completed stages are compact native disclosures: evidence count, saved activity, fixed recipients, approved revision and delivery. Their exact evidence/recipient details, UTC timestamps and technical identities remain available. Private editing/save controls, explicit approval and delivery guidance, unsaved work, pending actions, conflicts and recovery links remain visible when needed. Follow-up retains visible response counts, pending/failed/uncertain status, loading/errors and the caution about missing/assisted work; comparison details expand below.

All six stages fit in the delivered 390 and 320 views. Four completed rows fit at actual native 200%, matching the prototype's completed-stage density target. Active private editing and expanded details still scroll; this deliberately retains necessary actions and recovery information.

## Visual comparison

Before/after below use the exact R07 record (14 saved responses, two students, one recipient). Prototype is the approved reference with five answers/two recipients and approved-undelivered state; differences in data/state are explicit. These images establish arrangement and density, not pixel-identical fidelity.

| View        | Approved prototype                       | Before, delivered              | After, same delivered record |
| ----------- | ---------------------------------------- | ------------------------------ | ---------------------------- |
| 1440 × 1000 | [Prototype](prototype/1440x1000.png)     | [Before](before/1440.png)      | [After](after/1440.png)      |
| 1024 × 768  | [Prototype](prototype/1024x768.png)      | [Before](before/1024.png)      | [After](after/1024.png)      |
| 390 × 844   | [Prototype](prototype/390x844.png)       | [Before](before/390.png)       | [After](after/390.png)       |
| 320 × 844   | [Prototype](prototype/320x844.png)       | [Before](before/320.png)       | [After](after/320.png)       |
| Native 200% | [Prototype](prototype/native200-cdp.png) | [Before](before/native200.png) | [After](after/native200.png) |

Native zoom uses fresh browser profiles with actual zoom preferences: unchanged outer width 1440, CSS viewport 1416→708, DPR 1→2, root CSS zoom 1, visual viewport scale 1. The published native images are inspected, nonblank CDP surface screenshots, not the cropped ordinary captures. Prototype images are copied unchanged from PR #122's `2026-10-25-final-07efb7f8/prototype-captures-01` snapshot. [Copy hashes](copy-provenance.json).

| Real lifecycle state  | 1440                                            | 1024                                            | 390                                            | 320                                            | Native 200%                                          |
| --------------------- | ----------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Private               | [View](lifecycle/private-1440.png)              | [View](lifecycle/private-1024.png)              | [View](lifecycle/private-390.png)              | [View](lifecycle/private-320.png)              | [View](lifecycle/private-native200.png)              |
| Edited and saved      | [View](lifecycle/edited-saved-1440.png)         | [View](lifecycle/edited-saved-1024.png)         | [View](lifecycle/edited-saved-390.png)         | [View](lifecycle/edited-saved-320.png)         | [View](lifecycle/edited-saved-native200.png)         |
| Approved, undelivered | [View](lifecycle/approved-undelivered-1440.png) | [View](lifecycle/approved-undelivered-1024.png) | [View](lifecycle/approved-undelivered-390.png) | [View](lifecycle/approved-undelivered-320.png) | [View](lifecycle/approved-undelivered-native200.png) |
| Delivered             | [View](lifecycle/delivered-1440.png)            | [View](lifecycle/delivered-1024.png)            | [View](lifecycle/delivered-390.png)            | [View](lifecycle/delivered-320.png)            | [View](lifecycle/delivered-native200.png)            |
| Linked follow-up      | [View](followup/1440-followup.png)              | [View](followup/1024-followup.png)              | [View](followup/390-followup.png)              | [View](followup/320-followup.png)              | [View](followup/native200-followup.png)              |

## Executed verification

| Layer                           | Result and limits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused unit                    | 60 passed. [Log](quality/focused-tests.log).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Full unit                       | 633 passed, zero failures. [Log](quality/test.log).                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Static/content/build            | Full lint, typecheck, format check, 293 content checks and normal production Turbopack build passed on application source 435dd0a. [Receipt](quality/results.json).                                                                                                                                                                                                                                                                                                                               |
| Existing editor component suite | 15 passed, zero page errors, using actual components and synthetic API/Next seams. Covers one mounted form, pane/recipient retention, native save, invalid hidden fields, unchanged lost-save request, stale conflict, exact evidence anchors, keyboard tabs, Evidence dialog/Escape, dirty navigation/reload, generation recovery, Back/Forward and native 200%. These are not database or actual-model checks. [Receipt](component-report.json).                                                |
| Production hydration            | 14 before/control cases, then 14 fixed cases on exact R07 record. Fixed cases have zero page/console errors and unchanged saved review.                                                                                                                                                                                                                                                                                                                                                           |
| Production lifecycle            | Saved fixture `3da23ea7-6972-4ef7-9763-ada152bf66a7`: explicit save 3→4, approval 4→5, then delivery at revision5; one distinct request each, HTTP200 and authenticated GET reconciliation. Approved-undelivered was inspected before delivery. Authorized recipient, exact evidence/source, one mounted editor, unsaved reload recovery, modal keyboard/Escape, five sizes at every saved stage, and unchanged reload passed. [Receipt](lifecycle/report.json), [runner](lifecycle-browser.mjs). |
| Production linked follow-up     | Exact original and linked response text matched saved API evidence at all five sizes; source/version, approval and attempt links preserved; no mutations or page errors. Uses original R07 delivered fixture, separately from new lifecycle fixture. [Receipt](followup/report.json), [runner](followup-browser.mjs).                                                                                                                                                                             |
| PostgreSQL / authenticated HTTP | Existing generation integrity suite passed with five injected provider calls and zero paid calls. Existing curated/uploaded approval+follow-up suite passed using saved fixtures, including ownership/enrollment, stale/replayed actions, source version, separate delivery, private projection and linked original/later evidence. [Generation](generation-service.log), [approval/follow-up](approval-followup.json).                                                                           |

The passing lifecycle run records three explicit actions with distinct request identities. Its network guard rejects unapproved writes; pane and responsive checks compare saved state for unintended changes. The service suite creates its own labeled verification copies; no new model generation was performed by that approval suite.

## Retained stops and reproduction

The first native setup stopped during module import because an attempted dependency link targeted an uninstalled tree. SQL confirmed no public tables; only migrations/seed were resumed. Turbopack subsequently rejected an external dependency junction; local lockfile installation fixed the test environment and the normal production build passed. No application configuration was changed to hide either setup failure.

A first copied private fixture returned409 on Save. Its revision remained1 with zero action records/approvals; the request was not replayed. The passing lifecycle uses the existing generation suite's designated fixture. A later verifier checked a recovered input before its asynchronous load finished; no action had occurred. Waiting for the existing readiness condition fixed that verifier, and the next run completed all three explicit actions. Two optional integrity runs stopped on the normal sign-in429 before lifecycle cloning; the final run after the full cooldown passed. No rate limit, timestamp or quota was changed. [Retained attempt summary](prior-attempts.json); complete private receipts remain outside Git.

Run the production hydration regression with a delivered fictional draft and a fresh output folder:

```powershell
$env:INTERVENTION_TEST_ENV = 'C:/private/runtime/.env.fixture'
node tests/intervention-hydration-browser.mjs http://127.0.0.1:3372 <delivered-draft-id> C:/private/new-hydration-output
```

The optional private environment supplies existing fictional teacher credentials; without it the runner uses the Demo teacher UI. The `baseline` argument expects the original #418 failure and clean UTC control. Fixed mode fails on any page/console error and checks the timestamps in server HTML and DOM. Never replay the lifecycle runner against its delivered fixture: use a new authorized private fixture, preserving prior receipts and request identities. Component build/report outputs now go to `COMPONENT_BUILD_DIR` instead of overwriting historical artifacts.

All data and provider seams are fictional. No actual-model, screen-reader, physical-device or hosted-deployment validation is claimed. Independent acceptance on the final combined branch remains the next integration step; this report does not close the broader R2/Workbench issues.
