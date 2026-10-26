# Evidence index

These are fictional, provider-disabled acceptance artifacts from separately built source snapshots. See [the acceptance report](../REPORT.md) for pass/fail/unrun decisions and [the defect report](../DEFECTS.md) for owner routing. Reports with failed cases remain failed; a later corrected harness run does not erase them.

- [Main environment](main/manifest.json) and [PR116 environment](pr116/manifest.json)
- [Main integration](main/runs/2026-10-25T03-12-44-205Z-integration/results.json) and [PR116 integration](pr116/runs/2026-10-25T02-59-19-428Z-integration/results.json)
- [Main linked follow-ups](main/runs/2026-10-25T03-26-18-968Z-approval/approval-details.json) and [PR116 linked follow-ups](pr116/runs/2026-10-25T03-09-35-377Z-approval/approval-details.json)
- [Main manual authoring](main/browser-authoring/report.json) and [PR116 manual authoring](pr116/browser-authoring/report.json)
- [Main teacher original run](main/browser-teacher/report.json), [main exact-text confirmation](main/browser-teacher-confirmation/report.json), [PR116 teacher lifecycle](pr116/browser-teacher-lifecycle/report.json)
- [Main accepted-result supplement](main/browser-student-result-main/student-result-report.json)
- [Main student core](main/browser-student/student-browser-report.json), [main adjudication](main/browser-student/student-browser-adjudication.json), [PR116 student core](pr116/browser-student/student-browser-report.json), [PR116 accepted-result supplement](pr116/browser-student/student-result-report.json)
- [Main priority-card path](main/browser-priority-confirmation/report.json) and [PR116 priority-card path](pr116/browser-priority-confirmation/report.json)
- [PR116 exact Workbench evidence](pr116/browser-workbench-final2/report.json), [actual priority-card entry](pr116/browser-priority/report.json), [real61response scope service check](pr116/oversized-evidence.json), [real61response phone narrowing](pr116/browser-oversized-verified/report.json)
- [Native zoom and keyboard report](../ACCESSIBILITY_REPORT.md)
- [PR117 independent assignment report](../PR117_REPORT.md) and [environment](pr117/manifest.json)
- [PR118 independent Lessons report](../PR118_REPORT.md) and [environment](pr118/manifest.json)
- [Combined acceptance boundary](../COMBINED_REPORT.md), [source composition](combined/composition.json), [interrupted integration](combined/runs/2026-10-25T03-47-12-987Z-integration/results.json), and [storage incident](combined/STORAGE_INCIDENT.json)

Each browser report lists its screenshot filenames. The folders include all four requested widths for reading, student composer and teacher shell views; PR116 also has intervention editor and selected evidence captures at all four widths. Screen-reader compliance is not established.

Representative screenshots:

| Workflow                       | Main                                                             | PR116                                                                 |
| ------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Student composer1440×900       | [image](main/browser-student/composer-1440x900.png)              | [image](pr116/browser-student/composer-1440x900.png)                  |
| Student composer1024×768       | [image](main/browser-student/composer-1024x768.png)              | [image](pr116/browser-student/composer-1024x768.png)                  |
| Student composer390×844        | [image](main/browser-student/composer-390x844.png)               | [image](pr116/browser-student/composer-390x844.png)                   |
| Student composer320×844        | [image](main/browser-student/composer-320x844.png)               | [image](pr116/browser-student/composer-320x844.png)                   |
| Approved reading390px          | [image](main/browser-authoring/17-reading-390.png)               | [image](pr116/browser-authoring/11-reading-390.png)                   |
| Exact selected evidence320px   | See main session inspection                                      | [image](pr116/browser-workbench-final2/selected-response-320.png)     |
| Intervention editing320px      | Initial capture was preview; no edit screenshot claim            | [image](pr116/browser-teacher-lifecycle/26-intervention-edit-320.png) |
| Native 200% composer and focus | [image](main/browser-accessibility/09-composer-keyboard-200.png) | [image](pr116/browser-accessibility/09-composer-keyboard-200.png)     |
| Initial save401 preserved text | [image](main/browser-student/answer-save-401-preserved.png)      | [image](pr116/browser-student/answer-save-401-preserved.png)          |

[inventory.json](inventory.json) records per-file SHA256 and byte counts for collected artifacts. Exact original report/log bytes are preserved. JSON requiring repository formatting has an adjacent .raw.json.log original; the readable .json receives only whitespace changes. The collector verifies equal parsed JSON values, and the inventory records transformations and both hashes. A verification-local formatter configuration selects the JSON.stringify layout without changing application configuration. The initial accessibility capture is retained separately from the final measured run. Private environment files, browser profiles, authentication state and endpoint files are excluded. The collector compares textual artifacts against actual generated credentials before publication.

PR118 includes40 viewport samples across nine teacher stages and reading, plus measured native200% navigation. PR117 has four reading viewport screenshots, but its new management-screen matrix is unrun. Combined has no browser screenshots because runtime testing halted first. These gaps are not filled with another source's images.

The larger unselected original harness attempts remain in ignored local state under `C:/Users/sb128/Desktop/LearningPlatform/.setup/acceptance-{main,pr116,pr117,pr118,combined}`. Their causes and remaining unrun cases are documented; they are not silently counted as product passes. This bundle includes initial student harness failures, failed quality/audio/approval-preparation runs, both incomplete PR117 management attempts, and the interrupted combined integration run.
