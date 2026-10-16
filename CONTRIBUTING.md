# Learning Pulse — Team Development Guide

## New to the project?

- Start with [Start Here](docs/START_HERE.md) for the quickest setup.
- Use [Getting Started](docs/GETTING_STARTED.md) for more detailed instructions.
- Choose [Codex setup](docs/CODEX_SETUP.md) or [Claude Code setup](docs/CLAUDE_CODE_SETUP.md) for your preferred AI assistant.
- Follow [First Task](docs/FIRST_TASK.md) when you're ready to work on your first issue.

## How we'll work together

We're building an AI-powered teaching platform for our hackathon. Since we're using AI-assisted coding tools, everyone can contribute to developing features, regardless of their programming experience.

You can use whichever AI coding assistant you're most comfortable with. The tools might be different, but we'll all follow the same basic process to keep our work organized.

**Our workflow:**

Pick a task → Understand it → Build with AI → Test it → Submit for review → Merge into the project.

The goal is to work independently when possible while making sure everything fits together.

---

## 1. Choose a task

We'll use our [GitHub Project Board](https://github.com/users/peterbucci/projects/7) to organize our work.

Each task is called an **issue**. It explains what we're building, why it matters, and how we'll know when it's finished.

To get started:

1. Open the project board.
2. Find a task in your assigned workstream.
3. Choose an issue that's ready to be worked on.
4. Let the team know you're taking it.
5. Move it to **In Progress**.

Try to focus on one issue at a time.

## 2. Understand what you're building

Before making changes, read the issue and make sure you understand the goal.

You should be able to answer:

- What is this feature supposed to do?
- Why are we building it?
- What should the user experience?
- How will I know when it's working?

You don't need to understand all the technical details. If something is confusing, ask your AI assistant to explain it.

**Example prompt for any coding assistant:**

> I'm working on GitHub issue #XX for our Learning Pulse project. Please review the issue, the existing code, AGENTS.md, and PROJECT_CONTEXT.md. Explain in simple terms what we're building, how it fits into the application, and how you would implement it. Don't make any changes yet.

Review the proposed approach before allowing the AI to begin implementation.

## 3. Work in your own branch

We'll use GitHub to manage everyone's contributions.

The `main` branch contains our shared version of the application. To avoid interfering with each other's work, we'll develop features in separate branches.

Think of a branch as your own workspace. You can make changes without immediately affecting everyone else.

Before coding:

1. Make sure you're starting from the latest `main` branch.
2. Create a new branch for your issue.
3. Make your changes in that branch.
4. Keep unrelated changes out of it.

Your AI coding assistant may be able to handle these steps. If not, ask a teammate for help.

**Important:** Don't directly modify or push changes to `main`.

## 4. Build your feature using AI

You're welcome to use whichever AI coding tool works best for you.

Give your assistant the relevant GitHub issue and have it follow the requirements already written there.

We recommend building in smaller steps instead of asking the AI to make many unrelated changes at once.

While working:

- Ask the AI to explain significant changes.
- Check that it's following the issue's requirements.
- Avoid unnecessary changes to existing working features.
- Coordinate with the team before changing shared code or database structures.
- Keep track of any problems or unfinished work.

**Example prompt:**

> Please implement this issue following the repository's existing architecture and conventions. Work only on the relevant feature, reuse existing code where possible, and avoid unrelated changes. Run appropriate tests and explain what you changed. If something is unclear or requires a shared architectural change, ask before proceeding.

Some AI tools can directly edit files, run tests, and create pull requests. Others may require you to perform those actions yourself.

That's fine. **The workflow stays the same regardless of the tool.**

## 5. Test your work

Just because an AI assistant says something is finished doesn't necessarily mean it works.

Before submitting your changes:

1. Ask your AI assistant to run appropriate tests.
2. Try the feature yourself when possible.
3. Compare the result against the issue's acceptance criteria (the checklist describing what should work).
4. Check for obvious problems or unexpected behavior.
5. Make sure existing features still work.

If something goes wrong, explain the problem to your AI assistant and work through it.

Some features may depend on unfinished parts of the application. In those cases, it's okay to test with clearly labeled example data.

Just make sure the team knows what has been tested and what still needs to be connected.

**Don't report a test as passed unless it was actually run.**

## 6. Submit your changes for review

When your feature is ready, create a **Pull Request (PR)** on GitHub.

A pull request lets someone else review the changes before they're added to `main`.

Your AI assistant may be able to create the PR, or you can create it through GitHub.

Include:

- **Issue:** Which task did you work on?
- **Changes:** What did you build?
- **Testing:** How did you verify it works?
- **Remaining work:** Is anything incomplete or dependent on another feature?

Move your issue to **In Review**.

Another teammate should review the work before it's merged. AI can help with the review, but we should still check that the feature behaves as expected.

Once approved, the changes can be merged into `main`, and the issue can be marked **Done** if all its requirements are satisfied.

## 7. Keep the team informed

We don't need lengthy updates, but communication is important when multiple people and AI assistants are changing the same project.

A quick update is enough.

**Example:**

> **Finished:** Built the interactive networking diagram.
>
> **Next:** Connecting the controls to the experiment.
>
> **Blocked:** Need the shared activity format from another issue.

If you get stuck, let the team know.

Also, before making changes that might affect someone else's work, check with them first.

This is especially important for shared application interfaces, authentication, database changes, and deployment.

## 8. Guidelines for using AI responsibly

AI is a major part of how we're building this project, but we still need to make sure the results are reliable.

**Understand the purpose.** You don't have to understand every line of code, but you should understand what your feature does and how to test it.

**Don't blindly accept changes.** Review what the AI is modifying, especially if it wants to delete files, change configuration, install dependencies, or restructure existing code.

**Protect sensitive information.** Never put passwords, API keys, credentials, or private student information into prompts or GitHub commits.

**Keep changes focused.** If the AI proposes work outside your issue, discuss it before proceeding.

**Test what gets built.** Automated tests help, but we should also check the actual user experience.

**Ask questions.** Programming experience isn't a requirement for contributing, and nobody should feel uncomfortable asking for an explanation.

---

## Common terms

| Term                | Simple explanation                                                       |
| ------------------- | ------------------------------------------------------------------------ |
| Repository (Repo)   | Where all our project files and code live                                |
| Issue               | A task describing something we need to build                             |
| Workstream          | The part of the project you're responsible for                           |
| Branch              | Your own separate workspace for changes                                  |
| Commit              | A saved checkpoint of your changes                                       |
| Pull Request (PR)   | A request to review and add changes to the shared project                |
| Merge               | Combining approved changes into the shared application                   |
| Main                | The shared version of the project                                        |
| Acceptance Criteria | A checklist of what must work before a task is complete                  |
| Docker              | A tool that helps everyone run the application and database consistently |

---

## The most important thing

We don't need everyone to have the same technical background or use the same AI tools.

What we do need is a consistent way of working together.

Everyone should know what they're building, communicate changes that affect the team, test their work, and get it reviewed before merging.

**Use whatever tools help you work effectively. Follow the same process so everything works together.**
