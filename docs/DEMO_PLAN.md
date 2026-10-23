# Learning Pulse — Hackathon Demonstration Plan

**Status:** Revised demo target; not a claim that every feature works  
**Planning date:** October 22, 2026  
**Event:** UMass Boston PEAAII AI Applications Hackathon  
**Submission date:** **October 25, 2026** · **Finalist symposium:** October 29, 2026

> **Read first:** [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md), [Agentic Architecture](AGENTIC_ARCHITECTURE.md), and [AGENTS.md](../AGENTS.md). This plan sets out the **demonstration we want to deliver**. Check the current [GitHub project](https://github.com/users/peterbucci/projects/7), [roadmap #15](https://github.com/peterbucci/ai-teaching-platform/issues/15), [release epic #9](https://github.com/peterbucci/ai-teaching-platform/issues/9), and pull requests for what is actually implemented.

The [official PEAAII events page](https://ai.umb.edu/events/) identifies **Agentic AI** as the 2026 program theme and October 25 as the hackathon project-submission deadline. **Verify the exact submission time, timezone, format, judging rubric, team requirements, and upload instructions in the team's Canvas course.** This document does not claim access to that private rubric or confirm a particular video length.

## 1. The story we want the judges to see

**Learning Pulse helps teachers prepare lessons and helps students learn—not by handing every task to a chatbot, but by allowing AI to choose and use bounded educational tools while teachers retain control.**

One connected journey:

**Teacher provides material → AI proposes objectives and questions → teacher reviews and publishes → student converses with an AI tutor → tutor chooses a useful, permitted teaching action → student responds → evidence is saved → AI recommends optional practice or a teacher-reviewed intervention.**

The key demonstration of **agentic AI** is **a real model selecting an appropriate action based on new evidence, the server executing an approved tool, and a later observation changing what happens next**. A fixed script, a classifier alone, a chat response alone, or a generated UI is not enough.

We will show the difference between:
- **Model proposal:** What the AI recommends and why, in a short, inspectable summary.
- **Application decision:** Whether the action is permitted, adequately grounded, and safe.
- **Executed action:** Which approved server tool actually ran and what was shown.
- **Observed evidence:** What the student then said or did and how the next step adapted.

## 2. Delivery priorities

| Priority | Capability | Hackathon target | Existing ownership |
| --- | --- | --- | --- |
| **P0: critical path** | **R4 — Teacher-provided lessons** | One permitted new source → reviewed concepts/questions → published version | [#20, #49–#53](https://github.com/peterbucci/ai-teaching-platform/issues/20) |
| **P0: critical path** | **R7 — Agentic dialogue and orchestration** | One composer, real intent routing, grounded new diagnostic/help, bounded action choice, persisted evidence | [#71–#76](https://github.com/peterbucci/ai-teaching-platform/issues/71) |
| **P1: priority showcase** | **R1 — Interactive visual tutoring** | Agent chooses one validated experiment; student's prediction, changes, and explanation influence the follow-up | [#17, #38–#43](https://github.com/peterbucci/ai-teaching-platform/issues/17) |
| **P1: priority showcase** | **R2 — Teacher Action Center** | Evidence-backed follow-up draft → teacher edits/approves/assigns → later evidence remains linked | [#18, #44–#46](https://github.com/peterbucci/ai-teaching-platform/issues/18) |
| **Focused addition** | **Teacher Copilot** | Propose a real structured edit to the *currently open* assignment form; teacher previews/accepts | New focused epic/stories, pending team review |
| **Focused addition** | **R5 / optional practice** | Inspectable candidate learning pattern and/or recommended opt-in practice, without unsupported mastery claims | [#21, #54–#55](https://github.com/peterbucci/ai-teaching-platform/issues/21) and focused follow-up story |
| **Later** | R3 Teach-the-AI, R6 voice, broad LMS/document-format coverage | Do not block the core agentic demonstration | [#19](https://github.com/peterbucci/ai-teaching-platform/issues/19), [#22](https://github.com/peterbucci/ai-teaching-platform/issues/22) |

These are **team delivery goals**, not an assertion that PEAAII's official scoring rubric requires these particular reach-goal names. Preserve the original deterministic tutoring loop as a **working regression baseline and fallback**, but **do not count it as proof of the new agentic goal**.

## 3. Intended live demo: one connected journey

Use **fictional students and clearly labeled synthetic class histories**, not real student data. Choose a short source with permitted reuse; the approved networking excerpt can remain a controlled comparison fixture. For the R4 claim, actually import a **second, new** supported text-based source rather than calling the existing bundled excerpt an upload.

### Scene A — The teacher creates the assignment (R4 + Teacher Copilot)

**Teacher's goal:** Make a short assignment about network performance without hand-writing a full question bank.

1. Sign in as the fictional teacher.
2. Open **Materials / Lesson Builder** (or whichever actual route is implemented).
3. Import a permitted text-based source and show the extracted text, passage IDs, source attribution, version, and a reviewable preview. A pasted-text source is a valid narrow starting point if the demo labels the supported format precisely.
4. Ask AI to suggest a few learning concepts and objectives. Show citations to the relevant source passages.
5. **Edit** one suggested concept, **remove** an unsupported one, and **add** a teacher-authored objective.
6. Ask AI to prepare a question bank: an initial question, at least one alternative/diagnostic, private evaluation criteria, and a different retest.
7. In the copilot, give a natural instruction such as:  
   *“Make these questions more conceptual. Focus on confusing transmission delay with propagation delay, and add a question that asks students to explain why.”*
8. Show **actual proposed changes to the open form**, not merely advice in a chat bubble. Preview/accept selected changes; reject an unwanted change.
9. Preview the student-visible lesson separately from the teacher-only guidance, then approve/publish an immutable lesson version and activate an assignment for the fictional class.

**Evidence to capture:** Source/version ID, reviewed concepts and question definitions, copilot action proposal and accepted form patch, final approved lesson version, class assignment identity.

**Failure to avoid:** Silently inserting unsupported generated questions; exposing private answer guidance; overwriting a newer form revision; falsely claiming PDF/slides support that the importer lacks.

**Acceptance:** The new assignment resolves the correct authorized source/version through the **same tutor/evaluator/evidence path** as the curated networking lesson.

### Scene B — The student has one natural conversation (R7)

**Student's goal:** Work through the assigned question while being able to ask the tutor for help.

1. Sign in as the enrolled fictional student; open the new assignment.
2. Show the **same assigned reading**, its source reference, and one conversational input. **No mandatory Ask/Answer mode picker.**
3. Show the active question. Student types:  
   *“What do you mean by packet size?”*
4. The **real model** classifies this as a question/help request from context. The server routes it to permitted grounded assistance, without recording a graded answer.
5. The model retrieves approved passages and returns a relevant explanation with an inspectable citation. Record help **only when actually displayed**.
6. Student asks: *“Could you explain that another way?”* and receives a different, grounded explanation.
7. Student gives an intended answer. The application sends it through the existing assessed-answer workflow. If the text could plausibly be either an answer or a help request, ask for a short clarification **before** grading.
8. Show the saved original question/answer, evaluation, assistance timing, and what the tutor recommends next.

**Evidence to capture:** Original message text, proposed intent, authorized route, actual help and citation, displayed acknowledgement, submitted answer and evaluator result, request/session IDs.

**Failure to avoid:** A help question becoming an answer; a model classification treated as unquestionable permission; repeated Send making duplicate paid calls or attempts.

### Scene C — Show meaningful AI action choice (R7 + R1)

**Student's goal:** Resolve a specific misunderstanding by investigating it.

Prepare **two held-out fictional student responses** to the same concept, not just different wording of the same mistake:

- **Case A — distance confusion:** *“The transmission delay doubles when the cable is twice as long.”*
- **Case B — packet-size confusion:** *“Sending a larger packet takes the same amount of time at the same bit rate.”*

For each case:

1. Run the **real evaluator**; keep judgments tentative and source-grounded.
2. Show the **agent's proposed next action** selected from a server-provided list (for example, retrieve passage, generate diagnostic, explain, select visual, retest).
3. Show the controller's **accept/reject** decision and the actual tool result.
4. Generate a **materially different** targeted diagnostic or helpful activity appropriate to that student's reasoning. A cosmetic paraphrase is not a meaningful difference.
5. For **one justified case**, demonstrate **R1**: the agent requests a validated packet-delay experiment.
6. Student predicts an outcome, changes **one variable at a time** (distance, packet size, or bit rate), and explains what they observed.
7. The application performs checked calculations; the student-visible experiment does **not** execute arbitrary model-generated code.
8. The tutor uses the saved prediction/interaction/explanation to choose and deliver an appropriate **next** question, correction, or retest.

**Evidence to capture:** Two exact fictional inputs, actual model/configuration, allowed action set, chosen proposals and short rationale, validation results, generated question/visual spec, calculations and inputs, student explanation, next action.

**Failure to avoid:** Hardcoding the visual choice for the demo while claiming AI selected it; showing the same canned diagnostic for both cases; letting a visual with the correct slider position stand in for understanding.

### Scene D — Optional practice recommendation

**Student's goal:** Decide what to review after the session.

1. Show a recommendation tied to saved concept evidence, such as a **short optional comparison practice** or **later independent review**.
2. Make the recommendation **opt-in**, with an explanation of the relevant observed evidence.
3. Keep it separate from teacher-issued assignments.
4. If follow-up scheduling or practice creation is not actually implemented, label the proposed draft and do **not** imply a queued assignment exists.

**Evidence to capture:** Triggering attempt/concept IDs, reason and source/policy, recommendation status, student opt-in if performed.

**Failure to avoid:** Declaring durable mastery or retention from an immediate answer after hints.

### Scene E — Teacher sees evidence and acts (R2 + narrow R5)

**Teacher's goal:** Understand a class-level concern and assign targeted support.

1. Return to the fictional teacher's workspace; show an actual new learning event reflected in class insights.
2. Ask the teacher copilot:  
   *“Are other students confusing transmission and propagation delay? Show me the evidence.”*
3. Query **only authorized evidence**. Show original student responses, correct distinct-student denominators, source context, and **contradictory evidence** where relevant.
4. If **R5** is enabled, show a tentative AI-proposed reasoning pattern **not already in the predefined category list**. Teacher may inspect, correct, or dismiss it.
5. Use **R2** to propose an appropriate targeted review activity based on that evidence. Show the connection between the observation and proposed questions.
6. Teacher reviews, edits, chooses recipients, and **explicitly approves/assigns** the intervention.
7. Student opens the assigned follow-up. Later performance is linked back for a before/after comparison. If this last step is not integrated, do not claim successful R2 delivery.

**Evidence to capture:** Source responses, number of distinct students, supporting/contradictory evidence, teacher draft edits and approval, recipient scope, new assignment ID, follow-up attempt IDs if available.

**Failure to avoid:** AI automatically assigning work, inferring permanent learner traits, confusing synthetic fixture class patterns with new real-model evidence, or claiming causality from a before/after observation.

## 4. What must be demonstrated versus what can be shown as planned

**Minimum credible agentic demonstration (non-negotiable for the revised product goal):**

- [ ] One **real** AI-proposed instructional action based on new student evidence, not solely prewritten application branching.
- [ ] A **server-permitted tool call** executes that action and produces a source-grounded, validated result.
- [ ] The student responds, and that observation **actually changes** the next decision or step.
- [ ] An original message is correctly routed as **help vs intended answer**, with safe ambiguity handling and no accidental grading.
- [ ] The action, result, source/version, and student evidence are saved and inspectable.
- [ ] Invalid proposals and service failures preserve the student's work and use a truthful fallback.

**Our desired integrated showcase:**

- [ ] **R4:** New source imported, concepts/questions reviewed, published, and actually used by a student.
- [ ] **R7:** Natural dialogue, meaningful varied diagnostic/explanation and observe–decide–act loop with real model calls.
- [ ] **R1:** Agent-selected visual tool with correct calculations and student evidence affecting a next step.
- [ ] **R2:** Evidence-backed teacher-reviewed intervention is approved, assigned, and linked to later work.
- [ ] **Teacher Copilot:** At least one structured, previewable edit applied to the currently open teacher draft with approval.
- [ ] **R5 / optional practice:** A narrow, inspectable example where implemented, clearly distinguished from broader roadmap ambitions.

The team should pursue all these, but **do not claim a target passed** unless its complete real integration was observed. Unfinished features remain openly marked **planned**, **fixture-only**, or **partially integrated**.

## 5. Current development baseline (October 22 checkpoint)

| Component | Verified planning status from repository/PR descriptions | What remains |
| --- | --- | --- |
| Curated network source, evidence DB, authenticated class and teacher analytics | Existing merged foundation on `main` | Keep unchanged and regression tested |
| Grounded evaluator and deterministic tutor | Existing merged baseline | Preserve alongside new runtime agentic decisions |
| Single-composer student UI + intent contracts | [PR #81](https://github.com/peterbucci/ai-teaching-platform/pull/81) is **draft/open**, with fixture tests | Live classifier, grounded generator, transactional storage, cross-role test |
| Teacher pages separated | [PR #82](https://github.com/peterbucci/ai-teaching-platform/pull/82) is **draft/open** | Merge/review and connect new teacher authoring/coplay tools |
| Teacher-provided source/lesson pipeline | [R4 #49–#53](https://github.com/peterbucci/ai-teaching-platform/issues/20) planned | Real import → objectives → questions → publish → tutor |
| R1 visual experiment | [R1 #38–#43](https://github.com/peterbucci/ai-teaching-platform/issues/17) planned | Validated player, calculation, generation, agent selection, evidence |
| R2 teacher intervention | [R2 #44–#46](https://github.com/peterbucci/ai-teaching-platform/issues/18) planned | Generate → review → approve → assign → follow-up |
| Teacher Copilot and optional practice | Product-reset targets | Focused issues/contracts and real integration |

**This table is a historical snapshot, not a live status feed.** Refresh issue/PR status before recording completed demo claims. Do not treat a merged contract or screenshot as evidence of a running generator.

## 6. Rehearsal runbook

### Preparation

- [ ] Review **Canvas submission instructions** and identify the exact cut-off and required materials.
- [ ] Select one **permitted new** text-based source; verify extraction, attribution and readable passage references.
- [ ] Use **fictional teacher/student accounts** and an isolated synthetic class.
- [ ] Ensure a working HTTPS deployment or reliable local/demo environment and stable seeded data.
- [ ] Confirm OpenAI credentials, chosen model, API budget, and a deliberately bounded live test plan. No keys in screen recordings.
- [ ] Ensure approved lesson/source versions and correct class enrollment; clear only disposable demo test records, never real history.
- [ ] Confirm all demonstration URLs and direct navigation paths; use actual routes rather than inventing them in slides.
- [ ] Confirm visually distinct labels for **fixture**, **live model**, **curated fallback**, and **not yet implemented**.
- [ ] Prepare two held-out student responses and one ambiguous ask/answer test.
- [ ] Have a team member rehearse the sequence without relying on the original developer's local state.

### Suggested presentation pacing (adjust to any official limit)

| Segment | Suggested focus |
| --- | --- |
| Problem and product | Teachers lack insight into *why* students struggle; students need responsive explanations |
| Teacher authoring | Upload, AI objectives/questions, approval, copilot's actual proposed edit |
| Student agent | One conversation, intent recognition, generated help, AI-chosen action/tool, responsive retest |
| Visual | R1 prediction → experiment → explanation → next tutoring decision |
| Teacher impact | Evidence trace and R2 reviewed intervention |
| Trust | Approved sources, human approvals, bounded tools, safe fallback, honest limits |

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
| R1 visuals | Server calculations match reviewed model; prediction, parameters and explanation are saved; text fallback works |
| R2 interventions | Evidence-backed draft requires teacher approval; correct recipients; later attempts linked correctly |
| Copilot | Proposed form patch targets the correct teacher/draft/revision; teacher approval required; stale patch rejected |
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

The final database and live-model commands require working credentials/configuration; a documentation change **does not** mean these have been executed. Avoid unbounded paid calls.

## 8. Integration and deadline decisions

The sequence below is a **planning target**, not a promise of completion. Use independent feature branches and coordinate migrations/contracts before merging.

| Date | Highest-value work | Decision gate |
| --- | --- | --- |
| **Oct 22** | Review revised scope, branch/PR ownership and required interfaces: #53 content resolver, R7 orchestration + #74/#75, R1 activity contract, R2 intervention schema | Confirm what is truly built vs planned; agree on one vertical slice |
| **Oct 23** | Integrate one new source + approved question and live R7 model intent/action routing; build narrow R1 and R2 services in parallel | A student can actually use the new approved lesson and agent action |
| **Oct 24** | Join R1 experiment, saved evidence, and R2 teacher-reviewed follow-up; run adversarial and cross-role tests | Freeze speculative features; identify reliable demo route and honest limitations |
| **Oct 25** | Rehearse real model trace, build/deploy, record backup, prepare and **submit** through the official required platform | Submit **before Canvas's verified cutoff**; don't wait for last-minute integration |

**If something is blocked:** Cut breadth, not truthfulness. For example, support a single clearly described text import rather than pretending all PDFs/slides work; deliver one real visual tool rather than five fake visual types; show a teacher-reviewed R2 draft without claiming a follow-up occurred if it didn't.

**Release decisions:** The deterministic baseline remains independently testable. The new *agentic showcase* gate is separate. An incomplete agentic gate must be reported as incomplete even if the baseline passes.

## 9. Submission checklist and handoff

- [ ] Confirm the **official Canvas rubric and submission package** (links, slides, code, video, declaration, team membership as required).
- [ ] The README and public demo description match the actual implementation, not only the target plan.
- [ ] Confirm all source rights/attribution and remove secrets, test credentials, real student data and private files from artifacts.
- [ ] Record deployment URL, git SHA, model/config, tests, real trace and known limitations.
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

**Final rule:** Show the real path from **AI decision → validated tool call → observed student response → next action**, and show which parts the teacher controls. If a feature is a fixture, an unmerged PR, or a plan, label it accordingly.
