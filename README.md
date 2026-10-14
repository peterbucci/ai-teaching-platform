# AI Teaching Platform

_Working name: Learning Pulse_

We're building an AI tutoring and teacher-insights platform for the **PEAAII AI Applications Hackathon at UMass Boston**.

The idea is to go beyond marking answers right or wrong. We want an AI tutor that helps students think through assigned material, asks follow-up questions when their reasoning is unclear, and gives teachers a better picture of where their class is struggling.

**Our guiding principle: AI detects learning signals. Humans understand students.**

## How the idea works

A teacher assigns a reading. Students work through questions with an AI tutor that uses that reading to evaluate their answers and explain mistakes.

If a response suggests a misunderstanding, the tutor doesn't immediately label the student. It can ask another question to investigate the reasoning, provide feedback, and then use a fresh question to see whether the explanation helped.

The application records that process so a teacher can look for patterns across the class, rather than relying only on quiz scores.

In a finished product, we want teachers to be able to upload course material, review AI-suggested learning objectives, and let the system generate and adapt practice questions. **The questions and misconception examples for our hackathon demo are prepared in advance so we can test the AI's decisions—not because we expect teachers to create all of that content themselves.**

## What we're building for the hackathon

We're keeping the first demonstration small:

- **One teacher and one fictional class** of roughly 20–30 students.
- **One assigned reading:** Section 1.5.1, _Bandwidth and Latency_, from _Computer Networks: A Systems Approach_ by Larry Peterson and Bruce Davie.
- **Five concepts:** bandwidth versus throughput, latency versus round-trip time, transmission delay, propagation delay, and queuing delay.
- **Fifteen prepared questions** and one complete example of an adaptive tutoring conversation.
- **A teacher dashboard** showing evidence from fictional student histories, including an update from a live tutoring interaction.

Our main example focuses on a student confusing transmission delay with propagation delay. We want to show the AI investigating that possible misunderstanding, explaining the distinction using the assigned reading, and testing the student again.

All student records in the hackathon demonstration must be **fictional and clearly identified as synthetic**. We're not conducting a classroom study or claiming that the AI's educational decisions have already been validated.

The hackathon submission deadline is **October 25, 2026**, with the finalist symposium on **October 29**.

## Where the project stands

This repository currently contains a basic **Next.js, React, and TypeScript application shell**. The tutoring experience, database integration, and teacher dashboard are still planned work—not working features yet.

We've also prepared a versioned networking content package with the reading, questions, expected answers, and example tutoring paths. It's included on the [`feature/2-demo-content` branch](https://github.com/peterbucci/ai-teaching-platform/tree/feature/2-demo-content) in [draft pull request #11](https://github.com/peterbucci/ai-teaching-platform/pull/11), but it has **not yet been merged or connected to the application**.

The team still needs to approve the learning material, decide how much diagnostic coverage is necessary for the first demo, and review a discrepancy between the textbook repository's license and README. Because this repository is public, the prepared content branch is publicly visible, making the reuse question especially important to resolve.

## Where to start

You don't need to read every file to get involved.

| Resource                                                          | What you'll find                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| [Project board](https://github.com/users/peterbucci/projects/7)   | Current issues, priorities, and who's working on what          |
| [Demo content overview](content/README.md)                        | The reading, questions, and decisions the team needs to review |
| [Content package guide](content/network-performance-v1/README.md) | How the prepared lesson and tutoring examples fit together     |
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)                          | The product vision, hackathon scope, and planned architecture  |
| [AGENTS.md](AGENTS.md)                                            | Development guidelines for contributors and Codex              |

**You don't need to be a developer to contribute.** Feedback on whether the questions are understandable, the tutoring experience feels helpful, or the dashboard would be useful to a teacher is just as valuable as code review.

_Note: The content links above refer to files on the active content branch and won't be available on `main` until that pull request is merged._

## Run the project locally

You'll need **Node.js 22.13 or newer within the Node 22 release line** and npm. The `.nvmrc` file selects Node 22 if you use a compatible version manager. This repository is public, so anyone can clone it.

```sh
git clone https://github.com/peterbucci/ai-teaching-platform.git
cd ai-teaching-platform
npm ci
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

To work with the prepared networking content before it's merged, switch to its branch and install its dependencies:

```sh
git switch feature/2-demo-content
npm ci
```

The application shell runs without API keys. `.env.example` lists placeholders for future OpenAI and Supabase integrations. When those are needed, keep actual credentials in `.env.local` and **never commit secrets**.

## Checks for developers

Before opening a pull request, run the checks relevant to your changes:

```sh
npm run lint
npm run typecheck
npm run format:check
npm run build
```

On the content branch, also run:

```sh
npm run content:check
```

That content check needs Python 3 available as `python`. It uses the standard library and does not write or change any files. Python is **not** required to start the Next.js app.

`npm run format` applies formatting where permitted. The imported educational-content package is excluded from automatic formatting to preserve its source files. GitHub Actions also runs the quality checks on pull requests and pushes to `main`.

## Working together

We use the [GitHub Project board](https://github.com/users/peterbucci/projects/7) to track tasks and pull requests to review changes.

1. Choose an existing issue and coordinate with the team before changing shared requirements or data structures.
2. Create a feature or fix branch from the latest `main`. Keep changes focused on the issue.
3. Open a pull request explaining what changed, linking the issue, and noting which checks you ran.
4. Review the changes with a teammate when possible, and merge after the relevant checks pass. Only use `Closes #N` when the issue is fully complete.

Please don't force-push shared branches, overwrite someone else's work, or add real student information to the demo.

### Maintainer notes

This repository is public. Anyone can view, clone, or fork it and propose changes through pull requests. Direct write access and Project board editing require the appropriate permissions. Maintainers should confirm that `main` is protected with the intended pull request and CI requirements; regardless of the settings, follow the review-and-check process described above.

The initial dependency audit found no production vulnerabilities but flagged an upstream `braces` advisory in development lint tooling. Revisit compatible tooling updates when appropriate; don't apply an incompatible Next.js lint-configuration downgrade just to clear the audit warning.

## What success looks like

For the hackathon, we're aiming for one dependable end-to-end experience:

**A student answers → the AI investigates their reasoning → feedback is grounded in the reading → the student tries again → the teacher sees what happened.**

We'd rather demonstrate that clearly and reliably than rush to build an entire learning management system.
