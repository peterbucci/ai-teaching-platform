# S3 screen and interaction checklist — before implementation

Base: N7 `d486fc029941567f81257d7b8717b1cb3dab09d4`, PR #133.
Prototype ZIP SHA-256: `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
The `before/` captures are the authenticated pinned application on a copied,
fictional database and the unmodified approved Main prototype. Providers disabled.

| Screen / interaction                                 | Actual baseline deficiency                                                                        | Planned parity / authority boundary                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| My Learning review rows                              | Objective label, date, view date, unloaded-status badge and description occupy many lines per row | Compact teacher tag/title/objective/action; disclose exact delivery/view and unloaded state without inferring completion                                            |
| Selected review desktop                              | Old sidebar Workspace; duplicate activity title/teacher tag; broad unstructured column            | Existing N1 focus shell, one title, local page navigation and exact-source context; numbered/paper-like content panels                                              |
| Selected review phone                                | Old workspace Menu and large repeated headings; start/answer far below context                    | N1 Pages/Reading controls, compact cards, full-width response actions and clear jump to fresh check                                                                 |
| Instructions and objective                           | Valid approved text, weak grouping                                                                | Keep exact text and version; improve panel hierarchy and objective label                                                                                            |
| Explanation and evidence                             | Source excerpts disconnected from explanation                                                     | Style both clearly; retain controller DOM order/visibility acknowledgment. Do not duplicate excerpts in a separate pane                                             |
| Practice / fresh question                            | Existing practice questions and separate fresh-check preview                                      | Keep exact prompts. Prototype's separate exercise/practice fields and explanation-first sequence are a contract difference, requiring owner coordination to reorder |
| Original submitted response                          | Exact text already preserved; undifferentiated result panel                                       | Paper/serif original response, separate accepted feedback/result markers, uncertainty and assistance visible                                                        |
| Fresh-check actions                                  | Existing explicit start, sole composer, submit/status/retry                                       | Retain unchanged controller, one instance and IDs; add navigation only, never proxy submission                                                                      |
| Unanswered / pending / failed / uncertain / accepted | Existing distinct runtime states                                                                  | Test each through actual auth/services; do not show prototype's simulated evaluation as real                                                                        |
| Unavailable                                          | Existing error route in old frame                                                                 | N1 shell and honest error with return links; no stale activity body                                                                                                 |
| Return context                                       | Only generic My Learning link                                                                     | Review-local allowlisted Notebook/My Learning return context, exact native links; no S1/S2 or N0 edits                                                              |
| Responsive / zoom                                    | Baseline reference/application captured at 1440×1000, 1024×768, 390×844, 320×844                  | Compare hierarchy, controls, keyboard access and native 200% zoom; no acceptance based solely on overflow                                                           |

Fictional-content differences: actual water-state uploaded lesson vs prototype
networking lesson; different approved title/objective/practice/source count;
actual delivery dates and account; several accumulated test reviews vs one sample.
Do not copy Jamie Rivera, objectives O3/O4, Maya's earlier answers, mock completion
labels, prepared feedback or simulated conversation into application records.

Prototype scenarios inspected in source: maya-home, maya-review,
maya-review-check, maya-review-result, maya-unavailable, noor-review-pending and
aisha-review-result. Capture and interaction results after implementation are
recorded separately; this checklist alone is not acceptance.
