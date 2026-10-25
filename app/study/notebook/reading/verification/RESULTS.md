# N4 verification and prototype comparison

N4 is an isolated presentation leaf on frozen N0 #125, commit `16c0ed3`.
All assignment/class records in the fixture are fictional. Passage text and
attribution come from the repository's actual approved public reading, through
`assignedReading(loadApprovedContent().content_ref)`; the prototype's shorter
demonstration text was not substituted for it. No paid model call, database
operation, application route change or merge was performed.

## Executed checks

- **484 deterministic repository tests passed**, including seven focused N4
  regressions. They cover exact source/session/question identity; foreign and stale
  context; source hash and historical uploaded-version mismatch; citation identity;
  independent reading; absent current attempts; and pending/unavailable behavior.
- Full repository lint, route type generation, TypeScript and production Webpack
  build passed. N4 formatting and final diff checks passed. The build does not mount
  this isolated package into a production route or prove authenticated acceptance.
- **95 component-browser assertions passed** at 1440×1000, 1024×768, 390×844 and
  320×844. The executed [runner](run.mjs) writes [browser-report.json](browser-report.json).
- At every width: ready/loading/empty/unavailable/mismatched views have no horizontal
  document overflow; unresolved views do not mount the reader; exact source commit
  is inspectable; the real existing text-size/search controls work; same-scope pending
  presentation preserves the mounted search field; citation keyboard navigation and
  passage navigation keep exact versions; the real passage selection focuses its
  article; Back/Forward preserves passage identity; and the longest approved passage
  can be read through to its end.
- The component fixture preserves exact unsent textarea text, one mounted reader,
  conversation markup and restored focus while switching its local reading pane.
  At 390/320 the reading replaces the visible question without unmounting it.
- Rendering, navigation and the hidden **session-free fixture** made zero writes.
  An explicit bookmark click made one fixture-only `PUT /api/study/reading/bookmarks`,
  rejected with 401. The existing bookmark error appeared while text remained visible.
  No session-reading, display, answer, evaluation or model endpoint was called.

The browser harness bundles the actual React components and existing standalone
`StudentReader`. Its native-anchor and Next-router seams preserve navigation in an
isolated loopback server. CSS module names are mapped for this fixture; selectors
are retained. All external browser requests are blocked, including external fonts.
These are component results, not signed-in browser/database evidence.

## Final reference and visual review

Verified supplied archive SHA-256:
`fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`.
Verified extracted `Main.dc.html` SHA-256:
`70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4`.

The browser renders Main with its own vendor runtime. The served response changes
only the declared default scenario to `owen-reading` or `owen-p2-reading`; the
reference files remain unchanged outside the repository. These scenarios show
standalone reading and the contextual facing pane. No prototype decision engine,
content rewrite, demo identity or simulated assessment is imported into N4.

| Width | Standalone N4                  | Reference reading                  | N4 pane                       | Reference pane                  |
| ----- | ------------------------------ | ---------------------------------- | ----------------------------- | ------------------------------- |
| 1440  | [View](reading-ready-1440.png) | [View](prototype-reading-1440.png) | [View](reading-pane-1440.png) | [View](prototype-pane-1440.png) |
| 1024  | [View](reading-ready-1024.png) | [View](prototype-reading-1024.png) | [View](reading-pane-1024.png) | [View](prototype-pane-1024.png) |
| 390   | [View](reading-ready-390.png)  | [View](prototype-reading-390.png)  | [View](reading-pane-390.png)  | [View](prototype-pane-390.png)  |
| 320   | [View](reading-ready-320.png)  | [View](prototype-reading-320.png)  | [View](reading-pane-320.png)  | [View](prototype-pane-320.png)  |

There are 28 final captures: the table's 16 plus loading, unavailable and long-reading
captures at every width. They were visually inspected across desktop and phone
layouts. The reading uses the reference's green/white palette, serif body, source
identity, 270px standalone contents rail, compact facing controls and narrow reflow.
Controls wrap without document overflow, long version identifiers wrap and prose
retains superscripts. Disabled-only class/source selectors are omitted when the
identity is already presented; enabled selectors remain available. No busy link,
error notice or interactive source choice is hidden.

Differences are deliberate and data-bound: full approved passage text is longer
than the prototype's abbreviated example; approved passage titles are preserved;
the actual content version is shown rather than the prototype's invented version
label; existing reader search, bookmark, contents, previous/next and return controls
remain; no unsupported session-help banner or receipt claim is fabricated. The
fixture top bar and question are labeled test seams, not the N1 shell. The reference
scrolls within its own viewport while N4 implementation captures show the full
document; pixel equivalence is not claimed.

## Failed attempts and unrun gates

The first browser launch used the restricted process's default browser-cache path;
the next could not reach loopback. Using the existing installed browser cache and
the approved local-test execution resolved those environment failures. Two initial
raw-text assertions failed on superscript notation and a trailing Windows carriage
return. The comparison was corrected to the renderer's existing representation;
passage content was unchanged. A contents-disclosure assertion initially assumed a
viewport breakpoint rather than the actual container width; it now operates on the
visible disclosure. The final full suite passed without weakening overflow,
identity, text, focus or no-write assertions. An initial restricted build hit EPERM;
the authorized Webpack build passed.

**Actual 200% browser zoom remains unverified.** The browser connector had no Chrome
surface. Native Chrome observation worked, but attempts to open a QA tab did not
produce a usable changed target; an indexed click also returned a cached-state
error. No zoom result or screenshot is claimed. The 320px viewport and text-size
checks are not browser zoom. Physical mobile keyboard and screen-reader checks are
also unrun.

The live facing-pane display gate remains open as described by N0 #125. Session-free
hidden fixture results do not establish that hidden session reading is unacknowledged.
Production route mounting, authenticated assignment/session authorization, actual
hidden/visible assistance receipts, PR #113 draft recovery, cross-route historical
return and combined N1/N7 focus/scroll acceptance remain unverified. Keep the
existing visible reading route as the live destination until the separate reader
owner's visibility work is reviewed and accepted in the combined application.

## Reproduction

Run the normal `npm test`, `npm run lint`, `npm run typecheck`, and `npm run format:check`
from the repository root. The checked build used
`node node_modules/next/dist/bin/next build --webpack` with existing dependencies.
The component suite has no production route and is not run by `npm test`:

```sh
node app/study/notebook/reading/verification/run.mjs
```

Make Playwright available through the installation or `PLAYWRIGHT_PACKAGE`. Set
`PLAYWRIGHT_BROWSERS_PATH` when using an existing browser cache. Optional
`N4_PROTOTYPE_DIR` points to the inspected final export containing Main, support.js
and vendor files; without it, prototype captures are skipped. The runner validates
the Main hash when supplied. `N4_SERVE_ONLY=1` serves the same local fixture for a
manual check and prints its URL. No dependencies are installed, secrets read,
prototype files modified or production services contacted by this runner.
