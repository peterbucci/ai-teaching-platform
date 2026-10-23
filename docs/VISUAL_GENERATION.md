# Grounded visual generation (#41)

`lib/visual/generation.ts` generates and validates a concept graph or sequence diagram in `visual-v1`, or a packet experiment in the explicit `visual-v2` SI format. It returns an accepted activity and server-side provenance, or a useful text-tutoring fallback. It does not render an activity, choose the tutor's next action, submit an answer, advance a session, or mark assistance as displayed.

This is a service milestone for #41. #42 owns live visual selection and execution; #43 owns durable visual snapshots, display acknowledgments, evidence and authorized replay. Packet generation consumes the reviewed shared #38/#40 contract; new packet acceptance remains fixture-tested until an explicitly bounded actual-model check passes. The generator does not introduce another renderer, networking model, provider backend or tutoring controller.

## Service interface

Import `generateVisualActivity` from `lib/visual/generation.ts` and the request, result and service types from `lib/visual/generation-contracts.ts`.

```ts
type VisualGenerationRequest = {
  session_id: string;
  operation_id: string;
  expected_revision: number;
  kind: "concept_graph" | "sequence_diagram" | "packet_experiment";
  concept_ids: string[];
  source_passage_ids: string[];
};

const result = await generateVisualActivity(request, services);
```

The request contains identifiers and a requested selection. Its strict schema rejects extra source, actor, permission and provenance claims. It is not an authorization record. The server must construct `services` for the authenticated actor and the exact existing operation; never deserialize a service context from an HTTP body.

Every service dependency is mandatory:

