# Intervention screenshots

All after images show the actual production application at `b0608f6`, with fictional data and synthetic provider seams. See [verification](VERIFICATION.md), [native execution](native/EXECUTION.md), and [reference provenance](reference/provenance.json). Prototype and before images use different fixtures/states; no identical-data or pixel-parity claim is made.

## Prototype, before and after

| Size        | Actual prototype, approved                                          | PR #122 before, delivered                                | After, approved                                                        | After, delivered                                             |
| ----------- | ------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1440 × 1000 | [Prototype](reference/prototype-approved-undelivered-1440x1000.png) | [Before](reference/pr122-before-delivered-1440x1000.png) | [Approved](native/journey/approved-undelivered-page-top-1440x1000.png) | [Delivered](native/journey/delivered-page-top-1440x1000.png) |
| 1024 × 768  | [Prototype](reference/prototype-approved-undelivered-1024x768.png)  | [Before](reference/pr122-before-delivered-1024x768.png)  | [Approved](native/journey/approved-undelivered-page-top-1024x768.png)  | [Delivered](native/journey/delivered-page-top-1024x768.png)  |
| 390 × 844   | [Prototype](reference/prototype-approved-undelivered-390x844.png)   | [Before](reference/pr122-before-delivered-390x844.png)   | [Approved](native/journey/approved-undelivered-page-top-390x844.png)   | [Delivered](native/journey/delivered-page-top-390x844.png)   |
| 320 × 844   | [Prototype](reference/prototype-approved-undelivered-320x844.png)   | [Before](reference/pr122-before-delivered-320x844.png)   | [Approved](native/journey/approved-undelivered-page-top-320x844.png)   | [Delivered](native/journey/delivered-page-top-320x844.png)   |

## Required lifecycle states

| Size        | Private draft                                                  | Edited and saved                                                   | Uploaded follow-up: original                                         | Uploaded follow-up: later response                                    |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1440 × 1000 | [Private](native/journey/private-draft-page-top-1440x1000.png) | [Edited](native/journey/edited-saved-draft-page-top-1440x1000.png) | [Original](native/followup/followup-original-expanded-1440x1000.png) | [Follow-up](native/followup/followup-response-expanded-1440x1000.png) |
| 1024 × 768  | [Private](native/journey/private-draft-page-top-1024x768.png)  | [Edited](native/journey/edited-saved-draft-page-top-1024x768.png)  | [Original](native/followup/followup-original-expanded-1024x768.png)  | [Follow-up](native/followup/followup-response-expanded-1024x768.png)  |
| 390 × 844   | [Private](native/journey/private-draft-page-top-390x844.png)   | [Edited](native/journey/edited-saved-draft-page-top-390x844.png)   | [Original](native/followup/followup-original-expanded-390x844.png)   | [Follow-up](native/followup/followup-response-expanded-390x844.png)   |
| 320 × 844   | [Private](native/journey/private-draft-page-top-320x844.png)   | [Edited](native/journey/edited-saved-draft-page-top-320x844.png)   | [Original](native/followup/followup-original-expanded-320x844.png)   | [Follow-up](native/followup/followup-response-expanded-320x844.png)   |

## Phone pane navigation

| State / size                   | Evidence                                                             | Activity                                                             | Steps                                                          |
| ------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| private-draft · 390x844        | [Evidence](native/journey/private-draft-evidence-390x844.png)        | [Activity](native/journey/private-draft-activity-390x844.png)        | [Steps](native/journey/private-draft-steps-390x844.png)        |
| private-draft · 320x844        | [Evidence](native/journey/private-draft-evidence-320x844.png)        | [Activity](native/journey/private-draft-activity-320x844.png)        | [Steps](native/journey/private-draft-steps-320x844.png)        |
| edited-saved-draft · 390x844   | [Evidence](native/journey/edited-saved-draft-evidence-390x844.png)   | [Activity](native/journey/edited-saved-draft-activity-390x844.png)   | [Steps](native/journey/edited-saved-draft-steps-390x844.png)   |
| edited-saved-draft · 320x844   | [Evidence](native/journey/edited-saved-draft-evidence-320x844.png)   | [Activity](native/journey/edited-saved-draft-activity-320x844.png)   | [Steps](native/journey/edited-saved-draft-steps-320x844.png)   |
| approved-undelivered · 390x844 | [Evidence](native/journey/approved-undelivered-evidence-390x844.png) | [Activity](native/journey/approved-undelivered-activity-390x844.png) | [Steps](native/journey/approved-undelivered-steps-390x844.png) |
| approved-undelivered · 320x844 | [Evidence](native/journey/approved-undelivered-evidence-320x844.png) | [Activity](native/journey/approved-undelivered-activity-320x844.png) | [Steps](native/journey/approved-undelivered-steps-320x844.png) |
| delivered · 390x844            | [Evidence](native/journey/delivered-evidence-390x844.png)            | [Activity](native/journey/delivered-activity-390x844.png)            | [Steps](native/journey/delivered-steps-390x844.png)            |
| delivered · 320x844            | [Evidence](native/journey/delivered-evidence-320x844.png)            | [Activity](native/journey/delivered-activity-320x844.png)            | [Steps](native/journey/delivered-steps-320x844.png)            |

## Interaction evidence

- Delivered Steps with explicit scrollTop 0: [1440](native/steps-top/delivered-steps-top-1440x1000.png), [1024](native/steps-top/delivered-steps-top-1024x768.png), [390](native/steps-top/delivered-steps-top-390x844.png), [320](native/steps-top/delivered-steps-top-320x844.png).
- Actual 200% zoom measurements passed; a complete visual capture remains unavailable. [Cropped capture](native/zoom/actual-native-zoom-200-708x454.png), [blank CDP appendix](native/zoom-appendix-capture-failed/actual-native-zoom-200-cdp-1-1416x908.png), and [explicit limitation](native/EXECUTION.md#zoom-and-screenshot-limitations). Neither image establishes full-frame visual acceptance.

- [Tablet contextual Steps](native/journey/private-draft-context-open-1024x768.png) and [exact Evidence after closing the drawer](native/journey/steps-inspect-saved-evidence-1024x768.png).
- [Phone exact original citation](native/journey/citation-exact-original-390x844.png); native Back focus/scroll restoration is asserted in the receipt.
- [Recovered unsaved draft](native/journey/recovered-unsaved-draft-320x844.png) and [unsaved student preview](native/journey/unsaved-student-preview-320x844.png).
- [Invalid save reveals Activity on phone](native/journey/invalid-save-reveals-teacher-guidance-320x844.png) and [tablet](native/journey/invalid-save-reveals-teacher-guidance-1024x768.png). Focus moves to the form; the lower private-guidance field may still require scrolling.

Lifecycle and follow-up panels intentionally scroll independently. A screenshot with a clipped status card is a retained-scroll capture, not evidence of missing status. The receipt records exact geometry; the native execution report supplies request outcomes and test boundaries.
