# Initial application run — failures preserved

Source `0fb417066d87e89f4770aea3127d4014e2c91f10`; browser harness SHA256 `65a281cc294568c1f872a43ecf60957fe2036b6132cb7db2059685a1050b8a3d`.

This run completed 212 checks with 9 failures. It is retained as an initial observation, not final acceptance. All 45 screenshots are copied unchanged. The full report records each assertion and outcome.

- Four search/filter groups stopped on a harness selector that matched both the visible search input and a hidden handoff field. Follow-up uses the accessible searchbox name; these failures do not establish an application search defect.
- The tablet context drawer closed on Escape but page restoration took focus from its opener.
- Native fragment-only row navigation from the mobile Record pane did not reveal the list at 390px or 320px.
- Direct row hashes opened the mobile list but the shared pane heading won focus instead of the response row at both phone widths.
- Screenshot inspection and a separate guarded read-only diagnostic found pane bodies extending beyond the viewport or fixed bottom navigation. Pointer focus could scroll the outer document by 4–56px. Follow-up assertions measure the pane body boundary and outer scroll position.

The 20 evidence/workflow table fingerprints before and after this browser run are identical. Authentication tables are deliberately excluded because fictional teacher sign-in writes authentication state. No model provider is enabled. The separate diagnostic only browsed the same fictional runtime.

Native 200% zoom was measured and original text remained exact. The follow-up adds an explicit scroll-to-answer visibility check at native zoom; initial record reachability alone did not establish that the entire answer was visible above the bottom navigation.

Private browser profiles, authentication state, runtime configuration and logs containing setup details are excluded.
