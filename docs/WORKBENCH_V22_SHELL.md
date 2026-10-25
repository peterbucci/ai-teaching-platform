# Workbench v2.2 shared shell

Coordination: [#114](https://github.com/peterbucci/ai-teaching-platform/issues/114).
Original stacked base: repaired PR #116 at `76b11ddfa0ce784f70290c0746efd94c7042f6fc`.
The user-approved dependency merge includes PR #116's later repair
`94e4e534ea4d68d86ea0810067497bf07258e6d2`; the original base remains an ancestor.
This successor owns shared presentation and the explicitly assigned session
return correction below; PR #116 itself is unchanged. Other page-owned files
are preserved from the dependency.

## Design and authority

The actual attached `Main.dc.html` export was rendered, not reconstructed.
SHA-256: `c853369da1250adf24a741a38c3d94d3c97a976c012c352732cf4dd8d924cb54`.
The October 23 Teacher Experience Blueprint and October 24 Workbench Fidelity
Audit were consulted. The prototype and the user's shell instruction supersede
their older six-peer/sidebar and drawer-only navigation descriptions.

The server layout calls existing `requireActor`, `teacherAssignments` and
`assignmentReview` services. It passes only assignment identity/title/class,
fixed content version and actual activation availability to the client shell.
It does not pass private criteria, review tokens or original responses. A missing
or mismatched pinned version is shown as unavailable, not replaced. This adds a
read per owned assignment on layout load/refresh; it adds no database query,
service, permission rule or persistence model. The existing bounded demo roster
is the supported scope; larger libraries may later need a reviewed metadata
projection to avoid repeated content review reads.

Assignment URLs remain selection inputs, not authorization. Every destination
retains its existing authenticated loader. The shell reuses PR #116's
`resolveTeacherNavigationContext`. With `contextIsAuthoritative={true}`, a
page's authorized saved `context` replaces the complete URL scope: omitted
student/session/attempt/evaluation/search fields stay absent. Ordinary pages
follow URL selection updates. A just-acknowledged draft's canonical URL replaces
the earlier preparation scope, including omissions. Destination loaders still
authorize the draft and its identities. An explicit invalid or unknown assignment
never silently selects the first.
Missing context uses the same ordered default as the existing teacher loader.
No client course store, copied lesson resolver or model call is introduced.

## Consumer contract

Existing `TeacherFrame({ children, section, context?, contextIsAuthoritative? })`
calls remain compatible. Use `context` for resolved assignment/evidence scope;
set `contextIsAuthoritative` only after loading an authorized saved snapshot,
as PR #116's Interventions page does. The
shared layout supplies display metadata automatically; pages must not create
their own course/assignment navigation or duplicate the context band.

| Navigation                  | URL / meaning                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Overview                    | `/teacher` with assignment and origin; current content is honestly selected-assignment scope                      |
| Assignments                 | Bare `/teacher/assignments`: course discovery; no selected-assignment query                                       |
| Lessons                     | `/teacher/lessons`; Materials and Objectives remain reachable at their original URLs through lesson subnavigation |
| Progress                    | `/teacher/assignments?assignment=…&view=progress`; PR #117 owns actual progress content                           |
| Assignment review / preview | Explicit `view=review` / `view=preview` remains in assignment scope under Progress                                |
| Student work                | `/teacher/evidence`; All answers, By idea and Concerns retain existing evidence/insights routes and anchors       |
| Interventions               | `/teacher/interventions`; generation/save/review/delivery remain page-owned                                       |
| Roster                      | `/teacher/students`; existing canonical session detail routes stay valid                                          |

`workspaceNavigationHref` in `app/teacher/workspace-model.ts` is the shared
adapter over PR #116's `teacherNavigationHref` and the unchanged validated
`teacherWorkspaceHref`. Course Assignments receives no selection parameters; Overview
receives assignment/origin; Roster additionally receives student, never an old
answer search. Lessons, Materials and Objectives receive no investigation
parameters. Evidence, Insights and Interventions retain validated investigation
scope. Explicit assignment Progress/review/preview views also retain that scope
for #117's student/concept filters. Generic navigation removes intervention
starting responses and cannot copy draft/provider/delivery identities or private
text. Explicit page-owned preparation links still use the existing seed contract.
`switchedAssignmentHref` starts Progress with only the
new assignment and origin, clearing incompatible concepts/records/panes. It does
not select recipients or write anything. The switcher explains this clearing.

### S1 and C2: course discovery and Class Progress returns

These corrections address [PR #122 S1/C2](https://github.com/peterbucci/ai-teaching-platform/blob/codex/workbench-acceptance-verification/acceptance/v22/DEFECTS.md).
Every shared course Assignments entry, including the desktop course tab, phone
Back link, breadcrumb and workspace switcher, uses the bare library route.
Explicit `view=progress|review|preview` links keep their assignment. The
Assignments page continues to interpret explicit assignment parameters normally.

Agent D owns outgoing Assignment links and the returning page's focus controller.
Agent C owns `parseTeacherWorkspaceContext`, `teacherReturnHref`,
`teacherProgressReturnHref`, `resolveTeacherSessionContext` and the session
detail receiver. The agreed session URL fields are:

| Field                                         | Meaning / allowlist                                                                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `returnTo`                                    | `progress` selects this contract; other existing return destinations are unchanged                                                 |
| `assignment`, `origin`                        | Actual assignment UUID and `all`, `synthetic_fixture` or `live_demo` evidence filter                                               |
| `session`, `attempt`, `evaluation`, `student` | Optional target record identities; if supplied they must match the authorized session/evidence                                     |
| `progressStudent`                             | Optional original selection UUID, validated against that assignment's current roster; may differ from the opened session's student |
| `progressConcept`                             | Optional original concept selection, validated against the assignment's pinned content                                             |
| `progressView`                                | `grid`, `concepts`, `questions` or `sessions`; defaults to `grid` when omitted                                                     |
| `pane`                                        | `grid` or `details`; defaults to `grid` when omitted                                                                               |
| `class`, `status`                             | Optional UUID matching the authorized session's class; status is `all`, `active`, `inactive` or `unavailable`                      |

The `progress*`, `pane`, `class` and `status` fields above are parsed only for
`returnTo=progress`. Other pages retain their own query contracts. Original
selection omissions remain absent: opening a student's row from a concept-wide
view does not create a student filter on return. Questions/Sessions can open a
different student's record while preserving the original, roster-authorized
selection. An unrelated library class filter must be omitted by the sender.

The receiver first uses existing teacher session and pinned-content services.
When a valid `progressStudent` UUID is supplied, it reuses the existing
`readAssignmentEvidence` service for that session's assignment to obtain the
authorized roster. This adds a bounded read for selected-student returns; it
adds no service, query implementation, mutation or permission grant. Malformed or
cross-scope identities return the existing not-found response.

The return builder emits only `/teacher/assignments`, fixed `view=progress`,
assignment/origin, original selection mapped to `student`/`concept`, subview,
pane and optional class/status. It excludes target record IDs, seed selection,
search, private text, draft/request identifiers and any raw return URL. The
focus fragment is computed, never caller-selected:

- Details: `#cell-evidence`.
- Grid selection: the existing `ap-selection-{student-or-all}-{concept-or-all}` ID.
- By idea selection: `ap-selection-all-{concept}`, even when a student filter is retained.
- Questions, Sessions or no visible selection: `#progress-main`.

Fragments are encoded from validated identities. Agent D owns resolving these
fixed targets after authorized rendering, including desktop focus, hidden-pane
fallbacks and direct/reloaded URLs. The shell leaves nonempty hash placement to
that page controller. Actual integration requires a disposable composition of
the pinned Agent C and Agent D commits; standalone fixture tests are not that
browser acceptance.

For page-owned edge-to-edge progress frames, the existing shell inset is
`24px 28px 56px` desktop, `18px 14px 32px` at phone widths, with `12px` inline
at widths up to 360px. A page may cancel those insets like `.tw-panes` and supply
one internal heading gutter. Its page controller and record layout stay owned
by that page; no second pane controller is required.

### F1 ownership agreement

Agent A owns Evidence row/list/detail focus. Its entire managed list/detail
region must use `data-workspace-restoration="page"`. The shared shell excludes
descendant focus and scroll from its snapshots and yields all placement when a
visible managed control already has focus. Agent A must also preserve the
originating row's entry before navigation: immediate detail focus is appropriate
only when the full destination URL already equals the current URL. Otherwise
post-navigation/hash placement owns the detail target. A boundary alone cannot
repair a page that overwrites the original entry's row intent before leaving.
No Evidence files or shared restoration behavior are changed by S1/C2.

### Contextual panes

The coordinated Lessons integration distinguishes exact library routes
(`/teacher/lessons`, `/teacher/materials`, `/teacher/objectives`) from focused
lesson, question, objective and source detail routes. Libraries retain Lesson
tools navigation. Focused editing uses a desktop Back to Lessons/path row and
hides that row on phones, leaving the compact header and page-owned pane controls.
The ordinary return link uses the existing editor's unsaved-work guard.
`--tw-authoring-top` exposes the shared top inset: `103px` desktop and `57px`
at phone widths. The desktop value includes the 44px path control and its 1px
divider. Agent E owns full-width editor geometry and local reading behavior.

Import `TeacherWorkspacePanes` from `app/teacher/presentation.tsx` or directly
from `app/teacher/workspace-panes.tsx`. Mount at most one per page inside
`TeacherFrame`. Each slot is `{ label: string, children: ReactNode }`:

```tsx
<TeacherFrame section="Assignments" context={resolvedContext}>
  <TeacherWorkspacePanes
    main={{ label: "Class", children: <PageOwnedProgress /> }}
    context={{ label: "Details", children: <PageOwnedDetails /> }}
  />
</TeacherFrame>
```

For authoring add `navigation={{ label: "Outline", children: … }}`. The shell
never fetches or chooses page records, duplicates controllers, interprets
evidence, or owns save/recovery behavior. All children remain mounted across
pane switches and breakpoints so hidden forms keep their local state.

- Wide: 330px navigation / flexible main / 360px context; two-slot layouts use
  a 380px context pane. Shared panes span the available workspace width.
- At 1240px and below: 300px navigation; context becomes a 400px, max-92vw
  native modal drawer with Escape/close and focus return.
- At 800px and below: exactly one visible pane, with a labelled pane switcher.
  Arrow/Home/End move tab focus; Enter/Space selects. The fixed presentation-only
  URL parameter is `workspacePane=navigation|main|context`; unknown, duplicated,
  or unavailable choices fall back to the page's initial pane.
- Pane selection uses browser history; page routes, assignment and evidence
  identities are preserved. Focus/scroll restore in mounted panes. Page-owned
  citation activation still owns exact hash target focus.

Optional shared presentation primitives: `TeacherMetricStrip` takes items
`{ label, value, note? }`; `TeacherRuledList` takes `label` and page-owned list
children. They render supplied measures; they never calculate evidence or infer
mastery. Shared CSS is isolated under `tw-*`; student shell styles are unchanged.

### Focus, recovery and mobile

The phone header shows assignment/page context and a return to course
assignments. The workspace switcher exposes all course destinations and owned
assignments. Persistent bottom navigation contains three course or four
assignment destinations, with no horizontal discovery. It is additional to
the switcher; navigation is not hamburger-only.

Normal links use Next's real router/history. Shared restoration keeps bounded,
memory-only positions and content-control identities across shell remounts;
positions belong to individual browser history entries, including repeated
visits to the same URL. History state stores only an opaque entry token and
preserves the router's and pages' fields; no position or form value is stored
there. Chrome links do not overwrite the originating content focus. Pages can use an
element `id` or `data-workspace-focus` for stable focus, and
`data-workspace-scroll` for their own scroll container. No text is stored.
After reload the URL restores selection, but previous in-memory scroll snapshots
are unavailable. Exact hash activation remains with the owning page.

Pages that already restore their own focus/scroll can mark the managed region
`data-workspace-restoration="page"`. The shell excludes that region and its
descendants from shared snapshots and yields all placement when the page has
already focused a visible control there. PR #116's existing evidence component
is recognized without changing its files. Its per-history-entry list controller
owns row focus and list scroll; the shell does not read or rewrite its history
state. Focusing a content control without a stable identity clears the old shared
focus target; moving into navigation chrome alone preserves it.

Draft recovery/dirty navigation remains owned by each editor and its existing
actor/revision/request contracts. The shell does not promise to save unsaved
forms or replay mutations. The pane component preserves mounts; moving to a
different page still uses that editor's existing recovery. Consumers must verify
their own unsaved-work journey when adopting it.

The switcher dismisses an ordinary navigation link during native window capture
without cancelling, replaying or routing the click. Its listener is installed in
a layout effect before the existing page guards' passive effects. This releases
modal inertness before the page guard presents and focuses recovery feedback;
navigation dismissal does not refocus the switcher opener. Escape/backdrop/close
still restore the opener. Keep page guards in passive effects and let them own
their visible recovery target. Preinstalled or layout-effect guards need explicit
coordination rather than assuming the shell can recover an unknown focus target.

## Ownership and integration

- Shell: `navigation.tsx`, `layout.tsx`, shared `presentation.tsx`/`filters.tsx`,
  `workspace-*` files, shell tests and this contract.
- #117: assignment discovery/progress/review/preview, grid and selected records.
- #118: materials/objectives/lesson authoring, source reading and editor content.
- Evidence/Students and Interventions keep exclusive ownership of their routes,
  local styles, record selection and lifecycle behavior.

Consumers rebase onto a reviewed shell commit in isolated worktrees. This PR
does not merge #117/#118 or edit their files. Do not merge the shell automatically.
The stacked draft targets `codex/teacher-workbench-slice`; rebase and retarget
only after #116 is accepted and merged.

PR #117's reported `9f300ce` progress implementation retains its own
`pane=grid|details` and `progressView=grid|concepts|questions|sessions` controls.
Those parameters are distinct from the optional shell's `workspacePane`.
Existing page links and browser history retain their complete URLs; generic
shell navigation deliberately carries validated investigation context only.
Page owners should keep their current controls or adopt the shared pane
component, not mount two pane controllers. Combined acceptance must exercise
selected student/concept, the page-owned subview and return navigation after
the branches are integrated. That combined check has not been run here.

## Explicit deviations and remaining integration

1. Course/term authority is not implemented in the backend. The header uses the
   authorized class label, not invented NET 210 metadata or whole-course metrics.
2. Global Find and prototype harness controls are omitted because no corresponding
   service exists. Real contextual return links replace the prototype's simulated
   history arrows; browser Back/Forward is verified separately.
3. Existing Insights anchors supply By idea/Concerns. Dedicated Patterns content
   remains with its page owner; the shell does not fabricate a second page.
4. Apart from the explicitly assigned session return correction, PR #116's
   page-local content remains unchanged. Its stacked filters/cards and
   Evidence reading layout are not accepted as full v2.2 page fidelity. The new
   optional pane/metric/row contracts are available for those owners to adopt.
5. Progress uses PR #117's existing explicit `view=progress` contract. On the
   exact #116-only base, its page still displays legacy assignment review;
   the actual progress grid needs the reviewed page-local #117 integration.
6. Prototype illustrative class/version/roster counts differ from the immutable
   curated fixture. Actual before/after screenshots use the same durable
   fictional database; no production DOM, calculation or source version is
   altered to imitate prototype values. The visual report records these limits.

See `WORKBENCH_V22_SHELL_VERIFICATION.md` for executed checks, screenshots,
geometry comparisons and unrun acceptance. No actual-model, hosted-release,
full-page parity, educational-validity or independent-human acceptance is claimed.
