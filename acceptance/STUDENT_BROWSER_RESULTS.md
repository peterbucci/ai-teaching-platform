# Student browser acceptance: main and PR #116

Independent browser runs completed October 24, 2026 (America/New_York). These are provider-disabled checks of real local application, authentication and PostgreSQL behavior with fictional users. These student runs did not include a fresh actual-model test, hosted release check, screen-reader check or actual browser 200% zoom. Native zoom and additional bounded keyboard checks are reported separately in [ACCESSIBILITY_REPORT.md](ACCESSIBILITY_REPORT.md).

## Exact targets

| Target       | Source SHA                                 | Application             | Browser                       | Valid results                                                                                                                                                                                                         |
| ------------ | ------------------------------------------ | ----------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current main | `723ed6fea41138b604a9d333ebcd4a07b2202c36` | `http://localhost:3321` | Edge/Chromium `156.0.4314.42` | 12 core passes; S-02 reproduced. Supplemental run: 4 passes and S-01 reproduced. Separate delivered-review inspection passed. Three earlier attempted cases were inapplicable harness/fixture cases, explained below. |
| PR #116      | `5d6363d2867a6f0250f8220db0474342b1241d00` | `http://localhost:3322` | Edge/Chromium `156.0.4314.42` | 12 core passes; S-02 reproduced; 3 explicitly unrun cases. Supplemental run: 4 passes and S-01 reproduced.                                                                                                            |
| PR #113      | `2b490863cc6de69a7659f1df1e4628bc22dd7d9a` | Not run                 | Not run                       | Static scope review only. It owns the student result and scrolling changes; no passing result is transferred to it.                                                                                                   |

Providers were disabled by the isolated environment. Saved conversation state reported `provider_requests_used: 0`. The supplement injected a clearly labeled synthetic accepted evaluation through existing server services; it did not claim a model judgment. See the root environment manifest for container/build and database details.

Evidence root on this machine: `C:/Users/sb128/Desktop/LearningPlatform/.setup/`. The main core run is under `acceptance-main/browser-student/`, with its later accepted-result supplement under `acceptance-main/browser-student-result-main/`; PR #116 is under `acceptance-pr116/browser-student/`. Keep storage-state JSON and `.env.acceptance` private and out of Git. Screenshot/report filenames below contain fictional data only.

## Passed observations

On both source SHAs, the same scenarios verified:

- Exact unsent text, including leading/trailing spaces and newlines, survives refresh; reading navigation and browser Back/Forward retain the draft without submitting an answer.
- Quick-action replacement provides Restore previous draft, which restores the exact original text.
- At 1440x900, 1024x768, 390x844 and 320x844, a long composer draft remains editable with no document horizontal overflow. Top-of-page and focused-composer screenshots were captured separately. A limited keyboard test moves from textarea to Send and then the normal navigation order; it is not complete keyboard or screen-reader acceptance.
- With no provider available, a help message receives explicit intent clarification. Choosing “I’m asking for help” produces an honest unavailable-help notice, keeps the original question, leaves `response_text` and `submitted_at` null, and consumes zero provider requests. This is not a live classifier test.
- Refresh makes no API write in the observed unanswered/fallback state.
- Synthetic offline and 401 failures injected before the initial answer-save commit preserve the exact answer in the locked composer, display an explicit retry/sign-in action, and send no automatic retry. The server still has no answer. S-02 concerns misleading status wording, not observed data loss.

The same supplemental checks also passed independently on both targets:

- A completed session with explicitly synthetic accepted evidence reloads to an identical student API view; no new evaluation was requested.
- A different student receives 404 for another student's session.
- Repeating the exact original help-message identity returns 200; changing its text under the same identity returns 409; a new request with a stale revision returns 409. The complete conversation view stays identical and provider requests stay at zero.
- An explicit wrong assignment combined with a valid session displays the 404 page rather than another assignment's evidence.

Main cross-role inspection passed for the teacher-delivered review: Student Two receives approval `56184882-8818-4a56-a5fd-24ee2ae7d2b6`, draft `47d61be0-5cf9-47af-8fce-1056789ae5bd`, assignment `30000000-0000-4000-8000-000000000001`, and pinned content version `3bd292c1476f5becb658418b70ee36153cfce830`. Student-safe content excludes private assessment criteria. Opening the review showed the activity and fresh-check entry point; its explanation was acknowledged by the normal UI. No fresh check was started or submitted by this inspection. Evidence: `delivered-student-two.json`, `delivered-student-two-after-ui.json`, `student-two-delivered-review.png`.

## Defects for owning workstreams

### S-01 — Accepted result is not visible in the study conversation

**Browser-reproduced independently on main and PR #116. Owner: student answer-result / PR #113, coordinated through #76 and #35. Priority: P2.**

The completed student page visibly shows “Completed” and “Your answer — saved,” but no accepted correctness or uncertainty feedback. The synthetic accepted evaluation says both transmission and propagation concepts are correct. Exact original answer text is visible. This prevents a truthful pass of the requested student accepted-result step; it is not evidence that scoring or persistence failed.

Reproduction:

1. In each disposable target environment, use `seed-student-result.mjs` once. It refuses to overwrite any existing Student Two `live_demo` session for the curated assignment.
2. Sign in as fictional Student Two and open the `url` recorded in that target's `accepted-result-fixture.json`.
3. Compare the visible page with that fixture's accepted evaluation and original attempt. No visible result appears, including after refresh.

