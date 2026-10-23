# Issue #85 integrated orchestration verification

**Result: the text-help service cycle executes and persists; the changed-action acceptance gate remains unmet. Keep #85 open and PR #94 draft.**

These checks ran on October 23, 2026 UTC (October 22 America/New_York), after the deterministic suite. They compose the actual #85 dispatcher, #74 provider and #75 PostgreSQL adapter in a separate verification worktree. They do not enable a production endpoint. [Sanitized evidence](results/2026-10-23-orchestration-live.json) preserves original synthetic messages, proposed actions, validation/execution/failure events, help text, source identities, provider response IDs, usage, assistance timestamps and failed gates.

## Exact scope and versions

| Batch     | Orchestration revision                     | Provider revision                          | Persistence revision                       | Combined checkout                          | Calls | Outcome                                                     |
| --------- | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ----- | ----------------------------------------------------------- |
| Original  | `9ec09e96968d42ad59a53f0ed252cc79e7cfcb7e` | `13c8a51a583ca91b076f77361d7d872a5caa43a3` | `00f618b2a1816ffab2d59591afa8b76a5c8adb95` | `3b1003d920c28433d0e8d22fd1ff57fdd75d038d` | 4     | Unsupported generated help rejected; later cases unrun      |
| Corrected | `5fd0b61621c66abb3bdfee8e5514c7d74eec9070` | `3db5c2252f0de9595cef0728c8caa0c2c24f21ad` | `00f618b2a1816ffab2d59591afa8b76a5c8adb95` | `cbd4459a393851056b7cb5ec4ab5eecc0340d688` | 12    | Three help turns executed; selected strategy did not change |

Provider: `gpt-6.1-sol`, low reasoning, 4,096 maximum output tokens, 45 seconds per call, zero automatic retries. Total **16 actual calls**, **61,755 input tokens**, **3,474 output tokens** (65,229 total). Each successful turn used classification, proposal, generation and independent review, all through #75's shared reservation. The second batch used the original scenarios with fresh identities after reviewed prompt corrections; it was not an automatic retry.

Source: approved `network-performance-v1`, content version `3bd292c1476f5becb658418b70ee36153cfce830`, upstream `5deec5e741e2b8c0bc44566108a24cb783c2c7de`. The original curated question remained active throughout. A disposable local PostgreSQL database ran all six reviewed migrations with a non-superuser application role. All accounts, assignments and messages were synthetic.

Both `clarify` and `explain` were installed by an explicit **test-only** server policy on every turn. The harness did not select an action, force a classification, replace a model result or grant controller permissions. #53's production lesson policy was not enabled or tested. The broad authorized question context remained intact; the proposal's narrower `selected_source` went separately to #74.

## What actually happened

The first batch proposed `clarify` for confusion between bits per second and packets per second. The generated content included the unsupported categorical statement that packets contain multiple bits. Independent review rejected it; the dispatcher saved `invalid_output`, retained the private trace and returned the curated fallback without displaying help or grading an answer. The failure remains in the record.

That run also exposed an action-semantics gap. #85 now tells the proposer that neutral clarification cannot teach a definition or correct a misconception. #74 generation v4 enforces the same boundary before review; review v2 explains the existing assistance labels. R7 permits explanations to use `hint`, so the original review's suggestion that this label necessarily understates an explanation was not a valid contract interpretation. No grounding/disclosure acceptance condition was relaxed and no generated content was relabeled to pass.

| Corrected case                                                                   | Actual instructional result                                                     | Selected action and arguments        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| Rate mistaken for packets per second                                             | Corrected the counted unit to individual bits                                   | `explain`, `alternative_explanation` |
| New scripted observation: units understood, packet-duration relationship unclear | Used equal-width bit slots on a time strip to explain a longer sending interval | `explain`, `alternative_explanation` |
| All packet bits imagined entering simultaneously                                 | Used first/last-bit sender endpoints, distinguishing sending from cable travel  | `explain`, `alternative_explanation` |

The follow-up proposal explicitly referred to previously displayed help and the new reasoning. Its generated explanation addressed a different need. Nevertheless, **all three proposals selected the same action and style**. The different-strategy gate, changed-strategy-after-observation gate and stricter changed-action-label gate all failed. The harness exited nonzero and its overall status remains `incomplete_or_failed`; adapted wording is not reported as proof of the required changed instructional decision. No additional calls were made to obtain a preferred result.

Each of the three completed turns verified real reservation, model classification, exact source identity, accepted tool execution and durable teacher reconstruction. Replaying each request returned the saved receipt with **zero additional model calls**. Help was `created` with no visibility timestamp before acknowledgement, then `displayed` afterward. Original student text and proposal/validation/execution events were preserved. No answer was submitted or evaluated, and the student receipt excluded private rationale and generation fields.

An independent agent inspected all three final explanations against P05/P07/P08 and the active question. It found appropriate content assistance and no explicit active-answer or private-rubric disclosure. It also confirmed that changing wording does not satisfy the unchanged action/strategy gates. This is agent review, not human educational validation.

## Limits and remaining acceptance

Display acknowledgement and the next student observation were scripted by the harness, not observed in a browser or an actual classroom. The record establishes provider/database service integration and reliable rejection, not learning improvement, production enablement or the full changed-action acceptance. Uploaded lessons, #53 policy integration, live HTTP/browser routing, evaluated controller requests, generated diagnostic/retest handoff and reading delivery remain unverified.

The focused #85 branch passed **108 deterministic tests**, including 30 orchestration cases. The prompt correction reran all 30 orchestration cases and lint/format checks. Existing typecheck, production build and 293 content checks passed before that prompt-only change; combined #74/#75/#85 TypeScript also passed after their corrections. These deterministic results are distinct from the live results above.

Next integration step: connect reviewed production lesson policy and the existing conversation display flow to the composed services; complete the controller-authorized generated-question/reading adapters before advertising those tools. Then run a separately scoped acceptance case whose saved observation warrants a different permitted strategy, without forcing a model action or dropping failed gates. Human educational review and a real browser cycle are still required.
