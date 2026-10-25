# Workbench v2.2 — actual main and combined visual acceptance

**Result: the temporary combined candidate does not yet meet Workbench v2.2 design fidelity.** It renders the inspected routes and adds real review surfaces, but its shared navigation, assignment context, evidence pane structure and mobile transitions remain materially different. This is a visual-acceptance result for the exact composition below, not a claim that its integration or authorization tests failed.

## Provenance and actual screenshots

| Artifact         | Exact source                                                                                | Result                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Prototype        | Unchanged HTML SHA `c853369da1250adf24a741a38c3d94d3c97a976c012c352732cf4dd8d924cb54`       | 36 baseline screenshots plus 5 pane/menu images; see sibling prototype-verification report                                       |
| Before / main    | `723ed6fea41138b604a9d333ebcd4a07b2202c36`                                                  | 36 actual captures in `screenshots-main/`; isolated provider-disabled stack3344; October25 12:21–12:22 AM Eastern                |
| After / combined | `eba2fba3eee223bb43c0eea5fe197e9569285ea9`, tree `016e8aeebd3b1f584cc7bd5a1036afcfeb8eac5c` | 36 actual captures in `screenshots-completed/`; isolated provider-disabled stack3349; exact pinned PR116+117+118+113 composition |

Use [comparison-gallery.html](comparison-gallery.html) to select a surface and viewport and inspect unchanged prototype, before, and after screenshots together. Each image links to its full resolution. The gallery labels non-equivalent state/data explicitly.

Both application stacks were freshly seeded with the same default fictional fixture before capture. Each browser performed one authorized `POST /api/auth/demo-sign-in`; every other non-GET/HEAD/OPTIONS request was blocked by the runner. No other mutation was attempted. No authored lessons, assignments, interventions, provider calls, or model output were created for these screenshots.

All 72 application captures completed with HTTP200 at their intended routes and no page JavaScript errors. Their document width equaled the requested viewport width. Next.js prefetch requests were aborted during successive navigation; these are retained in the request logs and do not establish a backend failure. Initial combined `networkidle` readiness timed out after login; that attempt's zero-capture manifest is preserved in `screenshots/report.json`. The final runners wait for the actual heading, font readiness and a brief paint interval instead. They do not claim that network-idle passed.

Viewports: **1440×1000, 1024×768, 390×844, 320×844**, device scale1, fresh headless Edge156.0.4314.42. These are CSS responsive viewports, not actual browser200% zoom or physical mobile devices.

## Severity-ranked visual defects and ownership

Owners are implementation PRs/workstreams, not invented teammate assignments. No application fix or remote issue/PR mutation was made.

| ID / priority | Finding and reproducible evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Owning PR/workstream                                                                          | Acceptance condition                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| V01 / P1      | **Global hierarchy remains a sidebar of eight peer destinations.** Login Demo teacher → `/teacher` or `/teacher/evidence` at1440. Combined has Teaching Desk/Evidence/Interventions/Lessons/Assignments/Students/Materials/Objectives in a242px sidebar. Prototype has horizontal Overview/Assignments/Lessons, then assignment-specific Progress/Student work/Interventions/Roster. Compare `desk-1440x1000.png` and `evidence-original-answer-1440x1000.png` with prototype counterparts.                        | Shared-shell owner coordinated through #114; current shell composition inherited through #116 | Repeat against the reviewed shared-shell snapshot. Preserve whole-course versus selected-assignment hierarchy across all owned surfaces.           |
| V02 / P1      | **Phone evidence does not transition into one selected pane.** Open exact original-answer URL from runner at390 or320. Combined renders all filters and the saved-response list ahead of the chosen record, with no Concerns/Details/Context pane switch and no persistent assignment bottom navigation. At320 the selected student's heading is y≈1751 and Original response y≈2132; at390 they are y≈1630 and y≈1987. Prototype presents the selected answer directly under its57px top bar and59px pane switch. | #116 evidence + shared-shell owner                                                            | Selected record must be discoverable without scrolling past the entire list; verify actual mobile pane transitions and focus on the updated shell. |
| V03 / P1      | **Desktop evidence lacks the reference context pane and bounded work area.** Exact original-answer route at1440: combined evidence block starts x278/y472 and uses330/794px two-column layout, with approved source/help/follow-up later inside the record. Prototype work area starts x0/y201 and uses330/750/360px list/record/context panes, individually scrollable in remaining799px. At1024 prototype context becomes a400px drawer; combined remains a285/471px two-column layout inside the sidebar shell. | #116                                                                                          | Restore explicit adjacent/drawer context and verify source/reading access at both desktop and tablet sizes without discarding original evidence.   |
| V04 / P2      | **Assignment hierarchy and typography remain structurally different.** `/teacher/assignments` at1440 has a35px heading, numbered workflow strip, a collapsible class-assignment card, filters, and a selected assignment section. Prototype has a26px heading and lesson→version→class hierarchy with status/participation/Open aligned in rows. The single seeded assignment limits count comparison, but the extra framing and hierarchy difference remain visible independently of count.                       | #117, coordinated with shared shell                                                           | Compare a populated multi-version/multi-class fixture after shell integration; settle explicit intended deviation or match reference hierarchy.    |
| V05 / P2      | **Inconsistent global spacing and phone heading scale.** Combined desktop top bar72px, main padding38px36px60px and sidebar242px replace prototype top58px and main padding24px28px56px. At390/320 combined top bar65px and horizontal20px main padding differ from57px and14/12px. Desk/Evidence/Lessons headings stay26px on phones versus prototype23px full-page/20px record headings.                                                                                                                         | Shared-shell owner; #116/#117/#118 for local heading overrides                                | Measure after shared-shell integration and unify the agreed type/spacing scale.                                                                    |

