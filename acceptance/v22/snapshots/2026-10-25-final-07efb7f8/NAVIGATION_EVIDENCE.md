# Combined navigation and evidence verification supplement

The original V02, V03, S1, C2 and F1 regressions are resolved within their tested functional scope on application commit `07efb7f821339538800f150f57b298eb2e606be3`, tree `948b9a6005a056c97f10d181c589b5352d6221f3`. This conclusion uses authenticated browser navigation on the combined application at all four required viewports and actual native 200% zoom. Full visual acceptance is assessed separately. The completed V09 save/approval/delivery/follow-up lifecycle is established by the separate [connected journey evidence](END_TO_END_EVIDENCE.md), not by these read-only navigation checks alone.

This is a separate evidence reconciliation. Earlier reports, failed screenshots and historical PR #122 results remain unchanged. No application code or runtime state was changed by this independent review.

## Receipts and outcome accounting

| Receipt | Recorded outcome | Interpretation |
| --- | --- | --- |
| [six-blockers-01/report.json](six-blockers-01/report.sanitized.json) | **94 PASS, 8 FAIL, 6 UNRUN**; aggregate `failed`; 2026-10-25 17:20:37–17:24:38 UTC | The eight failures are S1/C2 verifier-readiness failures at tablet, two mobile widths and native 200%. The six unrun cases concern V09 editing/lifecycle. Do not rewrite this raw outcome as a pass. |
| [navigation-supplement-01/report.json](navigation-supplement-01/report.sanitized.json) | **21 PASS, 0 FAIL, 0 UNRUN**; aggregate `passed`; completed 17:25:27 UTC | Corrected readiness wait; S1/C2 selection, context, visible focus and refresh checks pass at all five sizes. |
| [v09-private-01/report.json](v09-private-01/report.sanitized.json) | **60 PASS, 0 FAIL, 0 UNRUN**; aggregate `passed`; completed 17:34:38 UTC | Later populated private-draft supplement proves panes/tabs, local editing retention, preview, tablet modal behavior and unchanged saved state. It intentionally does not save, approve, deliver or submit a follow-up. |

The first two receipts pin the exact candidate above, use `lp-v22-final-01a173d6` at `http://localhost:3396`, record successful 10 GiB runtime preflights and no blocked requests. All application requests after fictional-account login are read-only. Browser actions were executed against the actual application; these are not component tests or isolated-agent reports. Fictional database records supply the content. No model calls were made.

Published receipt links use `.sanitized.json` derivatives that remove guard ownership tokens without changing outcomes or application evidence. The SHA-256 values below identify the preserved original reports; the publication plan records the distinct derivative hashes. Screenshot bytes remain unchanged.

Original report SHA-256:

- Six-blocker report: `8917ce12253ea8d4ff17f339aad40181dce907591fdbae175b19ba74f1d2d5f7`.
- Navigation supplement: `dff7856581f5e4c2aba098ca4eb7ebac6b715affd5c1803f33426044c03e4e19`.
- Populated V09 supplement: `ac7915ca04e22e8749c5eadbb15192d2c0c36fd05e51b5b4a9d80d6e6640e53c`.

## Original blocker disposition and reproduction

| Original finding | 1440 × 1000 | 1024 × 768 | 390 × 844 | 320 × 844 | Native 200% | Original finding resolved? |
| --- | --- | --- | --- | --- | --- | --- |
| V02 — immediate dedicated original record | PASS | PASS | PASS | PASS | PASS, record pane/title immediate; body requires pane scrolling | Yes, no response-list-before-record layout |
| V03 — list / record / context transitions | PASS | PASS | PASS | PASS | PASS, compact transition | Yes for tested layout behavior; broader visual fidelity remains separately assessed |
| S1 — course Assignments discovery | PASS | PASS | PASS | PASS | PASS | Yes |
| C2 — Class Progress contextual return | PASS | PASS | PASS | PASS | PASS | Yes |
| F1 — native Back row/focus/scroll | PASS | PASS | PASS | PASS | PASS | Yes, including long-list nonzero scroll |

