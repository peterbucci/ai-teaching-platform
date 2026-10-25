# Teaching Workbench v2.2 — exported prototype baseline

Captured October 25, 2026, 12:14–12:16 AM Eastern. This report verifies the actual exported design, not the application. All data are the export's built-in fictional records. No model requests, application API calls, source edits, or student-data imports were made.

## Exact reference and reproducibility

- Archive: `C:/Users/sb128/Downloads/Workbench v2.2 · clickable prototype (desktop — start here)-html.zip`
- Archive SHA-256: `74bc909dffba839d6850823b35b8c8fc3c67adf1a64b14d67f245560fb87768f`
- Unchanged `export/Main.dc.html` SHA-256: `c853369da1250adf24a741a38c3d94d3c97a976c012c352732cf4dd8d924cb54`
- Archive README explicitly identifies Workbench v2.2; the HTML title remains `Learning Pulse · Teaching Workbench v2`. Both refer to these exact bytes.
- `capture-prototype.mjs` captured 36 screenshots: nine states at 1440×1000, 1024×768, 390×844, and 320×844. The original capture used loopback port 3349; that server was stopped immediately afterward to release the integration port. Reproduction must use assigned port 3352 through `PROTOTYPE_URL`.
- `screenshots/report.json` records browser version, actual CSS viewports, device scale 1, loaded font families, requests, errors, focus, navigation, and element geometry for each capture. Every state captured successfully with no page errors or failed resource requests. Inter loaded; Source Serif 4 loaded in states that render serif reading/answers. External Google Fonts resources were requested normally and were not substituted or fabricated. The favicon's missing file does not affect reference layout.
- `prototype-interaction-checks.mjs` records actual keyboard and pane/menu observations in `interaction-checks/report.json` and captures five additional drawer/menu images.

Run from this folder with the existing bundled Playwright package and installed Edge:

```powershell
python -m http.server 3352 --bind 127.0.0.1 --directory .\export
# In a second terminal; choose a new output folder for every run.
$env:PROTOTYPE_URL = 'http://127.0.0.1:3352/Main.dc.html'
node .\capture-prototype.mjs .\screenshots-rerun
```

The browser is a fresh, headless desktop context sized to each CSS viewport. These are responsive-layout captures, not claims of a real mobile device, native 200% browser zoom, or screen-reader verification. Windows' restricted browser process could not start, so capture ran with the approved host browser process. The first sandbox-only server also could not be reached by that process; the successful run used a host loopback server.

## Captured states and equivalent application fixtures

Each row has four `screenshots/<state>-<width>x<height>.png` images and matching extracted `.txt` files. The counterpart must preserve state and data shape before comparing density or typography; shared colors alone do not establish fidelity.

