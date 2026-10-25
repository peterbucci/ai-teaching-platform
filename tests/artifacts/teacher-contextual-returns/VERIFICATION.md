# K — Teacher contextual returns

Verified 2026-10-25. Coordination: #8, #21, #114, #120. No paid calls, merge, or deployment.

## Revisions and scope

- Baseline: `07efb7f821339538800f150f57b298eb2e606be3`, retained original final-acceptance runtime at localhost:3396.
- K application: `56e49151504bd831a4437ed5cde172f8dd751be6`, isolated production runtime at localhost:3408.
- Final disposable G/H/K composition: `87e92ed3a0bca307101b02851428334224d5409e`, tree `3ebd03a693ee766afa49189e73124325e2635f31`, production runtime at localhost:3409.
- Composition contains K `56e4915`, G `874ed85` + `0443400`, H `4c26cea` + `7493b68`. G/H page changes are **not** included in K's branch. Their separate outgoing links and destination controllers are required for end-to-end completion.
- I's optional tablet drawer is a separate K commit (`56e4915`) and defaults to the previous context drawer. K did not edit Intervention pages. I included this component in draft PR #136; I's production acceptance is reported there, not certified by K's component harness.

All shared modifications and G/H's typed outgoing-link contract are documented in [TEACHER_CONTEXTUAL_RETURNS.md](../../../docs/TEACHER_CONTEXTUAL_RETURNS.md). K changes only the session receiver, shared navigation/validation contracts, the requested opt-in pane component/CSS, focused tests and evidence.

## R01/R02: exact original fixture

Assignment `382f0724-3800-4e6c-8a15-40b4813cb4ab`, session `c619a811-af67-4aeb-9348-686fe439db98`, concept `d1edb362-fa58-4e34-b8af-08c1f685e583`, Student One (fictional). This is the original `teacher-recovery-02` acceptance fixture, copied to an isolated database without reseeding or changing original records.

| Case                        | Before                                                                                               | Final composed behavior                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 Roster                  | Bare session link; displayed Back goes to Insights with `origin=all`, losing Roster search/selection | Fixed Roster path preserves assignment, `origin=live_demo`, student, applicable concept, name search, participation and pane; visible student/work-log target |
| R02 By idea                 | Displayed Back retains assignment only, drops concept and resets origin to all                       | Fixed Insights path retains assignment, concept and live origin; `#concept-{id}` selects and focuses the investigation                                        |
| Named/uncategorized concern | Not part of original two failure captures                                                            | `returnTo=patterns` retains selected concept and optional category; `#patterns` is visibly focused                                                            |

[Before receipts](before-01.json) reproduce both defects at 1440, 1024, 390 and 320 widths (8 cases). [Final integrated receipts](integrated-final.json) pass **21 checks** using the real G/H outgoing links, including the exact original older session exposed by H's Earlier responses. Each main journey checks displayed Back, separate native Back/Forward, reload and visible destination focus. Additional cases cover named/uncategorized concerns at desktop/mobile, changed Roster filters, actual assignment switching clearing stale state, invalid assignment/student/concept/category/attempt/origin, and a legacy direct deep link.

[Receiver-only receipts](receiver-03.json) pass 15 checks but explicitly use a browser-only outgoing-link adapter. They establish K's receiver behavior, not G/H page integration.

The full before/after URLs, link text and actual destinations are in the JSON receipts. Return destinations are fixed local paths, fields are allowlisted and bounded, and target session/attempt/evaluation/seeds are absent from return queries. No arbitrary return URL, private answer text or mutation/request identity is accepted as return state. Record access remains server-authorized before context validation.

## Loaded screenshots

These are supplemental direct loads of the **recorded returned URLs**, after waiting for the destination heading and hydration. They are not additional navigation assertions. Earlier journey screenshots sometimes captured loading states and are intentionally excluded. [Capture metadata](loaded-screens.json) records requested and final URLs.

| Destination            | Before, desktop                  | After, desktop                  | Before, mobile                 | After, mobile                 |
| ---------------------- | -------------------------------- | ------------------------------- | ------------------------------ | ----------------------------- |
| Roster-origin return   | [1440](before-students-1440.png) | [1440](after-students-1440.png) | [390](before-students-390.png) | [390](after-students-390.png) |
| Insights-origin return | [1440](before-insights-1440.png) | [1440](after-insights-1440.png) | [390](before-insights-390.png) | [390](after-insights-390.png) |

