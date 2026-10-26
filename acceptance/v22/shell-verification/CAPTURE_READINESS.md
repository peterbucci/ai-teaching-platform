# Shared-shell capture readiness

Prepared only; no browser, database, build or network request has run for this target.

## Read-only hooks identified from the pinned source

| Purpose                                               | Actual selector or route                                                                                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Course links                                          | `nav[aria-label="Course workspace"]` with Overview/Assignments/Lessons                                                                                                                          |
| Assignment links                                      | `nav[aria-label="Assignment workspace"]` with Progress/Student work/Interventions/Roster                                                                                                        |
| Phone course or assignment links                      | `nav[aria-label="Course workspace mobile"]` / `nav[aria-label="Assignment workspace mobile"]`                                                                                                   |
| Scope dialog opener                                   | `button.tw-scope-switch` or `button.tw-assignment-switch`; dialog `#teacher-workspace-switcher`, heading Switch workspace, close button Close workspace switcher                                |
| Evidence view links                                   | `nav[aria-label="Student work views"]`, All answers/By idea/Concerns                                                                                                                            |
| Library tool links                                    | `nav[aria-label="Lesson tools"]`, Lessons/Materials/Objectives                                                                                                                                  |
| Shared pane slots, if any page actually consumes them | `.tw-panes`, `tablist[aria-label="Workspace panes"]`; `workspacePane=navigation                                                                                                                 | main   | context`; context opener Open {label} |
| Actual lesson pane controller                         | `.aw-workspace[data-active-pane]`, `nav[aria-label="Authoring panes"]` buttons Outline/Editor/Reading; Focused editor and Contextual source reading regions; Close reading and return to editor |
| Actual class progress pane controller                 | `.ap-workbench[data-pane]`, Class progress views / Details regions, `#ap-open-details`, `.ap-close-details`                                                                                     |
| Lesson source and sequencing                          | `/teacher/lessons/{lessonId}?step=source` or `?step=sequence`                                                                                                                                   |
| Lesson immutable publication                          | `/teacher/lessons/{lessonId}?version={exactPublishedVersion}`                                                                                                                                   |
| Saved material version                                | `/teacher/materials/{documentId}?version={integer}`                                                                                                                                             |
| Selected assignment                                   | `/teacher/assignments?assignment={id}&view=progress                                                                                                                                             | review | preview`                              |
| Exact intervention                                    | `/teacher/interventions?draft={actualDraftId}` plus original authorized assignment context as supplied by root                                                                                  |

## Hooks needed from root

1. Explicit runtime-ready signal for3350 with no concurrent restart/mutation during the initial36captures; external runtime state directory if it is not `runtime-shell`.
2. After authoring: exact saved source and version, lesson ID and published version, assignment ID and state, and GET URLs already observed in the fixture results.
3. Intervention draft ID and capture windows before approval, after approval but before delivery, and after delivery/follow-up. Alternatively provide separate real fixture records retained at those stages. Capture only; no assistant-created competing writes.
4. The current fictional actor's authorized class context and exact follow-up URL. No credentials or browser storage are needed because the demo sign-in button is used.

The prepared default runner compares the same fixed seed identities as the prior main/combined pass. Its selected-assignment route now explicitly requests `view=progress` so the new assignment-level shell is actually exercised; this differs from the first snapshot's default review selection and will be labeled in the report/gallery.
