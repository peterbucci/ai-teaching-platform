# Learning Pulse — Product Context and Hackathon Plan

_Last product-direction revision: October 22, 2026 · Working product name: Learning Pulse_

> **October 23 teacher-first release decision:** The October 25 demonstration now leads with **teacher overview → inspect original student reasoning → AI intervention draft → teacher review/edit/approval and delivery → linked follow-up evidence**. Usability, visual consistency, clear navigation, reliability and presentation are P0 requirements. Preserve the existing R4/R7 implementation supporting that story; authoring polish, narrow copilot and visuals are conditional P1, while broad copilot/voice/new visual types/analytics and infrastructure expansion are P2. This later decision supersedes the October 22 priority table and presentation order below, while preserving the broader product vision and history. See the [demo plan](docs/DEMO_PLAN.md) for the current implementation checkpoint, independent UI acceptance gates and walkthrough, and [roadmap #15](https://github.com/peterbucci/ai-teaching-platform/issues/15) for current ownership/status. Historical real-model evidence remains valid only within its recorded scope; synthetic histories and passing tests do not prove educational effectiveness.

> **Purpose:** This is the team's product specification: what Learning Pulse should do, why it matters, and what a truthful demonstration must prove. It is **not** a claim that all described features are implemented. Check the [GitHub roadmap (#15)](https://github.com/peterbucci/ai-teaching-platform/issues/15), [project board](https://github.com/users/peterbucci/projects/7), current pull requests, and actual code for implementation status. The roadmap and older guides still need to be reconciled with this product reset.

## 1. What we're building

**Learning Pulse is an agentic AI-powered teaching and learning platform.** It helps instructors create lessons from their own approved material, gives students a conversational tutor that adapts its teaching strategy, and turns learning evidence into useful, reviewable next steps.

The product has three connected experiences:

1. **Teacher authoring:** Teachers provide source material, define or review learning concepts, work with AI to generate and edit questions and assignments, then approve what students will receive.
2. **Student learning:** Students read approved material and interact with an AI tutor through one natural conversation. The tutor interprets their reasoning, proposes an instructional action, uses a permitted tool when appropriate, and adapts to what happens next.
3. **Teaching insights and action:** The platform examines recorded work, proposes evidence-backed patterns and optional practice, and helps teachers prepare, review, and approve interventions.

A **context-aware teacher copilot** supports these workflows. It can retrieve permitted information and propose concrete edits to the page or form the teacher is working on; it does not merely offer advice in a chat bubble.

**Guiding principles:**

- Students should do the thinking. The AI supports reasoning instead of supplying an unrevealed assessment answer.
- AI can propose actions; application code validates and executes only authorized actions.
- Teacher decisions and official assignments remain under teacher control.
- Original responses, source references, assistance, uncertainty, and decisions remain inspectable.
- A system that only evaluates an answer and selects prewritten questions is our **reliable baseline**, not proof of the intended agentic experience.

### Hackathon context

The project is for the **PEAAII AI Applications Hackathon at UMass Boston**. The [PEAAII program's 2026 theme is Agentic AI](https://ai.umb.edu/events/). The posted project submission deadline is **October 25, 2026**; the finalist symposium is **October 29, 2026**. Team members must confirm submission details and any additional judging criteria in the official Canvas materials; this file does not claim to reproduce that private rubric.

The **team's revised demonstration objective** is to show a real, bounded, goal-directed AI workflow—not merely a static chat UI or one model call. We are prioritizing **R4 + R7 as the critical path**, **R1 + R2 as high-priority connected showcase goals**, a focused **R5** discovery path, and the first useful **Teacher Copilot** workflow. This supersedes the earlier planning assumption that the prepared single-lesson tutoring loop alone represented the full hackathon target.

## 2. The end-to-end product journey

**Teacher supplies material → AI proposes concepts and questions → teacher edits and approves → student studies with an agentic tutor → tutor uses permitted tools and adapts → system records evidence → AI recommends additional learning and teaching actions → teacher reviews and acts.**

Each stage must use the **same approved, versioned content and evidence system**. Do not build a second evaluator, tutor state machine, lesson store, or parallel set of student records for new features.

The older curated networking lesson remains a valuable test fixture and deterministic fallback. It is no longer the only kind of lesson the product is designed to deliver.

## 3. Teacher experience: source material to approved lesson (R4)

### 3.1 Provide and review learning material

A teacher can create a lesson from permitted material, such as textbook excerpts, lecture notes, slides, worksheets, documents, or pasted text. Material may comprise more than one source; each source needs its own identity, attribution, access scope, and version.

**Bounded first implementation:** pasted text, UTF-8 `.txt`/`.md`, and text-based PDFs. Extract text into **reviewable, ordered passages** with stable IDs and page/section references where reliably available. The teacher must be able to correct or reject extraction before publication.

**Expansion:** `.pptx` and `.docx` text and slide/section references; complex diagrams, image-heavy files, scans, and OCR only with separately reviewed extraction. Never imply that every slide, scan, formula, or PDF image was understood correctly. Reject unreadable or unsupported content with a clear explanation.

Store uploaded assets privately; preserve copyright attribution, permitted-use confirmation, a content hash, and source version. Extracted text and uploaded instructions are **untrusted source content**, not instructions to the AI system. The system cannot assume teachers have unlimited redistribution rights.

### 3.2 Define and approve learning objectives

Teachers can **enter concepts themselves** or ask AI to propose them from the selected material. The AI should supply short descriptions, measurable learning objectives, and supporting passage references. Teachers can add, remove, edit, merge, and reorder concepts and mark learning goals as essential, supporting, or optional.

If a proposed concept is unsupported by the assigned material, flag it instead of inventing evidence. Teacher approval of objectives is distinct from publishing a lesson and from activating a class assignment.

### 3.3 Generate and curate questions

For each approved concept, AI can propose:

- Initial retrieval or explanation questions, including questions that assess **more than one concept**.
- Variations in wording, examples, numerical values, or difficulty that test the **same intended reasoning**, not merely surface paraphrases.
- Private answer criteria, permitted variations, partial-credit guidance, and citations.
- Possible reasoning errors worth investigating, neutral clarification questions, targeted diagnostics, hints, explanations, and meaningfully different retests.
- Question formats and activity types allowed by the teacher's lesson policy.

Teachers can inspect, edit, add, delete, and reorder questions, change rubrics and instructions, and regenerate selected parts. They can request a particular style, such as conceptual rather than computational questions, a focus on a named misconception, or stronger emphasis on explaining *why*.

Teachers should **review the initial bank and generation policy**, but need not approve every runtime variation individually. New runtime questions must still pass server validation, adhere to the approved policy and exact source version, and retain an immutable snapshot and private evaluation guidance. Do not generate an effectively identical retest or leak unrevealed expected answers.

### 3.4 Assemble, preview, and publish

A lesson can contain ordered reading, guided study, practice questions, and supported visual activities. An assignment chooses an approved **immutable lesson version**, target class/recipients, instructions, and availability or due-date settings.

A teacher can preview both the student experience and private answer guidance, then explicitly approve and publish. A later edit creates a **new version**; previous assignments and student evidence stay tied to the old version. Reuse the same lesson version across authorized classes without mixing enrollments or results. Draft, approved, published, assigned, and closed states must not be conflated.

## 4. Teacher Copilot: an assistant that can use the workspace

The copilot should know the **authorized context of the page** the teacher is viewing: selected class, current draft/version, assignment, concept, or insight. It should not search unrelated classes or assume broad permission from an arbitrary URL or browser-provided identifier.

**In the assignment editor**, a teacher could write:

> Make these questions less mathematical, focus on transmission versus propagation, and add one harder diagnostic question.

The copilot would use structured tools to **propose edits to the current draft**. The teacher sees the proposed changes in the actual form, can accept individual changes, reject them, or revise the request. Changes are applied against the correct draft revision, are undoable or recoverable, and never silently overwrite newer edits.

Other useful page-specific capabilities:

| Teacher area | Copilot capabilities |
| --- | --- |
| Materials library | Find passages, identify missing or contradictory coverage, summarize within authorized sources. |
| Lesson builder | Propose objectives, lesson structure, examples, instructional sequencing, and question coverage. |
| Assignment builder | Propose specific changes to fields, questions, rubrics, notes, and recipients; preview diffs before applying. |
| Class overview | Summarize recorded participation and evidence-backed teaching priorities. |
| Learning insights | Investigate possible reasoning patterns, retrieve supporting and contradicting student responses. |
| Student profile | Summarize observable learning behavior, help already shown, and possible appropriate next steps. |
| Teacher action center | Draft a targeted activity and suggested recipients for teacher review and approval. |

**Approval boundary:** The copilot may create a private draft or proposal, but it must not automatically publish a lesson, assign work, change official grades, or contact students. The teacher reviews before such actions. Every accepted edit and intervention records authorization, ownership, provenance, and the source draft version.

**First demonstrable slice:** One context-aware copilot in the assignment editor that proposes structured question/form changes and lets the teacher preview and accept them. The broader teacher workspace assistant is a product requirement but need not be implemented on every page before the hackathon.

## 5. Student experience: one conversation with an adaptive tutor (R7)

### 5.1 Student pages and entry points

Students need distinct access to **My Learning, Assignments, Reading, Study Session, and Learning Journal**. They must be able to read material independently, open an assignment, resume saved work, or review prior answers without having to start a new paid evaluation.

A student's personal progress should be tied to their actual authorized work. "Practiced," "correct independently," "correct after assistance," "completed practice," and "retained in a later check" are different concepts; do not collapse them into an arbitrary mastery score.

### 5.2 One conversation, not separate Ask/Answer modes

The study session has **one message composer**. Students can ask about the material, request a different explanation, or submit an answer without manually choosing a mode or dropdown.

The model proposes the **message intent** using the active question, student's exact message, and limited prior conversation. The server validates and routes the result:

- **Answer:** Route a clearly intended answer through the existing assessed-answer and evaluation process, preserving idempotency and making the resulting action visible.
- **Question or help:** Respond through authorized, grounded tutoring dialogue; do **not** grade or complete the original attempt.
- **Ambiguous:** Ask a short clarification or provide explicit in-conversation choices before grading. Never turn an ambiguous help request into a wrong answer.
- **Off-topic or unsupported:** Give a bounded redirection or safe fallback, without fabricating source support.

A student can correct a misinterpretation. Asking for help leaves the original question and unsent work intact; returning or resuming does not silently submit an answer. If live intent recognition is unavailable, use an **honest confirmation/fallback**, not fake AI classification.

### 5.3 The tutor adapts its strategy

The tutor should aim to help the student understand the **teacher-approved learning objectives**. After observing an answer, question, or experiment, a bounded AI decision step considers which of the currently permitted instructional actions is most useful.

Examples:

- Retrieve specific approved passages and cite the exact version.
- Ask a neutral clarification or self-explanation question.
- Generate a targeted diagnostic for a possible error.
- Give a grounded hint, worked example, or different explanation.
- Choose a supported visual diagram or interactive experiment (R1).
- Give a fresh, independently answerable retest or move to another objective.
- Recommend optional practice or later review when supported by recorded evidence.

**Agentic requirement:** In at least one demonstrated path, the AI must actually **select a meaningful action/tool based on the student's reasoning**; the server validates that action; the tool executes; the next observation changes what the tutor does. Rewording a canned prompt does not meet this goal.

The AI's proposal is advisory. **The server controller remains the authority** for permitted transitions, scope, spending limits, and state changes. No unbounded autonomous loop. Limit turns, context, tokens, time, retries, and concurrent operations; keep a text fallback if generation or a visual tool fails.

### 5.4 R1: interactive visual tutoring

The agent may select a visual when it is educationally appropriate, not simply because a student got something wrong. The first reviewed quantitative tool can simulate transmission and propagation delay using packet size, link rate, distance, and propagation speed.

A meaningful interaction is **predict → change variables → observe a server-verified result → explain → follow up**. The model may propose structured layouts, prompts, and allowable parameters; **reviewed code**, not arbitrary generated JavaScript or formulas, calculates results. Student predictions, choices, explanations, generated activity/version, help shown, and outcome become durable evidence.

A visual activity that merely looks polished or runs a canned animation is not a completed R1 agentic experience. The student response must influence the following tutor decision. The student must always have a text alternative.

### 5.5 Personalized optional practice

After a session, AI may recommend a small, source-grounded optional activity based on *observed* difficulties or requested help. Recommendations should say **why** they were suggested and which concepts they address. A student may opt in without the system pretending that the teacher formally assigned the work. A teacher-assigned intervention requires teacher approval and distinct assignment provenance.

Follow-up success immediately after assistance is not proof of durable retention. Track delayed independent practice separately when it actually occurs.

## 6. Teaching insights, R5 discovery, and R2 interventions

The teacher dashboard should turn saved student evidence into **inspectable learning signals**, not unsupported claims about ability or motivation.

It should display participation, concept-level outcomes with meaningful denominators, independent versus assisted responses, original questions and answers, uncertainties, help shown, possible misconceptions, and later changes. Class patterns must count **distinct students**, not repeated attempts by one person as different students.

**R5 — new-pattern proposals:** AI may propose a recurring reasoning pattern not already represented by the approved categories, with supporting and contradictory examples. These are hypotheses, not diagnoses; teachers can inspect, correct, rename, approve, or dismiss them.

**R2 — teacher action center:** From an approved concept/pattern insight, AI can draft a targeted review activity tied to the permitted reading. The teacher reviews the evidence, edits question/instructions/recipients, approves the activity, and assigns it. Later student work is linked back to the intervention so teachers can compare observations **without claiming the activity caused an improvement**.

**Student support suggestions:** Explain the observable basis (e.g. repeated difficulty with a specific concept, no independent retest yet), show counterevidence and sample size, and provide links to original work. Do not infer disability, effort, motivation, or permanent aptitude. Do not autonomously message students or take high-stakes action.

Start with **on-demand analysis or analysis triggered by new accepted evidence**, not an always-running agent. A scheduled teaching brief is a later extension.

## 7. Agentic architecture and responsibility boundaries

The student tutor and teacher copilot may have different system prompts and allowed tools, but they share **one small server-side orchestration/action-validation approach**, approved content services, model-access conventions, authentication, and evidence system. **Multiple autonomous agents or a new framework are not prerequisites.**

### A bounded decision-and-tool cycle

1. **Authorize and load context:** Determine actor, classroom/assignment/lesson version, current session or draft revision, relevant approved passages, and bounded history.
2. **Request an AI proposal:** The model classifies intent where appropriate and chooses from a server-supplied list of currently permitted actions. Return structured output; do not trust model instructions or claims of permission.
3. **Validate:** Check the schema, actor permissions, source/content version, allowed action, factual grounding and answer leakage, current revision, budget, and preconditions.
4. **Execute one permitted server tool:** Use existing services for retrieval, question/explanation generation, validated diagrams/experiments, evidence queries, or **draft-only** teacher edits. Never execute arbitrary model-generated code.
5. **Persist and display:** Save request identity, proposal, validation outcome, actual tool result, generated snapshot/source, and assistance **actually shown**.
6. **Observe and continue:** Accept the student's next response or teacher approval, reevaluate what happened, and decide whether to continue, ask for clarification, offer optional practice, or stop.

Do not replace `lib/tutoring/decide.ts` or the established evaluator with a second parallel controller. Extend their interfaces so a validated AI action proposal can be considered under server-owned rules. An unsuccessful proposal returns a transparent curated fallback without losing prior work.

### Examples of tools, not necessarily their final function names

| Student tutor | Teacher copilot |
| --- | --- |
| Retrieve authorized source passages | Retrieve authorized source passages and lesson drafts |
| Evaluate a submitted answer via the existing evaluator | Suggest learning concepts with source evidence |
| Generate a validated diagnostic question or explanation | Generate/revise draft questions, rubrics, and lesson outlines |
| Propose a supported visual activity; calculate its results in reviewed code | Propose structured edits to the current assignment draft |
| Recommend optional practice based on saved evidence | Query allowed class insights and inspect original evidence |
| Propose an allowed next tutoring step | Draft a follow-up intervention awaiting teacher approval |

**Never permit the model to choose its own authorization or tool inventory.** Read-only queries, draft proposals, and side-effecting actions have different permissions. Publishing, class-wide assignment, external messages, and high-stakes decisions require explicit human authorization.

**Untrusted inputs:** Student responses, uploaded documents, retrieved passages, and model outputs can contain prompt-injection text. Treat them as data, not developer/system instructions. Do not leak private grading rubrics, hidden answers, internal hypotheses, unrelated class records, or credentials to the student or model without authorization.

## 8. Data model, provenance, and evidence

### Existing foundation to preserve

The repository already uses **PostgreSQL** for authenticated profiles/classes/enrollments/assignments and session evidence such as attempts, evaluations, and interventions. Keep the existing Better Auth, transaction, idempotency, source-reference, and evidence-integrity patterns.

### Add only the records required by real workflows

- **Source material and versions:** Ownership, private asset location, extracted passages, source hash, attribution, extraction/review status.
- **Reusable lessons and immutable lesson versions:** Approved objectives, questions, rubrics, policy, permitted tools, and source-version references. Assignments pin one approved version.
- **Teacher drafts and copilot proposals:** Form revision, proposed structured patch, source context, validation, teacher accept/reject action, and history.
- **Agent operations:** Actor/session/draft identities; AI-proposed intent and tool; validation and acceptance; actual execution result; retry/idempotency identity; model/template provenance; citations; displayed status and timestamps.
- **Optional-practice recommendations and interventions:** Supporting evidence, target concepts, student choice or teacher approval, assigned recipients, and follow-up linkage.

Use relational foreign keys for identity, ownership, version and approval relationships; use validated JSON/JSONB for flexible question, rubric, visual and model payloads where appropriate. Do not create a global question/concept ontology or a table for every field without a concrete query or integrity requirement. Source-document versions and published lesson versions are different identities.

**Immutable learning evidence:** Preserve the exact original student answer/question snapshot; accepted evaluations and their uncertainty; the actual assistance seen **before** an answer; generated content/source/version; separate student asks from assessed attempts; the action the server executed; and later responses. A newer source or lesson version cannot rewrite historical evidence. An accepted but undisplayed hint does not count as seen assistance. A student's later answer can be assisted because of previously shown help; do not label same-session success as retention.

**Analytics:** Derive authoritative metrics from persisted, authorized evidence rather than maintaining competing progress records. Keep fictional seed data and live-model results distinguishable, and report denominators, missing data, and uncertainty.

## 9. Prepared networking fixture and licensing

The curated, team-reviewed regression fixture remains:

- *Computer Networks: A Systems Approach*, Larry Peterson and Bruce Davie, Section 1.5.1, **Bandwidth and Latency**.
- Pinned upstream [source revision](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L14-L187).
- Five concepts: bandwidth vs. throughput; latency vs. RTT; transmission delay; propagation delay; queuing delay.
- `content/network-performance-v1/` includes **13 approved passages and 15 prepared questions**, including the `NP-TX-01` transmission/propagation diagnostic example.
- Team content approval: **October 14, 2026**, for hackathon use; **not** proof of classroom-instructor approval or educational validation.

Do not rename these approved IDs, silently expand the assigned excerpt, or rewrite the curated source to accommodate a new loader. See `content/network-performance-v1/ATTRIBUTION.md` for attribution, license, and third-party notices. Observe CC BY 4.0 terms and any separately credited content restrictions; do not imply author endorsement or legal clearance. Teacher-provided uploads require their own rights and access review.

Use this fixture to compare actual model decisions with known examples and to keep the **nonagentic tutoring fallback** testable. New teacher-created lessons must go through the same authorized evidence and tutoring pipeline, not a special demo-only system.

## 10. Hackathon targets and realistic scope

**The legacy single-lesson path is a regression baseline, not the new definition of a successful agentic showcase.** It should keep working, but it cannot substitute for a live AI decision and tool-use loop.

| Workstream / reach | 2026 team target | Priority |
| --- | --- | --- |
| **R4 / E11 — Teacher content** | Import a bounded teacher-provided source; review AI concepts/questions; publish an immutable lesson. | **P0 — critical path** |
| **R7 / E13 — Agentic tutor** | One composer; real intent recognition, generated diagnostics/explanations, bounded action choice, source grounding, persisted evidence. | **P0 — critical path** |
| **R1 / E07 — Visual tool** | Agent selects and runs a validated interactive activity; prediction/explanation changes next tutoring action. | **P1 — committed showcase goal** |
| **R2 / E08 — Teacher action** | AI drafts an evidence-backed follow-up; teacher edits/approves/assigns; linked later evidence can be inspected. | **P1 — committed showcase goal** |
| **R5 / E09 — Pattern proposals** | At least one tentative new-pattern suggestion with original evidence and teacher review. | **P1 — narrow slice** |
| **New Teacher Copilot capability** | Assistant proposes a structured, reviewable change to a draft assignment and can answer an authorized evidence question. | **P1 — narrow slice** |
| R3 / E10 and R6 / E12 | Teach-the-AI and optional voice; keep planned work visible. | **P2 — later** |

These priorities express the **team's desired deliverable**, not unsupported claims that the official judging rubric mandates each named reach goal. With the October 25 deadline, finish and verify vertical slices rather than claiming a broad but unconnected feature set. Missing showcase work must be reported honestly, not silently replaced with fixtures.

### Target end-to-end demonstration

1. A fictional teacher imports a **new, permitted text-based source**, checks the extracted passages, and confirms its attribution.
2. AI suggests supported learning concepts and a small initial question bank. The teacher edits an objective or question (optionally using the copilot's structured draft proposal), previews the student experience, and publishes the approved lesson.
3. A fictional student opens the assignment. Through **one input**, the student asks for clarification, receives a grounded cited reply, and then answers a question. The ask is not graded.
4. The student exhibits an unfamiliar error. A **real model proposes an appropriate instructional action**, the server validates it, and the app performs it. Show meaningfully different decisions for at least **two different misunderstandings**, not just different wording.
5. When R1 is enabled, the agent chooses a validated packet-delay experiment. The student predicts, changes a variable, and explains the result; that evidence changes the following question or explanation.
6. The tutor proposes a source-grounded **optional practice** recommendation, explicitly separate from teacher-assigned work.
7. The teacher sees the original answers, help shown, decisions, uncertainty, citations, and subsequent results. AI suggests a possible pattern and drafts a **reviewable R2 follow-up**; the teacher edits and approves it.
8. Verify that the live flow uses authenticated PostgreSQL persistence, survives refresh, respects class permissions, bounds AI calls, and falls back without losing work. Label synthetic class histories and any unsupported/fixture components accurately.

**Minimum truthful agentic evidence:** A real model-generated decision among allowed actions, a real authorized tool execution, an observed result that affects a subsequent decision, and traceable logs/citations. A static mockup, keyword routing, canned explanation, and one standalone LLM evaluation do not satisfy this test. Do not present a mostly scripted demo as fully autonomous.

## 11. Status snapshot and work not yet complete

_Checked against the repository and issue/PR descriptions on October 22, 2026. The live state may have changed; inspect before editing._

**Implemented foundations on `main`:** Next.js/React/TypeScript, Docker/PostgreSQL, Better Auth, approved networking package, grounded evaluator, deterministic tutor/controller and saved evidence, teacher metrics/patterns, core student pages and assignment/reading improvements. These constitute real infrastructure, **not** the finished agentic experience.

**Work in flight:**

- [PR #81](https://github.com/peterbucci/ai-teaching-platform/pull/81): single-composer student conversation and intent contracts with fixtures; **draft** and **not live AI classification or durable dialogue integration**. Actual model recognition/generation and persistence belong to [#74](https://github.com/peterbucci/ai-teaching-platform/issues/74) and [#75](https://github.com/peterbucci/ai-teaching-platform/issues/75).
- [PR #82](https://github.com/peterbucci/ai-teaching-platform/pull/82): teacher workspace pages; **draft** and not an implemented teacher copilot.
- [R7 contracts #72 / PR #77](https://github.com/peterbucci/ai-teaching-platform/pull/77) were merged, but contracts and fixtures do **not** establish live agentic behavior.

**Planned or integration-incomplete:** R4 import/concept/question/publish [#49–#53](https://github.com/peterbucci/ai-teaching-platform/issues/20); R7 real selection/generation/persistence/evaluation; R1 visual action and feedback; R2 intervention workflow; R5 new pattern discovery; Teacher Copilot; production end-to-end showcase.

Older README/issue/guide claims about a *locked nonagentic MVP* or *six reach goals* are historical and **must be reconciled** with this approved product direction. Do not silently mark issues complete or rewrite status history. Update roadmap #15, release epic #9, relevant issue criteria, and protected docs in a reviewed, explicitly authorized change.

## 12. Roadmap ownership and GitHub project organization

Keep the existing workstreams and issues where possible; avoid reimplementing merged functionality:

| Existing issue area | What it should now deliver |
| --- | --- |
| [R4 #20 / #49–#53](https://github.com/peterbucci/ai-teaching-platform/issues/20) | Teacher-supplied and immutable versioned content, approved concepts/questions, assignment publication. |
| [R7 #71 / #73–#76](https://github.com/peterbucci/ai-teaching-platform/issues/71) | Single student conversation, live intent and instructional-action selection, grounded generation, safe persistence and real tests. Add one focused orchestration story if no existing issue owns it. |
| [R1 #17 / #38–#43](https://github.com/peterbucci/ai-teaching-platform/issues/17) | Validated visual tool, calculation, generated visual, tutoring adapter, and saved interaction evidence. |
| [R2 #18 / #44–#46](https://github.com/peterbucci/ai-teaching-platform/issues/18) | Draft, teacher approval and delivery, later evidence comparison. |
| [R5 #21 / #54–#55](https://github.com/peterbucci/ai-teaching-platform/issues/21) | New potential patterns, correctable teacher review. |
| **New Teacher Copilot epic (proposed)** | Context-aware assistant, structured draft patches, authorized insights, teacher confirmation. |
| [Integration/release #9, #35–#37](https://github.com/peterbucci/ai-teaching-platform/issues/9) | Real agentic demo acceptance, deployment, failure recovery and submitted evidence. Keep the old baseline regression checks. |

Retain Project #7's **Backlog, Todo, In Progress, In Review, Done** statuses. Use views such as *Critical Path, Teacher Authoring & Copilot, Agentic Tutoring, Insights & Interventions, Integration & Release,* and *Later*. Track priority, owner, dependency, target date, and **verification level** (fixture / real-model / integrated). An attractive or passing UI fixture is not a real service.

Parallelize independent contracts, visual renderer, pure simulation, teacher form, and analytics work. Coordinate shared migrations, lesson/content references, agent action contracts, and session/teacher permissions before merging. Do not assign invented teammate handles or override someone else's branch.

## 13. Testing and acceptance

Tests should target consequential behavior rather than arbitrary coverage counts.

**Shared checks:** valid/invalid source extraction, lesson version pinning, teacher approvals, class isolation, grounding and unsupported evidence, prompt injection and hidden rubric leakage, session recovery, idempotency and spending limits, permission failures, original answer immutability, and honest metrics.

**Agentic tutor checks:** distinct previously unseen errors lead to meaningfully different permitted actions; help asks never become assessed answers; ambiguous intent is clarified; source-backed answers remain relevant; failed tool/model calls fall back; visual results are recomputed in reviewed code; the next decision responds to new student evidence.

**Teacher checks:** copilot proposes an accurate draft patch but does not silently publish; stale form versions reject overwrites; suggested recipients and patterns have inspectable evidence; only authorized teachers see student-level material; approved intervention results link back to original observations.

**Three distinct types of evidence:**

1. **Deterministic tests** prove code contracts, authorization and state transitions.
2. **Actual-model tests** exercise real classification, questions, actions, grounding and pedagogical appropriateness with reviewed fictional cases.
3. **Integrated browser/database tests** prove that the teacher and student can use the feature end to end and recover from failures.

Report the real model, source version, test input, observed decision/tool, outcome, failures, and remaining unrun cases. Do not treat a mock, a passing JSON schema, or a screenshot as a passed agentic demonstration. A teammate should review meaningful educational examples and critical permission changes.

## 14. Technology, security and non-goals

**Keep the installed stack:** Next.js 16 / React / TypeScript / Tailwind; Next.js server endpoints; PostgreSQL under Docker Compose; Better Auth; `pg`; Zod; OpenAI model access; versioned Markdown/JSON content; GitHub Issues, PRs, and Project #7.

Use simple server modules and reviewed React visual renderers. **Do not add** LangGraph/LangChain, a second backend/database, vector search, arbitrary model-generated code execution, or a general multi-agent framework without a demonstrated need and team review.

For the hackathon use **fictional accounts and synthetic student records**, with live model calls on fictional submissions clearly distinguished from prepared synthetic histories. Never commit secrets or upload private classroom records. Authentication, server-side authorization, provenance, data minimization, and clear failure behavior are required even in a demo. Do not claim school deployment readiness, FERPA compliance, research validation, or clinically/educationally calibrated mastery scores.

**Not part of the October 25 vertical slice:** unrestricted every-format ingestion or reliable OCR of scans, full LMS/Canvas synchronization or official gradebook, automatic high-stakes outreach, parent accounts, school-wide analytics for actual students, scientifically validated knowledge-tracing, broad cross-teacher sharing, and open-ended autonomous browser/code execution.

## 15. Decisions still requiring review

- Confirm the official Canvas submission rubric, deliverables, and any account-specific requirements.
- Identify who owns the new R7 orchestration, R4 resolver/import, Teacher Copilot, and integrated demo.
- Agree the first teacher-provided source and its permitted rights; choose whether slide/Word parsing fits before the deadline.
- Define the precise teacher-authoring approval and draft patch/apply API contracts.
- Agree which R1 visual formats and available tutor actions are enabled in the initial agentic demo.
- Choose honest thresholds for reporting pattern evidence and student practice recommendations; avoid unvalidated mastery claims.
- Verify production model credentials/budget and deployment, then run actual-model tests and an independent teammate rehearsal.

## 16. Definition of done and final principle

A **feature** is done only when its actual authorized workflow works end to end, its important failure paths preserve state, and its claims are backed by relevant tests. The **legacy curated tutoring baseline** should always remain usable; it is necessary regression coverage but is **not sufficient** to call the revised hackathon product agentic.

Our **agentic demonstration** is complete only when a real model can interpret a student's goal/evidence, propose a meaningful permitted action, use the approved tool through server validation, observe the result, and adapt—while the teacher can inspect the underlying learning evidence. Our team's broader submission goal also connects teacher-authored content and the prioritized R1/R2 showcase experiences. Report any unfinished elements openly.

**Build a platform that helps teachers decide what to teach and students decide how to reason—not a black-box grader, a collection of mockups, or an unrestricted autonomous agent.**
