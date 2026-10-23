# Learning Pulse — R7 Dialogue and Agentic Tutoring Contracts

**Status:** Existing `r7-v1` contracts on `main`; `r7-conversation-v1` single-composer extension in **draft PR #81**; live classification, generation, orchestration and durable conversation routing still require integration.  
**Design checkpoint:** October 22, 2026  
**Primary epic:** [R7 — Adaptive AI Dialogue (#71)](https://github.com/peterbucci/ai-teaching-platform/issues/71)

> **Purpose:** Preserve the implemented R7 contract invariants while defining how they integrate with the revised **one-conversation, agentic tutor**. This document is a contract and implementation guide, **not proof that a model-powered agent is deployed**. Consult [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md), [AGENTS.md](../AGENTS.md), [Agentic Architecture](AGENTIC_ARCHITECTURE.md), [Demo Plan](DEMO_PLAN.md), and the current branch/PR before coding. The older [roadmap #15](https://github.com/peterbucci/ai-teaching-platform/issues/15) and [release epic #9](https://github.com/peterbucci/ai-teaching-platform/issues/9) may still contain pre-reset MVP language pending review.

## 1. Goals and boundaries

A student should interact with **one conversational input**. The student can ask questions, request examples, explain their reasoning, or answer an active lesson question without choosing an Ask/Answer mode first.

The **real model** considers the current approved question, relevant conversation history, and student message; it proposes the message intent. For an unambiguous intended answer, the application may route through the existing assessed-answer path **only after server-side intent review**. Genuine ambiguity requires a visible clarification before grading. A help request must never be silently counted as an answer.

Beyond interpreting intent, the student tutor should **propose a meaningful instructional action** based on evaluated student evidence: retrieve authorized passages, generate a source-grounded explanation or diagnostic, request a supported R1 visual activity, or continue with a permitted retest. **The application** checks the allowlist and actually executes the tool. After the student responds, the loop can make another bounded decision.

**Not permitted:** A second chatbot/evaluator/state machine, unrestricted autonomous loops, model-selected permissions, arbitrary browser code, direct model updates to grades/class assignments, invented sources, or unapproved student-specific/teacher-wide interventions. The existing deterministic curated tutor must remain usable if R7 is disabled or unavailable.

## 2. What exists today versus intended integration

| Layer                                         | Source of truth / current status                                                                                                                                                                                   | What is still needed                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Existing evidence/question rules              | [`lib/evidence/contracts.ts`](../lib/evidence/contracts.ts), [`lib/evidence/rules.ts`](../lib/evidence/rules.ts), PostgreSQL                                                                                       | Add only the evidence links required by live dialogue and tool execution                        |
| Versioned R7 pure contracts                   | [`lib/dialogue/contracts.ts`](../lib/dialogue/contracts.ts), [`rules.ts`](../lib/dialogue/rules.ts), [`examples.ts`](../lib/dialogue/examples.ts), [`tests/dialogue.test.ts`](../tests/dialogue.test.ts) on `main` | Connect them to authenticated storage and a real provider                                       |
| Single-composer UX / classification contracts | [Draft PR #81](https://github.com/peterbucci/ai-teaching-platform/pull/81): `app/study/dialogue.tsx`, `lib/dialogue/conversation.ts`, `student-view.ts`, preview/tests                                             | Merge after review; implement the `ConversationTransport` backend in #74/#75                    |
| Model evaluator and tutor                     | [`lib/evaluation/evaluate.ts`](../lib/evaluation/evaluate.ts), [`lib/tutoring/decide.ts`](../lib/tutoring/decide.ts), [`store.ts`](../lib/tutoring/store.ts)                                                       | Extend allowed actions without replacing existing evaluation or controller authority            |
| Authorized lesson/version resolution          | Curated networking package on `main`; [R4 #53](https://github.com/peterbucci/ai-teaching-platform/issues/53) planned                                                                                               | Ensure generated questions and help use the exact authorized lesson version                     |
| Visual activity                               | [R1 #38–#43](https://github.com/peterbucci/ai-teaching-platform/issues/17) planned                                                                                                                                 | Add a **validated** R1 tool to the orchestrator's available actions, without new parallel tutor |
| Real R7 acceptance                            | [#76](https://github.com/peterbucci/ai-teaching-platform/issues/76)                                                                                                                                                | Run actual-model, cross-role, failure/recovery checks; fixtures are not sufficient              |

PR #81's described browser checks and passing CI apply to its **fixture UI/contracts**, not live AI intent classification or grounded dialogue. On the production study page, unconnected help still gets a **truthful unavailable fallback**; it must not show synthetic responses as though generated live.

## 3. Existing lower-level contract (`r7-v1`)

`DIALOGUE_VERSION = "r7-v1"` is defined in `lib/dialogue/contracts.ts`. **Retain it** while the new conversation layer routes to these explicit server-side actions.

### Student actions and state

- `StudentActionSchema`: discriminates `submit_answer`, `ask_tutor`, and `return_to_lesson`. These are **authorized internal operations**, not mandatory student UI modes.
- `AskTutorSchema`: preserves `purpose` (`question`, `clarification`, `example`, `alternative_explanation`) and a text request. An optional quick-action purpose is a _hint_, not classification authority.
- `LessonAnchorSchema`: server-issued `session_id`, `assignment_id`, `attempt_id`, `root_attempt_id`, `sequence_index`, and exact `content_ref`.
- `DialogueStateSchema`: anchor plus `revision`, current `TutorView.progress`, `enabled`, `active_request_id`, `turns_used`, and `provider_requests_used`.
- `LessonDraftSchema`: draft text belongs to that exact lesson/attempt, never to a different student's or revised activity.
- `DialogueHistorySchema`: bounded **accepted, student-safe** messages; do not pass raw provider outputs, unrevealed answers, or private rubrics as chat history.

`submit_answer` wraps the existing `SubmitAnswerSchema`. The existing `IntentSchema` in evidence describes **assessment attempt kinds**; do not confuse it with the **student's conversational message intent**.

The server owns revisions. Cancelling/returning, an assessed-answer transition, or generated-question handoff invalidates older work. A repeated identical request reuses the stored result; reusing its ID with different input is rejected. Never accept a stale completed model call into a later attempt.

### Generation and display

- `DialogueRequestSchema`: owned request ID/revision/lesson, originating from either a student ask or a controller-authorized evaluation follow-up.
- `GeneratedDialogueSchema`: `kind: "help"` or `kind: "question"`, with source/version and generation provenance.
- For a **generated assessed question**, reuse `QuestionSnapshotSchema`; preserve immutable identity (`question_id = content_id`), source passage IDs, concept IDs, question wording, embedded scaffolding, and **server-private** rubric/answer guidance.
- `validateGeneratedDialogue()` validates structured references and scope, but **cannot on its own prove factual support or catch an answer leak**. `DialogueReview` must be provided by trusted server checks—not copied from model output.
- `StudentDialogueContentSchema` / `toStudentDialogueContent()`: explicitly project student-safe help/questions, omitting rubrics, internal hypotheses, expected answers, raw generation records and sensitive provider metadata.
- `DialogueEventSchema`: append-only `requested → generated → accepted → displayed`, or a terminal `rejected`, `failed`, or `cancelled` outcome.
- `DisplayDialogueSchema`: acknowledges the **actual accepted help shown** to the student; it must resolve to a saved accepted event and authorized intervention before server time is recorded.

A generated student help request cannot authorize an assessed diagnostic on its own. A new assessed question is accepted only through an allowed controller transition and immutable question snapshot. Existing authored questions remain a curated fallback.

**Exposure rule:** A hint/explanation counts as assistance only when **actually displayed** (or when scaffolding is part of a question that was actually displayed). A generated-but-undisplayed response is not assistance. Help provided after submission does not retroactively change that original answer; it may affect later answers. A correct immediate retest after help is **not** durable mastery.

## 4. Single-conversation contract (`r7-conversation-v1`, PR #81)

**This section documents the unmerged draft PR design, not a current `main` API.** The branch adds `lib/dialogue/conversation.ts`; code consumers must verify the merged version rather than assuming the file exists on `main`.

The key constants/types in that branch are:

- `CONVERSATION_VERSION = "r7-conversation-v1"` and `MESSAGE_CHARACTERS = 12_000`.
- `ConversationActionSchema`: `send_message`, `resolve_intent`, or `cancel_message`.
- `ConversationMessageSchema`: original text plus optional purpose hint, classification, and a typed outcome.
- `IntentClassificationSchema`: one proposed `category` plus a short server-only `rationale` (max 600 characters).
- `ConversationViewSchema`: the existing student-safe dialogue view **and** the student's immutable original messages and routing outcomes.
- `ConversationTransport`: `load()`, `act(action)`, and `acknowledge(display)`; #75 must provide authenticated live server operations.

`send_message` includes request/session/attempt IDs, `expected_revision`, exact text and optional `purpose_hint`. **The browser does not choose whether it is an assessed answer.** `resolve_intent` and `cancel_message` use their **own** request IDs and reference the original `message_request_id`; they cannot replace the original text with edited content. A quick-action chip may fill editable text, never auto-submit or decide intent.

### Proposed message-intent outcomes

| Classification             | Meaning                                                         | Required server behavior                                                                                                           |
| -------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `ANSWER`                   | Clear attempt to answer the active question                     | Perform trusted server review of _intended submission_; route to existing `SubmitAnswerSchema` once established; otherwise clarify |
| `QUESTION_OR_HELP`         | Student asks for help, definition, example, another explanation | Route exact original message to grounded R7 help; **do not** create assessed attempt                                               |
| `AMBIGUOUS`                | Reasonably could be help or an answer                           | Ask within the conversation: **“Submit as my answer”** or **“I'm asking for help”**; do nothing irreversible until resolved        |
| `OFF_TOPIC_OR_UNSUPPORTED` | Not within authorized lesson/scope or safely answerable         | Application-owned scoped fallback, not an invented answer or failing grade                                                         |

Classification must consider the **actual model** and relevant authorized context; no keyword/punctuation classifier, fixed example lookup, or client-side guessing. The optional `purpose_hint` is a convenience, never routing authority. A model's label alone is **not** permission to grade. The student should have a correction path when intent cannot be established safely.

`routeClassifiedMessage()` (PR #81) is **pure**: it validates a trusted server review and returns a proposed route (`submit_answer`, `ask_tutor`, `clarify`, or `fallback`). It does **not** call a model, authenticate a student, submit an answer, save a dialogue, or advance lesson state. Those effects belong to #74/#75 and the existing stores.

**Example:**

1. Tutor asks: _“What changes when the cable becomes twice as long?”_
2. Student sends: _“What do you mean by transmission delay?”_ → `QUESTION_OR_HELP` → source-grounded response. **Zero** assessed answers.
3. Student sends: _“Could you explain another way?”_ → grounded follow-up; previous conversation is retained.
4. Student sends: _“Transmission delay stays the same; propagation delay doubles because distance doubled.”_ → intent review establishes `ANSWER` → existing answer/evaluation once.
5. If the student instead sends _“I think it's distance. Is that right?”_, the server may return `AMBIGUOUS`, preserving the message and offering an explicit choice.

### Outcome and projection invariants

The draft `ConversationMessageSchema` outcome statuses are `pending`, `clarification`, `help`, `answer`, `fallback`, and `cancelled`. An `answer` outcome contains the existing idempotent `submission_key`. A `help` outcome links to the exact existing dialogue request with the same original message and owned attempt. The student projection must not contain raw classifier rationale, private evaluation guidance or rejected model text.

- The original message is **immutable** after acceptance. Never rewrite it when the student clarifies intent.
- A saved `ANSWER` cannot be recreated by receiving a duplicate or late response. Fetch the current `TutorView` after a saved answer receipt to determine the next activity.
- At most one message remains unresolved per active attempt. Another message should wait until its outcome is settled or explicitly cancelled.
- An accepted help event must be acknowledged as displayed before later submission can use accurate assistance accounting. Unknown acknowledgement outcomes are reconciled read-only.
- Browser tab storage is **draft/UI recovery only**; PostgreSQL holds authoritative dialogue state when #75 is implemented.
- Cancellation must be durable. A late model result cannot revive a cancelled request or replace a newer question.
- Existing answer submission and retry identities remain unchanged. Do not build a second evaluator or submission state machine for the new composer.

## 5. Proposed agentic action layer (new integration; NOT implemented by these contracts)

R7 needs more than generative responses: **meaningful bounded action choice**. Add one focused server-owned orchestration interface, coordinating [#74](https://github.com/peterbucci/ai-teaching-platform/issues/74), [#75](https://github.com/peterbucci/ai-teaching-platform/issues/75), the existing controller, and R1's visual adapter.

This is a **responsibility contract**, not an existing TypeScript schema or permission to invent a separate agent platform.

**One bounded cycle:**

1. Authenticate; load permitted active student/assignment, exact lesson version, validated evaluation, displayed assistance, source scope, and relevant history.
2. Application calculates an **allowlist** of tools/actions from the current state and approved lesson policy.
3. The real model returns **one structured proposed action**, targeted concept/passage references, and a concise auditable reason (not hidden reasoning text).
4. Server validates request identity, permitted action, authorized source, grounding and disclosure, budgets, timing, and current revision.
5. Application executes the allowed reviewed tool, **one action at a time**, then stores proposal, acceptance/rejection, actual tool result and display evidence.
6. Student response or experiment outcome becomes new evidence; reevaluate and choose an appropriate next permitted action or stop.

Illustrative **candidate** actions (names below are descriptive, not committed API strings):

| Candidate action                       | Runtime ownership                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| Retrieve authorized reading passage(s) | R4 content resolver / scoped retrieval; no general unrestricted web search        |
| Generate a targeted diagnostic         | R7 generator + existing controller; immutable question and private rubric         |
| Give a grounded explanation/example    | R7 generator; cite approved passages; honor active-answer leakage policy          |
| Request a supported visual             | R1 structured generator/player/calculation service; only when enabled and allowed |
| Fresh retest or end/review             | Existing tutor rules + approved policy; bounded stopping condition                |

The model does **not** directly invoke arbitrary functions. The server maps validated typed proposals to a narrow tool registry. A disallowed action is **rejected/fallback**, not quietly executed because a model requested it. R1 visuals must use **validated specifications, reviewed React components, and server-verified calculations**, not AI-authored executable code/formulas. R2 official teacher assignments must never be issued directly by the student tutor.

The orchestrator should reuse `lib/tutoring/decide.ts` and existing transaction/recovery patterns, with focused action-proposal schema(s) rather than a second state machine. An orchestration story under R7 should own shared typed decisions, allowlists, dispatch, operation evidence and an integrated observe–act loop; prevent duplicated ownership with #74/#75.

## 6. Grounding, lessons, and educational review

- Use only **teacher-approved material for the exact authorized assignment/version**, obtained via #53's resolver as multi-lesson support lands. Do not call `loadApprovedContent()` indiscriminately for unrelated uploaded lessons.
- Source documents and immutable published lesson versions are **different identities**. An assignment pins one approved lesson version. Later teacher edits cannot rewrite a student's earlier question or evaluation.
- A suggested misconception is a **tentative, response-supported hypothesis**. A wrong answer, partial reasoning, or arithmetic error alone cannot establish a stable belief. Use `other_or_uncertain` where no reviewed category applies rather than inventing IDs.
- Validate citation ID **and semantic support**; correct syntax or a matching passage number is insufficient.
- Support genuinely different question variations and diagnostics for different evidence. Generated questions must be answerable with private criteria, concept scope, source/version and generation provenance.
- A student asking for the unrevealed answer to an active assessment gets **permitted scaffolding**, not the private answer or rubric. Treat course documents and student/model text as untrusted data; ignore embedded requests to change roles, call tools or expose private content.
- Model recommendations remain advisory. The application validates them, and an educationally unsupported proposal must not be presented as checked instruction.

## 7. Persistence, idempotency, delivery, and recovery (#75)

All accepted operations need **authorized PostgreSQL persistence**; local browser state and synthetic examples are not an evidence store.

Store/link the following without rewriting history:

- Actor/role; student, assignment/class, session, active question/attempt and source version.
- Original message, user-supplied purpose hint, model's proposed classification, trusted server decision and any explicit student resolution.
- Action proposal, server allowlist/validation outcome, executed tool, result/failure, request and idempotency IDs, model/template/source provenance.
- Generated question snapshot or exact help text, accepted citations and any embedding scaffolding, **display acknowledgement** and server timestamp.
- Later attempted answers, evaluations, visual interactions and next actions; distinguish assistance, independent retrieval and immediate retests.

**Sequence and failure invariants:**

- Authenticate/authorize **before** provider work; reserve the request and per-session usage under an appropriate DB lock/transaction.
- Repeated same request ID + same payload → reuse stored outcome; same ID + different payload → reject.
- Revalidate active attempt/session/source/revision **at commit**. A stale/tab-cancelled result must not apply.
- Pending calls, cancelled operations, accepted-but-unseen help, displayed help, failed provider outcomes and rejected content are **different states**.
- Unknown provider outcome → read-only reconciliation, **not** silent second paid request. Do not promise exact-once external billing.
- On resume or reconnect, preserve original question, saved answers, draft where authorized, dialogue history, displayed-assistance evidence and pending/failed status.
- Never mark failed/rejected/undisplayed help as “seen.” A student can still return to the safe curated path without losing existing evidence.
- Another student or unrelated teacher must not read or mutate the exchange. Keep teacher-only rubric and other private metadata out of student projections.

The original `DialogueEventSchema` and `appendDialogueEvent()` validate delivery history; **#75 must add the actual authorized transactions and durable request reservations**. Do not confuse pure validation with implemented DB durability.

## 8. Existing limits and retry policy

The **runtime source of truth is `DIALOGUE_LIMITS` in `lib/dialogue/contracts.ts`**; the table below reflects its October 22 `main` values, not a new configuration.

| Limit                                                        | Value                                        |
| ------------------------------------------------------------ | -------------------------------------------- |
| Explicit `AskTutorSchema` request                            | **2,000 characters**                         |
| New single-composer original message (PR #81)                | **12,000 characters** (`MESSAGE_CHARACTERS`) |
| Saved draft                                                  | **16,000 characters**                        |
| Help response / individual accepted history message          | **6,000 characters**                         |
| Entire generated content payload, including private guidance | **16,000 JSON characters**                   |
| Bounded history                                              | **12 messages / 12,000 characters total**    |
| Dialogue turns per session                                   | **12**                                       |
| Provider requests per session, including retries             | **36**                                       |
| Concurrent provider calls per session                        | **1**                                        |
| Provider timeout                                             | **45 seconds**                               |
| Model output                                                 | **4,096 tokens**                             |
| Automatic provider retries                                   | **0**                                        |
| Explicit retries per turn                                    | **2**, with **60-second** cooldown           |

**Important distinction:** The free-text composer can accept up to 12,000 characters, but the existing _help_ contract allows 2,000. An overlong message classified as help must produce a truthful safe limit/fallback or request shortening **without truncating the original text or silently grading it**.

Intent classification and later generation **both consume provider budget**. Respect the same session reservation/concurrency limits; do not create a hidden secondary request counter or provider retry loop. New cross-tool step budgets must be explicitly reviewed and bounded before implementation. An exhausted budget leaves the deterministic curated text path usable.

`validateDialogueRetry()` and `assertProviderAttemptAllowed()` enforce the existing linked-retry/cooldown concepts. An unknown or interrupted provider result must be reconciled before any later paid retry; a successful accepted result must be reused instead of regenerated.

## 9. Verification: what must be true to call R7 integrated

**Deterministic contracts/fixture checks:**

- [ ] Two explicit intents and one ambiguous free-text message are routed correctly by **server-reviewed** rules; no client-side assumption about punctuation.
- [ ] Ask, clarification and cancel leave the active assessed attempt unchanged until an intended answer is submitted.
- [ ] A generated question has a valid snapshot/private guidance, stable identity, source scope and a **different** follow-up prompt.
- [ ] Unknown citations, mismatched source version, unsupported claims, private-answer leakage and unknown actions are rejected.
- [ ] State revisions, idempotency, cancellation, display acknowledgment, retries and cross-user authorization preserve exact original evidence.
- [ ] Help actually displayed affects only eligible later assessed answers; asking itself is never an evaluated attempt.
- [ ] Feature-disabled/timeout/exhausted-budget cases preserve drafts/session and curated fallback.

**Actual-model integration checks (owned by [#76](https://github.com/peterbucci/ai-teaching-platform/issues/76)):**

1. Run two previously unseen fictional misunderstandings about the **same concept**: distance versus transmission time, and packet size at fixed bit rate. Demonstrate **materially different, appropriate** real generated diagnostic questions or instructional actions. Capture why each choice fits the evidence; superficial rewording is insufficient.
2. In one active lesson, send _“What do you mean by packet size?”_ and _“Explain that another way.”_ Get **supported, cited** responses with **zero assessed answers** from those asks.
3. Give an intended answer in the **same composer**; the application assesses it once through the existing evaluator. Test a genuinely ambiguous message and confirm it stays ungraded until resolved.
4. Demonstrate one **real agentic cycle**: AI proposes permitted action → server validates/executes approved tool → student reacts → resulting evidence changes the next decision. With R1 enabled, show an **AI-selected** validated visual, not a pre-scripted button.
5. Refresh/reconnect and inspect authorized teacher evidence: exact original texts, source/version, generation/model provenance, displayed assistance and later outcomes; verify another actor's access denial.
6. Test provider timeout, invalid output, prompt injection, private-answer request, off-topic input, duplicate clicks, stale tab, failed display acknowledgement, feature disabled and recovery without duplicate charged calls or corrupted attempts.
7. Re-run the existing curated deterministic tutor with all extensions disabled or unavailable.

**Record proof, don't just tick boxes:** exact code SHA, date, model/config, fictional input, accepted/rejected outputs, validated source, executed tool, teacher/student observations, replay/database IDs, limitations and a reviewer conclusion. Passing `npm test`, JSON verifiers or browser fixture previews does **not** establish live R7 agentic behavior.

Useful existing commands (run only with appropriate environment/configuration):

```sh
npm test
npm run content:check
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run tutor:check
npm run reading:check
npm run eval:live
```

## 10. Issue ownership and delivery boundaries

| Owner                                                                                                                                           | Work                                                                                                                        | Non-goals / dependencies                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [#72](https://github.com/peterbucci/ai-teaching-platform/issues/72)                                                                             | Existing `r7-v1` contract/examples merged in PR #77                                                                         | Do not reopen a completed contract issue just because its consumers expand                 |
| [#73 / draft PR #81](https://github.com/peterbucci/ai-teaching-platform/issues/73)                                                              | One composer, student-safe view, unclassified message, ambiguity UI, preview and recovery                                   | UI/contract alone **is not** live classification or persistence                            |
| [#74](https://github.com/peterbucci/ai-teaching-platform/issues/74)                                                                             | Real model classification, grounded dialogue/question generation and trusted content review                                 | Coordinate with orchestrator for action choice; do not replace evaluator/controller        |
| [#75](https://github.com/peterbucci/ai-teaching-platform/issues/75)                                                                             | Authenticated session/event persistence, answer/help routing, revisions, reservations, assistance/display, teacher evidence | No duplicate evidence DB or parallel submission handler                                    |
| **New focused orchestration story**                                                                                                             | Typed allowed-action proposals, server validation/dispatch and observe–act loop                                             | Keep inside R7 or shared tutor service; don't create multi-agent platform                  |
| [R1 #38–#43](https://github.com/peterbucci/ai-teaching-platform/issues/17)                                                                      | Validated structured diagrams/experiments, checked math and interaction evidence                                            | R7 may request R1 via one allowed action; R1 tool need not be rewritten as an R7 generator |
| [R4 #53](https://github.com/peterbucci/ai-teaching-platform/issues/53)                                                                          | Exact assignment/approved lesson-version content resolver                                                                   | Curated networking content is a regression fixture, not the only future lesson             |
| [#76](https://github.com/peterbucci/ai-teaching-platform/issues/76) / [release #9](https://github.com/peterbucci/ai-teaching-platform/issues/9) | Integrated real-model cross-role acceptance and reliable demo                                                               | Test live agentic result separately from deterministic baseline                            |

R2 teacher interventions consume saved, authorized learning evidence **later**. They are not a student-tutor tool that can automatically publish or assign work. See [Agentic Architecture](AGENTIC_ARCHITECTURE.md) for teacher-specific copilot and intervention boundaries.

## 11. Implementation order and review expectations

1. **Reconcile scope** with [Project Context](../PROJECT_CONTEXT.md), [Architecture](AGENTIC_ARCHITECTURE.md), current roadmap and PR branches. Respect active teammate work; don't overwrite draft PR #81.
2. Extend accepted R7 contracts **additively**, with a reviewed proposed-action/allowed-tool boundary. Coordinate source resolution (#53), visual formats (#38) and persistence (#75) before touching shared files.
3. Wire real classifier/generator (#74) and authorized transactional transport (#75) to the single composer (#73), without inventing a duplicate tutoring engine.
4. Add the narrow agent orchestration and R1 tool adapter; persist the full proposal/accept/execute/observe trace.
5. Execute [#76](https://github.com/peterbucci/ai-teaching-platform/issues/76)'s actual-model tests; preserve original answers, session restart/resume, and teacher evidence.
6. Finish the [Demo Plan](DEMO_PLAN.md) checks and report actual vs unrun cases. Leave incomplete epics open.

**Final contract rule:** The student's natural message is **not** an automatic assessed answer, model output is **not** an authorized action, and a generated tool response is **not** proof of learning. Those distinctions must remain explicit in the UI, server transitions and stored evidence.
