# AI-Powered Teaching and Learning Platform

## Project Status

This project is being developed for the **PEAAII AI Applications Hackathon at UMass Boston**.

- **Submission deadline:** October 25, 2026
- **Finalist symposium:** October 29, 2026
- **Working name:** Learning Pulse (not finalized)
- **Category:** AI-powered adaptive learning and teaching analytics
- **Current implementation (as of October 14, 2026):** The minimal Next.js application foundation is on `main`. A prepared networking content package is under review in [draft PR #11](https://github.com/peterbucci/ai-teaching-platform/pull/11). The database, working AI tutor, and teacher dashboard are not yet implemented.

This document describes **the intended product and agreed MVP direction**, not a claim that every feature exists. Inspect the repository, GitHub issues, and open pull requests for the actual implementation status. Team content approval does not mean the draft PR has been merged or the tutor implemented.

## 1. Project Overview

We're building an AI-powered educational platform for **both teachers and students**.

Students get personalized practice based on material their teacher assigns. The AI uses research-backed learning methods rather than simply summarizing chapters or giving students generic quizzes.

At the same time, the application records evidence about student understanding and helps teachers see:

- Which concepts students are struggling with.
- Common possible misconceptions and patterns in incorrect reasoning.
- Whether explanations and corrective feedback appear to help.
- Whether students can still recall material later, not just immediately after an explanation.
- Which students might benefit from additional human support.

A normal quiz might tell a teacher that 40% of the class got a question wrong. Our system aims to help the teacher understand **what reasoning patterns might explain those mistakes** and what could be worth reviewing in class.

The goal is not to replace teachers, build a complete learning management system, or create another generic AI chatbot. We want to give teachers better information while giving students more useful practice.

> **Guiding principle: AI detects learning signals. Humans understand students.**

## 2. Hackathon Scope and How It Differs from a Real Service

### What we're building for the hackathon

Keep the first version intentionally small:

- One fictional teacher and one fictional class.
- Approximately 20–30 fictional students represented by **clearly labeled synthetic histories**.
- One preloaded, versioned textbook reading.
- Five prepared learning concepts and a small curated question bank.
- One complete adaptive tutoring sequence, including a diagnostic follow-up, corrective feedback, and a fresh retest.
- Saved learning evidence and a teacher dashboard that visibly updates after a live interaction.

The teacher must still be able to **review and approve** the prepared assignment. Preloading content is a shortcut for building and evaluating the demo; it is **not** the intended teacher onboarding process for a finished service.

### Why we're preparing so much content manually

The fixed reading, questions, expected answers, diagnostic scenarios, and misconception categories serve two purposes:

1. They give us a reliable, repeatable hackathon demonstration.
2. They provide **reference examples for testing the AI's educational decisions**. If we already know what a good follow-up looks like, we can check whether the model chooses something appropriate.

This does **not** mean real teachers should manually write every question, rubric, misconception, and retest for every chapter. Doing so would create more work for teachers and undermine the value of the product.

### How a real teacher would use the finished service

The intended experience is much simpler for teachers:

1. **Assign material.** Upload or select a chapter, reading, slides, or other permitted course content.
2. **Review goals.** The AI suggests the important concepts and learning objectives. The teacher edits or approves them, rather than authoring a full question bank.
3. **Let students study.** The AI generates grounded retrieval questions and answer criteria, then adapts explanations, diagnostic questions, and retests to each student's responses.
4. **Review learning insights.** The teacher sees concept performance, possible class-wide misconceptions, retention patterns, and students who may need attention, with supporting evidence.
5. **Stay in control.** The teacher can inspect, correct, dismiss, or act on an insight. The AI does not make high-stakes decisions about students.

Teachers should be able to add their own questions or review sample AI-generated questions, but **approving every single practice question should not be required**.

### Product roadmap, not MVP scope

| Stage | Content and tutoring | Teacher workload |
| --- | --- | --- |
| **Hackathon MVP** | Preloaded reading, manually curated questions and misconception examples, one reliable diagnostic flow. | Review and approve the prepared demo content. |
| **Next prototype** | AI drafts questions, expected-answer criteria, follow-ups, and retests from approved objectives and passages. | Approve objectives and optionally review examples or flagged material. |
| **Real service** | Supports broader course material and identifies recurring misconception patterns dynamically, with safeguards and evaluation. | Focus on assignments, goals, and decisions based on evidence—not authoring every tutoring step. |

**Important architectural rule:** The tutoring workflow should not fundamentally depend on questions or misconception categories being handwritten. Curated content and future AI-generated content should be able to use the **same core question, source, evaluation, and evidence contracts**. We only need the curated-content implementation now; do not build a generic generation platform prematurely.

### Demo reading

**Approved demo source:** *Computer Networks: A Systems Approach*, Larry Peterson and Bruce Davie, Section 1.5.1, “Bandwidth and Latency.”

- [Upstream textbook source](https://github.com/SystemsApproach/book/blob/master/foundation/performance.rst)
- [Pinned source revision used by the content package](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L14-L187)

The five prepared concepts are:

1. Bandwidth versus throughput.
2. Latency versus round-trip time (RTT).
3. Transmission delay.
4. Propagation delay.
5. Queuing delay.

The prepared `content/network-performance-v1/` package includes 13 assigned passages, 15 questions, and a detailed transmission-versus-propagation demonstration. The package's IDs and source version should stay stable now that it has team approval. The full upstream source file is preserved for provenance, **not** for expanding the assigned reading.

Peter Bucci approved `network-performance-v1` for the hackathon team on October 14, 2026 at 7:30 PM ET (`2026-10-14T19:30-04:00`): the selected reading/version, five concepts, 15 questions and answer guidance, misconception categories, and transmission-versus-propagation demonstration. This records team approval; it does not establish classroom-instructor review or scientific validation. The approved MVP scope requires **one complete adaptive sequence**: initial retrieval, diagnostic follow-up, grounded corrective feedback, fresh retests, and the evidence-recording specification. The other concepts have approved questions and guidance; more sequences can be added later.

Preserve attribution and licensing information. The source repository's CC BY 4.0 license explicitly grants reproduction, sharing, and adaptation rights, subject to its conditions. Its README contains an apparent inconsistency, not proof that separate permission is required. The [attribution document](content/network-performance-v1/ATTRIBUTION.md) links the official license, README, contributor agreement, and relevant commit history; the wording-carryover explanation remains an unconfirmed inference. Follow the license conditions and check separately credited third-party material. The package preserves both notices and does not claim author confirmation or legal clearance.

## 3. Student Experience and Learning Methods

Students open an assignment and study the approved material with the AI tutor. The AI should encourage them to **do the thinking**, not immediately provide summaries or answers.

### Retrieval practice — essential for the MVP

Ask students to recall information without seeing the correct answer first. For example: “Without looking back, what determines transmission delay?”

### Self-explanation — essential for the MVP

Sometimes ask students *why* they chose an answer or how they reached it. Their reasoning can reveal useful learning signals that a simple right/wrong result cannot.

### Corrective feedback — essential for the MVP

Give specific, source-supported explanations of mistakes. Avoid generic “Incorrect” responses. Then let the student demonstrate understanding again with a **fresh question**.

### Spaced practice — basic tracking in the MVP

Store when a concept should be reviewed again. A student answering correctly immediately after a hint is not evidence of durable retention. The demo can use synthetic prior histories to illustrate delayed practice; a complete scheduling engine is not needed now.

### Interleaving — stretch goal

Mix related concepts once students have practiced them individually. This can help students distinguish, for instance, transmission delay from propagation delay. Do not prioritize it ahead of the working core flow.

### Pretesting — optional future feature

A few low-stakes questions before a reading could establish prior knowledge. This is not required for the first demonstration.

The learning methods above have research support, especially retrieval and distributed practice. That **does not** mean our particular AI tutor, scoring, or misconception detection has been educationally validated.

## 4. Adaptive Tutoring Behavior

The tutor follows a **controlled decision process**. It evaluates what the student says and proposes an appropriate next step; application logic validates that proposal and owns the state transitions.

A typical sequence is:

1. Select a teacher-approved concept and a grounded question.
2. Receive the student's answer.
3. Evaluate correctness and, when useful, ask for an explanation.
4. Decide whether to continue, clarify, investigate a possible misconception, offer feedback, or retest.
5. Save the answer and evaluation with source references and assistance history.
6. Continue or schedule future practice.

Permitted actions for the first prototype may include:

- `ASK_RETRIEVAL_QUESTION`
- `ASK_SELF_EXPLANATION`
- `ASK_DIAGNOSTIC_FOLLOWUP`
- `GIVE_HINT`
- `GIVE_CORRECTIVE_FEEDBACK`
- `RETEST_CONCEPT`
- `MOVE_TO_NEXT_CONCEPT`
- `SCHEDULE_REVIEW`

The AI should never have unrestricted autonomy over student records, official grades, messages, or assignments.

**Curated versus generated content:** For the MVP, the question and diagnostic candidates come from our reviewed package. In a future service, the AI can generate them from approved concepts and source passages, but they should pass through the same validation and provenance checks. Do not bake a particular hard-coded demo question ID into the general tutoring engine.

## 5. Detecting Misconceptions

Investigating a possible misconception is one of the central features of the project.

Suppose a student says:

> “Transmission delay doubles because the packet has farther to travel.”

The tutor can form a **tentative hypothesis**: the student may be confusing transmission delay with propagation delay.

Rather than immediately labeling the student, it asks a question designed to test that explanation. It might change distance while keeping packet size and rate constant, then ask the student to explain what changes. A separate follow-up can vary packet size instead.

The result may **support, weaken, reject, or leave the hypothesis uncertain**. Then the tutor can provide grounded corrective feedback and ask a different retest question.

A single wrong answer, arithmetic mistake, ambiguous response, or skipped explanation does not establish a specific misconception. We cannot observe a student's internal mental model directly.

### How we handle misconceptions in the MVP

Use the prepared concept-level misconception IDs from `concepts.json`, including `other_or_uncertain`. These make the demo consistent and give us reference cases for evaluation. The transmission-versus-propagation sequence is the primary fully mapped example.

### How a real service would handle them

A real teacher should **not** have to anticipate and define every misconception manually.

The AI could generate a *possible* explanation for an observed error, ask a targeted question to investigate it, and record the resulting evidence. As more students study, a separate process could compare those evidence records to identify **recurring reasoning patterns**, including patterns not previously listed by the teacher.

Because two differently worded answers may reflect the same misunderstanding—and similar wording can sometimes reflect different problems—dynamic grouping requires careful evaluation. The application should preserve original responses, avoid forced classifications, allow uncertain cases, and let teachers inspect or correct groups.

This dynamic discovery and clustering is **future work**, not something we must implement by October 25. The MVP's controlled categories are a testing and demonstration aid, **not** a permanent requirement that teachers write misconception catalogs.

## 6. Grounding and RAG

The tutor should generate questions, explanations, and evaluations using **the material the teacher assigned**, rather than drawing freely from everything the model knows.

For the MVP, we have one versioned excerpt and known concept-to-passage mappings. We can retrieve those passages directly from the prepared data without a vector database.

The grounding process is:

1. Identify the current concept and question.
2. Look up its approved source passages.
3. Give those passages and the student's response to the model.
4. Validate cited passage IDs against the approved document version.
5. Save relevant source references alongside the result.

If the assigned material doesn't provide enough evidence for an answer, the tutor should say so instead of inventing one. A failed retrieval is not proof that the full reading lacks the answer, so handle uncertainty carefully.

For a future real service, uploads and AI-generated questions would use the **same source-first rule**. Adding a document-ingestion and semantic-retrieval pipeline is a later feature, not necessary for the preloaded demo. RAG reduces some risks but does not guarantee correctness.

## 7. Learning Evidence and Shared Data Contracts

Define what each student interaction must save **before building the full student and teacher interfaces**. This is what lets us explain an AI judgment and calculate trustworthy class-level insights.

At a minimum, an attempt or linked evaluation must preserve:

- Unique attempt ID; student, class, assignment, session, concept, and question IDs.
- Student's original response and when it was submitted.
- Whether the attempt was independent, assisted, diagnostic, an immediate retest, or a delayed retrieval.
- Assistance or hints **actually shown** before the response, not merely proposed by the model.
- Evaluation result and any meaningful uncertainty.
- Supporting passage IDs and exact document/content version.
- Any possible misconception ID or description, status, and supporting or contradictory evidence.
- The next permitted tutoring action and any corrective feedback shown.
- Links among the initial attempt, diagnostic follow-ups, and retests.
- Last-practiced and next-review information when applicable.

Not every field needs its own database table or applies to every step. Store original student answers separately from model interpretations where practical. Avoid unnecessary duplication, but preserve the evidence needed to reconstruct the session.

**Content provenance:** The MVP should be able to distinguish the approved, curated question/rubric/version used for an attempt. Future AI-generated questions should retain their own version, source references, and generation provenance using the same general contract; no dynamic content generator needs to be built now.

Do not count multiple attempts by one student as multiple students, or treat same-session success after help as demonstrated long-term retention.

## 8. Teacher Dashboard

The dashboard should translate individual tutoring sessions into **useful, inspectable learning signals**, rather than only showing quiz scores.

### Class overview

- Participation in the assigned activity.
- Performance by concept, with clear definitions and denominators.
- Common possible misconceptions and recurring error patterns.
- Students for whom instructor attention might be helpful.

### Concept insights

Show where students succeed independently versus after help. Avoid presenting an arbitrary percentage as a scientifically validated mastery score.

### Misconception trends

Show how many **distinct students** exhibited evidence consistent with a particular pattern, what the pattern is, whether later responses changed, and examples/source passages that support the summary.

In the MVP, grouping can use reviewed misconception IDs. In a real service, proposed groupings may be generated dynamically but must remain reviewable and correctable by teachers.

### Retention

Keep immediate and delayed retrieval separate. If delayed results are only synthetic, label them clearly. Do not imply that an actual longitudinal study occurred.

### Individual support

Flag repeated difficulty across attempts or sessions when useful, but describe **observed behavior**, not the student's character, effort, ability, disability, or personal circumstances. The teacher decides whether and how to reach out.

The finished product should also allow teachers to dismiss incorrect insights or flag misleading questions. Such review controls are a product goal, not required for the minimal hackathon dashboard.

## 9. Proposed Technology Stack

| Area | Proposed technology | Purpose |
| --- | --- | --- |
| Application | Next.js, React, TypeScript | Student and teacher interfaces and server-side application logic. |
| Styling and charts | Tailwind CSS, optional shadcn/ui, Recharts | Consistent UI and dashboard visuals. |
| Server endpoints | Next.js Route Handlers / Server Actions | Request handling and tutoring coordination. |
| Database | Supabase PostgreSQL | Students, sessions, attempts, evaluations, and insights. |
| Authentication | Supabase Auth **if needed** | Teacher/student accounts; restricted demo access remains a decision. |
| AI | OpenAI Responses API with structured outputs | Response evaluation and grounded tutoring decisions. |
| Validation | Zod | Validate inputs and model-generated data. |
| Course content | Versioned Markdown/JSON and simple passage lookup | Deterministic content and source references for the MVP. |
| Deployment | Vercel | Host the demo. |
| Collaboration | GitHub, Codex | Team development, issues, review, and AI-assisted coding. |
| Testing | Focused deterministic checks and a small real-model evaluation set | Protect important behavior without excessive test infrastructure. |

Vitest can be introduced for meaningful tutoring and data tests; a Playwright smoke test is optional if it helps protect the primary demo.

A separate Python backend, LangChain/LangGraph, custom AI model, vector database, and production content-generation pipeline are **not required** for the MVP.

## 10. Architectural Principles

Keep the implementation understandable and as small as practical.

- **UI:** Display questions, responses, feedback, and teacher metrics.
- **API/application layer:** Authenticate or authorize where necessary and coordinate requests.
- **Tutoring logic:** Own allowed actions and state transitions independently of the model.
- **AI service:** Evaluate language, suggest tutoring actions, and generate explanations from provided evidence.
- **Data access:** Save the original responses and validated evaluations.
- **Analytics:** Use deterministic TypeScript/SQL to count unique students, compute clearly defined measures, and surface patterns.

**Separate the source of learning content from the tutoring workflow.** A question should have the required concept, source, answer guidance, and version information whether it was curated for the demo or generated by an AI in a future implementation.

This is a *compatibility principle*, not permission to create abstract provider frameworks, plugin systems, or extensive generation code in advance. Start with the reviewed package and refactor only when real needs justify it.

All model output is untrusted: validate the schema, IDs, evidence links, and permitted actions. Keep secrets server-side and ensure teachers cannot read another class's private records.

## 11. Minimum Viable Product

The submission-ready demonstration needs to show:

1. One prepared reading and approved concepts in a fictional teacher's assignment.
2. A fictional student answering a retrieval question grounded in the reading.
3. An AI evaluation of that response using approved passages and expected-answer guidance.
4. A diagnostic follow-up when an answer suggests a possible misconception.
5. Corrective feedback and a **different** immediate retest question.
6. Stored learning evidence linking the initial answer, follow-up, and retest.
7. A teacher dashboard showing class patterns from clearly labeled synthetic histories.
8. At least one teacher-facing metric or insight changing after a live interaction.

The first end-to-end path should use the prepared `NP-TX-01` transmission-versus-propagation scenario. It must handle more than the “misconception supported” branch—for example, the model should be able to reject or remain uncertain about the initial hypothesis.

We do **not** need every question and misconception to be dynamically generated in the MVP. That is part of the product vision, not the demo requirement.

## 12. Out of Scope for the Hackathon

Do not build these without explicit team approval:

- A complete LMS, Canvas/Blackboard sync, or official gradebook.
- Arbitrary textbook/PDF ingestion and large-scale course management.
- Automatic generation of entire course question banks, rubrics, and misconception catalogs.
- Dynamic class-wide misconception discovery and semantic clustering.
- Advanced knowledge-tracing or scientifically calibrated mastery scores.
- Parent accounts, mobile applications, or autonomous teacher-to-student messages.
- Real classroom studies, production compliance claims, or automatic high-stakes decisions.
- Custom AI models or an elaborate multi-agent orchestration framework.

If the deadline becomes tight, cut optional features rather than weaken the central tutoring-to-teacher-insight demonstration.

## 13. Testing Priorities

Focus on **realistic, consequential failures**, not test count or coverage targets.

Key checks:

- The actual model distinguishes correct, partial, incorrect, ambiguous, and unsupported responses in a small reference set.
- One initial answer does not establish a definite misconception.
- Follow-ups can strengthen, reject, or leave a hypothesis uncertain.
- Invalid AI actions, source IDs, and outputs fail safely without corrupting a session.
- Student responses, assistance, feedback, and retests are linked correctly.
- Class metrics count distinct students and use the correct denominators.
- Teacher/student authorization prevents unintended data access.
- The live end-to-end demo works reliably, with a backup walkthrough available.

Static package checks, deterministic software tests, and actual-model evaluations answer **different questions**. Passing a JSON verifier or a mocked test does not prove the AI is a good tutor. Do not create broad test suites or unnecessary testing frameworks for speculative features.

## 14. Development Priorities and Team Workflow

**Submission deadline: October 25, 2026.** Work in small GitHub issues and feature branches, with reviews before merging to `main`. The existing GitHub Project board tracks the team's work.

Priority order:

1. **Application foundation — completed on `main`.**
2. **Versioned demo content — team-approved with one complete prepared sequence in draft PR #11; not yet merged.**
3. **Shared evidence contract and minimal persistence.**
4. **Grounded AI evaluation using one approved question.**
5. **Diagnostic follow-up, feedback, and fresh retest.**
6. **Student UI, synthetic class histories, and teacher insight display.**
7. **Integration checks, deployment, rehearsal, backup recording, and submission.**

The frontend, AI, database, and dashboard work can proceed in parallel **once the shared data contracts and IDs are agreed upon**. Do not have different teammates invent incompatible evidence shapes.

Keep issue acceptance criteria and actual work aligned. Issue #2 uses the approved scope: one complete transmission/propagation sequence, with approved questions and answer guidance for the other concepts. Additional sequences can follow later.

## 15. Definition of Done

The core demonstration is ready when:

- One fictional student can complete a source-grounded retrieval question.
- The AI can evaluate the response without inventing a source or forcing a diagnosis.
- A relevant diagnostic follow-up can be asked when appropriate.
- Grounded corrective feedback and a fresh retest work.
- The original answers, evaluations, assistance, and citations are saved and linked.
- A teacher can inspect the evidence behind a relevant class insight.
- A live student response visibly changes at least one teacher-facing result.
- The deployed demonstration works reliably and synthetic data is clearly identified.

A polished interface is useful, but an understandable, trustworthy end-to-end flow matters more than the number of features.

## 16. Open Decisions

These require team agreement rather than silent implementation assumptions:

- Final product name.
- Confirmation that the planned reuse follows the license conditions and any applicable third-party notices.
- The final shared evidence schema and API contracts.
- AI model selection and evaluation criteria.
- Exact meanings and thresholds of teacher-facing metrics or support alerts.
- Supabase Auth versus restricted fictional demo access.
- Optional improvements if the core is finished early.

The broader product direction is clear: **teachers should not have to author every question, misconception, and tutoring branch**. Exactly how automated content creation and dynamic pattern grouping are implemented remains future design and research work.

## 17. Project Principle

Build the smallest reliable application that demonstrates:

**Assigned material → Research-backed studying → Diagnostic AI tutoring → Structured learning evidence → Teacher insights**

The hackathon's curated content lets us test and demonstrate this flow. The longer-term product uses AI to reduce teacher preparation by generating grounded learning activities and investigating reasoning patterns dynamically—with evidence, safeguards, and teacher oversight.

**We should design for the real teacher experience without trying to build the entire real service before the hackathon.**
