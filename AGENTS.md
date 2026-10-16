# Development Instructions — PEAAII AI Teaching Platform

## Project context

- Read `PROJECT_CONTEXT.md` before major product or architecture decisions.
- Check the [current GitHub roadmap](https://github.com/peterbucci/ai-teaching-platform/issues/15) for the latest development phases, issues, and dependencies. The roadmap is more current than older statements about optional features.
- Inspect the repository, open pull requests, and relevant issues before changing it. Planned features are not necessarily implemented.
- This is a time-limited, shared hackathon project. **The minimum viable product (MVP) must work independently**, while selected reach goals can be developed in parallel.
- If documentation conflicts with working code or a newer team decision, flag the difference rather than silently rewriting either.

## Engineering principles

- Prefer clear, straightforward, maintainable solutions over clever abstractions.
- Solve the current requirement; do not build generalized systems for hypothetical needs.
- Follow established conventions and keep changes focused on the active task.
- Avoid unrelated refactors, duplication, excessive configuration, and unnecessary dependencies.
- Keep responsibilities separate, but do not split trivial logic across dozens of files.
- Use strict TypeScript. Avoid `any`, unchecked casts, and suppressed errors without justification.
- Validate external inputs and model-generated data with Zod at appropriate boundaries.
- Handle expected errors explicitly and communicate useful failures to users.

## Application boundaries

- Use the existing Next.js / TypeScript / Docker / PostgreSQL / Better Auth stack unless the team agrees to a change.
- React components handle presentation and interaction, not tutoring decisions or direct database access.
- Keep tutoring state transitions and business rules separate from OpenAI API calls.
- Isolate database access, enforce authorization server-side, and do arithmetic with code/SQL rather than an LLM.
- Treat LLM output as untrusted: validate actions, misconception IDs, cited passage IDs, and generated activity specifications.
- Preserve uncertainty. A wrong answer alone must not establish a definite misconception.
- Generated diagrams should use validated structured descriptions and reviewed application components. **Do not execute arbitrary AI-generated code, formulas, HTML, or SVG in the student's browser.**
- Keep course materials versioned and attribute third-party content according to its license.
- Do not introduce an agent framework, vector database, separate backend, or additional service without a concrete need.
- A missing or failed reach feature must not prevent students from completing the core text-based tutoring experience.

## Security and data

- Never commit secrets, `.env`, `.env.local`, API keys, or real student information.
- Use fictional students and synthetic histories for the hackathon demonstration.
- Keep private credentials server-side and validate user permissions for every protected operation.
- Do not log sensitive information or assume that a demo is production-compliant.

## GitHub and team collaboration

- Track substantive work in GitHub Issues and on the linked [GitHub Project board](https://github.com/users/peterbucci/projects/7).
- Check existing issues before proposing or creating new ones; avoid duplicates.
- Keep each issue focused, with a short description and observable acceptance criteria.
- Use the issue's scope and dependencies; coordinate before changing shared contracts.
- Teammates may use **Codex, Claude Code, or another coding assistant**. Everyone follows the same issue, branch, review, and testing process.
- Work on feature/fix branches (for example, `feature/12-tutor-evaluation`), not directly on `main`.
- Open focused pull requests referencing the relevant issue. Use `Closes #N` only when the issue is fully addressed.
- Review the diff and run relevant checks before requesting a merge. Get independent teammate review for shared contracts and sensitive data.
- Do not force-push shared branches, discard uncommitted changes, or rewrite another teammate's work.
- Only create, close, reassign, or otherwise modify GitHub issues/projects when authorized by the task.
- Never invent teammate GitHub handles or assign issues to people who have not been identified.

For the human-friendly steps, see [Start Here](docs/START_HERE.md), [Team Development Guide](CONTRIBUTING.md), and [First Task](docs/FIRST_TASK.md).

## Lean testing philosophy

- Test meaningful behavior and realistic failures, not trivial implementation details.
- Prioritize tutoring transitions, AI output validation, evidence persistence, authorization, class metrics, and the actions of any implemented reach features.
- Keep a small curated set of actual-model evaluation cases separate from deterministic software tests.
- Avoid repetitive tests, broad snapshots, elaborate mocking, arbitrary coverage targets, and unnecessary test frameworks.
- Do not add a test unless it catches a realistic, consequential failure not already covered.
- For a significant bug, add a focused regression test when it is useful.
- Run only relevant checks for the change; run a broader check/build before integration or submission.
- Never claim a check passed unless it was actually run; never weaken tests merely to make them pass.
- A fixture-driven feature may be ready for integration, but a **reach epic is not complete** until its actual end-to-end behavior has been checked.

## Protected project documentation

The following documents are intentionally maintained for human readers, including teammates without technical backgrounds:

- `README.md`
- `PROJECT_CONTEXT.md`
- `content/README.md`
- `content/network-performance-v1/README.md`
- `content/network-performance-v1/DEMO_GUIDE.md`
- `content/network-performance-v1/REVIEW_GUIDE.md`

These files have been reviewed for clarity, tone, and accessibility. Preserve their writing style, organization, and level of detail.

### Rules

- Do not modify these files unless the user explicitly authorizes changes.
- Do not automatically update documentation as part of feature development, bug fixes, refactoring, or cleanup.
- Generic instructions such as "update documentation as needed" do not authorize changes to protected files.
- Do not reformat, restructure, expand, or regenerate these documents without permission.
- If a code change makes documentation outdated, report what needs updating instead of editing it automatically.
- When changes are explicitly requested, make only the necessary edits. Preserve the existing voice and avoid unnecessary technical jargon or additional sections.
- Do not run documentation generators that overwrite protected files without explicit authorization.
- Keep structured JSON data and human-readable guides separate. Changes to machine-readable content do not automatically authorize rewriting the guides.

Documentation changes should be intentional, focused, and reviewed separately from unrelated code changes.

## Working style

- For nontrivial tasks, briefly state the approach and identify important tradeoffs before editing.
- For small, clear tasks, implement directly; avoid a long planning ritual.
- Make the smallest complete change, inspect the resulting diff, and avoid opportunistic expansion.
- Ask for clarification only on choices that block safe progress, such as GitHub owner, repository visibility, or missing authorization.
- At completion, briefly report what changed, what was verified, and any remaining blockers.

## Definition of success

**Core MVP:** A student completes a grounded retrieval question, receives appropriate diagnostic follow-up and feedback, completes a fresh retest, and the saved evidence updates a teacher insight.

**Reach goals:** The team is also working toward generated visual tutoring, teacher-approved activities, Teach-the-AI, teacher-provided lessons, new reasoning-pattern discovery, and optional voice. See the [roadmap](https://github.com/peterbucci/ai-teaching-platform/issues/15) for their acceptance criteria. None is required to declare the independent MVP complete.
