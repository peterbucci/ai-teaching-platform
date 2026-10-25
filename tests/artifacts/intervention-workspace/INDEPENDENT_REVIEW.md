# Intervention workspace source review

Reviewed on October 25, 2026 against baseline
`dd7401edcabe80b8308da30431ae06f05f0f1a9b`. Final source inspected:
`b0608f6c69f47c48ed85876a992ccc3011bd2a66`.

The follow-up-label subagent reviewed the workspace and editor implementation
independently of their authors. That reviewer authored the concept-label helper;
the label observations below are therefore a self-check, not a second independent
review of that helper.

## Scope and resolved findings

Read-only comparison of intervention-owned page, workspace, editor, evidence,
follow-up, concept-label and CSS changes; shared pane/restoration contracts and
the installed Next 16.4.3 history implementation were inspected as dependencies.
No shared shell, service, authentication, schema or student files were edited.

| Finding                                                                                                                                                                                                            | Resolution confirmed in source                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Citation navigation copied the shell's opaque history-entry identity into a new entry, allowing the new position to replace the prior entry's saved position.                                                      | `e1228eb3219b4aa45c33ed50ccd69dd163ec0b87` changes citation navigation to `pushState(null, ...)`, matching the shared pane contract.                                    |
| Pane reveals forwarded Next's private `__NA` history marker. Next treats that as an internal write and skips URL-to-hook synchronization, so the address bar could change while the visible pane stayed unchanged. | `1bbc8671eddafc1296185639e55572fa1d2e8c51` changes both `revealActivity()` and citation `navigate()` to `replaceState(null, ...)`. Both exact occurrences were checked. |

Earlier review feedback also corrected initial hash focus when the requested
pane already matches the anchor, and prevents a handled focus request from
overriding a subsequent pane choice. No additional actionable source regression
was found in this review after the two history fixes.

## Preserved boundaries

- Generation, save, recipient selection, approval and delivery remain separate
  operations. Existing request identities, pending reconciliation, actor-scoped
  recovery, revision checks and service authorization remain in place.
- One editor controller composes the Activity and Steps slots. Pane changes hide
  mounted content; they do not recreate the editor or follow-up controller or
  invoke a generation, save, approval or delivery mutation.
- Steps contains one form-associated Save button. The editable form remains
  mounted across preview changes. Invalid-field handling opens required details,
  reveals Activity and preserves the draft without submitting an invalid form.
- Exact saved evidence remains the display source. Follow-up concept names are
  accepted only when the saved comparison and question content references match
  the original evidence and the concept belongs to that question; absent or
  mismatched names use an explicit fallback. IDs and stored evidence are unchanged.

## Supplementary final-source review

Reviewed `5f2d8dc..b0608f6` without executing the application or heavy checks.
No additional actionable source regression was found:

- Focus requests are now marked handled only after the intended element actually
  receives focus. A failed attempt behind the tablet Steps modal remains pending
  for the pane change, when the shared layout effect closes that modal.
- Removing the repeated saved-activity heading preserves the student preview's
  title, the editable title field and teacher-only review. The saved activity
  section retains the existing anchor ID, a programmatic focus target and an
  accessible activity name; preparation still has its heading.
- Compact evidence summaries retain the same saved counts, prior-scope warning,
  selection controls and related/contrary selection semantics. Enrollment,
  expansion explanation, scope note and exact source/version identity remain in
  the combined disclosure. Original responses, assistance and uncertainty are
  unchanged. Newly included generation evidence still produces its notice.
- Height rules are confined to the intervention workspace and outrank the shared
  body rules. The tablet modal override follows the equally specific general
  tablet rule; mobile uses the shell's bottom-navigation height and safe-area
  inset. Shared overflow behavior remains enabled. These offsets depend on the
  current shell geometry and still need the actual viewport/zoom checks below.

The preceding `5f2d8dc` HTTP-regression change was also reviewed: it replaces an
obsolete introduction marker with the three shared pane headings and separate
lifecycle controls. Authentication, exact request/draft identity, private-guidance
denial, rejected-request boundaries, unchanged database counts and original
evidence assertions are preserved. The final real-browser and component reruns
remain pending at the time of this supplementary review.

## Report and provenance preparation

The retained [GitHub check receipt](quality/github-b060-checks.json.raw.txt)
reports two successful checks attached to `b0608f6`. Its quality log records
573 passing CI tests. This is distinct from the earlier isolated `5f2d8dc`
receipt with 563 tests; neither count is a final local browser result.

The final isolated `b0608f6` [quality receipt](quality/final-b060-results.json.raw.txt)
records all six checks passing: tests, lint, type checking, formatting, content
validation and production build. The retained [test log](quality/final-b060-test.log.raw.txt)
confirms **563 passed, 0 failed, 0 skipped**; the
[content log](quality/final-b060-content-check.log.raw.txt) confirms **293 checks**;
the [build log](quality/final-b060-build.log.raw.txt) confirms a successful
production build. These local counts are separate from the 573-test CI context.
All seven copied logs/receipt files were inspected for credentials and their
SHA-256 values match the private originals. The receipt file hash is
`9779b9354150f53c568c783a3d283d7e47a8819e6b1e063c9b702758202236ee`.
Earlier `5f2d8dc` evidence is preserved. These checks do not establish database,
Docker, browser or actual-model acceptance.