| State filename                  | Real navigation used            | Fictional reference data / comparison requirement                                                                                                                                 |
| ------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overview`                      | Export initial screen           | Jamie Rivera; NET 210 Fall 2026; three active assignments, six decisions, three evaluation-check groups, three missing-work groups; separate assignment rail and resumable drafts |
| `assignments`                   | Whole-course Assignments        | Bandwidth and Latency published versions 3/2/1; four section assignments under v3; draft-only lessons shown separately                                                            |
| `assignment-section-a`          | Assignments → Open Section A    | Active Section A; 18 students, 16 answered, 68 answers, 66 evaluated, two pending/failed; class grid and contextual Details                                                       |
| `assignment-inactive-section-c` | Assignments → Open Section C    | Inactive Section C with 12 students and explicit activation decision; compare against inactive assignment, not active class progress                                              |
| `lessons`                       | Whole-course Lessons            | Three lessons and three materials; published vs draft status, objective/question counts, exact reading versions and attribution                                                   |
| `lesson-published`              | Lessons → Bandwidth and Latency | Published lesson v3, 5 objectives/15 questions, reading v1/13 passages; 4 assigned classes and form to save an inactive assignment                                                |
| `evidence-concern`              | Overview → second Look into it  | Section A transmission/cable-length concern; 6 of 15 evaluated students, 11 linked answers, supporting/unclear/contrary evidence; question context and exact reading passages     |
| `evidence-original-answer`      | Concern → first Read in full    | Maya Chen's original NP-TX-01 answer, October 20; original question/answer, two concept results, help history, passage context                                                    |
| `intervention-approved`         | Overview → Review and deliver   | Queuing review v2; Elijah Brooks and Lena Fischer; 5 evidence answers, 2 recipients; approved but not delivered; separate delivery step                                           |

The export uses a published lesson **v3** and reading **v1**; do not mislabel implementation lesson/source IDs as equivalent just to match this display. If implementation data have different counts, versions, titles, or status, report those differences separately and compare geometry only where the content shape is comparable. No implementation fixture was changed by this task.

## Navigation, page structure, and geometry authority

| Concern                     | Measured reference behavior                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Global hierarchy            | Whole-course **Overview / Assignments / Lessons**. Evidence and interventions belong to a selected assignment rather than separate, unscoped global destinations.                                                                                                                                      |
| Assignment context          | Desktop assignment band includes section + lesson + version, active/inactive status, participation counts, and **Progress / Student work / Interventions / Roster**. A 44px path strip carries origin and contextual back/forward controls.                                                            |
| 1440 overview               | 58px top bar; content starts at y=58; main area 1060px and assignment/draft rail 380px. Main padding 24px 28px 56px. Priorities are dense ruled rows with reason, denominator, state, and action.                                                                                                      |
| 1440 evidence/intervention  | Top bar 58px + assignment band 99px + path strip 44px = content y=201. Three panes are **330 / 750 / 360px**; independently scrollable inside remaining 799px. Evidence left list, central record, right context. Intervention left evidence, central activity, right ordered approval/delivery steps. |
| 1024 evidence               | Same desktop scope hierarchy; content y=201. Left list 300px + record 724px. Context is a user-opened 400px drawer at x=624, not permanently squeezed alongside the record.                                                                                                                            |
| 1024 intervention           | Evidence drawer is hidden initially; activity and 340px Steps remain visible. Different pane priority from evidence is deliberate.                                                                                                                                                                     |
| <=800 transition            | Single active pane; sticky 57px mobile top bar with menu, back, truncated scope/title, and find. Scope band/path collapse into the title/menu. A 59px pane switch follows the top bar. Sticky bottom navigation reflects the current global or assignment level.                                       |
| 390 mobile                  | Evidence uses Concerns / Details / Context; detail pane spans 390px; assignment bottom bar 65px. Approved intervention opens Steps so the delivery decision is discoverable.                                                                                                                           |
| 320 mobile                  | Same navigation with no document-wide horizontal overflow; detail pane spans 320px. Assignment bottom bar grows to about 80px because Student work wraps. Main horizontal padding reduces from 14px to 12px.                                                                                           |
| Reading and answers         | Inter UI text; Source Serif 4 for original answers and reading excerpts; stable passage IDs, question IDs, source version, help context, and cited text remain adjacent or accessible in Context.                                                                                                      |
| Typography                  | UI base 15px / 23.25px. Full-page heading 26px / 31.2px, weight650; mobile heading23px. Record heading22px / 27.5px, weight650; mobile20px / 25px.                                                                                                                                                     |
| Lessons/assignments density | Lesson/source tables and lesson→version→assignment hierarchy, not generic equal-size dashboard cards. At phone widths an assignment becomes a compact class/status/action card with participation underneath.                                                                                          |

`screenshots/report.json` contains exact geometry beyond these landmarks. All 36 captures had document scroll width equal to the viewport width. This alone does not prove every inner grid is usable; the class grid can scroll independently.

## Keyboard and focus observations, kept separate from application acceptance

- Desktop Tab reached Overview → Assignments → Lessons → Find → Prototype → All sections → Section A → Section B → Online section, in that order.
- Keyboard Enter activated Assignments while focus remained on the still-present Assignments navigation button. The export intentionally retains focus when the activating control remains visible, and uses a live region to announce the destination. In the fresh pointer-navigation captures, replaced controls yielded focus to the destination heading.
- Tablet Context was keyboard-opened; closing the context drawer with its Close button left focus on BODY in this tested export. This is a prototype limitation, not permission to reproduce lost focus in the application.
- Mobile Context and Details switching worked, showed one pane, and retained focus on the selected pane control. Supplemental screenshots show actual context content at390/320.
- Mobile Menu opened. Escape left it open at both390 and320 in the observed export. This is a prototype limitation; do not mark application keyboard behavior acceptable merely because the export has the same problem.
- The internal Back observation restored a previously focused overview filter. Browser Back/Forward is not demonstrated by a mockup's internal Back. The export explicitly calls its links simulated and does not change the browser address bar.
- Native 200% zoom and screen-reader verification remain **unrun**. These screenshots do not establish application unsaved-work recovery, pending-operation reconciliation, authorization, paid-call prevention, or backend persistence.

## Acceptance interpretation

This is a successful **reference capture**, not a visual-acceptance pass for any PR. Pair actual implementation screenshots from pinned commits with these files, and report navigation/geometry/typography differences separately from functional defects. Application routes, version integrity, cross-role isolation, and combined-branch behavior need their own real tests.
