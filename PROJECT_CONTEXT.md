# AI-Powered Teaching and Learning Platform

## Project Status

This project is being developed for the PEAAII AI Applications
Hackathon at UMass Boston.

- Submission deadline: October 25, 2026
- Finalist symposium: October 29, 2026
- Status: Early development
- Working name: Learning Pulse (not finalized)
- Category: AI-powered adaptive learning and teaching analytics

This document describes the intended product, not necessarily
the current implementation. Inspect the repository to determine
what has actually been built.

## 1. Project Overview

We're building an AI-powered educational platform for teachers
and students.

Students receive personalized tutoring based on material
assigned by their teacher, using research-backed study methods.

At the same time, the application collects evidence about
student understanding and helps teachers identify:

- Concepts students are struggling with.
- Common misconceptions across the class.
- Patterns in incorrect reasoning.
- Whether corrective feedback appears to help.
- Whether previously learned material is retained.
- Students who may benefit from additional human support.

The goal is not to replace teachers or create another generic
AI chatbot.

We want to help teachers understand what students are learning
and misunderstanding before those problems become apparent
on major assessments.

Guiding principle:

"AI detects learning signals. Humans understand students."

## 2. Hackathon Scope

Keep the first version intentionally small.

Our initial demonstration should use:

- One teacher.
- One fictional class.
- Approximately 20–30 fictional students.
- One preloaded textbook reading.
- Five teacher-approved concepts.
- A small, curated question bank.
- One complete AI tutoring workflow.
- One teacher analytics dashboard.

All student records used for the demonstration must be
synthetic and clearly identified as such.

Do not attempt to build a complete learning management system.

### Demo Reading

Proposed source:

Computer Networks: A Systems Approach
Authors: Larry Peterson and Bruce Davie

Section 1.5.1: Bandwidth and Latency

https://github.com/SystemsApproach/book/blob/master/foundation/performance.rst

Proposed concepts:

1. Bandwidth versus throughput.
2. Latency versus round-trip time (RTT).
3. Transmission delay.
4. Propagation delay.
5. Queuing delay.

Use a fixed, versioned excerpt rather than dynamically retrieving
the latest source.

Preserve attribution and licensing information. The repository
contains conflicting language about derivative works in its
README and LICENSE; verify the intended reuse before publishing
adapted material.

The exact source is not finalized until approved by the team.

## 3. Student Experience

Students open an assigned study session.

The AI tutor asks questions based on the approved reading.

It should not simply summarize the reading and give the student
the answers.

The primary learning methods are:

### Retrieval Practice

Ask students to recall material without immediately showing
them the answer.

### Self-Explanation

Occasionally ask students to explain their reasoning.

### Corrective Feedback

Explain specific mistakes using evidence from the reading.

### Spaced Practice

Record when a concept should be reviewed again.

A full spaced-repetition implementation is not required
for the first demo.

### Interleaving

Mix related concepts to help students distinguish them.

This is a stretch feature, not an MVP requirement.

## 4. Adaptive Tutoring Behavior

The tutor follows a controlled decision process.

Basic sequence:

1. Select an approved concept.
2. Ask a retrieval question.
3. Receive the student's response.
4. Evaluate the answer using the assigned material.
5. Decide the next appropriate action.
6. Save the interaction and evidence.
7. Repeat or move to another concept.

Possible actions:

- ASK_RETRIEVAL_QUESTION
- ASK_SELF_EXPLANATION
- ASK_DIAGNOSTIC_FOLLOWUP
- GIVE_HINT
- GIVE_CORRECTIVE_FEEDBACK
- RETEST_CONCEPT
- MOVE_TO_NEXT_CONCEPT
- SCHEDULE_REVIEW

The LLM recommends an action.

Application logic validates the action and controls the
actual workflow.

The model must not have unrestricted autonomy.

## 5. Misconception Detection

This is one of the project's central features.

The system should investigate possible misconceptions
instead of declaring them after one incorrect answer.

Example:

Question:
"What happens to transmission delay if cable length doubles?"

Student:
"It doubles because the packet travels farther."

Possible misconception:
The student believes transmission delay depends on distance.

The system should ask a diagnostic follow-up that changes
one relevant variable at a time.

For example:

- Change distance while holding packet size and rate constant.
- Change packet size while holding distance and rate constant.
- Ask the student to explain the reasoning.

Use the answers to support, weaken, or reject the hypothesis.

Then:

1. Provide source-grounded corrective feedback.
2. Ask a fresh retest question.
3. Record the result.
4. Update the student's learning evidence.
5. Make relevant information available to the teacher.

Keep possible misconceptions tentative.

Do not claim to know a student's internal reasoning with certainty.

For the MVP, use a small predefined set of misconception
categories, including an "unknown" option.

## 6. Grounding and RAG

The AI must base questions, explanations, and evaluations
on the assigned material.

For the MVP, we have one known chapter and five concepts.

We do not need a sophisticated vector database.

Store the reading as versioned text or Markdown with
identifiable passages.

When the AI needs evidence:

1. Identify the relevant approved concept.
2. Retrieve its associated passages.
3. Supply those passages to the model.
4. Validate the model's source references.
5. Store the supporting passage IDs and document version.

If there is insufficient evidence in the assigned material,
the tutor should acknowledge that limitation.

Do not invent source references.

RAG reduces unsupported answers but does not guarantee accuracy.

## 7. Learning Evidence

We must define the information recorded during tutoring
before building the interfaces.

Each student question attempt should have enough information
to reconstruct what happened.

Required information:

- Unique attempt ID.
- Student ID.
- Class and assignment IDs.
- Study session ID.
- Concept ID.
- Question ID.
- Student response.
- Evaluation result.
- Whether hints or assistance were used.
- Relevant supporting passage IDs.
- Source document version.
- Timestamp.

