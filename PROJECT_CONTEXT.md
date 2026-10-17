# AI-Powered Teaching and Learning Platform

## Project Status

This project is being developed for the **PEAAII AI Applications Hackathon at UMass Boston**.

- **Submission deadline:** October 25, 2026
- **Finalist symposium:** October 29, 2026
- **Working name:** Learning Pulse (not finalized)
- **Category:** AI-powered adaptive learning and teaching analytics
- **Status checked October 16, 2026:** The basic Next.js application, versioned networking lesson, and Docker/PostgreSQL/Better Auth evidence foundation are on `main`. Prepared content was merged in [PR #11](https://github.com/peterbucci/ai-teaching-platform/pull/11), and the database/authentication foundation in [PR #13](https://github.com/peterbucci/ai-teaching-platform/pull/13). The grounded AI evaluator is in [draft PR #14](https://github.com/peterbucci/ai-teaching-platform/pull/14), whose report says successful real-model evaluation is blocked by HTTP 429/API access. The complete tutor, dashboard, and reach-goal experiences have **not yet been verified as finished**.

This document explains **what we're trying to build and why**, not a claim that every feature is working. For live development status, see the [GitHub Project board](https://github.com/users/peterbucci/projects/7), [issues](https://github.com/peterbucci/ai-teaching-platform/issues), and [pull requests](https://github.com/peterbucci/ai-teaching-platform/pulls).

**Our planning decision:** The original MVP is still our minimum definition of success, but the team is actively pursuing six additional reach goals before the hackathon. They can be built in parallel. The full [development roadmap](https://github.com/peterbucci/ai-teaching-platform/issues/15) is the source of truth for their stories and priorities.

## 1. Project Overview

We're building an AI-powered educational platform for **both teachers and students**.

Students get personalized practice based on material their teacher assigns. The AI should help students reason through questions, not simply tell them the correct answer or summarize a chapter.

At the same time, the platform keeps a record of the learning process and helps teachers see:

- Which concepts students are struggling with.
- Common *possible* misunderstandings in student explanations.
- Whether students respond differently after receiving an explanation or trying another activity.
- Whether students can recall something later, not just right after getting help.
- Which observed learning patterns might be worth discussing in class.

A normal quiz might tell a teacher that 40% of the class got a question wrong. Our system aims to help the teacher understand **what reasoning might be behind those answers** and decide what to do next.

We also want the AI to adapt **how it teaches**. If a conversation isn't helping, it might offer a guided diagram or experiment. If several students struggle with the same idea, it could propose a teacher-reviewed review activity.

The goal isn't to replace teachers, build a complete learning management system, or create another generic AI chatbot. We want to give students more useful practice and teachers clearer, inspectable information.

> **Guiding principle: AI detects learning signals. Humans understand students.**

## 2. Hackathon Scope and How It Differs from a Real Service

### The minimum version we must finish (MVP)

Our **minimum viable product (MVP)** is a small, dependable experience:

- One fictional teacher and one fictional class.
- Approximately 20–30 fictional students represented by **clearly labeled synthetic histories**.
- One preloaded, versioned textbook reading.
- Five prepared learning concepts and a small curated question bank.
- One complete tutoring sequence: initial answer, appropriate diagnostic follow-up, grounded feedback, and a fresh retest.
- Saved learning evidence and a teacher dashboard that visibly updates after a live interaction.

The teacher must be able to **review and approve** the prepared assignment. Our team's earlier approval of the reference material is not the same thing as approval by a teacher in the application.

**If none of the reach goals is completed, the MVP can still be a valid hackathon submission.** It must continue to work if a reach feature is turned off or fails.

### Six planned reach goals

We're also actively developing the following, in this priority order:

| Phase | What we're trying to add | What it would let someone do |
| --- | --- | --- |
| **R1 — [Interactive visual tutoring](https://github.com/peterbucci/ai-teaching-platform/issues/17)** | AI-generated, validated diagrams and guided experiments | A student predicts, changes variables, explains what happened, and gets a different next step based on that reasoning. |
| **R2 — [Teacher action center](https://github.com/peterbucci/ai-teaching-platform/issues/18)** | Suggested review activities based on learning evidence | A teacher reviews, edits, approves, and assigns a useful follow-up, then sees what happened afterward. |
| **R3 — [Teach-the-AI](https://github.com/peterbucci/ai-teaching-platform/issues/19)** | Students explain a concept to a fictional learner | The AI asks follow-up questions, and the student completes a fresh check of understanding. |
| **R4 — [Teacher-provided lessons](https://github.com/peterbucci/ai-teaching-platform/issues/20)** | Import approved material and generate a bounded lesson | A teacher reviews learning goals and publishes activities using the same tutoring system. |
| **R5 — [New reasoning patterns](https://github.com/peterbucci/ai-teaching-platform/issues/21)** | AI proposes possible class-wide patterns not already in our list | A teacher can inspect, correct, approve, or dismiss a suggested pattern. |
| **R6 — [Voice](https://github.com/peterbucci/ai-teaching-platform/issues/22)** | Optional speech input and spoken feedback | Students can speak an answer or listen to feedback while retaining the full text option. |

These are **reach goals, not promises**. Teams can develop them alongside the MVP using shared examples. An individual component can work before its full feature is connected. We should only call a reach goal complete after its real end-to-end experience has been verified.

The [roadmap (#15)](https://github.com/peterbucci/ai-teaching-platform/issues/15) contains the more detailed epics, stories, dependencies, and test conditions.

### Why we're preparing some content manually

The fixed reading, questions, expected answers, diagnostic scenarios, and misconception categories give us reliable examples against which to test the AI.

They serve two purposes:

1. They give us a repeatable hackathon demonstration.
2. They give us a **reference for evaluating the AI's decisions**. We can compare its judgments and follow-ups against known examples rather than simply assuming they are educationally useful.

This does **not** mean real teachers should manually write every question, rubric, misconception, and retest for every chapter. That would create more work for teachers and undermine the value of the product.

### How a real teacher would use the finished service

The intended experience is much simpler for teachers:

1. **Assign material.** Upload or choose a chapter, reading, slides, or other permitted material.
2. **Review learning goals.** The AI suggests key concepts. The teacher edits or approves them, rather than authoring a complete question bank.
3. **Let students study.** The tutor asks grounded questions and adapts its explanations, follow-ups, and activities to each student's responses.
4. **Review learning insights.** The teacher sees concept performance, possible class-wide misunderstandings, and the evidence behind them.
5. **Stay in control.** The teacher can inspect, correct, dismiss, or act on an insight. The AI doesn't make high-stakes decisions about students.

Teachers should be able to add their own questions or review AI-generated examples, but **approving every individual practice question shouldn't be required**.

### A roadmap, not two separate products

The preloaded networking lesson and teacher-generated lessons should eventually use the **same question, source, evaluation, and evidence system**. We should extend the working foundation rather than create a second tutor just for generated material.

We can start with a small, safe content format. Supporting teacher-provided text and carefully scoped documents does **not** mean accepting every PDF, scan, figure, or textbook perfectly.

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

The prepared `content/network-performance-v1/` package includes **13 assigned passages, 15 questions**, and a detailed transmission-versus-propagation demonstration. The package's IDs and source version should stay stable now that it has team approval. The full upstream source file is preserved for provenance, **not** for expanding the assigned reading.

The prepared content was approved for hackathon team use on October 14, 2026, at 7:30 PM ET (`2026-10-14T19:30-04:00`): reading, five concepts, question guidance, possible misconceptions, and the complete transmission/propagation example. This does **not** establish actual classroom-instructor review or scientific validation. The other concepts also have approved questions but do not need complete diagnostic sequences for the MVP.

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

### Interleaving — optional learning method

Mix related concepts once students have practiced them individually. This can help them distinguish, for instance, transmission delay from propagation delay. Do not prioritize it ahead of the working core flow.

### Pretesting — optional learning method

A few low-stakes questions before a reading could establish prior knowledge. This is not required for the first demonstration.

### Exploring and teaching back — planned reach activities

An interactive experiment can ask a student to **predict, investigate, and explain**. Teach-the-AI mode can ask the student to explain something to a fictional learner. Both should end with a meaningful question that doesn't simply repeat the answer the student was shown.

The learning methods above have research support, especially retrieval and distributed practice. That **does not** mean our particular AI tutor, scoring, generated diagrams, or misconception detection has been educationally validated.

## 4. Adaptive Tutoring Behavior

The tutor follows a **controlled decision process**. The AI evaluates what the student says and proposes an appropriate next step; the application checks whether that step is permitted and records what actually happened.

A typical sequence is:

1. Select a teacher-approved concept and grounded question.
2. Receive the student's answer.
3. Evaluate correctness and ask for an explanation when useful.
4. Decide whether to continue, clarify, investigate a possible misconception, offer feedback, or retest.
5. Save the answer, evaluation, source references, and any assistance.
6. Continue or schedule future practice.

Actions available to the core tutor may include:

- `ASK_RETRIEVAL_QUESTION`
- `ASK_SELF_EXPLANATION`
- `ASK_DIAGNOSTIC_FOLLOWUP`
- `GIVE_HINT`
- `GIVE_CORRECTIVE_FEEDBACK`
- `RETEST_CONCEPT`
- `MOVE_TO_NEXT_CONCEPT`
- `SCHEDULE_REVIEW`

The reach goals may extend the allowed actions, for example by offering a validated visual activity. Those extensions must use the **same server-controlled tutoring process**, not a competing state machine.

### How visual tutoring would work (R1)

Suppose a student thinks doubling the cable length doubles both transmission and propagation delay.

The tutor might choose a guided packet-delay experiment:

1. **Predict:** The student says what they think will change.
2. **Experiment:** The student adjusts distance, packet size, or link rate and sees the resulting delay.
3. **Explain:** The student describes why the result happened.
4. **Adapt:** The tutor uses the prediction and explanation to choose a clarification, another comparison, feedback, or a fresh retest.

The AI can produce **structured instructions** for concept diagrams, sequences, or supported experiments. Reviewed application components display them. For quantitative examples, **ordinary code calculates the results**, using checked formulas and inputs.

Do **not** run arbitrary model-generated JavaScript, HTML, SVG, or mathematical formulas in the student's browser. A new quantitative subject needs its own reviewed calculations. A failed diagram should leave the ordinary text tutoring experience available.

An animation or a correct slider setting alone is **not** evidence that the student understands the concept. Ask them to explain what they observed.

### Other tutoring modes (R3 and R6)

In **Teach-the-AI**, the student explains a concept to a fictional learner. The AI asks a relevant follow-up and uses the normal evaluator to help check the explanation. A fresh question follows.

In **Voice mode**, a student can speak an answer or listen to feedback if the feature is available. Students must be able to review a transcript before it's treated as their answer, and text remains available.

The AI should never have unrestricted autonomy over student records, official grades, private messages, or assignments.

## 5. Detecting Misconceptions

Investigating a *possible* misconception is one of the central features of the project.

Suppose a student says:

> “Transmission delay doubles because the packet has farther to travel.”

The tutor can form a **tentative hypothesis**: the student may be confusing transmission delay with propagation delay.

Rather than immediately labeling the student, it asks a question designed to test that explanation. It might change distance while keeping packet size and rate constant, then ask the student to explain what changes. A separate follow-up can vary packet size instead.

The result may **support, weaken, reject, or leave the hypothesis uncertain**. Then the tutor can provide grounded corrective feedback and ask a different retest question.

A single wrong answer, arithmetic mistake, ambiguous response, or skipped explanation does not establish a specific misconception. We cannot observe a student's internal mental model directly.

### How we handle misconceptions in the MVP

Use the prepared concept-level misconception IDs from `concepts.json`, including `other_or_uncertain`. These make the demo consistent and give us reference cases for evaluation. The transmission-versus-propagation sequence is the primary fully mapped example.

### Discovering new patterns (R5)

In the longer-term product, a teacher should **not** have to anticipate and define every misconception manually.

Our **R5 hackathon reach goal** explores a bounded version of this: the AI proposes possible recurring reasoning patterns from responses that don't fit existing categories. It keeps the original answers, shows evidence for and against each proposal, and lets the teacher rename, correct, approve, or dismiss a suggestion.

Similar wording can hide different mistakes, and different wording can express the same idea. New groupings need careful review. **R5 is active reach-goal work, not an MVP requirement or an already validated feature.**

## 6. Grounding and RAG

The tutor should generate questions, explanations, evaluations, and visual activities using **the material the teacher assigned**, rather than drawing freely from everything the model knows.

For the MVP, we have one versioned excerpt and known concept-to-passage mappings. We can look up those passages directly without a vector database.

The grounding process is:

1. Identify the current concept and question or activity.
2. Look up its approved source passages.
3. Give those passages and relevant student response context to the model.
4. Validate cited passage IDs against the approved document version.
5. Save relevant source references alongside the result.

If the assigned material doesn't provide enough evidence for an answer, the tutor should say so instead of inventing one. A failed retrieval is not proof that the full reading lacks the answer, so handle uncertainty carefully.

For **R4 teacher-provided lessons**, the same source-first rule applies to imported material. A published lesson must use the **right approved lesson version**, even after a teacher adds a newer reading. The scoped content resolver is tracked in [LP-11.5](https://github.com/peterbucci/ai-teaching-platform/issues/53).

RAG (retrieval-augmented generation) means giving the AI relevant source material when it answers. It reduces some risks but does not guarantee correctness.

## 7. Learning Evidence and Shared Data Contracts

**Learning evidence** is the record of what the student actually said and did, along with the system's careful interpretation. It is how teachers can inspect an AI judgment and how the dashboard can calculate trustworthy patterns.

At a minimum, an attempt or linked evaluation should preserve:

- Unique attempt ID; student, class, assignment, session, concept, and question IDs.
- The student's original response and when it was submitted.
- Whether the attempt was independent, assisted, diagnostic, an immediate retest, or a delayed retrieval.
- Assistance or hints **actually shown** before the response, not merely proposed by the model.
- Evaluation results and meaningful uncertainty.
- Supporting passage IDs and exact document/content version.
- Any possible misconception, status, and supporting or contradictory evidence.
- The next permitted tutoring action and any corrective feedback shown.
- Links among initial attempts, diagnostic follow-ups, and retests.
- Last-practiced and next-review information when applicable.

**Reach-goal evidence** may also record validated visual activity versions, the student's predictions and submitted experiment settings, server-calculated outcomes, explanations, generated lesson versions, and teacher-reviewed intervention decisions.

Not every field needs its own database table or applies to every step. Store original student answers separately from model interpretations where practical. Avoid unnecessary duplication, but preserve the evidence needed to reconstruct a session.

**Content provenance:** A curated question must retain its approved reading and version. A generated question or activity must preserve its source references and information about how it was generated. A later lesson revision must not rewrite older learning records.

Do not count multiple attempts by one student as multiple students. Do not treat same-session success after help as demonstrated long-term retention.

The **PostgreSQL evidence and authentication foundation is already merged**. New features should extend that foundation instead of adding a separate database or replacing the existing contracts.

## 8. Teacher Dashboard

The dashboard should translate tutoring sessions into **useful, inspectable learning signals**, rather than only showing quiz scores.

### Class overview

- Participation in the assigned activity.
- Performance by concept, with clear definitions and denominators.
- Common possible misconceptions and recurring error patterns.
- Observed situations where additional teacher support might be helpful.

### Concept insights

Show where students succeed independently versus after help. Avoid presenting an arbitrary percentage as a scientifically validated mastery score.

### Misconception trends

Show how many **distinct students** have responses consistent with a particular pattern, what the pattern is, whether later responses changed, and original examples/source passages supporting it.

In the MVP, grouping can use reviewed misconception IDs. In R5, AI-proposed groupings need to remain reviewable and correctable.

### Retention

Keep immediate and delayed retrieval separate. If delayed results are only synthetic, label them clearly. Do not imply that an actual longitudinal study occurred.

### Individual support

Describe **observed learning behavior**, not a student's character, motivation, ability, disability, or personal circumstances. The teacher decides whether and how to reach out.

### Teacher action center (R2)

A teacher can turn a dashboard observation into a **reviewed follow-up activity**. The AI may draft a targeted exercise from the approved material, but the teacher checks and approves it before assigning it. Later responses should link back to that assignment.

The dashboard should also be able to show a saved visual activity (R1) without regenerating it and compare what the student predicted, tried, and explained.

## 9. Proposed Technology Stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Application | Next.js, React, TypeScript | Student and teacher screens and server-side logic |
| Styling and charts | Tailwind CSS; optional shadcn/ui and Recharts | Clear, usable interfaces |
| Server endpoints | Next.js Route Handlers / Server Actions | Handle requests and coordinate tutoring |
| Database | **Self-hosted PostgreSQL in Docker** | Store students, sessions, attempts, evaluations, and insights |
| Authentication | **Better Auth** | Sign-in and sessions for fictional teacher/student accounts |
| AI | OpenAI Responses API with structured outputs | Evaluate responses and propose grounded next steps or activities |
| Validation | Zod | Check inputs, AI judgments, and generated activity descriptions |
| Course content | Versioned Markdown/JSON and approved passage lookup | Keep the MVP repeatable; extend for R4 lesson imports |
| Visual tutoring (R1) | Reusable React renderer and reviewed simulations | Display AI-composed diagrams safely |
| Deployment | Docker Compose on a Docker-capable server | Run the web app and database together |
| Collaboration | GitHub and AI coding assistants (Codex, Claude Code, or others) | Track issues, reviews, and parallel contributions |
| Testing | Focused deterministic checks and small real-model evaluation sets | Verify important behavior honestly |

A separate Python backend, LangChain/LangGraph, custom AI model, vector database, and general-purpose AI code-execution engine are **not required**. They shouldn't be added without a concrete, team-reviewed need.

## 10. Architectural Principles

Keep the implementation understandable and as small as practical.

- **UI:** Display questions, diagrams, controls, feedback, and teacher insights.
- **API/application layer:** Check permissions and coordinate requests.
- **Tutoring logic:** Decide which actions and state changes are allowed.
- **AI service:** Interpret language and propose grounded evaluations, tutoring actions, or activity specifications.
- **Data access:** Save original responses, validated judgments, and interaction evidence.
- **Analytics:** Use ordinary TypeScript/SQL to calculate counts and clear metrics.
- **Visual model:** Use validated activity descriptions, reusable display components, and reviewed calculations.

**Separate the source of learning content from the tutoring workflow.** A question should have concept, source, answer guidance, and version information whether it was curated for the demo or generated from approved material.

The same principle applies to visual activities. The AI may choose an appropriate structure and guided steps, but the application controls rendering, calculations, user permissions, and recording.

This is a *compatibility principle*, not permission to create abstract provider frameworks, plugin systems, or extensive generalized engines in advance. Start with the approved networking package and extend only for actual stories.

All model output is untrusted: validate schema, IDs, references, permitted actions, and parameters. Keep secrets on the server. A teacher may see authorized classroom evidence but not another class's private records.

**Failure rule:** If a visual generator, speech service, or other reach component fails, the student's text-based learning progress must remain usable.

## 11. Minimum Viable Product

The submission-ready **core demonstration** needs to show:

1. One prepared reading and approved concepts in a fictional teacher's assignment.
2. A fictional student answering a retrieval question grounded in the reading.
3. An AI evaluation of that response using approved passages and expected-answer guidance.
4. A diagnostic follow-up when an answer suggests a possible misconception.
5. Grounded corrective feedback and a **different** immediate retest question.
6. Saved evidence linking the initial answer, follow-up, feedback, and retest.
7. A teacher dashboard showing class patterns from clearly labeled synthetic histories.
8. At least one teacher-facing insight changing after a live student interaction.

The first end-to-end path should use the prepared `NP-TX-01` transmission-versus-propagation scenario. It must handle more than the “misconception supported” outcome; the model should be able to reject or remain uncertain about an initial hypothesis.

We do **not** require generated diagrams, new imported lessons, discovered categories, voice, or the other reach features to complete the MVP. They are additional planned work, not a replacement for the core.

## 12. Outside Our Hackathon Scope

The following are **not** approved as part of the MVP or the six bounded reach phases:

- A complete learning management system, Canvas/Blackboard synchronization, or official gradebook.
- Unrestricted processing of every textbook, PDF, scanned page, figure, or course.
- Automatic production of entire large-scale question banks or fully autonomous courses without teacher oversight.
- Scientifically calibrated mastery scores or complex, unvalidated knowledge-tracing claims.
- Parent accounts, native mobile apps, or autonomous high-stakes student messaging.
- Real classroom experiments, production-compliance claims, or automatic high-stakes decisions about students.
- Arbitrary execution of AI-generated code in student visualizations.
- Building our own AI model or a large, unnecessary multi-agent orchestration platform.

**Important distinction:** A *bounded* teacher-content importer (R4) and teacher-reviewed new-pattern suggestions (R5) **are part of our planned reach goals**. They should not be dismissed as out of scope simply because the full production versions would be much larger.

If the deadline becomes tight, ship a dependable core and only the reach goals that have passed their end-to-end checks.

## 13. Testing Priorities

Focus on **realistic, consequential failures**, not test count or coverage targets.

Core checks:

- The actual model distinguishes correct, partial, incorrect, ambiguous, and unsupported responses in a small reference set.
- One initial answer does not establish a definite misconception.
- Follow-ups can strengthen, reject, or leave a hypothesis uncertain.
- Invalid AI actions, source IDs, and outputs fail safely without corrupting a session.
- Original responses, assistance, feedback, and retests are linked correctly.
- Class metrics count distinct students and use correct denominators.
- Teacher/student permissions prevent unintended data access.
- The live end-to-end demo works, with an honest backup walkthrough if needed.

For implemented reach goals, also check:

- **R1:** Generated activities are grounded and valid; calculations are correct; prediction, experiment, and explanation events affect the tutor. A failed visual step leaves text tutoring available.
- **R2:** Teachers can inspect, edit, approve, and assign an intervention and see follow-up evidence.
- **R3:** Teach-the-AI questions probe reasoning without rewarding superficial agreement.
- **R4:** A teacher's imported lesson uses the correct approved source/version and doesn't leak another class's content.
- **R5:** Proposed patterns remain tentative, evidence-backed, and correctable.
- **R6:** Students can review transcripts and still use text without speech.

Static content checks, deterministic software tests, and actual-model evaluations answer **different questions**. Passing a JSON verifier or mocked test does not prove the AI is a good tutor.

## 14. Development Priorities and Team Workflow

**Submission deadline: October 25, 2026.** Work in small GitHub issues and feature branches, with teammate review before merging to `main`.

Our shared planning reference is [Roadmap #15](https://github.com/peterbucci/ai-teaching-platform/issues/15). Its epics divide the work into **MVP/P0**, **primary reach/P1**, and **additional reach/P2**.

### What we should focus on now

1. Finish and verify the evaluator in [Issue #4](https://github.com/peterbucci/ai-teaching-platform/issues/4) and draft PR #14, including resolving the reported API-access blocker.
2. Agree on shared request/response examples in [LP-01.2](https://github.com/peterbucci/ai-teaching-platform/issues/24) and visual-activity formats in [LP-07.1](https://github.com/peterbucci/ai-teaching-platform/issues/38).
3. Build student tutoring, assignment approval, synthetic class data, dashboard, and Docker deployment in parallel.
4. Develop the interactive diagram player, networking experiment calculations, activity generation, and tutor integration **in parallel with the MVP**, not after everything else.
5. Work on teacher actions, Teach-the-AI, lesson imports, new-pattern proposals, and voice when owners can build them without blocking shared integration.
6. Rehearse the independent MVP first, then each fully integrated reach feature. Demonstrate what actually works.

This order guides **integration attention**. It does not mean everyone must finish one phase before anyone begins another.

### Working as a team with AI

Teammates may use **Codex, Claude Code, or other coding assistants**. They don't all need a computer science background, or even the same editor.

- Use one assigned issue and your own branch at a time.
- Read the issue and ask the AI to explain it before changing files.
- Coordinate shared interfaces, migrations, permissions, and deployment.
- Use clearly labeled sample data to let independent work begin; don't present mock data as working live AI.
- Run the relevant tests and explain what wasn't tested.
- Ask a teammate to review the pull request before merging.

See [Start Here](docs/START_HERE.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [First Task](docs/FIRST_TASK.md) for the easy version of the workflow.

## 15. Definition of Done

The **core MVP** is ready when:

- One fictional student can complete a source-grounded retrieval question.
- The AI evaluates the response without inventing sources or forcing a diagnosis.
- The tutor can ask an appropriate diagnostic follow-up.
- Grounded feedback and a different retest work.
- The original answers, evaluations, displayed assistance, and citations remain linked.
- The teacher can inspect the evidence behind a class insight.
- A live student response visibly changes a teacher-facing result.
- The deployed experience works reliably and all synthetic data is clearly identified.
- The entire flow still works when reach features are off.

An individual **reach goal** is ready only when its real experience works, meets its epic's acceptance criteria, and doesn't break the core. Working mock components or generated screenshots are useful progress, but not proof of completion.

## 16. Open Decisions and Blockers

These need team agreement or verification rather than silent implementation assumptions:

- Final product name.
- Confirmation that textbook reuse follows the license conditions and any applicable third-party notices.
- Final approved extensions to the shared evidence and visual-activity formats.
- **OpenAI API access for real-model tests** and the configured model; PR #14 currently reports HTTP 429 as a blocker.
- Definitions of teacher-facing metrics and thresholds.
- Deployment host and HTTPS setup for the self-hosted demonstration.
- Which reach goals receive owners and which versions pass integration before the deadline.

The overall direction is clear: **teachers should not have to author every question, misconception, and tutoring branch**. The hackathon's six reach phases let us explore parts of that vision with bounded, testable implementations.

## 17. Project Principle

Build a reliable learning loop:

**Assigned material → Student reasoning → Diagnostic AI tutoring → Structured evidence → Teacher insight**

Then extend it when useful:

**Different activity (such as a visual experiment) → Student prediction and explanation → Adaptive follow-up → Teacher-approved next action**

The hackathon's curated content lets us test that core flow. The reach goals show how the platform could generate grounded activities and help teachers respond to what students need, while preserving evidence, safeguards, and human oversight.

**Build ambitiously, but verify honestly. The minimum experience should stand on its own.**
