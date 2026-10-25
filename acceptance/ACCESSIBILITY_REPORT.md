# Native zoom and bounded keyboard acceptance

Executed 2026-10-25 UTC with an independent headless Microsoft Edge profile for every role and zoom setting. These checks used the provider-disabled disposable PostgreSQL runtimes and fictional demo users. No answer, help request, generation, approval, or delivery was submitted. Browser contexts were closed at completion.

| Target       | Exact source SHA                           | Origin                  | Final run UTC     |
| ------------ | ------------------------------------------ | ----------------------- | ----------------- |
| Current main | `723ed6fea41138b604a9d333ebcd4a07b2202c36` | `http://localhost:3321` | 03:29:20–03:29:26 |
| PR #116      | `5d6363d2867a6f0250f8220db0474342b1241d00` | `http://localhost:3322` | 03:29:11–03:29:19 |

## Native 200% zoom method and result

`accessibility-browser.mjs` writes Chromium's native `partition.default_zoom_level` preference in a newly created, dedicated browser profile, then launches Edge with `viewport: null` and a 1440 × 900 outer window. The preference uses the browser zoom level `log(2)/log(1.2)` for 200%. This uses the native profile setting documented in [Chromium's zoom preference implementation](https://chromium.googlesource.com/chromium/src/+/lkgr/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc). No CSS zoom, device-scale-factor override, page pinch, or viewport emulation was used.

The following measurements were reproduced independently on **both** targets:

| Measurement              | 100% baseline | 200% native zoom |
| ------------------------ | ------------- | ---------------- |
| Outer window             | 1440 × 900    | 1440 × 900       |
| CSS viewport             | 1416 × 808    | 708 × 404        |
| `devicePixelRatio`       | 1             | 2                |
| `visualViewport.scale`   | 1             | 1                |
| Computed root CSS `zoom` | 1             | 1                |

**Pass:** native zoom doubles DPR and halves the CSS viewport while the outer window stays fixed. Login, teacher workspace, evidence, reading, and student composer had no document-level horizontal overflow on either target. Main original student evidence and PR #116 intervention landing view also had no document-level overflow. This measurement does not establish that every nested panel or every screen is usable at 200%.

Screenshots use the browser's direct `Page.captureScreenshot` surface capture. Ordinary Playwright screenshots cropped this native-zoom viewport to its CSS dimensions during harness development; those captures were replaced with verified 1416 × 808 surface captures. The final composer capture was visually inspected: the question, help actions, focused composer, and exact unsent text were legible and contained. Viewport captures intentionally show only the visible portion of long pages.

## Keyboard and history results

Controls were reached with actual `Tab` presses and activated with `Enter`, without locator clicks or programmatic focus. DOM reads identified the currently focused control. Browser Back/Forward were separate history API actions, not keyboard shortcuts.

| Check                                                         | Main                                          | PR #116                                                         |
| ------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| Demo teacher login → mobile navigation drawer                 | Pass                                          | Pass                                                            |
| Drawer → teacher evidence                                     | Pass: Learning insights                       | Pass: Evidence                                                  |
| Visible focus indication on reached links, buttons, composer  | Pass: measured green 3px outline              | Pass: measured green 3px outline                                |
| Original student session from evidence by keyboard            | Pass                                          | Unrun: matching link not reached within bounded Tab search      |
| Evidence → intervention landing by keyboard                   | Unrun: matching drawer link not reached       | Pass                                                            |
| Open an existing saved intervention review by keyboard        | Unrun                                         | Unrun: matching summary not reached in current assignment scope |
| Student assignment details → approved reading                 | Pass                                          | Pass                                                            |
| Return from reading → study session → single composer         | Pass, with browser history API for return     | Pass, with browser history API for return                       |
| Type exact unsent text in composer, then clear without submit | Pass                                          | Pass                                                            |
| Main original-session Back restores list scroll               | Pass: 2090.5px before and after               | Unrun                                                           |
| Main original-session Back restores originating focus         | **Observed gap:** active element becomes BODY | Unrun                                                           |
| Forward returns to original session route                     | Pass; BODY focus, top of page                 | Unrun                                                           |

The reading End key was issued, but document scroll remained 0; nested reading-container scroll was not measured. Reading scroll restoration is therefore **unrun**, not passed. Tab counts in raw reports are diagnostic only: hydration timing and many accumulated fictional assignments make them unsuitable as fixed acceptance thresholds.

The student fixture is the exact manual authoring fixture recorded in `AUTHORING_BROWSER_REPORT.md`: main assignment `53f84e71-f829-4479-84fd-0df908d5bf87`, PR #116 assignment `2bd8094c-21d0-428c-bc54-3ef9d584f1b5`. The original water-state source and presented question were reused without answering them. Teacher default scopes differ: main used the seeded synthetic networking history, while PR #116 selected the newer fictional 61-response oversized-evidence fixture. Teacher results must not be treated as a controlled comparison between identical records.

## Follow-up finding and limits

**A11Y-01 — Back returns scroll but does not restore the initiating control on current main.** Reproduction: at native 200%, sign in as Demo teacher using Tab/Enter; open mobile navigation; choose Learning insights; Tab to Inspect session for session `129120b0-f584-41f0-8e58-c3e190941799`; press Enter; use browser Back. The list returns to scrollY 2090.5, but `document.activeElement` is BODY instead of the Inspect session link. Browser Forward reaches the expected session route. Owner: shared navigation / teacher evidence workstream, coordinated through #114/#35. Classify as a post-submission keyboard-navigation improvement unless the release owner sets a stricter focus-restoration gate. No production repair was made. No claim is made about subsequent Tab order or screen-reader announcements after Back.

Screen-reader operation, comprehensive WCAG compliance, keyboard-only authoring/intervention editing/approval/delivery, all recovery states, nested scroll restoration, and all-page Back/Forward/focus behavior remain **unrun**. A bounded locator search failing to find a matching control is reported as a harness/scope limitation, not an application accessibility failure. These results do not replace the four requested viewport checks in the other browser reports or validate a hosted release.

## Reproduction and artifacts

Run from the acceptance worktree with the isolated runtime and its successful `browser-authoring/report.json` available:

```powershell
$env:ACCEPTANCE_ACCESSIBILITY_OUT = "C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-main/browser-accessibility-$(Get-Date -Format yyyyMMdd-HHmmss)"
node acceptance/accessibility-browser.mjs `
  C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-main `
  C:/Users/sb128/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright `
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
```

Replace `acceptance-main` with `acceptance-pr116` in both paths for the other target. The script rejects non-loopback origins or a manifest authorizing paid calls. `ACCEPTANCE_ACCESSIBILITY_OUT` optionally selects a fresh absolute output directory; without it, the output defaults to the target's `browser-accessibility` directory. The harness refuses to run if `report.json` already exists, preserving earlier evidence.

The development version used for the recorded runs updated named outputs while the capture method was being verified. Original executed results are retained in the early evidence bundle. The later output-directory guard changes only evidence preservation; the browser assertions are unchanged, and browser tests were not rerun after this guard was added.

Final local evidence:

- `.setup/acceptance-main/browser-accessibility/report.json` and `01-baseline-login.png` through the available numbered workflow captures.
- `.setup/acceptance-pr116/browser-accessibility/report.json` and the equivalent captures.
- `09-composer-keyboard-200.png` demonstrates actual native zoom and the visible focus ring with unsent fictional text on each target.

Browser `profile-*` directories contain temporary authenticated browser state. **Do not collect, stage, or publish profiles, cookie databases, or browser storage.** Only the JSON measurement report and PNG screenshots are acceptance artifacts. The runtime manifest supplies the exact build/configuration details. No new paid or hosted verification was performed.