Additional information when applicable:

- Possible misconception ID.
- Misconception status: suspected, supported, rejected, or unknown.
- Evidence supporting the assessment.
- Next tutoring action.
- Feedback provided.
- Linked diagnostic/retest attempt.
- Review due date.

Distinguish between:

- Initial independent retrieval.
- Assisted retrieval.
- Diagnostic follow-up.
- Immediate retest.
- Delayed retrieval.

Not all fields apply to every attempt.

Avoid unnecessary duplication and use relational references
where appropriate.

Do not treat correctness immediately after feedback
as equivalent to durable understanding.

## 8. Teacher Dashboard

The teacher dashboard is a core product feature.

It should provide:

### Class Overview

- Participation.
- Performance by concept.
- Common possible misconceptions.
- Students potentially needing support.

### Concept Insights

Show which concepts have strong or weak evidence
of understanding.

### Misconception Trends

Identify patterns repeated across students.

Show:

- Misconception description.
- Number of affected students.
- Relevant learning evidence.
- Source material.
- Whether subsequent performance improved.

### Retention

Distinguish immediate performance from delayed retrieval.

Do not imply delayed retention has been measured if
only synthetic or same-session data exists.

### Individual Support

Highlight students who continue to struggle despite
multiple interventions.

Do not make judgments about motivation, intelligence,
disabilities, or personal circumstances.

The teacher decides whether and how to intervene.

## 9. Proposed Technology Stack

Frontend:

- Next.js
- React
- TypeScript

UI:

- Tailwind CSS
- shadcn/ui
- Recharts

Backend:

- Next.js Route Handlers / Server Actions

Database:

- Supabase PostgreSQL

Authentication:

- Supabase Auth when needed

AI:

- OpenAI Responses API
- Structured Outputs

Validation:

- Zod

Course Content:

- Versioned Markdown/text
- Curated concept and question definitions
- Simple passage retrieval

Deployment:

- Vercel

Collaboration:

- GitHub
- Codex

Testing:

- Vitest for important deterministic logic
- A small real-model evaluation set
- Optional Playwright demo smoke test

Avoid unnecessary services or frameworks.

A separate Python backend, LangGraph, LangChain, custom model,
and vector database are not required for the MVP.

## 10. Architectural Principles

Keep the application simple.

Separate these responsibilities:

- UI components display information.
- API routes handle requests and authorization.
- Tutoring logic controls learning state and actions.
- AI services generate and evaluate language-based content.
- Database services persist and retrieve records.
- Analytics services calculate teacher-facing metrics.

Use normal TypeScript/SQL for deterministic operations.

Use AI when interpreting language, generating questions,
evaluating reasoning, or producing explanations.

Do not use AI for simple counting or arithmetic.

All model-generated structured data must be validated.

## 11. Minimum Viable Product

The first working prototype must demonstrate:

1. A teacher-approved assignment using one preloaded reading.
2. A student answering a grounded retrieval question.
3. An AI evaluation of the answer.
4. A relevant diagnostic follow-up for a possible misconception.
5. Corrective feedback based on the assigned material.
6. A fresh retest.
7. Saved learning evidence.
8. A teacher dashboard using synthetic class histories.
9. An observable dashboard update from the live interaction.

This end-to-end workflow is more important than feature breadth.

## 12. Out of Scope

Do not build these unless explicitly approved:

- Full LMS functionality.
- Canvas or Blackboard integration.
- Gradebook management.
- Automatic grading.
- Parent accounts.
- Mobile application.
- Teacher-to-student messaging.
- Production-scale document ingestion.
- Custom AI model training.
- Advanced knowledge tracing.
- Autonomous teacher interventions.
- Real student classroom trials.
- Elaborate multi-agent orchestration.

## 13. Testing Priorities

Focus on realistic failure risks.

Critical areas:

- Valid and invalid AI responses.
- Correct tutoring state transitions.
- Accurate database records.
- Source reference validation.
- Teacher/student authorization.
- Correct class-level aggregation.
- Complete end-to-end demo.

Use a small set of known student answers to evaluate
the actual model's educational decisions.

Do not confuse passing software tests with proof that
the AI makes educationally correct judgments.

## 14. Development Priorities

Deadline: October 25, 2026.

Priority order:

1. Application foundation.
2. Versioned demo content.
3. Data model and evidence contract.
4. Working student response evaluation.
5. Diagnostic follow-up and corrective feedback.
6. Teacher dashboard and synthetic data.
7. Integration testing and deployment.
8. Presentation and backup demonstration.

When short on time, reduce scope instead of introducing
more complexity.

## 15. Definition of Done

The core demonstration is complete when:

- A student can answer a question.
- The tutor can evaluate the answer against approved material.
- A suspected misconception can trigger a diagnostic follow-up.
- The tutor can provide corrective feedback and retest.
- Results are saved correctly.
- Teacher insights are calculated from stored records.
- A live interaction changes a relevant teacher-facing result.
- The flow works reliably in the deployed application.

A polished UI is valuable, but a working and trustworthy
end-to-end system comes first.

## 16. Open Decisions

These remain open until the team explicitly resolves them:

- Final project name.
- Exact textbook excerpt and license handling.
- Final schema and API contracts.
- Model selection.
- Instructor-support alert thresholds.
- Detailed dashboard metric definitions.
- Authentication versus restricted fictional demo accounts.
- Optional features beyond the core demo.

Do not treat open decisions as established requirements.

## 17. Project Principle

Build the smallest reliable application that demonstrates:

Assigned material
→ Research-backed studying
→ Diagnostic AI tutoring
→ Structured learning evidence
→ Teacher insights

The goal is a clear, convincing hackathon prototype with
a codebase that can be extended afterward.
