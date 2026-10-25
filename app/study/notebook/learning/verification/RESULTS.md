# N2 verification

All records are fictional. No paid calls, database changes, merges or existing-route edits.

## Component browser checks

`browser-report.json` records 133 passing assertions at 1440×1000, 1024×768, 390×844 and 320×844. It covers empty, active, completed, pending, teacher-support, new, multiple-assignment, loading and unavailable home states; category/search/class filters; compact phone control rows; empty filtered results; the injected N5 slot and existing action slots; keyboard Enter and visible focus; current and earlier completed session links, Back/Forward and objective fragments; foreign assignment and stale saved-work/reader inputs; exact reader version display; and explicit unavailable/loading work states.

There were zero writes during navigation/filtering/rendering. One explicit click on the real existing Start button made exactly one `POST /api/tutoring`, rejected by the fixture with HTTP 401. The existing sign-in error appeared. No answer, evaluation, provider or assistance endpoint was called.

These are React component checks with native-anchor/Next-router test seams and a test-only server. CSS module class names are mapped for the isolated bundle while retaining the source selectors. They do not prove production route, authenticated database, draft recovery, concurrent-start or real evaluation behavior. Those existing services are unchanged and require combined integration checks after N0 mounts this package.

Initial harness failures: the focus assertion followed pointer input and was corrected to enter keyboard modality; a prototype overview capture stayed on home because its scenario is constructor-only; and an earlier-session assertion was initially placed on the reference page instead of the implementation. Each harness error was corrected, with no weakened application assertion. Final captures initialize the documented `owen-overview` scenario before mounting, by changing only scenario metadata in the served response. The reference files remain unchanged. The final complete runner passed all 133 checks.

## Authoritative reference and corrections

The supplied final ZIP matches SHA-256 `fa69c2d0262b0be684b5e9d21b2131d7c02a5bf9577c1586df07950c6394c570`. The runner also verifies the extracted Main hash `70fd02f83f6352a988d6deeadfb6b2243b61298c0c13ad0bb2c139b5baac72a4`. Its home and overview markup/CSS are unchanged from the previous inspected export; its teacher-review wording now matches the approved activity. N2 retains its existing implementation and the N5 slot, with no copied review activity or alternative lesson content.

The meaningful N2 correction puts class/source selectors on one phone row and search beneath, reducing avoidable vertical space while retaining 40px fields. Optional action slots now match PR #125’s composition seam and were exercised with the actual `AssignmentAction`; no duplicate controls were mounted. The final help-request artboard was inspected and [captured](prototype-help-1440.png). It treats the reported message as help, with the original question still waiting. N2 does not implement that interaction; the existing conversation and PR #113 recovery were left unchanged.

## Screenshots

| Width | My learning                        | Assignment overview       | Reference home                  | Reference overview                  |
| ----- | ---------------------------------- | ------------------------- | ------------------------------- | ----------------------------------- |
| 1440  | [View](learning-multiple-1440.png) | [View](overview-1440.png) | [View](prototype-home-1440.png) | [View](prototype-overview-1440.png) |
| 1024  | [View](learning-multiple-1024.png) | [View](overview-1024.png) | [View](prototype-home-1024.png) | [View](prototype-overview-1024.png) |
| 390   | [View](learning-multiple-390.png)  | [View](overview-390.png)  | [View](prototype-home-390.png)  | [View](prototype-overview-390.png)  |
| 320   | [View](learning-multiple-320.png)  | [View](overview-320.png)  | [View](prototype-home-320.png)  | [View](prototype-overview-320.png)  |

All table references use the final ZIP. Empty/unavailable screenshots are also saved at every width; there are 25 final captures including the help artboard. [refined-baseline/](refined-baseline/) preserves the eight previous N2 home/overview screenshots and their earlier 123-check report. The fixture top bar labels its provenance and is not N1’s shell. Reference pages have their own scroll container, so reference captures show the viewport; implementation captures include the full document. Different fictional data and omitted unsupported fields preclude pixel-equivalence claims. External fonts were blocked; system fonts were used.

The page width, type hierarchy, section rules, green continuation panel, assignment rows, side cards and mobile stacking follow the final reference. With several real status categories/classes/sources represented, phone filters still take more space than the reference’s single-assignment example, but class/source fields now share a row at 390/320px. No horizontal overflow was detected. Phone rows/actions remain readable, with visible 3px keyboard focus. The overview keeps instructions, learning steps, all objectives and reading before its stacked progress/session cards. “Your saved work” replaces unsupported recent-page previews; missing schedules, family totals and scores remain omitted. Existing action labels and source/version resolution remain authoritative.

Final-reference N2 component comparisons passed within these explicit current-data differences. Full Notebook parity, N1’s actual top/bottom navigation, N5’s real cards, production-page focus/scroll restoration, actual 200% browser zoom, physical phone/keyboard and screen-reader acceptance remain unverified. There is no live student/composer or end-to-end database claim. These are integration gates, not permission to edit existing routes or PR #113.

## Repository checks

474 repository tests passed, including eight focused N2 regressions. Full lint, route type generation/TypeScript and 293 content checks passed. Formatting and a production Webpack build passed. The initial package build command dropped the Webpack option in this shell; default Turbopack then failed to resolve the reused dependency junction. Direct `node node_modules/next/dist/bin/next build --webpack` passed. This is a Webpack build result, not a successful default Turbopack run.

The eight focused unit regressions are in `tests/student-notebook-learning.test.ts`; they are included by the normal repository test command. Browser fixture source and [run.mjs](run.mjs) are colocated here. The fixture is not automatically run by `npm test` and has no production route.

To reproduce, make Playwright available to Node (or set `PLAYWRIGHT_PACKAGE` to an existing installed package path), optionally set `N2_PROTOTYPE_DIR` to the inspected export directory containing `Main.dc.html`, its `support.js` and vendor runtime, then run:

```sh
node app/study/notebook/learning/verification/run.mjs
```

The runner uses temporary bundle files, reads the repository’s existing dependencies, serves only a loopback component fixture, blocks external browser requests, rejects every write with 401, and writes the report/screenshots into this owned folder. Prototype captures are skipped when no reference directory is supplied. It does not install browser packages or modify the prototype source. The reproducible captured runner and fixture were both executed; no passing claim relies on static source inspection alone.