PR #116 session: `596fda0e-7186-4e13-bf4d-6e865cfa9d5c`; attempt: `d6b4c388-f717-4bed-9b72-ab8559752621`; accepted evaluation: `ac0ddce6-6bdf-4bdc-8d59-73a9d6727b54`.

The later main run beginning `2026-10-25T03:34:38.175Z` independently reproduced the same result with session `487e5e23-13f9-4497-8b62-c4d4cc410d79`, attempt `44d7e075-4824-4447-91dd-efb72afbd93f`, and accepted evaluation `9409c564-2b03-4ea6-84db-bc18e3773d57`. Main used its own fictional database and synthetic evaluator fixture; no existing session was relabeled.

Evidence: each target's `accepted-result-fixture.json`, `student-result-report.json`, `correct-result-visible-text.txt`, and `correct-result-{1440x900,1024x768,390x844,320x844}.png`. Main's supplement is in the separate `browser-student-result-main` folder; its original core report and login storage remain unchanged. PR #116's 1440x900 and main's 1440x900/320x844 screenshots were visually inspected. Do not independently patch the student UI during acceptance; rerun this case on PR #113's eventual exact integrated SHA.

### S-02 — Initial-save 401 says work is already saved

**Reproduced on main and PR #116. Owner: student recovery / #76. Priority: P2.**

Reproduction:

1. In the provider-disabled curated session, choose the explicit answer fallback and enter a new answer.
2. Intercept the first `POST /api/sessions/{sessionId}/answers` before it reaches the server and return synthetic HTTP 401.
3. The exact local answer remains, and the server's attempt still has `response_text: null`. The error nevertheless says: “Please sign in again. Your submitted work is saved.”

Expected: distinguish preserved local/unconfirmed work from confirmed server persistence. Evidence: each target's `answer-save-401-preserved.png` and `student-browser-report.json`. Main session: `a1058019-9170-43fc-8200-ad39f1734934`; PR #116 session: `f1639d10-3745-4494-8c40-73a6a9f81d5c`. No automatic retries or data loss were observed.

## Harness corrections and honest unrun cases

The first main run returned from reading before the streamed passage finished rendering and its normal display acknowledgment completed. Later contexts correctly blocked editing and offered “Return to reading.” Following that action and waiting for the rendered passage cleared `pending_reading`. The harness now waits for actual page content and the reading `aria-busy=false` state. Its original report is retained as `student-browser-report-initial-harness-errors.json`. This was a harness timing problem and safe application gate, not a product failure.

The second main report retains three raw timeout failures. Their adjudication is recorded separately in `student-browser-adjudication.json`; do not count them as three release defects:

- **Conversation transport interruption after disabled-help fallback:** Send intentionally does not dispatch a conversation operation in this state. The intercepted POST never occurred. The test needs a fresh pre-fallback session; it is unrun, not a failed uncertain-provider test.
- **Two historical seeded-session UI checks:** `studentSessionAssignment` intentionally restricts student navigation to `data_origin='live_demo'`; original synthetic fixture records are inspectable through authorized teacher/API paths but return 404 in the student route. These fixtures were unsuitable for student browser acceptance. They were not relabeled. The separate S-01 fixture uses a newly created normal tutoring session with explicitly synthetic evaluator provenance.

Still unrun in this student suite: a real expired-session sign-in/return cycle (the observed case injected 401); an actual unknown provider outcome; failed conversational accepted-help acknowledgment; full keyboard journey; screen reader; fresh model generation or evaluation; hosted release. Existing synthetic service tests cover additional recovery and authorization behavior, but must be reported as that evidence layer.

## Reproduction files and readiness

- `student-browser.mjs`: core journey, responsive captures, initial-save failures and report. Configure `ACCEPTANCE_BASE_URL`, `ACCEPTANCE_SETUP`, `ACCEPTANCE_SOURCE_SHA`, optional `ACCEPTANCE_OUT`/`ACCEPTANCE_STATE_DIR`, and the existing local browser server through `ACCEPTANCE_WS_FILE`. Fresh setup signs in using the fictional Demo student UI; existing disposable storage is reusable. Model credentials are never read or printed by this script.
- `seed-student-result.mjs`: guard-protected container-only fixture. Requires `ACCEPTANCE_PROJECT=lp-accept-main` or `lp-accept-pr116`, empty `OPENAI_API_KEY`, existing fictional Student Two and approved curated assignment. Uses `/app` imports for the reviewed services. It creates normal-session evidence only once and records an explicitly synthetic evaluator. No provider module is imported.
- `student-result-browser.mjs`: S-01 display, refresh, cross-student denial, replay/stale identities and wrong-assignment checks. Reads only the fictional Student Two credentials from the private acceptance env file and never emits them.

The current reusable scripts return nonzero when a recorded case is FAIL. Earlier executed versions used JSON statuses as the authority and exited zero after recording S-02; their failed assertions are not reported as a passing suite.

Student acceptance is **partial**, not a release-wide or merge approval. The observed draft, fallback, persistence and isolation behaviors remain usable, but S-01 and S-02 prevent declaring the requested student result/recovery journey fully accepted. No student regression unique to the Workbench slice was observed in the repeated cases. PR #113's changed scrolling and result rendering still require their own exact-head browser acceptance. Preserve the known fallback and avoid merging an incomplete UI refactor solely on these results.