A bounded publication audit inspected artifact ownership, credential patterns,
fictional-data labels, image metadata and Markdown relative links. No credential
values, private runtime data directories or project-reference content were found.
Runner-source matches were runtime random generation or variable references,
not secret values. Historical local paths and released guard identity receipts
remain provenance, not authentication credentials.

The reviewed [PostgreSQL provenance](runtime/native-postgres-provenance.json) was
copied byte-for-byte from the private verification bundle: file SHA-256
`a64dbf48683928dd7129978d24d7093a201207b40291ead2e86a80b3d3e11caf`.
The [publication allowlist](runtime/PUBLISH_ALLOWLIST.md) is also an exact copy:
`d9f6ce5b7a50da5a7062a39fcef9c0c9ff05a916cdb38c5106b9b7a6346e5d1e`.
Their contents contain official binary-source URLs/hash and publication rules,
not credentials or database files. Publication links were checked locally.
At this audit checkpoint, the runtime guide labeled final execution as pending
and distinguished the earlier executable snapshots. No executable helper was
replaced during this audit; it does not establish a runtime pass. The root agent
subsequently published the final executed snapshots and separate receipts below.

## Native visual review of final b060 captures

The editor/composition subagent inspected the final native screenshots in
`intervention-native-browser-final-b060-01` without launching a browser or
changing the application. This is a visual self-check by a presentation author,
separate from the independent source review above. Coverage included 320px and
390px private, edited, approved-undelivered and delivered states, plus tablet
Steps and focus-navigation captures.

- The original response question now begins around 500px on both phones; the
  earlier 320px capture began around 750px. The student objective begins around
  439px at 320px, compared with approximately 609px before compaction. There is
  one student-facing activity title, and the three Activity-view controls fit
  one row. Recovery and delivery notices remain visible when applicable.
- The native geometry receipt places pane-body bottoms exactly at the top of
  the fixed navigation: 764px at 320 × 844 and 779px at 390 × 844. The inspected
  images show no content behind that navigation. The tablet Steps drawer fits
  the viewport, and its inspection capture shows the drawer closed with the
  Evidence heading visible; actual focus is established by the native assertions,
  not by assuming a visible focus ring in every screenshot.
- Steps remains denser than the approved prototype's compact completed rows.
  Approval/delivery details require more pane scrolling, and delivery is below
  the first viewport at 320px. Some approved-state captures deliberately retain
  pane scroll, clipping or omitting the status card at the top. They demonstrate
  preserved position and must not be presented as fresh top-of-pane comparisons.
- The invalid-Save screenshots show Activity's edit form revealed. The actual
  invalid private-guidance field is below the captured viewport. An open details
  element or a locator's DOM visibility does not prove that field is in view;
  these images must not be described as placing the missing field in view.

This visual review identified no additional functional blocker. The density and
invalid-field-placement limitations remain explicit; no application fix was made
during this review. This section makes no claim that final native 200% zoom has
passed; that requires its separate executed receipt.

## Runtime verification scope

The source-review portions above confirm inspected code; the visual addendum
inspects retained captures. No application server, database, provider, build or
heavy test was run by these reviewers during this review. Component tests with
mocked Next hooks cannot establish actual Next history synchronization.

Run the built Next application at 1440 × 1000, 1024 × 768, 390 × 844 and
320 × 844, plus actual 200% browser zoom. Verify cross-pane evidence citations,
Back/Forward and reload focus, Steps-to-Evidence inspection, invalid Save returning
to Activity, and blocked unsaved navigation. Verify keyboard order, tablet Escape
and focus return, and preserved drafts/recipients through pane changes. Cover
private, edited, approved-undelivered, delivered and follow-up states; confirm
that browsing and switching panes produce no mutation or provider replay.

Use the separate runtime/browser reports for executed outcomes. The scoped native
suite set is `interventions:check`, `interventions:lessons:check`,
`interventions:http`, and `interventions:approval:lessons --setup-fixtures
--with-followups`, with report paths explicitly redirected to private artifacts.
The direct legacy `interventions:approval` and `interventions:outcomes` aliases
write hardcoded reports inside the source tree and are unsuitable for the guarded
runner without a separate supported output strategy. Synthetic checks do not
claim actual-model or educational-effectiveness verification.

## Final publication note from the root agent

The [native execution chain](native/EXECUTION.md) now records the completed
requested-base application checks and final owned-process shutdown. The root
agent inspected desktop private/approved, tablet delivered/original follow-up,
phone later follow-up and both zoom capture attempts. The ordinary 200% image is
cropped and the bounded CDP appendix is blank; neither is a full-frame visual pass.
Native zoom interaction/layout measurements passed independently. This final
packaging note does not imply an additional independent review or conceal those
capture limitations. Raw receipts and helper snapshots are preserved, including
the appendix's dimensions-only pass status and its overriding visual failure.