## Safety and previous regressions

| Verification                                                                   | Result                                                                                                                          | Receipt                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| S1 Course Assignments + C2 Class Progress, original fixture, 1440/1024/390/320 | 8 passed; displayed/native return, reload, keyboard focus                                                                       | [S1/C2](s1-c2-01.json)                 |
| S1/C2 actual browser 200%                                                      | 2 passed; measured DPR 2, CSS viewport 708, CSS zoom 1                                                                          | [Native zoom](s1-c2-native200.json)    |
| F1 first/last Evidence row, original fixture, four sizes + native 200%         | 10 passed; exact answer matches API, native Back scroll/focus, Forward, reload                                                  | [F1](f1-final-fixture-01.json)         |
| Shared shell assignment switcher                                               | 6 passed; real component/CSS with mocked data hooks, production/development React                                               | [Switcher](switcher-01.json)           |
| Default/opt-in tablet drawer                                                   | Both passed; native dialog focus, inert background, Escape opener, history, reload, 390/320/desktop, unsaved input preservation | [Panes](panes-04.json)                 |
| Anonymous/student access to all three contextual-return modes                  | 6 passed; anonymous API 401/login redirect; student API 404/unavailable page, no evidence view                                  | [Roles](role-check.json)               |
| Original vs isolated database                                                  | 28 domain tables have identical counts and hashes; auth/rate limits excluded because demo sign-in writes                        | [Database](evidence-fingerprints.json) |

Browser journeys allow only same-origin reads and fictional demo sign-in. No generation/evaluation/intervention mutations or provider calls were made. Component harnesses do not establish database or production lifecycle behavior. Physical touch and screen-reader testing were not performed.

## Static, unit and build checks

- `npm test`: **640/640 passed**, [complete output](unit-results.txt).
- `npm run lint`, `npm run typecheck`, `npm run format:check`: passed (final static receipt accompanies this document).
- Production Next build using `npx next build --webpack`: passed for K and final composition. [K build](build-webpack.txt), [composition build](integration-build-webpack.txt).
- Default Turbopack could not build this managed worktree because its reused dependency directory is a junction outside the checkout. Webpack was used without application/config changes. Both successful builds retain the existing `lib/materials/extract.ts` `module.createRequire` parsing warning.
- Independent read-only shared-code review found no actionable defects and independently passed 32 focused tests (contextual returns, Progress, workspace contracts, navigation context and intervention handoff). It did not run browser/build/database checks.

## Harness corrections and limitations

Failed exploratory receipts remain in the private run directory; they were not relabeled as passes. Receiver attempt 1 changed an anchor attribute without changing Next Link's cached props; the later adapter used a plain anchor. Receiver attempt 2 expected generic 404 text instead of the app's unavailable heading. Initial pane checks incorrectly required native-dialog Tab focus to remain in the document; browser chrome is permitted, while background controls remain inert and are explicitly tested.

The fresh-class Evidence harness expected 33 records and timed out on this retained acceptance database's 48 records. The comparison found 15 additional legitimate rows and no missing expected rows. F1 was rerun against the original acceptance fixture and the original first/last row identities instead of reseeding or weakening the assertion. Its 10 original-fixture cases passed.

Initial composed checks used the legacy `#responses` Insights route (which H intentionally redirects to Evidence), then encountered H's initial latest-only list. The final test uses H's canonical By idea route and H's `7493b68` Earlier responses, so the exact original session is covered. The supplemental role harness initially assumed a `/student` route and HTTP 403; inspection confirmed the existing `/study` route and deliberate non-disclosing 404. The corrected harness verifies those existing contracts.

The final browser receipt records the harness hash used at execution. A subsequent test-only change delays screenshots until the destination heading has loaded; the loaded screenshot supplement provides the reviewed visual evidence. No application changes followed the tested K revision.

Next integration step: assemble the separately owned G/H and I changes with K, resolve the duplicated opt-in commit by keeping one copy, then run independent combined final acceptance before considering a merge. This PR does not close the broader coordination issues.