**V02/V03 reproduction.** Authenticate as the fictional teacher. Open `/teacher/evidence?assignment=30000000-0000-4000-8000-000000000001&origin=synthetic_fixture&concept=transmission_delay`. Select the first response. Verify its original answer exactly matches the authorized teacher API, the active pane is `main`, the heading `response-detail-title` receives visible focus, and reload retains the selected original record. At desktop, the list, record and context are adjacent at widths 330 / 750 / 360 CSS px. At tablet, list and record are 300 / 724 px; Open Context uses a drawer, and Escape returns focus to its opener. Compact widths show the record pane immediately, with the list absent from that pane. The original answer is not placed below 48 response rows. No tested size has horizontal page overflow.

The mobile record pane ends at y778 while fixed navigation starts at y779 (390 px); at 320 px it ends at y763 and fixed navigation starts at y764. The original text in this fixture is visible above that navigation at both mobile widths. At native 200%, the compact record heading is visible at y220 in a 454 px CSS viewport; the answer starts at y521 and needs normal pane scrolling. Do not claim the entire original answer is initially visible at 200%, or equate this density with the approved prototype.

**S1 reproduction.** Start from the selected Class Progress Details URL below. Use the course workspace's Assignments link at desktop/tablet or Back to course assignments in compact layout. Every size navigates to `/teacher/assignments`, with neither `assignment` nor `view` retained; the Assignments discovery heading is visible.

**C2 reproduction.** Open `/teacher/assignments?assignment=30000000-0000-4000-8000-000000000001&student=10000000-0000-4000-8000-000000000002&concept=transmission_delay&view=progress&progressView=grid&pane=details&origin=all&status=all#cell-evidence`. In the visible Details pane choose Read in full. It opens session `40000000-0000-4000-8000-000000000001`, anchored to attempt `50000000-0000-4000-8000-000000000001`, carrying the actual return parameters. Use the displayed Back link. The assignment, student, concept, `view=progress`, `progressView=grid` and `pane=details` are restored. Every size has visible focused element `cell-evidence` and hash `#cell-evidence`. Reload retains the complete returned URL. These are displayed contextual Back checks, distinct from native browser history in F1.

**F1 reproduction.** On the Evidence list above, use actual Tab navigation to reach the first response, press Enter, then use native browser Back and Forward. Repeat for the last response in the 48-row list. Back restores the originating response-row ID, visible keyboard focus and the response-list pane's scroll position. Forward restores the selected original record. The measured scroller is `.tw-panes-body`, not the unrelated window scroll position.

| View | Last-row scroll before / after native Back (CSS px) | First-row scroll before / after | Last response focused and visible |
| --- | --- | --- | --- |
| 1440 × 1000 | 9077 / 9077 | 0 / 0 | Yes |
| 1024 × 768 | 9354 / 9354 | 51 / 51 | Yes |
| 390 × 844 | 9247 / 9247 | 0 / 0 | Yes |
| 320 × 844 | 9604 / 9604 | 0 / 0 | Yes |
| Native 200% | 8725 / 8726.5 | 233.5 / 233.5 | Yes; 1.5 px difference within the recorded 4 px tolerance |

The last-row focus identity is `evidence-response-1f16fd29-fa61-4166-85c8-c13197f1facb` in every case. The first-row identity is `evidence-response-e15825e7-2b54-4fa3-864b-d6e5ef94d117`. These records belong to the synthetic networking history used for navigation; they are not the separately authored water-cycle journey below.

## Why the first S1/C2 failures are verifier faults

All eight failures have the same timeout: waiting for visible heading `Class progress`. At widths at or below 1240 px, an intentionally selected `pane=details` hides that main-pane heading. The screenshot [failure-S1-39.png](six-blockers-01/failure-S1-39.png) shows the actual visible Details pane and Read in full link. The supplement waits for the source-defined visible `.ap-workbench[data-pane="details"] #cell-evidence` and its Details heading. The substantive selection, destination, return context, focus and refresh assertions remain enforced. No application change occurred between these runs. The [supplement verifier](journey-bundle/navigation-supplement-browser.mjs) records this correction and the unchanged earlier run.

## Screenshot index and native zoom boundary

Each screenshot below is an unchanged artifact from its named run. Native200 entries in the first two runs are retained but are cropped ordinary Playwright captures; use their DOM/focus/scroll receipts for functional conclusions and the separate complete raw CDP gallery for visual inspection.

