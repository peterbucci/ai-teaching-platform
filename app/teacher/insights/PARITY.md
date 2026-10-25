# H — Concern investigation parity and verification

Base: `07efb7f821339538800f150f57b298eb2e606be3`. Coordination: #8, #21, #114; acceptance R06.

## Interaction matrix (recorded before implementation)

Reference: supplied Workbench v2.2 HTML, Student work template lines 1041–1265 and `vmEvidence`, `vmCase`, `vmConcept`. Prototype data and simulated actions are design examples, not application evidence.

| Step / screen   | Prototype                                                                     | Base application                                      | Intended implementation                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Discover        | Student work → Concerns, All answers, By idea                                 | Long Insights overview; separate real Evidence detail | Concern list + investigation + context using existing pane component; All answers links to real Evidence                                  |
| Select concern  | Named category, linked students/answers, current evidence status              | Nested pattern details below concept analytics        | URL-selected concept/category; distinct students and unique response counts; no inferred traits                                           |
| Investigate     | Reasons to look closer / Unclear / Evidence against; original answer excerpts | Pattern history and direct session links              | Existing pattern observations grouped by latest saved status; exact Evidence links for every observation/support/contradiction            |
| Counterevidence | Keep earlier reasoning and later contradictory work                           | History exists but buried                             | Explicit supporting/contrary evaluation references plus all same-student concept responses, including correct and unavailable evaluations |
| By idea         | Objectives, situation breakdown, whole-class/latest work, related concerns    | Concept score accordion                               | Concept navigation, existing latest/independent/assisted/retest/later metrics, original response links; missing work remains missing      |
| Source          | Context pane with authorized passages and questions                           | Evidence already shows exact saved source/version     | Concept passage context and saved version references; full response/question/help/private evaluation stay in Evidence                     |
| Act             | Prepare intervention, class grid, related idea                                | Broad intervention link without exact evidence        | Read-only, bounded accepted-response handoff; no generation, recipient choice, approval or delivery                                       |
| Return          | Back to concern and persistent path                                           | Old Insights links lose context                       | Existing assignment/origin/concept/misconception/returnTo fields; Agent K owns receiver                                                   |
| Responsive      | Three panes; context drawer at tablet; one pane on mobile                     | General analytics stacking                            | Shared pane component, local responsive styles; test 1440/1024/390/320 and actual 200% zoom                                               |
| Uncertainty     | Tentative, supported, contradicted; unresolved evaluation separate            | Existing services preserve statuses                   | Preserve accepted/uncertain/failed/rejected/pending and assistance metadata without new scoring                                           |

## Compatibility and shared requests for K

- Keep canonical `/teacher/insights`; preserve `#patterns`, `#concepts`, `#responses`, `#concept-{id}`.
- Exact shared label request: Student work with Concerns (`/teacher/insights#patterns`), All answers (`/teacher/evidence`), By idea (`/teacher/insights?view=ideas#concepts`). The base shell already supplies these sections; no shared label or canonical-route change is needed. H does not edit navigation.
- Concern outbound context: authorized assignment, origin, concept, approved misconception if named, `returnTo=patterns`; exact inspected session/attempt/evaluation identifiers. Return to `/teacher/insights#patterns`, retaining concept/category and dropping inspected record IDs.
- By idea outbound context uses `returnTo=insights`; destination recognizes this as By idea, so the receiver does not need a new `view` field. Focus `#concept-{id}` when present.
- Uncategorized concerns carry concept and `returnTo=patterns`, without inventing an approved misconception identifier.
- Evidence full-detail rendering and session-return receiver remain owned by their existing agents.

## Verification

Implemented using the existing authorized teacher view, pattern calculation, metrics and Evidence model. The canonical route remains `/teacher/insights`. The legacy `#responses` destination forwards to the real Evidence workspace, preserving scope. H adds direct full-session links for contextual returns; Evidence's own session links retain Evidence's return behavior.

### Delivered parity and deliberate differences

