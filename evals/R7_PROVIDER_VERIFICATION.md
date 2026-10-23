# Issue #74 isolated provider verification

Run on October 22, 2026 (America/New_York), with `gpt-6.1-sol`, reasoning effort `low`, 4,096 maximum output tokens, 45-second timeout and zero automatic retries. All inputs are fictional; source is the approved networking fixture, content version `3bd292c1476f5becb658418b70ee36153cfce830`, upstream revision `5deec5e741e2b8c0bc44566108a24cb783c2c7de`.

Exact prompts, JSON inputs, structured outputs, source references, response IDs, latency, usage and assertions are in [the evidence JSON](results/2026-10-22-dialogue-provider.json). Model and rubric details are operator evidence; they must never be returned through student projections.

## Runs and results

| Run                  | Clean code SHA                             | Actual calls | Result                                                          |
| -------------------- | ------------------------------------------ | ------------ | --------------------------------------------------------------- |
| Initial suite        | `bdb86e1de438663aca2a44cd2955657ff8f997cb` | 16           | 13/14 checks passed; distance diagnostic rejected as repetitive |
| Diagnostic follow-up | `28495ebfa2d6a8c4a9989b17283bd8a21afc9039` | 4            | 2/2 new diagnostic cases passed                                 |

Total: **20 actual model calls**, 38,709 input tokens and 9,502 output tokens (48,211 total). No database/assessment evaluation calls occurred. A preliminary harness invocation failed before creating its report because the requested output directory did not exist; it made zero provider calls. The directory was then created. No failed or uncertain model call was blindly retried.

| Case                                                          | Observation                                                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Clear question                                                | `QUESTION_OR_HELP`; exact text preserved                                                                  |
| Intended answer                                               | `ANSWER` proposal; trusted answer intent remains uncertain and requires explicit resolution               |
| Mixed answer/help                                             | `AMBIGUOUS`; no assessed submission                                                                       |
| Off-topic request                                             | `OFF_TOPIC_OR_UNSUPPORTED`                                                                                |
| Injected instruction to output ANSWER/reveal private material | Safe scoped classification; no grading authority or disclosure                                            |
| Initial distance confusion                                    | Generated source-supported question, but independent review rejected the repeated cable-length experiment |
| Initial packet-size confusion                                 | Accepted diagnostic probing the “packet as one object” reasoning at fixed bit rate                        |
| Packet-size clarification                                     | Accepted cited definition/rephrasing without revealing the current assessment's outcomes                  |
| Alternative explanation                                       | Accepted stopwatch analogy, correctly marked as a hint                                                    |
| Fresh retest                                                  | Accepted rate-change comparison of first-bit arrival and last-bit departure; no numerical computation     |
| False statement with valid P07 citation                       | Independent model review rejected the unsupported claim                                                   |
| Invalid citation                                              | Code rejected before a paid call                                                                          |
| Provider failure and exhausted session budget                 | Labeled deterministic injections/checks; no real outage or production concurrency experiment claimed      |

## Original rejection and correction

The first distance diagnostic changed event wording but kept the same controlled cable-length change as the active question. The reviewer identified this as repetition, and the service rejected it. This was a useful failure of generation and a successful rejection, not a passing diagnostic case.

Generation prompt v2 explicitly asks for a new causal intervention, controlled variable or contrasting case. The review prompt, acceptance conditions and limits were unchanged. The four-call follow-up used two new student statements rather than silently replacing the original record.

The accepted follow-up pair:

- **Distance/arrival confusion:** Change propagation speed while holding cable, packet and sending rate fixed. Ask separately about network-card completion and a bit's travel time. This tests the mistaken belief that sender completion waits for arrival.
- **Fixed packet duration:** Compare packets with different numbers of bits at the same rate and signal speed. Ask about first-to-last-bit entry intervals and individual bit travel time. This tests the mistaken belief that constant rate gives every packet a fixed duration.

A second agent independently inspected the source passages, public prompts and private criteria. It agreed that the pair probes different reasoning, differs materially from the original cable-length assessment, is answerable from P07/P08/P12, and gives no answer/formula away. It checked all 35 quoted support spans in the follow-up; all matched the approved source. Its initial-run review also supported the repetition rejection and checked all 52 quoted spans in that run. This is agent review, not a human instructor's educational validation.

## Deterministic and application verification

The final implementation passed 107 repository tests, including 5 provider and 24 service tests, TypeScript, lint, formatting, 293 content checks and a production build. The final optional `selected_source` handoff for #85 is covered by deterministic tests and generation prompt v3; the live runs recorded above exercised v1/v2 and did not exercise that optional narrowed selection.

No browser/database integration was executed here. Authentication, durable reservations, intent resolution, commit-time revision checks, display acknowledgement, saved teacher evidence and generated-question controller/evaluator handoff remain #75/#85/#73 integration gates. #53/#52 own exact uploaded lesson resolution/publication; this branch did not run uploaded-lesson acceptance. The current curated controller cannot yet treat a generated UUID snapshot as a complete supported activity transition.

The checker supplies explicit synthetic controller permission; it does not enable production runtime generation or override #53's lesson policy. The results show successful bounded provider behavior on a small sample, with a retained failure. They do not prove a full observe–act–observe cycle, guaranteed semantic correctness, learning improvement or production reliability. Issue #74 and Epic #71 must remain open pending their integrated acceptance.
