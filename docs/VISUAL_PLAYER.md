# Interactive diagram player

Issue [#39](https://github.com/peterbucci/ai-teaching-platform/issues/39) supplies a reusable React renderer and transient interaction boundary for concept graphs, sequence diagrams, and packet experiments. It does not generate activities, choose tutoring actions, calculate network delay, or persist evidence.

The player imports #38's schemas, examples, validation, and visibility rules without changing them. `lib/visual/player.ts` adds transport and renderer helpers, not another activity schema. The existing deterministic tutor is unchanged.

## Development playground

From the repository root, start the development server:

```sh
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3039
```

Open <http://127.0.0.1:3039/dev/visual-player>. The route returns 404 unless `NODE_ENV` is `development`; it is not linked from production tutoring or navigation.

The page includes chain, branching, cyclic, and twelve-node graphs; sequences with two, four, or six participants; two bounded experiment records; and invalid records. Select text-only, unavailable-visual, or read-only replay views. The adapter selector exercises fixture success, delay, failure, invalid output, and absence. Reset sample starts the selected fixture over; the player's Reset view only resets navigation and preserves responses.

All records and replay histories are synthetic. The callback log shows only event counts and types. It makes no database writes or tutoring decisions.

## Embedding the player

Import `VisualPlayer` from `app/components/visual/player.tsx` and the boundary types from `lib/visual/player.ts`.

| Prop                      | Caller responsibility                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `activity: unknown`       | Supply an immutable, student-safe activity projected from the exact authorized content version.                    |
| `context: PlayerContext`  | Supply authorized `activity_id`, `session_id`, `root_attempt_id`, and `attempt_id`. The latter two may be null.    |
| `revision: string`        | Supply the current host-owned revision; change it when replacing a snapshot or invalidating a previous view.       |
| `permittedEvents`         | Advertise permitted UI callbacks: `display`, `experiment_state`, `prediction`, `experiment_result`, `explanation`. |
| `fallbackText: string`    | Supply useful, student-safe text independently of the untrusted activity.                                          |
| `initialEvents?: unknown` | Supply an immutable validated history snapshot; defaults to an empty log.                                          |
| `mode?`                   | Use `interactive` (default) or `replay`.                                                                           |
| `adapter?`                | Connect an `ExperimentAdapter` only when its result provenance and authorization are established.                  |
| `onEvent?`                | Receive typed #38 `ActivityEvent` callbacks. Receiving a callback does not mean it is persisted.                   |
| `textOnly?`               | Use the complete text presentation; defaults to false.                                                             |
| `visualAvailable?`        | Set false when drawing is unavailable while retaining the text activity and permitted controls. Defaults to true.  |

Strict shared validation rejects unsupported records, unknown fields, invalid identity/history, and out-of-range settings. Invalid inputs render only the separate fallback; their fields and validation details are not printed. A rendering error also shows the fallback.

Validation in a browser is not a secrecy or authorization boundary. Never send private answers, grading rubrics, unrevealed outcomes, or unauthorized source content to the client. The host must project safe records and history before rendering. The player also applies #38's prediction-before-result visibility rule as defense in depth.

`activity.controls` governs selection, stepping, and setting controls. `permittedEvents` gates callbacks in this view; it is not server permission enforcement or a replacement per-step action schema. The host must independently authorize every accepted action and source/version reference.

Keep the activity and initial history immutable during a view. Replacing activity content, context, revision, mode, or initial history remounts the controller and cancels its pending request. Do not echo every callback back as a replacement `initialEvents` while a student is editing; reconcile and replace the snapshot intentionally. Preserve drafts in the integrating host when its own navigation requires that.

## Events and replay

The player emits shared typed events only for supported actions. It reports display after mounting, settings when applied and before execution, the submitted prediction, a validated result, and submitted explanations. Node selection, layout changes, sequence cursors, guided-step navigation, and Reset view are local view controls; they do not invent event types absent from #38.

One prediction and one result are allowed per activity. Predictions retain exact submitted text. A result requires an earlier prediction for the same context. Settings lock after a result. A new experiment requires a new activity identity; the player does not silently overwrite the existing prediction or result.

Callbacks are transient handoffs. #43 must provide persistence, acknowledgment/recovery, reload deduplication, and accurate assistance accounting. A display event has no invented hint IDs. Graph selections and individual guided-step exposure cannot be reconstructed from the current event schema.

Read-only replay restores recorded settings, prediction, visible result, and explanations without emitting new events or running an adapter. Students can still browse the diagram and text timeline. The shared schema has no saved graph layout, selected node, sequence cursor, or guided-step position, so replay does not claim to restore those view details.

## Experiment adapter and current blocker

An adapter has `provenance: "fixture" | "server"` and `run(request): Promise<unknown>`. The request contains the validated packet activity, context, bounded settings, submitted prediction, `request_id`, and an abort signal. The adapter must return a shared `experiment_result` event whose `event_id` equals `request_id` and whose four context fields match exactly. The player validates this before revealing the outcome.

The player performs no networking formulas. Its packet path is a schematic; distance, position, and transition duration are not measured transmission or propagation time. The sample adapter returns a clearly labeled qualitative fixture result.

#38's `link-delay`/`packet-count` controls do not map directly to #40's packet bits, link rate, distance, and propagation speed. The mapping is pending coordination with [@hanzeltkr on PR #104](https://github.com/peterbucci/ai-teaching-platform/pull/104#issuecomment-6364535757). No unfinished #40 changes are merged into the player. Do not treat the experiments as mathematically complete.

A future server adapter must:

- Use the agreed physical parameter mapping and #40's reviewed calculations, with units and ranges checked by server code.
- Authenticate the actor and authorize the exact activity, lesson/source version, session, current revision, and available action. The adapter's transport or closure must carry the host revision; it is not currently a field in `ExperimentRequest`.
- Preserve immutable submitted settings and prediction, execute idempotently using the request identity, and return the actual validated result.
- Reconcile cancellation, timeout, stale revisions, and uncertain outcomes before allowing another execution. An abort signal does not prove a server operation did not happen.

The player cancels work on replacement, adapter changes, and result-permission revocation; it bounds waiting to ten seconds. Result labels retain their originating adapter provenance even if the adapter changes later. A failed or uncertain request preserves local input and does not automatically retry. The host owns recovery and any durable result lookup. In the playground, changing the adapter preserves the current activity; use Reset sample to start another fixture run.

#42 still owns agent choice and authorized tutoring integration. #43 still owns durable visual evidence and replay retrieval. Neither is supplied by the development page.

## Reproducible review checklist

Run the repository checks with the required local runtime:

```sh
npm test
npm run typecheck
npm run lint
npm run format:check
npm run content:check
npm run build
```

Record results against the exact commit. These deterministic checks and fixture demonstrations do not establish actual-model behavior, authoritative calculations, or application/database integration.

For a browser walkthrough:

1. Inspect every graph sample, including long labels, branches, and cycles. Select nodes, inspect relationships, change layouts, and navigate guided steps.
2. Step forward and backward through all sequence sizes, including self-messages. Compare the highlighted interaction with the complete text timeline.
3. Use Tab, Shift+Tab, Enter, Space, and arrow keys where applicable. Check visible focus, accessible names, announced step changes, and no keyboard trap.
4. Repeat at approximately 390px wide; inspect long labels, controls, text alternatives, and any intentional diagram scrolling without page overflow.
5. Enable the browser or operating system reduced-motion preference and inspect graph, sequence, and packet views.
6. Confirm experiment results remain hidden before prediction. Apply valid settings, reject blank/fractional/out-of-range values, submit a prediction, reveal the labeled fixture, and submit an explanation. Check the fixed-range sample and guided steps.
7. Exercise delayed, failed, invalid, and missing adapters. Change sample while a delayed request is running; confirm its result cannot appear in the replacement activity.
8. Select both invalid records. Confirm the safe fallback appears and the private-field sentinel is never rendered. Also check Text only and Visual unavailable for every family.
9. Enable read-only replay. Verify recorded text/settings appear, editing and execution are unavailable, browsing remains possible, and callback count stays zero.
10. Run the production build/server and confirm `/dev/visual-player` returns 404. Report fixture checks separately from later authorized server, database, and model integration checks.

## Verification recorded October 23, 2026

Local deterministic checks passed: **108 tests** (including nine player-boundary tests), TypeScript, lint, formatting, and **293 content checks**. The production build passed on retry after the installed Next.js version interrupted its first invocation with a security advisory. The advisory remains in the inherited dependency stack; no dependency upgrades are included here. A local production HTTP request returned **404** for the sample route and did not contain the playground.

The real in-app Chromium walkthrough used the development fixtures at desktop size and **390 × 844**. Observed results:

- Chain, branching/circle, cycle, and twelve-node graphs rendered; native keyboard selection highlighted matching relationships. Row, grid, and circle layouts were exercised.
- Two-, four-, and six-participant sequences rendered; forward/backward stepping and keyboard selection of a self-message updated the current interaction. The eleven-message text timeline remained available.
- Enter, Space and Tab exercised node selection, navigation and forms with visible focus and meaningful accessibility names/current-state text. This is an accessibility-tree inspection, not a manual screen-reader product certification.
- Both experiment records rendered; out-of-range settings could not be applied. Prediction was required before reveal; settings and exact prediction remained visible after result, explanation and Reset view.
- Failed and malformed adapter outputs preserved the prediction and left results hidden; rerun stayed disabled. Changing activity or adapter during a delayed request discarded its result. Missing-adapter controls were disabled with an explanation.
- Invalid version/private-field records showed only the safe text fallback with zero callbacks; the synthetic private-field sentinel did not appear in the rendered UI. Text-only and unavailable-visual modes retained the learning text and controls. Replay restored synthetic evidence and remained at zero callbacks while browsing.
- No page-wide overflow was observed at 390px for the tested structures; large diagrams scroll within their container. Long graph labels did not overflow their node boxes.
- Computed styles in graph, sequence and experiment views had no animations or nonzero transition durations. Reduced-motion CSS is present, but the browser automation interface could not change the actual media preference, so a **preference-enabled walkthrough remains unverified**.

No model, database, persisted-evidence, real tutoring, or authoritative #40 calculation integration was run or claimed. An independent code review found replay settings/result mismatch and adapter provenance issues; both were corrected before delivery.
