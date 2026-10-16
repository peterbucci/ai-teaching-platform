# AI Teaching Platform

_Working name: Learning Pulse_

We're building an AI tutoring and teacher-insights platform for the **PEAAII AI Applications Hackathon at UMass Boston**.

The idea is to go beyond marking answers right or wrong. We want an AI tutor that helps students think through assigned material, asks follow-up questions when their reasoning is unclear, and gives teachers a better picture of where their class is struggling.

**Our guiding principle: AI detects learning signals. Humans understand students.**

## How the idea works

A teacher assigns a reading. Students work through questions with an AI tutor that uses that reading to evaluate their answers and explain mistakes.

If a response suggests a misunderstanding, the tutor doesn't immediately label the student. It can ask another question to investigate the reasoning, provide feedback, and then use a fresh question to see whether the explanation helped.

The application records that process so a teacher can look for patterns across the class, rather than relying only on quiz scores.

We're also working toward **different ways to learn**, not just a text conversation. For example, the AI could generate a structured interactive diagram or experiment when a student needs to see how something works. A student could make a prediction, explore the diagram, and explain the result. Their reasoning would help determine what the tutor does next.

The broader plan includes teacher-approved review activities, teaching a concept back to the AI, creating lessons from teacher-provided material, recognizing new patterns in student reasoning, and optional voice interaction.

## What we're building for the hackathon

**The minimum version (MVP)** is a small, dependable demonstration:

- **One teacher and one fictional class** of roughly 20–30 students.
- **One assigned reading:** Section 1.5.1, _Bandwidth and Latency_, from _Computer Networks: A Systems Approach_ by Larry Peterson and Bruce Davie.
- **Five concepts:** bandwidth versus throughput, latency versus round-trip time, transmission delay, propagation delay, and queuing delay.
- **Fifteen prepared questions** and one complete example of an adaptive tutoring conversation.
- **A teacher dashboard** showing evidence from fictional student histories, including an update from a live tutoring interaction.

Our main example focuses on a student confusing transmission delay with propagation delay. We want to show the AI investigating that possible misunderstanding, explaining the distinction using the assigned reading, and testing the student again.

**The reach goals** extend this experience. We're actively planning and developing six phases in priority order:

