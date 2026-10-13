# Development Instructions — PEAAII AI Teaching Platform

## Project context

- Read `PROJECT_CONTEXT.md` before major product or architecture decisions.
- Inspect the repository before changing it. Planned features are not necessarily implemented.
- This is a time-limited, shared hackathon project. Prioritize a dependable MVP over speculative features.
- If project documentation conflicts with working code or a newer team decision, flag the difference rather than silently rewriting either.

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

- Use the existing Next.js / TypeScript stack unless a change is agreed upon.
- React components handle presentation and interaction, not tutoring decisions or direct database access.
- Keep tutoring state transitions and business rules separate from OpenAI API calls.
- Isolate database access, enforce authorization server-side, and do arithmetic with code/SQL rather than an LLM.
- Treat LLM output as untrusted: validate actions, misconception IDs, and cited passage IDs.
- Preserve uncertainty. A wrong answer alone must not establish a definite misconception.
- Keep course materials versioned and attribute third-party content according to its license.
- Do not introduce an agent framework, vector database, separate backend, or additional service without a concrete need.

## Security and data

- Never commit secrets, `.env.local`, API keys, or real student information.
- Use fictional students and synthetic histories for the hackathon demonstration.
- Keep private credentials server-side and validate user permissions for every protected operation.
- Do not log sensitive information or assume that a demo is production-compliant.

## GitHub and team collaboration

- Track substantive work in GitHub Issues and on the linked GitHub Project board.
- Check existing issues before proposing or creating new ones; avoid duplicates.
- Keep each issue focused, with a short description and observable acceptance criteria.
- Use the issue's scope and dependencies; coordinate before changing shared contracts.
- Work on feature/fix branches (for example, `feature/12-tutor-evaluation`), not directly on `main`.
- Open focused pull requests referencing the relevant issue. Use `Closes #N` only when the issue is fully addressed.
- Review the diff and run relevant checks before requesting a merge. Prefer teammate review for changes affecting shared contracts or sensitive data.
- Do not force-push shared branches, discard uncommitted changes, or rewrite another teammate's work.
- Only create, close, reassign, or otherwise modify GitHub issues/projects when authorized by the task; initial repository setup may explicitly authorize those actions.
- Never invent teammate GitHub handles or assign issues to people who have not been identified.

## Lean testing philosophy

- Test meaningful behavior and realistic failures, not trivial implementation details.
- Prioritize tutoring transitions, AI output validation, evidence persistence, authorization, and class metrics.
- Keep a small curated set of actual-model evaluation cases separate from deterministic software tests.
- Avoid repetitive tests, broad snapshots, elaborate mocking, arbitrary coverage targets, and unnecessary test frameworks.
- Do not add a test unless it catches a realistic, consequential failure not already covered.
- For a significant bug, add a focused regression test when it is useful.
- Run only relevant checks for the change; run a broader check/build before integration or submission.
- Never claim a check passed unless it was actually run; never weaken tests merely to make them pass.

## Working style

- For nontrivial tasks, briefly state the approach and identify important tradeoffs before editing.
- For small, clear tasks, implement directly; avoid a long planning ritual.
- Make the smallest complete change, inspect the resulting diff, and avoid opportunistic expansion.
- Ask for clarification only on choices that block safe progress, such as GitHub owner, repository visibility, or missing authorization.
- At completion, briefly report what changed, what was verified, and any remaining blockers.

## Definition of success

A student completes a grounded retrieval question, receives appropriate diagnostic follow-up and feedback, and the saved evidence updates a teacher insight. Build this end-to-end path before adding breadth.
