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
- Shared label request: Student work with Concerns (`/teacher/insights`), All answers (`/teacher/evidence`), By idea (`/teacher/insights?view=ideas`). H does not edit navigation.
- Concern outbound context: authorized assignment, origin, concept, approved misconception if named, `returnTo=patterns`; exact inspected session/attempt/evaluation identifiers. Return to `/teacher/insights#patterns`, retaining concept/category and dropping inspected record IDs.
- By idea outbound context uses `returnTo=insights`; destination recognizes this as By idea, so the receiver does not need a new `view` field. Focus `#concept-{id}` when present.
- Uncategorized concerns carry concept and `returnTo=patterns`, without inventing an approved misconception identifier.
- Evidence full-detail rendering and session-return receiver remain owned by their existing agents.

## Verification

Pending implementation. No paid calls authorized or planned. Fixture, authenticated runtime, visual and static checks will be reported separately; no claim of new AI discovery.