- Concerns now start with a selectable investigation, then grouped student reasoning, saved support and counterevidence, source context and a bounded intervention-preparation link. Categories and conclusions come from saved evaluations; no additional score or inferred student trait is introduced.
- By idea shows approved objectives, latest work, existing independent/content-assisted/immediate-retest/later metrics, related concerns and earlier original responses. Reading-only assistance remains visible per response; the existing metrics service does not provide the prototype's separate reading-only aggregate.
- Counts distinguish enrolled students, students linked to the concern, and unique linked responses. The existing fixture's selected concern has 8 of 24 enrolled students and 15 linked responses. This denominator is explicitly enrolled students, rather than the prototype's evaluated-student denominator.
- Full question, response, evaluation and displayed-help inspection reuse Evidence. The prototype's separate side-by-side comparison and simulated intervention badges are not copied. Unknown or absent evaluations remain labeled unavailable/uncertain rather than filled with fabricated results.
- At desktop widths, the investigation and source context share the existing pane layout. At 1024 the context opens in the shared dialog; at 390/320 and 200% browser zoom, pane tabs expose the investigation and context without horizontal overflow. The application retains approved category descriptions rather than shortening them into unsupported claims.

### Executed verification

All runtime checks used the repository's existing `buildClassFixture` in a separate local PostgreSQL container: 24 fictional students, 23 sessions, 64 responses, 63 evaluations and 8 displayed assistance records. The model key was empty. No paid calls or new misunderstandings were used.

- Full deterministic suite: 640 passing tests, including eight concern regressions. Focused concern/pattern suite: 13 passing tests.
- Authenticated production browser suite: [22 passing checks](verification/browser-report.json), no browser errors or blocked requests. Covers exact original words/identities, supporting and contrary records, earlier responses, concept/origin filters, five accepted intervention seeds, Back/reload, all four legacy anchors, responsive panes, anonymous/student denial and invalid/unauthorized scope denial. Session, attempt, evaluation, intervention and draft hashes are unchanged after the journey.
- Read-only service privacy regression: authorized teacher access succeeds; assignment/session reads reject a student and a non-owning actor. This is a service-boundary test, not a second authenticated teacher browser session.
- Full lint, TypeScript and formatting checks pass. Production Webpack build passes. The default Turbopack build cannot resolve this local checkout's external dependency junction; the successful build used `node node_modules/next/dist/bin/next build --webpack`. An existing `lib/materials/extract.ts` createRequire parsing warning remains.
- [Prototype/current/after visual comparison](verification/comparison.html): populated Concerns and By idea at 1440, 1024, 390 and 320. Current captures use the requested base; after captures use the production build. Prototype and application use their respective fictional datasets, not matching invented outcomes.
- [Actual browser zoom measurements](verification/native-zoom-report.json): browser extension `chrome.tabs.setZoom(..., 2)` and `getZoom() === 2`, 1440 outer width, 712 CSS-pixel inner width, devicePixelRatio 2 and visualViewport scale 1. Direct browser-surface captures avoid Playwright's clipped native-zoom screenshot behavior. These are real 200% browser zoom captures, not CSS zoom or a narrow viewport simulation.

Reproduction: run the normal deterministic/static scripts. With an isolated seeded local runtime and provider disabled, run `node --experimental-strip-types --conditions=react-server --env-file=.env tests/concern-privacy.integration.ts` and `node --env-file=.env tests/concern-investigation.browser.mjs`. The browser script accepts `PLAYWRIGHT_MODULE`, optional `BROWSER_EXECUTABLE` and `CONCERN_ARTIFACT_DIR`; its default artifact output is ignored under `.setup`.

### Shared integration

Agent K owns the session-return receiver. H and K agreed the exact outbound contract above; H owns destination mode selection, context normalization and visible anchor focus. K executed [21 passing integrated checks](verification/integrated-return-report.json) on composition `87e92ed3a0bca307101b02851428334224d5409e` (tree `3ebd03a693ee766afa49189e73124325e2635f31`): K `56e4915`, G `874ed85`/`0443400`, H `4c26cea`/`7493b68`. These include original R01/R02 session links, By idea/Roster return and visible focus at all four widths, named/uncategorized concern returns at 1440/390, native Back/Forward/reload, changed filters, assignment switching and six invalid-context cases. K's shared changes must be integrated with H for the full session-return behavior; H does not duplicate them in its branch.

These checks verify the investigation UI over existing evidence and authorization. They do not claim new live-model pattern discovery, educational validation, or completion of the wider Workbench project.