| Port                                | Required behavior                                                                                                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveAuthorizedContext(request)` | Use the existing authorized lesson and operation resolver to load the pinned content, lesson anchor, canonical question, exact original student text, revision, generation policy and permitted families. Return the authorized concept/passage sets. |
| `assertCurrent(request, context)`   | Reauthorize the operation, source and revision against current server records. Called before generation, after generation before review, and after review before acceptance.                                                                          |
| `runReservedCall(descriptor, call)` | Bind #98's durable reservation service to this actor/session/operation. Enforce shared budgets, stable step identity, input hashes, settled replay and uncertain-outcome reconciliation.                                                              |
| `provider`                          | Supply the configured model and #98's structured-proposal transport. The generator has no default provider, SDK client or unrestricted fallback call.                                                                                                 |

The authorized context includes `ApprovedContent`, `LessonAnchor`, the canonical `QuestionSnapshot`, `student_text`, `assessment_status`, `runtime_generation_allowed`, `permitted_kinds`, and the server-owned source/concept scope. The generator verifies those references against the loaded approved content. The existing resolver remains responsible for ownership, assignment access, publication and exact lesson/source-version selection.

The integration branch preserves the original #41 work and normally merges the current #38 contract, #40 calculator, and main lesson/security dependencies. Production wiring also needs the merged #98 R7 implementation. Do not substitute a browser's reading text or import a second content resolver. Both the generator and its runtime dependencies must use the same checkout's content-reference schemas, including uploaded sources and UUID concept IDs.

## Generation, validation and factual review

A request can make at most two provider calls: `generate`, then `review`. Both use the existing R7 operation and shared reservation budget. They are not two independent budgets. A caller must reserve these stages for the visual tool and account for other calls already charged to the session. The generator neither reserves another operation nor retries a failed stage.

The generation prompt receives a bounded projection of the selected approved passages, approved concepts/objectives/boundaries, current question, assessment status and original student text. It does not receive the question rubric, expected-answer guidance or private misconception definitions. All supplied readings and student text are explicitly treated as untrusted data.

The model proposes only visible draft fields: `kind`, `title`, `text_alternative`, `guided_steps`, and graph nodes/edges, sequence participants/messages, or packet prediction prompt, SI parameters and bounded adjustable ranges. Server code binds `version`, the exact authorized `source`, `concept_ids`, family-appropriate controls, and provenance. Packet code also binds `model_version: packet-delay-v1`. A model cannot declare teacher approval, choose a calculation model, or supply calculated results. Graph/sequence generation retains its v1 prompts; packet generation and critique use distinct `visual-packet-generate-v2` and `visual-packet-review-v2` prompts and `visual-packet-generation-v2` provenance.

Acceptance requires all of the following:

- The requested family is permitted and matches the proposal; concepts and passages exist inside the authorized scope, and each target concept has selected source support.
- The draft passes its strict schema and the existing `validateVisualActivity` check. Shared schemas verify endpoint references and unique node/participant identities. Explicit kind dispatch also excludes inherited/prototype names before calling the shared validator.
- Packet SI inputs and ranges pass the canonical #40 schema and #38 activity refinements. The server calls `calculatePacketActivity` with the authorized source/concept scope and default parameters. The calculated seconds result is supplied only to factual critique, never inserted into the generated activity or exposed before prediction. Packet prompt, parameters and adjustable ranges are included in review coverage. Illustrative numeric inputs are distinguished from source facts; their instructional relationships still require supporting passages.
- The activity passes checks for markup, scripts, links/external assets, instruction-injection patterns, and normalized copies of private answer guidance or criteria. There are no executable formulas, arbitrary HTML/SVG or model-selected behaviors.
- A separate bounded review evaluates factual grounding, disclosure, relevance and answerability, and rejects any unverified quantitative calculation. It must provide a supported verdict and exact authorized passage quotes for every visible field, including edge endpoints and sequence order implications.
- Server code verifies complete, unique field coverage, known passage IDs, quote inclusion in the selected reading and source support for every target concept. Quote comparison collapses only ASCII layout whitespace (`[ \t\r\n\f]+`) to a single space and trims the comparison text, so a source line wrap may appear as a space in the quote. It does not change words, case, punctuation or interior Unicode spacing, and performs no fuzzy matching. The original quote remains unchanged in provenance. Unsupported or uncertain verdicts still reject the candidate.
- The authorized context and revision remain current. A hash also detects changes to the adapter-owned context across asynchronous calls.

The review receives the private rubric only for disclosure detection, with instructions never to quote it. Its output stays on the server. This allows rejection of paraphrased unrevealed answers as well as literal leaks. A separate model review and exact citations improve the evidence for acceptance; they do not prove educational correctness. A model may still misinterpret an exact quote or miss a subtle leak. Manual educational review and live integration checks remain necessary.

### Explicit bounds

The generator narrows the shared contract to six graph nodes/eight edges or four sequence participants/six messages, with at most three guided steps. Shared text limits still apply. The prompt asks for a smaller activity where practical. IDs/selection lists are bounded to twelve entries; concept and passage scope sets are bounded to thirty-two entries.

Student text is limited to 12,000 characters, the question prompt to 6,000, serialized private guidance to 12,000, and the public generation projection to 32,000. Each serialized provider input is limited to 64,000 characters. Oversized private guidance is rejected before generation can incur a charge. The R7 provider continues to own token limits, deadlines, cancellation and transport behavior; this service does not add a retry loop or expand those limits.

## Results and failure handling

On success, `result.activity` is a typed graph, sequence, or v2 packet experiment using #38's schemas. It contains no calculated outcome. `result.provenance` records the operation, expected revision, exact lesson anchor, cited passage IDs, activity SHA-256, generator version, actual model-call outcomes and accepted factual-review coverage.

Each call record includes the stage, actual returned model, response identity, prompt version, input hash, latency, usage and reconciliation status. Failed provider responses retain available model/response/usage metadata too; a billed incomplete response must not disappear from usage reporting. Unknown usage stays `null`.

Treat the result envelope as server-side data. Send only `result.activity` through the host's authorized student projection; do not serialize the provenance, private prompt inputs, review context or raw rejected candidate into the browser. The host separately supplies the player's authorized context, revision, permitted events and safe fallback text. Keep the provenance available to authorized persistence/review consumers.

| Failure                                         | Meaning and next step                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `invalid_request`, `not_authorized`, `stale`    | Invalid identifiers/scope or changed context. Return to the authorized current activity; do not apply the generated result.                      |
| `unsupported_contract`                          | Reserved compatibility failure for an unsupported calculation contract. Invalid v2 inputs currently fail schema validation.                      |
| `configuration`                                 | No configured model is available. No provider call is made.                                                                                      |
| `invalid_output`, `unsafe_output`, `ungrounded` | Reject the candidate. Do not display it or silently execute another tool.                                                                        |
| `provider_failure`                              | A known provider failure was returned. Preserve its usage and consult the operation record before any explicit retry.                            |
| `operation_denied`                              | An adapter established a known pre-dispatch denial, such as an exhausted budget. This alone does not imply an unknown paid outcome.              |
| `operation_unresolved`                          | A timeout, uncertain provider outcome or unclassified reservation/dispatch exception needs reconciliation. Do not automatically repeat the call. |

All failure results contain `fallback: "text_tutoring"`, a safe message, recorded call provenance and `needs_reconciliation`. `VisualOperationError` lets an adapter classify a known pre-dispatch `stale`, `not_authorized` or `operation_denied` error. Unknown exceptions are conservatively unresolved. A cancelled wait does not establish that the provider never executed.

The service itself does not change the student's original response, question, assessment or session state. Any explicit retry must follow the owning R7 operation's settled/unknown-outcome policy, rather than simply calling the provider again.

## #42 and #43 handoff

#42 should expose generation only after the existing controller has validated a visual action against the student's evidence, assignment policy, current revision and shared budget. It constructs the request and trusted ports, invokes `generateVisualActivity`, and handles rejection while preserving ordinary tutoring. Selection of a different visual or text tool belongs to a subsequent authorized decision, not an automatic fallback inside this generator.

#43 should persist the exact accepted specification and its hash/provenance with the existing operation/session/attempt links. Creation or acceptance is not display. Only an acknowledged actual display may count supplied content as assistance. Prediction, submitted settings, server results, explanations and follow-up links retain their separate evidence identities. Saved replay must use the accepted snapshot without a new generation call.

No production route, visual action registration, persistence migration or display-acknowledgment path is installed by this PR. The current #98 controller's text-generation stages must not accidentally share conflicting stage identities with a visual call. #42/#98 must agree dispatch and reservation-stage ownership before installing the live tool.

## Packet and player integration

#38 now exposes explicit v2 packet bits, link rate in bits per second, distance in meters, and propagation speed in meters per second. Its adapter uses #40's unchanged `packet-delay-v1` calculator and validates numeric seconds results. See [VISUAL_PACKET_CONTRACT.md](VISUAL_PACKET_CONTRACT.md). Only packet bits are integral; other valid inputs may be fractional. Controls narrow canonical bounds and leave unlisted inputs fixed. The model cannot submit a formula, result, old-unit control array, source permission, or model version.

An authorized packet request uses the same two reserved stages as other families. The server computes defaults for critique, but the eventual #42 runtime must reload the accepted snapshot, authorize the exact revision and submitted settings, and recompute the chosen result after prediction. Browser calculation previews do not establish server execution or #43 evidence. Legacy v1 packet payloads remain readable through the shared text fallback and are never silently converted into physical parameters. Three-family live acceptance remains incomplete until the new packet path has actual-model, rendered and runtime verification.

Graph and sequence output use the existing #39 player without copying or replacing its renderer. The independent #105 integration now handles uploaded-source attribution/version and v2 numeric packet playback. This #41 PR does not modify that renderer. Final generated-packet rendering and the live #42/#43 interaction loop remain separate checks.

## Verification commands and evidence

`tests/visual-generation.test.ts` contains twenty-six deterministic tests, all passing in the focused integration run. They cover authorization/version mismatches, malformed and injected content, private literals, unsupported relationships/review, quote/coverage checks including limited layout-whitespace equivalence, packet SI/range/authority validation, uploaded UUID scope, stale state, context mutation, budgets, replay denial, unknown outcomes, failed-call usage and oversized private context. The scripted provider/review fixtures are explicitly synthetic; they do not establish actual-model correctness. Final whole-suite counts belong in the verification record below.

```sh
npm test
npm run typecheck
npm run lint
npm run format:check
npm run content:check
npm run build
```

Final whole-repository checks, exact revisions, database/browser checks and actual-model evidence are recorded separately in [VISUAL_GENERATION_VERIFICATION.md](VISUAL_GENERATION_VERIFICATION.md). These checks establish the generator milestone, not the remaining #42/#43 live tutoring integration.

### Operator-only R7 check

`scripts/visual-generation-r7-adapter.ts` loads the actual #93/#98 resolver, operation store, structured provider and durable reservation functions from a trusted combined checkout. Its `createVisualCheckServices` helper is restricted to explicitly enabled synthetic checks. Its graph/sequence/packet allowlist is a test selection, not a policy decision installed in the live tutor.

`scripts/check-visual-generation.ts` uses fictional teacher/student identities in a disposable `visual41_*` PostgreSQL database, the existing non-superuser application role, and an approved runtime networking lesson. It prepares original student responses with clearly labeled fixture evaluations, then reserves operations through the existing controller. The evaluations are not new paid model assessments. Its separately selected RTT help case saves an actual student message through the existing conversation operation service and keeps the current assessment unanswered.

An operator must explicitly set `VISUAL_CHECK_SYNTHETIC=1`, configure the existing R7 provider/database environment, supply the combined checkout and a new report path, and choose a mode:

```sh
npm run visual:check -- --prepare-only --integration-root=/trusted/combined/checkout --output=/private/new-preparation-report.json
npm run visual:check -- --live --integration-root=/trusted/combined/checkout --output=/private/new-live-report.json
npm run visual:check -- --live --case=round-trip-help-sequence --integration-root=/trusted/combined/checkout --output=/private/new-rtt-report.json
npm run visual:check -- --live --case=distance-packet-experiment --integration-root=/trusted/combined/checkout --output=/private/new-packet-report.json
```

Prepare-only creates synthetic records but makes no model calls. The default live command retains its original six-dispatch ceiling and three graph/sequence candidates. The RTT and new packet cases require explicit `--case` selection and each limits that separate invocation to two dispatches. Durable #98 reservations remain the spending authority. The command stops on provider/uncertain failures; a settled content rejection may leave other independently planned cases runnable, but the rejected candidate is never retried automatically. It refuses to overwrite an existing report. Explicit invocations are paid checks and must stay within the operator's approved aggregate scope; the original verification used eight calls total. Adding the packet command does not mean it has been run.

For accepted cases it checks settled replay without new calls, foreign-actor rejection, stale-revision rejection and unchanged original student evidence. Its private report retains accepted specifications, exact usage/provenance and provider-record outcomes without publishing private prompts. Independent manual review must assess the accepted relationships, sequence ordering, guided questions and relevance to each original response. Player rendering requires its separate check. These scripts neither install #42's AI tool choice nor implement #43's saved visual evidence or assistance acknowledgment.