These differences are not explained by different student names or fewer fixture rows. Similar green colors do not resolve them. V01–V03 block a claim of complete Workbench v2.2 visual acceptance for this snapshot. They do not authorize competing application edits by the acceptance agent.

## Data/state differences — not automatically product defects

- Prototype Jamie Rivera/NET210 has three active assignments, a fourth inactive section, a populated library, multiple lesson versions and many student histories. The application seed has one inactive curated assignment, three fictional students, two students with responses, and five saved transmission responses. Main and combined show the same seeded identities; prototype counts are intentionally different.
- Prototype published lessonv3 and readingv1 are separate identities. Implementation's curated assignment displays immutable content hash `3bd292c1476f5becb658418b70ee36153cfce830`. The report does not relabel that hash as prototypev3.
- Both application lesson libraries contain **zero authored lessons and zero saved teaching materials**. Their empty-state screenshots are real; they cannot verify a populated #118 lesson workbench, published-version hierarchy, or lesson-to-assignment handoff. Those require the parent's cross-role authoring test fixture.
- The prototype intervention screenshot is approved-but-undelivered with two recipients and five evidence answers. Application seed has no intervention; screenshot comparison is valid for surrounding shell only. Approval, delivery, follow-up geometry and state fidelity remain unverified by this read-only pass.
- Main has no `/teacher/evidence` page. Its concept task uses `/teacher/insights`; its original answer task uses `/teacher/sessions/<id>#evaluation-<id>`. Combined uses the new `/teacher/evidence?...` route. These are task-level before/after comparisons, not identical-route captures.
- Default `/teacher/assignments` selects the only fixture assignment, so `assignments` and `assignment-selected` images may be identical. This is reported, not counted as two distinct data scenarios.

## What the before/after evidence does show

- Main Class overview becomes Teaching Desk with a priority list and contextual rail, replacing the previous pair of large summary cards. The candidate makes original-answer review more direct through a dedicated Evidence surface.
- The assignment slice introduces browse/filter controls, explicit inactive status, lesson/activation review, class progress and student-preview choices. It retains the surrounding old sidebar shell in this combination.
- Main and combined rendered their requested fictional teacher routes at all four sizes without page errors or document-wide horizontal overflow. Inner grid usability, keyboard traps and focus restoration are separate tests; screenshot width alone does not establish those properties.
- No assertion about authorization, provider behavior, student conversation regression, unsaved-work recovery, paid-call prevention on application actions, or full cross-role completion follows from this read-only visual capture.

## Reproduction

Run only while the corresponding isolated target has the exact manifest/source and freshly seeded fictional data. Existing installed Playwright and Edge paths are explicit in each runner. Use new output folders; preserve earlier reports.

```powershell
node .\capture-combined.mjs .\screenshots-combined-rerun
node .\capture-main.mjs .\screenshots-main-rerun
```

Each runner guards target origin, exact SHA and blank provider configuration, records its own SHA, actual requests, geometry, headings, links and screenshots, and blocks unapproved mutations. Logs/metrics are in each screenshot folder's `report.json`; corresponding `.txt` files preserve visible page text.

## Remaining visual gates

1. Integrate and recapture the reviewed shared-shell snapshot; the current screenshots do not include that future snapshot.
2. Use the parent's real provider-disabled authoring/intervention fixture to capture populated lesson, inactive→active assignment, original evidence and linked review states. Match prototype data shape where practical and keep exact source/version identities truthful.
3. Verify keyboard and focus restoration, actual200% browser zoom, long responses/reading, mobile pane switching, pending/failed operations and Back/Forward/reload on that combined snapshot. **Screen-reader verification remains unrun.**
4. Recheck changed surfaces at all four sizes, preserving current before/after evidence and assigning functional defects separately from layout differences.