| View | Original record | F1 last-row return | C2 returned Details |
| --- | --- | --- | --- |
| 1440 × 1000 | [Record](six-blockers-01/V02-V03-selected-1440x1000.png) | [Back](six-blockers-01/F1-last-back-1440x1000.png) | [Details](navigation-supplement-01/C2-returned-details-1440x1000.png) |
| 1024 × 768 | [Record](six-blockers-01/V02-V03-selected-1024x768.png) | [Back](six-blockers-01/F1-last-back-1024x768.png) | [Details](navigation-supplement-01/C2-returned-details-1024x768.png) |
| 390 × 844 | [Record](six-blockers-01/V02-V03-selected-390x844.png) | [Back](six-blockers-01/F1-last-back-390x844.png) | [Details](navigation-supplement-01/C2-returned-details-390x844.png) |
| 320 × 844 | [Record](six-blockers-01/V02-V03-selected-320x844.png) | [Back](six-blockers-01/F1-last-back-320x844.png) | [Details](navigation-supplement-01/C2-returned-details-320x844.png) |
| Native 200%, ordinary captures cropped | [Record](six-blockers-01/V02-V03-selected-native200.png) | [Back](six-blockers-01/F1-last-back-native200.png) | [Details](navigation-supplement-01/C2-returned-details-native200.png) |

Additional evidence: [tablet Context drawer](six-blockers-01/V03-context-1024x768.png). S1 discovery and the outbound full-session screen at every size are indexed in the navigation report as `S1-discovery-<size>.png` and `C2-full-session-<size>.png`.

Native zoom was established by an isolated browser profile's native zoom setting and measured as `devicePixelRatio=2`, `innerWidth=708`, `innerHeight=454`, outer window 1440 × 1000, CSS root zoom `1`, visual viewport scale `1`. This is actual browser zoom, not CSS scaling or a narrow viewport substitute. Ordinary screenshot PNGs are 708 × 454 and crop the enlarged rendering. The separate gallery contains complete unchanged 1416 × 908 raw CDP captures: [original record](application-captures-03/original-response-native200-cdp.png), [Class Progress](application-captures-03/class-progress-native200-cdp.png), [assignment discovery](application-captures-03/assignments-native200-cdp.png), with [gallery measurements and state identities](application-captures-03/report.json). The gallery's original response is the authored water-cycle record, a different fixture/state from the networking navigation checks; it is not a replacement screenshot of the same underlying state.

Keyboard navigation, browser Back/Forward, visible DOM focus, scroll restoration, responsive overflow and the stated Context/Steps modal behavior are supported by real browser observations. Screen-reader announcements and physical touch-device behavior remain unrun. These receipts do not by themselves prove full WCAG conformance, all keyboard pathways, or every long-content/source-unavailable condition.

## Original journey submission and evaluator identities

These values were independently read from [original-result-01/api-evidence.json](original-result-01/api-evidence.json), whose SHA-256 is `78961e247ad276749db006a895ab1a04f0228a86c6b50f7255b3c577f810b73b`. They are fictional application record identities, not authentication credentials.

| Field | Exact recorded value |
| --- | --- |
| Original session | `c619a811-af67-4aeb-9348-686fe439db98` |
| Original attempt | `ae652658-924b-485d-9a87-7281a7501099` |
| Original `submission_key` | `12482ec6-7609-464e-8b71-c803921b4d51` |
| Original evaluation | `2531aac6-c71d-400a-948d-4bb29ac79535` |
| Evaluation `validation_status` | `accepted` |
| `evaluator.provider_reservation_id` | `75950951-1ca8-4d70-8af1-15f8ba42f11b` |
| Evaluator model / provider outcome | `synthetic-same-browser-journey` / `settled` |
| Actual applied controller action | `ASK_DIAGNOSTIC_FOLLOWUP` |

The exposed identifier is explicitly a provider **reservation** ID; no distinct actual external model-provider request ID is established by this receipt. The stored evaluator type is `language_model`, but the accepted result was supplied by the declared synthetic seam, with zero model calls. The original assistance snapshot is `none_recorded`, empty `intervention_ids` and `scaffolding_types`, and null content-assistance time. Later diagnostic completion and separate-student reading assistance must not be attributed to this original answer.
