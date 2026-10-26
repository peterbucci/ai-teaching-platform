# Manual authoring browser acceptance

Result: the manual authoring-to-assignment scenario passed independently on both targets below. This is provider-disabled browser integration using fictional users and original synthetic source text. No model generation or evaluation was performed. These results do not substitute for the separate student-answer, intervention, Workbench, or hosted-release reports.

| Target       | Exact source SHA                           | Browser origin          | Result                               | UTC completion      |
| ------------ | ------------------------------------------ | ----------------------- | ------------------------------------ | ------------------- |
| Current main | `723ed6fea41138b604a9d333ebcd4a07b2202c36` | `http://localhost:3321` | PASS, interactive Playwright journey | 2026-10-25 03:10:00 |
| PR #116      | `5d6363d2867a6f0250f8220db0474342b1241d00` | `http://localhost:3322` | PASS, reusable script execution      | 2026-10-25 03:18:09 |

Both runs occurred on the evening of October 24 in America/New_York. They used separate disposable PostgreSQL/Compose projects with fictional demo accounts, blank model configuration, and isolated internal app networks. Build/environment identities are recorded in each target's `manifest.json` and runtime reports. The reusable script checks the target manifest and absence of model configuration before making UI changes.

## Journey actually exercised

1. Pasted the same original synthetic evaporation/condensation reading. Previewed exact extracted text, reviewed attribution and permitted use, and saved a private approved source version 1.
2. Manually authored an evaporation objective, quoted exact supporting source text, saved it and explicitly approved it (revision 3).
3. Manually authored an initial, alternative, diagnostic and fresh retest question, with private expected answers, criteria, feedback and source support. Reviewed each question, saved the bank (revision 4), inspected its student preview, and explicitly approved it (revision 5).
4. Prepared the tutoring sequence (revision 6), approved the complete lesson, and separately published immutable lesson version 1.
5. Created an inactive assignment for the seeded fictional class. A separate enrolled-student browser context could not see that assignment before activation.
6. Explicitly activated the assignment through teacher review. The student could then find it, open its details and exact imported reading, and start its initial question with one message composer.
7. Verified the student question preview and public session API omitted the exact private expected-answer/criterion text.
8. Started lesson draft version 2 (revision 7), which required fresh bank/sequence review. The published version-1 page retained source version 1; the student's entire public session/presented-attempt response remained deeply equal after the version change and refresh. No assessed answer was submitted in this journey.

The reviewed bank contained four question roles. The prepared deterministic tutor sequence exposed two prepared questions in assignment review for this category-free fixture; the browser did not claim to exercise a generated or assessed follow-up.

## Fixture identities

| Identity                        | Main                                   | PR #116                                |
| ------------------------------- | -------------------------------------- | -------------------------------------- |
| Source                          | `559f8f81-78bf-4dea-ba78-bd846e4f7b27` | `5fe25086-d05e-4ada-a263-c0b0090e944d` |
| Lesson                          | `889bfd08-de13-4430-a967-3767f987db58` | `01b8f786-c9fa-4fc6-9279-467e777a8b9b` |
| Published lesson/source version | `1` / `1`                              | `1` / `1`                              |
| Assignment                      | `53f84e71-f829-4479-84fd-0df908d5bf87` | `2bd8094c-21d0-428c-bc54-3ef9d584f1b5` |
| Student session                 | `35242f08-a4c6-4a1d-b965-5486843e7bee` | `b8d04829-6978-41b0-8fe3-27ce1cca75dd` |
| Presented attempt               | `cec0de0b-0a01-48a4-9055-2edf2cdaf749` | `34569feb-1f1f-4db1-bb6a-51627a7a6daf` |

Both source documents have SHA-256 `d1048e7be31909142dfbb28e54e0c2b7657a6d04f5eeeafaebb139f3056af2b6`. The prepared fixture remains separate from historical actual-model evidence.

## Browser evidence and reproduction

The reusable entry point is `acceptance/authoring-browser.mjs`. It accepts the isolated target state directory, browser WebSocket endpoint file, and installed Playwright package directory as its three arguments. It creates its own teacher/student browser contexts, selects the explicit seeded demo class, uses manual controls, saves screenshots and sanitized fictional API evidence, and closes its contexts. It never clicks generation controls. Do not use it against a hosted service or shared real-data environment.

Local evidence is under the task workspace:

- `.setup/acceptance-main/browser-authoring/report.json`, `api-evidence.json`, and PNGs.
- `.setup/acceptance-pr116/browser-authoring/report.json`, `api-evidence.json`, and PNGs.

Reading screenshots were captured at **1440×900, 1024×768, 390×844, and 320×844** for each target. `document.documentElement.scrollWidth > innerWidth` was false at all four sizes on both targets. The main 320px screenshot was visually inspected: source text and reader controls remained contained and readable. These are reading-page findings, not full responsive acceptance of every authoring form.

PR #116's successful run generated step screenshots `01-extraction-review` through `14-session-preserved-after-v2`, including four `11-reading-<width>` files. Main's interactive run retained the analogous `02-extraction-review` through `20-session-preserved-after-version2` screenshots and four `17-reading-<width>` files.

## Preserved environment and harness incidents

These were distinguished from application defects; no production source was changed:

- The first PR attempt encountered the test gateway's temporary 502 after the database/app restart. The owning runner refreshed its upstream and the original result remains in `environment-502-report.json`.
- An objective save succeeded, but the first script listened only for POST while the actual save used PUT. The original result remains in `harness-save-method-report.json`; the listener now handles the observed mutation method.
- An activation succeeded and appeared as active, while the harness stalled retrieving its unused response body. Only that acceptance process was stopped. The script now records activation status and verifies the visible refreshed state; the observation remains in `harness-activation-capture.json`.
- A later attempt used a default class introduced by other integration fixtures. Its assignment was correctly absent from the unrelated demo student's list. The result remains in `harness-class-selection-report.json`; the reusable test explicitly selects and asserts the seeded demo class identity. The final successful run used that intended class.

Incomplete fictional records from these harness attempts remain in the disposable PR database. They are not counted as passing journeys, are not silently repaired, and will disappear only with explicit disposal of that target stack.

## Limits and readiness implication

No application defect was observed in this narrowly scoped manual authoring-to-assignment path on either target. It supplies positive evidence that PR #116 preserves this existing workflow. It does not grant blanket merge readiness or release acceptance.

Unrun here: browser file-upload variants, live generation/evaluation, submitted historical answer/evaluation preservation, a whole keyboard-only journey, actual 200% browser zoom, screen-reader operation, full responsive authoring-form review, and hosted release verification. Existing deterministic/database suites cover additional contracts and submitted-history cases separately; their results must retain their own SHA/configuration/fixture labels.
