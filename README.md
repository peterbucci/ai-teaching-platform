# Learning Pulse

**An agentic AI teaching and learning platform**  
_A little insight. A better next step._

Learning Pulse helps teachers turn their own course material into guided learning, helps students reason through difficult concepts with an adaptive AI tutor, and helps teachers decide what to do next using inspectable learning evidence.

We're building it for the **PEAAII AI Applications Hackathon at UMass Boston**, whose 2026 theme is **Agentic AI**. The project submission deadline is **October 25, 2026**; the finalist symposium is **October 29, 2026**. Check the official event and Canvas instructions for submission details and judging criteria not reproduced here.

> **Our principle: AI supports student reasoning; teachers remain in control.**

**This README describes our revised product direction as of October 22, 2026—not a claim that every capability is already implemented.** For implementation status, see the [GitHub project](https://github.com/users/peterbucci/projects/7), [roadmap](https://github.com/peterbucci/ai-teaching-platform/issues/15), and [pull requests](https://github.com/peterbucci/ai-teaching-platform/pulls). Some existing roadmap issues still use the older definition of the MVP and need to be brought into line with [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## What we're building

Learning Pulse connects three experiences that share the same approved sources, lesson versions, and learning evidence.

### 1. Teachers create lessons with AI

A teacher provides permitted course material—a reading, notes, slide text, or other supported source—and reviews the extracted content. The teacher can then:

- **Enter learning concepts** or ask AI to suggest concepts and objectives, with links to supporting passages.
- **Generate a question bank** with different forms of questions, private answer criteria, likely reasoning errors to investigate, and fresh retests.
- **Edit, add, remove, and approve** concepts, questions, teacher notes, and permitted tutoring activities.
- **Work with a context-aware AI copilot**: for example, “Make these questions more conceptual and focus on transmission versus propagation delay.” The copilot proposes changes to the actual draft form for the teacher to review—not just text to copy and paste.
- **Publish a reviewed lesson version** and assign it to an authorized class. Later edits create new versions without altering earlier student work.

We will support a bounded set of formats first: pasted text, UTF-8 `.txt`/`.md`, and text-based PDFs. Slide documents and more complex or image-heavy sources are planned extensions and require reviewed extraction before use. Uploading a file alone does not mean the system correctly understood every figure or formula.

### 2. Students learn in one adaptive conversation

Students can read the assigned material, open an assignment, and chat naturally with their AI tutor. There is **one conversation input**, not separate “Ask” and “Answer” forms.

A student might ask, “What do you mean by packet size?” The tutor responds with a source-grounded explanation **without grading the question**. Later, the student explains their reasoning. The application uses validated AI intent recognition to route a clearly intended answer into the existing evaluation workflow; genuinely ambiguous messages require clarification first.

The **agentic** part goes beyond generating text. Based on the student's reasoning, the AI can **propose** a useful instructional action, such as retrieving an approved passage, generating a diagnostic question, explaining an idea another way, or choosing a supported visual experiment. The server validates the proposal, executes only permitted actions, records what actually happened, and uses the next student response to adapt again.

The tutor can also suggest **optional follow-up practice**, clearly distinguished from assignments formally approved by a teacher. A correct answer immediately after a hint is recorded differently from an independent answer or evidence from a later review.

### 3. Teachers investigate learning evidence and take action

Learning Pulse saves original student responses, question and source versions, validated evaluations, and the assistance actually shown. Teachers can inspect the evidence behind a possible learning pattern instead of seeing only a right/wrong score.

The teacher workspace is intended to support:

- **Class and concept insights**, including independent versus assisted responses, participation, and uncertainty.
- **Possible recurring reasoning patterns**, with supporting and contradictory examples and teacher review.
- **Student support suggestions** based on observed work, not claims about ability, effort, or motivation.
- **AI-drafted follow-up activities** that teachers can edit, approve, assign, and later compare with subsequent evidence.
- **A page-aware teacher copilot** that can answer authorized evidence questions and propose reviewable changes to drafts.

The AI must not silently assign work, change official grades, message students, or publish teacher materials.

## An example end-to-end journey

1. A fictional professor uploads a short networking reading and checks its extracted passages.
2. AI suggests objectives and questions. The teacher asks the copilot to focus on a particular distinction, reviews the proposed edits, and approves an assignment.
3. A student asks a clarification question in the same conversation used to answer the assignment. Asking for help does not count as an assessed response.
4. The student gives an explanation that suggests a specific misunderstanding. The AI proposes a targeted next action; the server checks it before execution.
5. The tutor may choose a validated interactive packet-delay experiment. The student predicts, changes a value, and explains the result; that explanation influences the next question.
6. The student receives a grounded optional-practice recommendation. Meanwhile, the teacher sees linked evidence and reviews an AI-drafted follow-up activity before assigning it.

**This is our intended integrated demonstration, not a claim that the full journey works in the application today.** A useful agentic demonstration must show a **real AI decision and permitted tool use followed by another observation**, not simply a predefined sequence with generated wording.

## Hackathon priorities

| Capability                                                                                                                                                       | Team priority         | What success looks like                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [**R4 — Teacher-provided lessons**](https://github.com/peterbucci/ai-teaching-platform/issues/20)                                                                | **P0: critical path** | Import a permitted source; review AI concepts and questions; publish a versioned lesson.                                       |
| [**R7 — Adaptive, agentic tutoring**](https://github.com/peterbucci/ai-teaching-platform/issues/71)                                                              | **P0: critical path** | One conversation; real AI intent recognition, grounded generation, bounded instructional/tool choice and saved evidence.       |
| [**R1 — Interactive visual tutoring**](https://github.com/peterbucci/ai-teaching-platform/issues/17)                                                             | **P1: showcase goal** | AI selects a validated visual tool; student prediction and explanation affect the next decision.                               |
| [**R2 — Teacher action center**](https://github.com/peterbucci/ai-teaching-platform/issues/18)                                                                   | **P1: showcase goal** | AI drafts an evidence-backed activity; teacher edits, approves and assigns it; follow-up evidence is linked.                   |
| [**R5 — Reasoning-pattern discovery**](https://github.com/peterbucci/ai-teaching-platform/issues/21)                                                             | **P1: focused slice** | Tentative, inspectable new-pattern proposal with teacher review.                                                               |
| **Teacher Copilot**                                                                                                                                              | **P1: focused slice** | Proposes structured edits to an active teacher draft and can retrieve authorized evidence. New epic/story planning is pending. |
| [R3 — Teach-the-AI](https://github.com/peterbucci/ai-teaching-platform/issues/19) and [R6 — Voice](https://github.com/peterbucci/ai-teaching-platform/issues/22) | **P2: later**         | Additional learning modes that reuse the same evidence and tutoring system.                                                    |

These are **team priorities**, not a claim that the official hackathon rubric requires each named reach goal. With the deadline approaching, we'll favor small, genuinely integrated demonstrations over a long list of disconnected interfaces.

### What stays from the original foundation?

We are **not starting over**. Our existing curated networking lesson, authenticated student and teacher flows, grounded evaluator, deterministic tutoring controller, and PostgreSQL learning evidence are valuable foundations.

The earlier fixed-question learning loop remains a **regression test and safe fallback**. It is **not enough on its own** to demonstrate the newly agreed agentic product goal. When a model, visual tool, or other extension fails, students must still be able to preserve their answers and continue with an approved text-based path.

## Current implementation snapshot

_Checked against the repository and open PRs on October 22, 2026. Follow the linked issues/PRs for changes after that date._

**Already established in `main`:**

- Next.js, React, TypeScript, Tailwind CSS, Docker Compose, PostgreSQL, and Better Auth.
- The versioned networking content package, basic teacher/student authorization, durable evidence records, grounded AI evaluator, and deterministic tutor/recovery mechanisms.
- Student learning/assignment views, teacher evidence, class metrics, and initial reasoning-pattern views. These do not by themselves establish agentic tool choice or lesson import.
- R7 dialogue **contracts and synthetic examples** from [PR #77](https://github.com/peterbucci/ai-teaching-platform/pull/77), not a live generation service.

**In progress or planned:**

- [PR #81](https://github.com/peterbucci/ai-teaching-platform/pull/81): **draft**, single-composer student conversation and intent-routing contracts. It uses labeled fixtures; live model classification, grounded dialogue and durable message routing are not complete.
- [PR #82](https://github.com/peterbucci/ai-teaching-platform/pull/82): **draft**, separate teacher workspace pages.
- [R4 stories #49–#53](https://github.com/peterbucci/ai-teaching-platform/issues/20): teacher-owned source import, objective/question review, lesson version resolution and publication still require implementation and integration.
- R7 orchestration and generation, R1 interactive visual selection, R2 intervention delivery, R5 discovery and Teacher Copilot workflows must be verified as real integrated features before being described as complete.

The [old roadmap #15](https://github.com/peterbucci/ai-teaching-platform/issues/15) and [release epic #9](https://github.com/peterbucci/ai-teaching-platform/issues/9) still include older scope language as of this revision. Our agreed product direction is documented in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md); the GitHub planning records need a reviewed update, not silent retroactive completion claims.

## Architecture at a glance

| Area                     | Existing technology or design                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| App and UI               | Next.js / React / TypeScript / Tailwind CSS                                                                      |
| Identity and persistence | Better Auth, self-hosted PostgreSQL, Docker Compose                                                              |
| AI                       | OpenAI API and structured, validated model outputs                                                               |
| Application safeguards   | Zod schemas, server-owned authorization and tutoring state transitions                                           |
| Content and grounding    | Approved, versioned passages; assignment-scoped retrieval; planned private uploads and immutable lesson versions |
| New agentic coordination | **Planned bounded server-side orchestrator**, reusing existing evaluator, controller and data access             |
| Visuals                  | Planned validated activity specifications, reviewed React renderer, and code-calculated experiments              |

A separate agent framework, vector database, model-serving backend, or network of autonomous agents is **not a prerequisite**. Read [Agentic Architecture](docs/AGENTIC_ARCHITECTURE.md) for the detailed proposed design, responsibilities, data flows, limits, and integration checks.

## Demo content and attribution

The curated regression example uses _Computer Networks: A Systems Approach_ by Larry Peterson and Bruce Davie, Section 1.5.1, **Bandwidth and Latency**. It covers five concepts: bandwidth/throughput, latency/RTT, transmission delay, propagation delay, and queuing delay.

The prepared [`content/network-performance-v1/`](content/network-performance-v1/) package has **13 approved passages and 15 questions**, including the `NP-TX-01` transmission/propagation example. Team content approval on **October 14, 2026** was for hackathon use; it was **not** approval by a classroom teacher or proof of educational effectiveness.

Respect the source's **CC BY 4.0** conditions, its attribution requirements, and separately credited third-party materials. See [Attribution](content/network-performance-v1/ATTRIBUTION.md). Teacher-uploaded material needs its own permissions and provenance; don't assume all textbook scans or slides may be redistributed.

The demo uses **fictional student accounts and synthetic histories only**. No real student records should be committed, uploaded to public services, or used as test fixtures. The project is not a validated educational intervention or a production-compliant student-record system.

## Get started

You do not need to be a developer to contribute: testing clarity of questions, discussing teacher workflows, and reviewing whether an AI explanation would help a student are useful contributions too.

**Getting the local demo running** requires Docker and Docker Compose. You do not need Supabase.

```sh
git clone https://github.com/peterbucci/ai-teaching-platform.git
cd ai-teaching-platform
# Copy .env.example to .env using the command appropriate to your computer.
# Fill in local secrets and the required fictional demo accounts.
docker compose up --build
```

In another terminal, once the application is running:

```sh
docker compose exec app npm run db:seed
```

Open [http://localhost:3000/login](http://localhost:3000/login) and use a fictional account configured locally. For Windows/Mac instructions, credentials setup, and troubleshooting, see [Getting Started](docs/GETTING_STARTED.md) and [Database Setup](database/README.md). **Never commit `.env`, `.env.local`, API keys, or account passwords.** Basic startup is distinct from configured, paid AI model calls.

### Common developer checks

Run the relevant checks for the work you changed; run a broader build and integration pass before demo/release.

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run format:check
npm run content:check
npm run build
```

The content checker uses Python 3. Database-backed checks (`assignments:check`, `reading:check`, `metrics:check`, `patterns:check`, `tutor:check`) and live model checks (`eval:live`) require their appropriate local services and configuration. **Passing deterministic or fixture tests does not prove an agentic feature works with a real model.**

## Team workflow and documentation

We work in focused issues and feature branches, with review before merging into `main`. Check existing PRs and dependencies before changing shared contracts or database migrations. Keep each PR's verified behavior, unrun cases, and remaining integration explicit. Do not overwrite another teammate's work or close an epic on the strength of a mockup.

| Resource                                                                         | Use it for                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [Project board](https://github.com/users/peterbucci/projects/7)                  | Live assignments, ownership, blockers and progress                                    |
| [Roadmap / issues](https://github.com/peterbucci/ai-teaching-platform/issues/15) | Tracked capabilities, stories and acceptance criteria; being reconciled to this reset |
| [Product context](PROJECT_CONTEXT.md)                                            | Revised vision, intended experiences, priorities and demonstration goals              |
| [Agentic architecture](docs/AGENTIC_ARCHITECTURE.md)                             | Proposed orchestrator, tool permissions, data ownership and evidence flows            |
| [AGENTS.md](AGENTS.md)                                                           | Engineering and coding-assistant rules                                                |
| [Start Here](docs/START_HERE.md) · [First Task](docs/FIRST_TASK.md)              | Quick onboarding and an initial contribution                                          |
| [Getting Started](docs/GETTING_STARTED.md) · [CONTRIBUTING](CONTRIBUTING.md)     | Local setup and team collaboration                                                    |
| [Codex](docs/CODEX_SETUP.md) · [Claude Code](docs/CLAUDE_CODE_SETUP.md)          | Setup for an AI coding assistant                                                      |
| [Content overview](content/README.md)                                            | Approved curated demo material and review guidance                                    |

`README.md` and `PROJECT_CONTEXT.md` are protected, deliberately reviewed human-facing files. Changes to them should be explicitly requested and made in a separate, focused documentation PR; routine coding tasks must not regenerate them automatically. See [AGENTS.md](AGENTS.md).

## What success looks like

**Reliable fallback:** A student can answer a grounded prepared question; the evaluator produces a validated result; the existing controller applies an allowed follow-up; original work and teacher evidence remain intact.

**Revised agentic demonstration:** A teacher can approve content; a student uses one conversation; a **real model** identifies the need for help or assessment, **proposes an instructional action**, the **server validates and executes a permitted tool**, a subsequent student response affects the next action, and an authorized teacher can inspect the saved evidence and review a proposed next step. The team's further goals are a working R1 visual action and an R2 teacher-approved intervention, with honest reporting of anything unfinished.

**Build ambitiously, verify honestly, and keep teachers and students in control.**
