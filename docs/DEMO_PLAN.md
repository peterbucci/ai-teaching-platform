# Learning Pulse — Hackathon Demonstration Plan

**Status:** Revised demo target; not a claim that every feature works  
**Planning date:** October 23, 2026
**Event:** UMass Boston PEAAII AI Applications Hackathon  
**Submission date:** **October 25, 2026** · **Finalist symposium:** October 29, 2026

> **Read first:** [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md), [Agentic Architecture](AGENTIC_ARCHITECTURE.md), and [AGENTS.md](../AGENTS.md). This plan sets out the **demonstration we want to deliver**. Check the current [GitHub project](https://github.com/users/peterbucci/projects/7), [roadmap #15](https://github.com/peterbucci/ai-teaching-platform/issues/15), [release epic #9](https://github.com/peterbucci/ai-teaching-platform/issues/9), and pull requests for what is actually implemented.

The [official PEAAII events page](https://ai.umb.edu/events/) identifies **Agentic AI** as the 2026 program theme and October 25 as the hackathon project-submission deadline. **Verify the exact submission time, timezone, format, judging rubric, team requirements, and upload instructions in the team's Canvas course.** This document does not claim access to that private rubric or confirm a particular video length.

## 1. The story we want the judges to see

**Learning Pulse helps teachers identify possible gaps in understanding, inspect the student reasoning behind them, prepare targeted support with AI, and examine what students demonstrate afterward.** Teachers review, edit, approve, and assign interventions. The student tutor supplies learning evidence and bounded instructional actions that support this teacher-facing story.

Lead with one connected journey:

**Teacher overview → original student evidence → AI intervention draft → teacher review/edit/approval → delivery → student follow-up → teacher examines subsequent evidence.**

Lesson authoring remains part of the product: **teacher uploads material → AI suggests objectives/questions → teacher reviews → publishes and assigns**. Show this as a short supporting workflow after the teacher value is clear, using an approved lesson already available for the core demonstration.

The key demonstration of **agentic AI** remains **a real model selecting an appropriate action based on new evidence, the server executing an approved tool, and a later observation changing what happens next**. A fixed script, a classifier alone, a chat response alone, or a generated UI is not enough. Make the model proposal, server authorization, actual executed result, and subsequent evidence inspectable without requiring judges to understand internal implementation details.

**UI/UX quality, reliability, and presentation are release requirements.** A backend test pass does not establish that a teacher can find the evidence, understand the next step, complete an intervention, or recover from a failure. A teammate must independently rehearse the actual interface.

## 2. Delivery priorities

This October 23 reprioritization supersedes the October 22 capability-first presentation order. Preserve existing owners, completed work, and issue history; use the existing workstreams rather than reopening implemented features or creating duplicate epics.

| Priority | Release outcome | Existing ownership |
| --- | --- | --- |
| **P0** | Clear teacher overview, inspectable original reasoning, cautious evidence labels, and a navigable path to action | [#8](https://github.com/peterbucci/ai-teaching-platform/issues/8), [#9](https://github.com/peterbucci/ai-teaching-platform/issues/9), [#114](https://github.com/peterbucci/ai-teaching-platform/issues/114) |
| **P0** | R2 draft → teacher edits/reviews recipients → explicit approval → separate delivery → linked student follow-up and comparison | [#44](https://github.com/peterbucci/ai-teaching-platform/issues/44), [#45](https://github.com/peterbucci/ai-teaching-platform/issues/45), [#46](https://github.com/peterbucci/ai-teaching-platform/issues/46) |
| **P0** | Preserve the working R4/R7 content, tutor, evidence, permission, and recovery paths needed for the teacher journey; verify the integrated main build | [#71](https://github.com/peterbucci/ai-teaching-platform/issues/71), [#76](https://github.com/peterbucci/ai-teaching-platform/issues/76), [#85](https://github.com/peterbucci/ai-teaching-platform/issues/85), [#35](https://github.com/peterbucci/ai-teaching-platform/issues/35) |
| **P0** | Consistent interface, clear navigation/context, usable loading/empty/error states, independent rehearsal, reliable deployment, backup recording and submission | [#114](https://github.com/peterbucci/ai-teaching-platform/issues/114), [#35](https://github.com/peterbucci/ai-teaching-platform/issues/35), [#37](https://github.com/peterbucci/ai-teaching-platform/issues/37) |
| **P1: conditional** | Polish existing lesson authoring; one narrow copilot edit or visual only when its dependencies are ready and it improves the teacher story | [#20](https://github.com/peterbucci/ai-teaching-platform/issues/20), [#87](https://github.com/peterbucci/ai-teaching-platform/issues/87), [#88](https://github.com/peterbucci/ai-teaching-platform/issues/88), [#42](https://github.com/peterbucci/ai-teaching-platform/issues/42), [#43](https://github.com/peterbucci/ai-teaching-platform/issues/43) |
| **P2: defer** | Broad copilot coverage/evidence questions, voice, new visual types, broader analytics/pattern discovery, optional-practice expansion, and speculative infrastructure | Existing roadmap [#15](https://github.com/peterbucci/ai-teaching-platform/issues/15) and capability issues, including [#86](https://github.com/peterbucci/ai-teaching-platform/issues/86) and [#89](https://github.com/peterbucci/ai-teaching-platform/issues/89) |

These are team release priorities, not a claim about the private PEAAII scoring rubric. P1 work must not delay the P0 walkthrough. Retain the original deterministic tutoring loop as a regression baseline and fallback; it does not independently prove the agentic goal. This planning update authorizes **no application refactor, new feature implementation, or paid evaluation**.

## 3. Intended live demo: one teacher-first journey

Use fictional accounts and clearly labeled synthetic class histories. Historical actual-model runs on fictional inputs are a separate evidence category: neither seed histories nor software tests establish educational effectiveness. Keep source rights and exact approved lesson versions visible where relevant.

### Scene A — The teacher finds a concern

1. Start in the teacher overview for the selected fictional class/assignment.
2. Identify one concept that may need attention, explain the denominator and missing evidence, and distinguish initial independent answers from assisted responses or immediate retests.
3. Follow a clear route to the relevant insight and student work while retaining assignment and evidence-origin context.
4. State the teaching question: *“What did these students say that suggests they need a different explanation?”*

### Scene B — Inspect the original reasoning

1. Show the exact question and original student response, approved source/citation, assistance actually displayed, and the evaluator's uncertainty.
2. Inspect a diagnostic or later response, including contrary evidence when available. Describe a possible misconception, not a permanent student trait.
3. Briefly show the saved tutor action trace: a real proposal, a permitted executed tool, the student's observation, and the next action. Use the existing reviewed R7 evidence; label a recording or historical run as such.
4. Briefly switch to the fictional student on that same approved assignment: show a help question being treated as help, then an intended answer and the resulting permitted tutoring action. Return to the teacher and refresh the linked saved evidence. Perform any live model interaction only within the team's separately approved rehearsal/demo budget; a labeled historical recording is a backup, not proof that the final build was freshly verified.

**Evidence to capture:** Assignment/source version, original attempt and follow-up IDs, evidence origin, assistance timing, action/result trace, and uncertainty.

### Scene C — Prepare targeted support and keep the teacher in control

1. Reach the intervention workflow from the teacher evidence context. The teacher should not need a developer-supplied URL to find it.
2. Show an AI-generated, source-grounded intervention draft tied to the inspected evidence, with rationale, editable student content, and private teacher guidance distinguished.
3. Teacher edits the draft and reviews the proposed recipients and student preview.
4. Teacher **explicitly approves**, then **separately delivers** the intervention. Show the saved state and actual delivery result; approval alone is not delivery.
5. Preserve work through refresh, stale revision, loading and error states. Never silently replace teacher edits or retry an uncertain paid request.

**Evidence to capture:** Original evidence links, draft/version, teacher edits, recipient scope, approval, delivery identity, and any failure/recovery.

### Scene D — Observe follow-up and return to the teacher

1. The intended fictional student opens the delivered activity, receives the approved content, and completes the follow-up/fresh check through the implemented flow.
2. Return to the teacher's comparison. Show the linked subsequent response, whether help was shown, and incomplete/not-started cases where applicable.
3. Explain what was observed and what remains unknown. Immediate success after assistance is not durable retention; a before/after comparison does not prove the intervention caused learning.
4. End with the teacher's next decision, not a claim of automatic mastery or educational validation.

**Evidence to capture:** Delivery/recipient identity, displayed content, original follow-up response, assistance, comparison linkage and origin labels.

### Supporting workflow — Lesson authoring

Once the core teacher story is clear, briefly show **upload → AI objectives/questions → teacher review → publish/assign** using the existing R4 workflow. To claim a new upload, use a permitted supported text-based source, inspect extraction and citations, approve the immutable lesson version, and demonstrate that the student resolves that version through the same tutor/evidence path. The bundled networking lesson alone does not prove upload support.

Polish and additional generation are P1. A page-aware copilot should appear only if its structured proposal, preview, teacher acceptance and stale-revision checks actually work; existing objective suggestions or intervention revision do not prove the broader copilot is complete.

### Conditional supporting workflow — Agent-selected visual

Only include this after [#42](https://github.com/peterbucci/ai-teaching-platform/issues/42) and [#43](https://github.com/peterbucci/ai-teaching-platform/issues/43) establish the complete loop: real allowed visual selection → validated activity/calculation → student prediction/interaction/explanation → persisted/displayed evidence → changed next decision. A standalone renderer or generated artifact is not that integration. Use the text fallback and omit the visual segment if the dependencies are not ready.

## 4. Release gates and truthful claims

**P0 teacher journey:**

- [ ] A teammate can identify a concern, inspect original evidence, reach the intervention, edit/review, approve, deliver and inspect linked follow-up without developer coaching.
- [ ] Navigation retains relevant assignment and evidence context, actions have clear labels, and information hierarchy makes the teacher's next decision obvious.
- [ ] Layout, spacing, typography and controls are consistent; ordinary viewport sizes remain usable; keyboard focus and basic contrast are checked.
- [ ] Loading, empty, error, stale-edit and retry states explain what happened and preserve work. No broken links, dead ends or unexplained disabled actions interrupt the route.
- [ ] Synthetic histories, historical actual-model evidence, and newly observed results are distinguished; missing/assisted evidence and uncertainty are visible.
- [ ] The final environment/build is rehearsed and documented, with a truthful backup and submission owner.

**Agentic evidence retained within that journey:**

- [ ] A real model proposed an instructional action based on student evidence; the server permitted and executed the tool.
- [ ] A new student observation affected the next decision, with saved actions, result, source/version and evidence.
- [ ] Help was not graded as an answer; ambiguity and invalid proposals preserved work and a truthful fallback.
- [ ] Historical two-misunderstanding/model checks retain their original scope and limitations; they are not relabeled as a fresh final-build or educational-effectiveness result.

**P1 claims are conditional:** New lesson authoring, narrow copilot and R1 visual segments may be demonstrated only to the extent their complete authorized workflows were observed. Mark incomplete work planned, fixture-only or partially integrated. Do not reopen already completed implementation issues merely because final demo acceptance remains open.

## 5. Implementation and verification checkpoint (October 23)

Code inspected at [`main` `723ed6f`](https://github.com/peterbucci/ai-teaching-platform/commit/723ed6fea41138b604a9d333ebcd4a07b2202c36). This is a bounded audit checkpoint, not a live status feed or a new browser/model test.

| Area | Implemented evidence | Remaining release gate |
| --- | --- | --- |
| Teacher overview, insights, student/session evidence | Existing teacher pages and persisted evidence views on main | Independent UX walkthrough, contextual navigation and evidence-to-action discoverability |
| R4 teacher lessons | Import, objectives, questions, immutable publication and assignment activation are present | Preserve approved version/permissions; polish the supporting authoring route without rebuilding it |
| R7 tutor and orchestration | Single composer, real provider/classification, persistence, controller adapters and teacher action traces are present | Preserve historical [application](../evals/R7_APPLICATION_VERIFICATION.md) and [uploaded-source](../evals/R7_RESOLVER_VERIFICATION.md) records; verify final demo route and recovery |
| R2 interventions | Draft generation/revision, editing/recipients, approval, separate delivery, student follow-up and teacher comparison are present | Joined teacher-first discoverability and final environment acceptance; historical [draft](../evals/INTERVENTION_DRAFT_VERIFICATION.md), [approval](../evals/INTERVENTION_APPROVAL_VERIFICATION.md), and [outcome](../evals/INTERVENTION_OUTCOMES_VERIFICATION.md) reports retain their stated scope |
| R1 visuals (only if included) | Renderer/generator components and historical verification exist | Tutor action allowlist does not yet include a visual action; #42/#43 integration remains a dependency |
| R5 / Teacher Copilot | Existing predefined-pattern evidence and focused authoring/intervention proposals | Do not claim new open-ended pattern discovery or a general page-aware copilot from these components |

The older October 22 descriptions of #81/#82 as draft-only and R4/R7/R2 as merely planned are superseded for this checkpoint. Existing verification includes genuine local real-model/browser evidence as well as deterministic and injected-provider checks. Preserve each report's tested commit, environment, inputs, failed/unrun cases and limitations. The historical [#35](https://github.com/peterbucci/ai-teaching-platform/issues/35) checkpoint at `6ecc80f` is separate from the required independent walkthrough of the final main/deployment build. No fresh paid evaluation or runtime acceptance was performed by this planning audit.

## 6. Rehearsal runbook

### Preparation

- [ ] Review **Canvas submission instructions** and identify the exact cut-off and required materials.
- [ ] Prepare an approved lesson and evidence/intervention scenario for the core teacher route; select a permitted new source only if showing the supporting upload workflow.
- [ ] Use **fictional teacher/student accounts** and an isolated synthetic class.
- [ ] Ensure a working HTTPS deployment or reliable local/demo environment and stable seeded data.
- [ ] Confirm configuration and fallback for the selected demo. Any new paid rehearsal/evaluation needs a separately authorized bounded scope; this planning task runs none. No keys in screen recordings.
- [ ] Ensure approved lesson/source versions and correct class enrollment; clear only disposable demo test records, never real history.
- [ ] Confirm all demonstration URLs and direct navigation paths; use actual routes rather than inventing them in slides.
- [ ] Confirm visually distinct labels for **fixture**, **live model**, **curated fallback**, and **not yet implemented**.
- [ ] Prepare two held-out student responses and one ambiguous ask/answer test.
- [ ] Have a team member rehearse the teacher-first sequence without developer coaching or reliance on the original developer's local state; record blocking UX defects under [#114](https://github.com/peterbucci/ai-teaching-platform/issues/114).

### Suggested presentation pacing (adjust to any official limit)

| Segment | Suggested focus |
| --- | --- |
| Teacher overview | The teaching concern and why it deserves attention |
| Evidence | Exact original reasoning, assistance, source and uncertainty |
| Teacher action | AI draft, teacher edit/review, approval and delivery |
| Follow-up | Student response and linked teacher comparison; observed evidence and limits |
| Supporting authoring | Brief upload/review/publish flow, only after the value is clear |
| Optional verified segment | Narrow copilot or R1 only if ready; omit to protect the core route |
| Trust and close | Human control, bounded tools, recovery and honest claims |

Avoid spending most of the demonstration navigating the UI. Show the **agent decision and its executed result** clearly.

### Live trace card (fill in after a real run)

| Field | Observed evidence / link |
| --- | --- |
| Date/time, environment, commit SHA | _Not yet recorded_ |
| Model and configuration | _Not yet recorded_ |
| Demo account roles (fictional only) | _Not yet recorded_ |
| Approved source and lesson version | _Not yet recorded_ |
| Student input and prior relevant state | _Not yet recorded_ |
| Model-proposed intent and action | _Not yet recorded_ |
| Server allowlist / validation decision | _Not yet recorded_ |
| Executed tool name and result | _Not yet recorded_ |
| What the student actually saw | _Not yet recorded_ |
| Next observation and changed decision | _Not yet recorded_ |
| PostgreSQL evidence/operation IDs | _Not yet recorded_ |
| R1/R2/copilot included? | _Not yet recorded_ |
| Failures, fallbacks, retries | _Not yet recorded_ |
| Reviewer and demo recording path | _Not yet recorded_ |

This template is intentionally blank. Do not prefill it with fixture data and call it a live result.

## 7. Acceptance tests before submitting

**Different types of checks establish different things.** Run them on the actual branch/environment:

| Test | Required observation |
| --- | --- |
| Content integrity | Approved source and content IDs still validate; uploaded references do not resolve to another lesson |
| Student intent | Clear question is not assessed; clear intended answer is assessed once; ambiguous message prompts clarification; no punctuation-only heuristic |
| Grounded generation | Model-produced responses cite correct approved passages and do not disclose protected rubrics/unrevealed answers |
| Agent action selection | Two held-out misunderstandings produce educationally distinct and justified actions/prompts |
| Action validation | Unknown tool, disallowed step, unsupported citation, or invalid output is rejected and leaves state consistent |
| Tool execution | Accepted tool actually runs, result persists, and the next student observation changes the following permitted step |
| R1 visuals (only if included) | Server calculations match reviewed model; prediction, parameters and explanation are saved; text fallback works |
| R2 interventions | Evidence-backed draft requires teacher approval; correct recipients; later attempts linked correctly |
| Copilot (only if included) | Proposed form patch targets the correct teacher/draft/revision; teacher approval required; stale patch rejected |
| Isolation | Student cannot read another student's work; teacher cannot access another teacher's class |
| Recovery | Duplicate Send, double click, tab refresh, pending provider timeout, retry and reconnect never corrupt evidence or auto-repeat paid calls |
| Analytics | Distinct student denominators and origin labels correct; assisted immediate retest is **not** described as retention |
| Baseline fallback | Curated deterministic tutor still works with new agentic extensions disabled or unavailable |

**Known project checks** (select those applicable):

```sh
npm ci
npm test
npm run content:check
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run tutor:check
npm run reading:check
npm run assignments:check
npm run metrics:check
npm run patterns:check
npm run eval:live
```

Database checks need working configuration. Paid model checks require a separately approved scope; **do not run them as part of this planning audit**. A documentation change does not mean any runtime check was executed. Independent UI acceptance remains required even when automated checks pass.

## 8. Integration and deadline decisions

The sequence below is a **planning target**, not a promise of completion. Use independent feature branches and coordinate migrations/contracts before merging.

| Date | Highest-value work | Decision gate |
| --- | --- | --- |
| **Oct 23** | Reconcile implemented work, current PRs and project metadata; agree the teacher-first route and P0 UX issue; retain owners/history | Identify actual integration and discoverability blockers without recreating completed work |
| **Oct 24** | Rehearse overview → evidence → intervention → follow-up on the intended environment; address P0 failures and freeze the route | Independent teammate can complete it; defer P1/P2 additions that threaten reliability |
| **Oct 25** | Verify final build/deployment, rehearse the approved route, record backup and submit | Submit before Canvas's verified cutoff; record confirmation and known limitations |

**If something is blocked:** Reduce optional breadth. Use the verified text tutoring path when visual integration is incomplete and omit a broad copilot segment. If intervention delivery or follow-up fails, report that as an incomplete P0 gate; showing only a draft does not satisfy the full teacher journey.

**Release decisions:** Track deterministic baseline, agentic evidence and teacher-facing UX acceptance separately. Passing one does not silently waive the others. Keep deployment/submission and exact private Canvas requirements with their existing owners.

## 9. Submission checklist and handoff

- [ ] Confirm the **official Canvas rubric and submission package** (links, slides, code, video, declaration, team membership as required).
- [ ] The README and public demo description match the actual implementation, not only the target plan.
- [ ] Confirm all source rights/attribution and remove secrets, test credentials, real student data and private files from artifacts.
- [ ] Record deployment URL, git SHA, model/config, tests, real trace, independent UX walkthrough, known limitations and remaining blockers.
- [ ] Capture a short, **truthfully labeled** backup recording of the *actual running* demo.
- [ ] Verify a teammate can open the experience and recover the demo if the live API is unavailable.
- [ ] Include a clear explanation of **why an agent is needed**: choosing instructional actions from evidence, safely using tools, and adapting to observed results.
- [ ] Complete the required submission before the official cutoff. Keep a confirmation of submission.

## 10. Ownership and related documents

- [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md): product requirements and priorities.
- [AGENTS.md](../AGENTS.md): contributor/Codex engineering and safety instructions.
- [Agentic Architecture](AGENTIC_ARCHITECTURE.md): detailed target data/tool boundaries.
- [R7 Contracts](R7_CONTRACTS.md): existing dialogue contracts and planned single-composer/live integration.
- [Curated demo source guide](../content/network-performance-v1/DEMO_GUIDE.md): prepared networking example (not a substitute for a new uploaded lesson).
- [Roadmap #15](https://github.com/peterbucci/ai-teaching-platform/issues/15), [release epic #9](https://github.com/peterbucci/ai-teaching-platform/issues/9), [Project #7](https://github.com/users/peterbucci/projects/7): current tickets/owners/statuses.
- [Teacher-First Showcase view](https://github.com/users/peterbucci/projects/7/views/10): focused release view using the existing project workflow and ownership.

**Final rule:** Make the teacher's benefit and control clear through **overview → evidence → reviewed intervention → follow-up**, supported by the real **AI decision → validated tool call → observed student response → next action** trace. If a feature is a fixture, an unmerged PR, or a plan, label it accordingly.
