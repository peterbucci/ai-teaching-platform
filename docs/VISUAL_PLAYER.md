# Interactive diagram player

Issue [#39](https://github.com/peterbucci/ai-teaching-platform/issues/39) supplies a reusable React renderer and transient interaction boundary for concept graphs, sequence diagrams, and packet experiments. It does not generate activities, choose tutoring actions, or persist evidence. Packet previews use #40's reviewed calculator through #38's versioned adapter.

The player imports #38's schemas, examples, validation, and visibility rules without changing them. `lib/visual/player.ts` adds transport and renderer helpers, not another activity schema. The existing deterministic tutor is unchanged.

## Development playground

From the repository root, start the development server:

```sh
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3039
```

Open <http://127.0.0.1:3039/dev/visual-player>. The route returns 404 unless `NODE_ENV` is `development`; it is not linked from production tutoring or navigation.

The page includes chain, branching, cyclic, and twelve-node graphs; sequences with two, four, or six participants; two bounded v2 packet experiments; a legacy packet text fallback; a synthetic uploaded-source graph; and invalid records. Select text-only, unavailable-visual, or read-only replay views. The adapter selector exercises local calculation success, delay, failure, invalid output, and absence. Reset sample starts the selected fixture over; the player's Reset view only resets navigation and preserves responses.

All records and replay histories are synthetic. The callback log shows only event counts and types. It makes no database writes or tutoring decisions.

## Embedding the player

Import `VisualPlayer` from `app/components/visual/player.tsx` and the boundary types from `lib/visual/player.ts`.

| Prop                      | Caller responsibility                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `activity: unknown`       | Supply an immutable, student-safe activity projected from the exact authorized content version.                   |
| `context: PlayerContext`  | Supply authorized `activity_id`, `session_id`, `root_attempt_id`, and `attempt_id`. The latter two may be null.   |
| `revision: string`        | Supply the current host-owned revision; change it when replacing a snapshot or invalidating a previous view.      |
| `permittedEvents`         | Advertise permitted UI callbacks: `display`, `packet_state`, `prediction`, `packet_result`, `explanation`.        |
| `fallbackText: string`    | Supply useful, student-safe text independently of the untrusted activity.                                         |
| `initialEvents?: unknown` | Supply an immutable validated history snapshot; defaults to an empty log.                                         |
| `mode?`                   | Use `interactive` (default) or `replay`.                                                                          |
| `adapter?`                | Connect an `ExperimentAdapter` only when its result provenance and authorization are established.                 |
| `onEvent?`                | Receive typed #38 `ActivityEvent` callbacks. Receiving a callback does not mean it is persisted.                  |
| `textOnly?`               | Use the complete text presentation; defaults to false.                                                            |
| `visualAvailable?`        | Set false when drawing is unavailable while retaining the text activity and permitted controls. Defaults to true. |

Strict shared validation rejects unsupported records, unknown fields, invalid identity/history, and out-of-range settings. Invalid inputs render only the separate fallback; their fields and validation details are not printed. A rendering error also shows the fallback.

Both curated and uploaded source references are accepted by the shared content contract. Uploaded references display their exact source version and attribution title; curated references display their source commit. UUID concept identifiers, including digit-leading IDs from the objective editor, remain valid. The server must still check authorized concept membership and source ownership.

Validation in a browser is not a secrecy or authorization boundary. Never send private answers, grading rubrics, unrevealed outcomes, or unauthorized source content to the client. The host must project safe records and history before rendering. The player also applies #38's prediction-before-result visibility rule as defense in depth.

`activity.controls` governs selection, stepping, and setting controls. `permittedEvents` gates callbacks in this view; it is not server permission enforcement or a replacement per-step action schema. The host must independently authorize every accepted action and source/version reference.

Keep the activity and initial history immutable during a view. Replacing activity content, context, revision, mode, or initial history remounts the controller and cancels its pending request. Do not echo every callback back as a replacement `initialEvents` while a student is editing; reconcile and replace the snapshot intentionally. Preserve drafts in the integrating host when its own navigation requires that.

## Events and replay

The player emits shared typed events only for supported actions. It reports display after mounting, settings when applied and before execution, the submitted prediction, a validated result, and submitted explanations. Node selection, layout changes, sequence cursors, guided-step navigation, and Reset view are local view controls; they do not invent event types absent from #38.

One prediction and one result are allowed per activity. Predictions retain exact submitted text. A result requires an earlier prediction for the same context. Settings lock after a result. A new experiment requires a new activity identity; the player does not silently overwrite the existing prediction or result.

Callbacks are transient handoffs. #43 must provide persistence, acknowledgment/recovery, reload deduplication, and accurate assistance accounting. A display event has no invented hint IDs. Graph selections and individual guided-step exposure cannot be reconstructed from the current event schema.

Read-only replay restores recorded settings, prediction, visible result, and explanations without emitting new events or running an adapter. Students can still browse the diagram and text timeline. The shared schema has no saved graph layout, selected node, sequence cursor, or guided-step position, so replay does not claim to restore those view details.

## Versioned packet adapter

An adapter has `provenance: "fixture" | "server"` and `run(request): Promise<unknown>`. The request contains the validated `visual-v2` packet activity, context, bounded SI settings, submitted prediction, `request_id`, and an abort signal. The adapter must return a shared `packet_result` event whose `event_id` equals `request_id` and whose four context fields match exactly. The player validates the model version, exact requested parameters, and recomputed numeric results before revealing the outcome.

The player contains no networking formulas. It uses `calculatePacketActivity` and the unchanged #40 calculator for a clearly labeled local calculation preview. Inputs are packet bits, link rate in bits per second, distance in meters, and propagation speed in meters per second. Only controls listed by the activity can change; the other inputs stay fixed. Packet bits remain integral, while valid non-packet inputs can be fractional. The result shows transmission, propagation, and their sum in seconds. This single-link model excludes queueing and processing and does not calculate round-trip time.

The packet path remains a schematic: distance, position, and transition duration are not measured time. Older `visual-v1` packet controls expressed in milliseconds, packets, or percent are never reinterpreted as SI inputs. Their records and histories remain readable, but the renderer shows only the activity's text alternative and emits no new events. See [the packet contract](VISUAL_PACKET_CONTRACT.md) for the exact v2 schemas and compatibility boundary.

A future server adapter must:

- Load the authorized immutable activity snapshot and use `calculatePacketActivity` with a server-owned source and concept scope. Recompute using #40's reviewed calculator; browser calculations are previews, not authority.
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

Record results against the exact commit. These deterministic checks and local calculation previews do not establish actual-model behavior, authorized server execution, or application/database integration.

For a browser walkthrough:

1. Inspect every graph sample, including long labels, branches, and cycles. Select nodes, inspect relationships, change layouts, and navigate guided steps.
2. Step forward and backward through all sequence sizes, including self-messages. Compare the highlighted interaction with the complete text timeline.
3. Use Tab, Shift+Tab, Enter, Space, and arrow keys where applicable. Check visible focus, accessible names, announced step changes, and no keyboard trap.
4. Repeat at approximately 390px wide; inspect long labels, controls, text alternatives, and any intentional diagram scrolling without page overflow.
5. Enable the browser or operating system reduced-motion preference and inspect graph, sequence, and packet views.
6. Confirm experiment results remain hidden before prediction. Apply valid settings, including fractional non-packet values; reject blank, out-of-range, or fractional packet-bit values. Submit a prediction, reveal the labeled numeric calculation preview, and submit an explanation. Check fixed inputs and guided steps.
7. Exercise delayed, failed, invalid, and missing adapters. Change sample while a delayed request is running; confirm its result cannot appear in the replacement activity.
8. Select both invalid records. Confirm the safe fallback appears and the private-field sentinel is never rendered. Also check Text only and Visual unavailable for every family.
9. Enable read-only replay. Verify recorded text/settings appear, editing and execution are unavailable, browsing remains possible, and callback count stays zero.
10. Run the production build/server and confirm `/dev/visual-player` returns 404. Report fixture checks separately from later authorized server, database, and model integration checks.
11. Inspect the uploaded-source sample's version and attribution, and the legacy packet's text-only fallback with zero new callbacks.

## Packet/source integration verification — October 23, 2026

The isolated integration preserves original player head `1cc2b701465448313be977365ba09984708a2784`, normally merges the reviewed v2 contract, upstream #104 activity snapshots, and main/security updates, and retains the original eleven player paths. The production tree was checked at `d296f2a`.

- **294/294 deterministic tests**, including eleven player tests, passed with TypeScript, full lint, formatting and the Next.js **16.4.3** production build. **293 content checks** passed before the subsequent dependency-only merge. Independently installed locked dependencies reported zero vulnerabilities.
- A real production HTTP check returned **404** for `/dev/visual-player` and contained no playground content.
- An independent browser walkthrough of the development preview verified that a prediction is required before calculation. At **400,000 meters**, the preview showed **0.008 seconds transmission**, **0.002 seconds propagation**, and **0.01 seconds total**. Explanation submission and Reset view preserved the submitted prediction, result and response.
- The fractional-rate sample accepted **500,000.5 bits/second** and showed **0.015999984000016 seconds transmission** plus **0.001 seconds propagation**. The legacy v1 sample showed only its text fallback with **zero events**. The uploaded-source graph displayed **source version 2** and its attribution title.
- A subsequent normal dependency merge includes published R7 main `38af6be` at player commit `3961e34`, with no player-code changes. Its **68 focused visual/model/player tests**, full lint, TypeScript, formatting and production build passed. The original eleven-path player diff and protected-file/migration integrity remain unchanged.

These are synthetic browser previews using the reviewed local calculator, not persisted classroom evidence or an authenticated visual runtime. No model calls or new PostgreSQL verification were performed for this renderer integration. Actual model-selected execution and durable display/evidence remain #42/#43 integration gates. The earlier mobile and broader accessibility observations below were not repeated for this change.

## Original v1 verification recorded October 23, 2026

The following records the original v1 player milestone. It predates the v2 packet and uploaded-source integration and does not establish verification of those changes.

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
