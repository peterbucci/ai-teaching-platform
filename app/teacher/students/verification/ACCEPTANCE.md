# G — Workbench v2.2 Roster and student work logs

Coordination: #8, #114. Acceptance finding: R05. Base: `07efb7f821339538800f150f57b298eb2e606be3`. Verified October 25, 2026. All displayed people and histories are fictional. No paid model calls, merge or deployment.

## What changed

The expandable directory is replaced by a student-by-concept response grid. Selecting a name or concept opens an assignment-scoped investigation with Ideas, Work log and Summary. The log includes **all authorized saved sessions**, including older responses when a newer session is empty. The session-detail page is a supporting exact-record destination.

Only `app/teacher/students/**` and Roster-specific tests change. The shared receiver belongs to [K, draft PR #139](https://github.com/peterbucci/ai-teaching-platform/pull/139); its implementation is deliberately absent here.

## Prototype parity checklist

Inspected the actual supplied `Workbench v2.2 · clickable prototype (desktop — start here)-html.zip`, including `Main.dc.html`, the running Roster and the selected-student state. The reference has a compact response grid and a three-column Ideas / Work log / Summary investigation. Its fictional labels are not treated as stored evidence.

| Prototype structure / interaction   | Supported implementation                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student × concept overview          | Semantic table, ordered compact response trails, sticky student names, keyboard-focusable horizontal scroll region                                   |
| Session / participation information | Saved session and submitted-response counts; opened-without-response and no-session filters                                                          |
| Meaningful response markers         | Correct, partly correct, incorrect, uncertain, pending, failed/rejected and shown-but-unanswered; text equivalents accompany symbols                 |
| Assistance distinction              | Per-concept help/supplied-content and reading-only marks; only recorded pre-submission links affect an answer                                        |
| Intervention indicators             | Actual approval recipients and matching delivery records; approved-not-delivered and evidence-only relationships stay distinct                       |
| Select a student or a concept trail | Fixed student/assignment context; concept selection opens the corresponding work log                                                                 |
| Ideas / Work log / Summary          | Three columns at 1440; Ideas + Work log and Summary drawer at 1024; keyboard-operated pane tabs at 390 and 320                                       |
| Individual work timeline            | Original question/response text, accepted evaluation identity, uncertainty, displayed assistance and exact source reference; separate saved sessions |
| Summary                             | Actual interventions and follow-up relationship, existing tentative concern observations, recorded activity counts                                   |
| Return to Roster                    | Preserved name search, participation/source filters and selected student anchor; browser Back/Forward and reload                                     |
| Inspect session / displayed Back    | G emits the bounded contract below; K's composed verification confirms the shared return receiver                                                    |

The prototype's informal performance summaries are replaced with supported response/activity counts. No score, inferred ability, durable mastery or causal effect is fabricated. The header's evidence scope and chronology explanation are disclosures so original work remains accessible at narrow widths.

## Populated browser evidence

These captures use the production build and real authenticated server reads from an isolated PostgreSQL database: 24 enrolled fictional students, five concepts, multiple sessions, students without work, uncertain/pending/failed evidence, displayed assistance, and authored private/approved/delivered interventions. Intervention fixtures use the real approval/delivery/follow-up services with an injected deterministic provider response, **not** a model call.

| Viewport                  | Roster                                                                                          | Selected student                                                                                 | Other panes                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1440 × 1000               | [Grid](screenshots/roster-1440x1000.png)                                                        | [All three panes](screenshots/student-1440x1000.png)                                             | Inline Summary                                                                                      |
| 1024 × 768                | [Grid](screenshots/roster-1024x768.png)                                                         | [Work log](screenshots/student-1024x768.png)                                                     | [Summary drawer](screenshots/summary-1024x768.png)                                                  |
| 390 × 844                 | [Overview](screenshots/roster-390x844.png), [scrolled grid](screenshots/grid-390x844.png)       | [Work log](screenshots/student-390x844.png), [original work](screenshots/work-390x844.png)       | [Ideas](screenshots/ideas-390x844.png), [Summary](screenshots/summary-390x844.png)                  |
| 320 × 844                 | [Overview](screenshots/roster-320x844.png), [scrolled grid](screenshots/grid-320x844.png)       | [Work log](screenshots/student-320x844.png), [original work](screenshots/work-320x844.png)       | [Ideas](screenshots/ideas-320x844.png), [Summary](screenshots/summary-320x844.png)                  |
| Native Chromium/Edge 200% | [Overview](screenshots/roster-native-200.png), [scrolled grid](screenshots/grid-native-200.png) | [Overview](screenshots/student-native-200.png), [original work](screenshots/work-native-200.png) | [Summary](screenshots/summary-native-200.png), [measured native zoom](screenshots/native-zoom.json) |

At phone sizes the table scrolls horizontally inside its own region; the page does not overflow. Screenshots preserve viewport dimensions rather than pretending the entire long work log fits above the fold. Physical touch and screen-reader testing have not been performed.

## Checks and reproduction

- Eight focused tests in `tests/roster.test.ts`: ownership/identity rejection; exact accepted evaluation vs later failure; retention of older work; actual display/submission linkage; status distinctions; per-concept assistance; explicit intervention delivery/recipient relationships; bounded outgoing links.
- Authenticated production browser suite in `tests/roster.browser.mjs`: populated grid, filters, selection/concepts, reload, Back/Forward, all four viewports without page overflow, keyboard tabs, drawer Escape focus, empty states, an existing foreign-owned assignment/class/student/session, and student-role denial. [Receipt](screenshots/browser-results.json).
- Native zoom test in `tests/roster-native-zoom.mjs` uses a fresh Chromium/Edge profile with native 200% zoom, no CSS zoom or viewport emulation. An earlier run also verified the Chrome UI's 200% control through computer use. A later manual-control rerun was stopped and is not counted as a pass.
- Repository lint, TypeScript, repository formatting and production Webpack build passed. The build retains the existing unrelated `lib/materials/extract.ts` `module.createRequire` warning. Webpack avoids Turbopack's rejection of the external dependency junction; no build configuration was changed.
- G alone intentionally retains the base session receiver: its browser receipt labels the limited displayed Back behavior. [K's combined verification](https://github.com/peterbucci/ai-teaching-platform/blob/e88e45acea1478d562a2fb3fd2ebb9caa5403ed8/tests/artifacts/teacher-contextual-returns/VERIFICATION.md) records 21 passing original-fixture browser checks in composition `87e92ed3a0bca307101b02851428334224d5409e`, including G `874ed85` + `0443400`, H and K. Exact older session, displayed/native Back/Forward, reload, filters, stale identities and mobile focus were covered. Subsequent G application commit `9300261` compacts presentation and add test evidence; the outgoing-link contract is unchanged.

For a **fresh isolated** PostgreSQL database named `roster_test` on `127.0.0.1`, apply the existing migrations and run `scripts/seed-demo.ts --class`, then `tests/roster-seed.ts` and `tests/roster-auth-seed.ts` with the existing `--experimental-strip-types --conditions=react-server --env-file-if-exists=.env` Node flags. The two Roster seed scripts refuse other database names/hosts and refuse a configured OpenAI key. Do not reseed a retained acceptance database. Enable the existing fictional demo login and build/start on loopback.

Run `node --experimental-strip-types --conditions=react-server --test tests/roster.test.ts`. Run the two browser `.mjs` files with `ROSTER_BASE_URL` pointing at that loopback server; `PLAYWRIGHT_PATH` may point to an existing Playwright installation. Set `ROSTER_EXPECT_RECEIVER=true` only on a composition containing K's receiver. Browser checks perform reads and fictional demo sign-in; seeding is separate and explicit.

## Outgoing return contract for K

`rosterSessionHref` emits `/teacher/sessions/{session}` with `returnTo=students`, authorized `assignment`, evidence `origin`, selected `student`, optional `concept`, bounded name search `q`, `participation=all|submitted|opened|missing`, and `rosterPane=navigation|main|context`. Exact `session`, optional `attempt`, and the actually displayed `evaluation` identify the inspected record. An attempt link ends in `#attempt-{attempt}`. No response text, mutation identity or arbitrary destination is placed in the URL.

`RosterSessionLink` captures the current shared `workspacePane` into `rosterPane`. K validates the target's ownership and identities, preserves the originating fields, strips inspected session/attempt/evaluation from the return query, and uses the fixed `/teacher/students` destination. The return has `workspacePane=rosterPane` and a validated `#roster-attempt-{attempt}` for the visible main log, otherwise `#roster-student-{student}` or `#roster-main`. G restores focus only to recognized visible targets, falling back to the Roster heading. Malformed hash encoding is ignored safely.

## Evidence boundaries and remaining projections

- **Assignment scope:** existing teacher-authorized `readAssignmentEvidence` provides all saved sessions for one assignment and selected evidence source. Other assignments are not joined by student name, concept title or timestamp. A class-wide, cross-assignment log requires a reviewed read-only projection keyed by owned class, enrolled student, authorized assignment, immutable content version and exact session/attempt identity, with pagination and explicit source boundaries.
- **Accepted evaluation:** only `attempt.current_evaluation_id` can supply an accepted educational judgment. A later failed retry does not overwrite it; historical accepted rows are not substituted when the current pointer is absent. Operational failures remain distinct from incorrect answers.
- **Assistance:** submission snapshots and exact displayed records establish pre-submission help. Missing linked records are shown as unavailable. Created-but-unshown assistance is separately disclosed, never treated as delivered help. Equal timestamps do not establish causal order. Unrecorded/out-of-app help is unknown.
- **Conversation coverage:** this is an assessed-response and recorded-assistance log, not a claim to contain every dialogue message. A full cross-session conversation projection needs the existing conversation service's authorized immutable message/action/display identities joined to their exact attempt, without guessing from timestamps. The canonical session remains available.
- **Interventions:** the existing service returns the latest 30 drafts for the assignment, across evidence sources; this bound is visible in the UI. Approval, delivery, recipient display and follow-up state come from their actual records. A complete historical intervention projection needs keyset pagination plus explicit draft/approval/delivery/recipient/follow-up links. Mere evidence inclusion does not make a student a recipient, and later work is not assumed to have resulted from an intervention.

Independent combined final acceptance with K and the other separately owned Workbench slices remains the integration gate. This PR does not close the broader coordination issues.