1. [Interactive visual tutoring](https://github.com/peterbucci/ai-teaching-platform/issues/17) — generate interactive diagrams and experiments based on what a student needs.
2. [Teacher action center](https://github.com/peterbucci/ai-teaching-platform/issues/18) — turn evidence into teacher-reviewed activities.
3. [Teach-the-AI](https://github.com/peterbucci/ai-teaching-platform/issues/19) — students explain a concept to a fictional learner.
4. [Teacher-provided lessons](https://github.com/peterbucci/ai-teaching-platform/issues/20) — use approved teacher material to create and assign practice.
5. [New reasoning patterns](https://github.com/peterbucci/ai-teaching-platform/issues/21) — propose possible patterns not already in our prepared categories.
6. [Voice interaction](https://github.com/peterbucci/ai-teaching-platform/issues/22) — optionally speak answers or hear feedback.

These are **planned features, not claims of completion**. We can work on them in parallel, but the MVP must still work without them. The [full roadmap](https://github.com/peterbucci/ai-teaching-platform/issues/15) explains the priorities and individual tasks.

All student records in the hackathon demonstration must be **fictional and clearly identified as synthetic**. We're not conducting a classroom study or claiming that the AI's educational decisions have already been validated.

The hackathon submission deadline is **October 25, 2026**, with the finalist symposium on **October 29**.

## Where the project stands

_As checked on October 16, 2026:_

- The **Next.js, React, and TypeScript application foundation** is on `main`.
- The **prepared networking content** was merged in [PR #11](https://github.com/peterbucci/ai-teaching-platform/pull/11).
- **Docker, PostgreSQL, Better Auth, and the evidence-storage foundation** were merged in [PR #13](https://github.com/peterbucci/ai-teaching-platform/pull/13). These support fictional logins and persistent learning records.
- The grounded AI answer evaluator is in [draft PR #14](https://github.com/peterbucci/ai-teaching-platform/pull/14). Its report still identifies an OpenAI HTTP 429/API-access blocker for successful real-model verification.
- The working student tutoring experience, teacher dashboard, and reach features are **not yet established as complete**. Check the [issue board](https://github.com/users/peterbucci/projects/7) and pull requests for current progress.

The prepared content was approved for hackathon use on October 14, 2026 at 7:30 PM ET. That was **team approval**, not classroom-instructor review or scientific validation. We must continue to follow the textbook license, attribution requirements, and separately credited third-party material restrictions. See [Source Attribution](content/network-performance-v1/ATTRIBUTION.md).

## Where to start

You don't need to read every file to get involved.

| Resource                                                                            | What you'll find                                                |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **[Start Here](docs/START_HERE.md)**                                                | The fastest way to connect an AI coding assistant and get ready |
| [Getting Started](docs/GETTING_STARTED.md)                                          | A more detailed guide to local setup                            |
| [Codex setup](docs/CODEX_SETUP.md) / [Claude Code setup](docs/CLAUDE_CODE_SETUP.md) | Setup for your preferred coding tool                            |
| [First Task](docs/FIRST_TASK.md)                                                    | Your first issue, branch, tests, and pull request               |
| [Team Development Guide](CONTRIBUTING.md)                                           | How we work together, no matter which AI tool we use            |
| [Project board](https://github.com/users/peterbucci/projects/7)                     | Current tasks, priorities, and who is working on what           |
| [Roadmap](https://github.com/peterbucci/ai-teaching-platform/issues/15)             | MVP and all six reach-goal phases                               |
| [Demo content overview](content/README.md)                                          | The reading, questions, and decisions the team needs to review  |
| [Content package guide](content/network-performance-v1/README.md)                   | How the prepared lesson and tutoring examples fit together      |
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)                                            | The product vision, agreed scope, and architecture              |
| [AGENTS.md](AGENTS.md)                                                              | Shared instructions for AI coding assistants and contributors   |

**You don't need to be a developer to contribute.** Feedback on whether questions are understandable, tutoring feels helpful, or teacher insights make sense is just as valuable as code review.

## Run the project locally

You'll need **Docker with Docker Compose** to run the application and database together on your computer. You do not need Supabase.

```sh
git clone https://github.com/peterbucci/ai-teaching-platform.git
cd ai-teaching-platform
# Copy .env.example to .env, using the command appropriate for your computer.
# Fill in the required local secrets and fictional demo accounts.
docker compose up --build
```

In a second terminal, after the app starts:

```sh
docker compose exec app npm run db:seed
```

Then open [http://localhost:3000/login](http://localhost:3000/login) and sign in with a fictional account from your local `.env`.

For exact Windows/Mac commands and help with passwords, use [Getting Started](docs/GETTING_STARTED.md) or [Database Setup](database/README.md). **Never commit `.env` or share credentials.** The OpenAI application API key is not required for the basic Docker/login setup, but live AI evaluation needs separate configuration and access.

If you're using a cloud coding assistant or working on a task that doesn't require a live database, ask your teammate or coding assistant which local steps you actually need.

## Checks for developers

Before opening a pull request, run the checks relevant to your change:

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run content:check
```

These are example project checks, not a requirement to run every command for every documentation change. [GitHub Actions](https://github.com/peterbucci/ai-teaching-platform/actions) runs the shared checks on pull requests.

`npm run content:check` requires Python 3 available as `python`, and doesn't rewrite the prepared source. You do **not** need Python just to start the Docker-based app.

`npm run format` applies formatting where permitted. The educational source package is excluded from automatic formatting so its reference files stay stable.

## Working together

We use the [GitHub Project board](https://github.com/users/peterbucci/projects/7) to track tasks, and pull requests to review changes.

1. Choose an issue and check that nobody else is working on it.
2. Start a separate feature or fix branch from the latest `main`.
3. Ask your AI coding assistant to help in small steps, and test what it actually builds.
4. Open a pull request linking the issue and explaining any unfinished work.
5. Get a teammate's review and passing required checks before merging.

Don't force-push shared branches, overwrite someone's work, commit passwords, or use real student information in the demo. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full plain-language workflow.

### Maintainer notes

This repository is public. Anyone can view or clone it, but contributing changes to this repository and editing the Project board require the appropriate permissions. Maintainers should confirm the intended branch protections and required checks before approving merges. Follow the review process even if a permission setting allows a shortcut.

A previous dependency audit identified an upstream `braces` advisory in development lint tooling. Revisit compatible updates when appropriate rather than downgrading the lint configuration just to clear an advisory.

## What success looks like

**MVP:** A student answers a question → the AI investigates their reasoning → feedback is grounded in the assigned reading → the student tries a fresh question → the teacher sees the learning evidence.

**Our bigger goal:** Build as many verified, integrated reach features as we can before the deadline—especially interactive visual tutoring—without weakening that core experience.
