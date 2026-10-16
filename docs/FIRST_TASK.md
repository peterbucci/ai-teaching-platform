# Your First Task — Learning Pulse

**New to programming? You can still contribute.** This guide walks you through completing one task with help from an AI coding assistant, such as Codex, Claude Code, or another tool you prefer.

You do **not** have to write every line of code yourself or memorize Git commands. Your job is to understand what you're trying to build, check the result, and keep your teammates informed.

**The whole process:** Pick a task → Ask AI to explain it → Work in your own branch → Build and test → Open a pull request → Get a review.

> **Need help setting up first?** See [Start Here](START_HERE.md), [Getting Started](GETTING_STARTED.md), [Codex setup](CODEX_SETUP.md), or [Claude Code setup](CLAUDE_CODE_SETUP.md). You only need one coding assistant.

## Before you start

Make sure you can:

- [ ] Open our [GitHub repository](https://github.com/peterbucci/ai-teaching-platform).
- [ ] Open our [team project board](https://github.com/users/peterbucci/projects/7).
- [ ] Access the repository through your AI coding assistant (on your computer or in the cloud).
- [ ] Find an issue your team has agreed you can work on.

**An issue is simply a task.** It describes what we want to build and how we will know it's finished. You don't need to understand every technical detail before beginning.

## Step 1 — Pick your issue

1. Open the [project board](https://github.com/users/peterbucci/projects/7).
2. Find a task in your work area that the team says is ready to start, or ask the team which one you should take.
3. Open the issue. Read its description and **acceptance criteria** (the checklist of what needs to work).
4. Check that nobody else is already working on it. Let the team know you're taking it.
5. Move the task to **In Progress**, if you have permission to edit the board.

**Example:** Issue `#40` is about making a networking experiment calculate the right results. That's an example of what an issue looks like—not an instruction for everyone to start #40.

**Don't know what to choose?** Ask your team. Some issues depend on other work and aren't ready to finish yet.

## Step 2 — Ask your AI assistant to explain the task

Open the Learning Pulse repository in your coding assistant and paste this prompt, replacing `#XX` with **your issue number**:

> I'm working on GitHub issue **#XX** in `peterbucci/ai-teaching-platform`. Please read the issue, `README.md`, `AGENTS.md`, `PROJECT_CONTEXT.md`, and any related instructions. Explain in simple language:
>
> 1. What am I building, and why?
> 2. What will someone see or be able to do when it's finished?
> 3. What should we build and test first?
> 4. Does this depend on another teammate's work?
>
> **Don't change any files yet.** Keep the plan small and tell me if anything is unclear.

**Before continuing:** You should be able to describe the task in one or two sentences. If you can't, ask the AI to explain it another way. If your assistant can't open the GitHub issue, paste the issue text into your conversation with it (leave out any private information).

## Step 3 — Make your own workspace (branch)

**`main` is the team's shared version of the project.** A **branch** is a separate workspace where you can make changes without immediately changing everyone else's work.

Ask your AI assistant:

> Before making changes, check whether I have unsaved or unfinished work. Start from the latest `main` branch and make a new branch for issue **#XX**, with a name like `feature/XX-short-description`. Don't edit or push directly to `main`. If there are existing changes or a branch conflict, stop and explain what to do.

If your assistant can handle Git, it can do this for you. **Check that you're on the new branch before it starts coding.**

### Prefer clicking instead? Use GitHub Desktop

If you're working with files on your computer, first check GitHub Desktop's **Changes** tab. If it shows existing work, stop and ask for help preserving it before switching branches.

1. Open **GitHub Desktop** and select the `ai-teaching-platform` repository.
2. Select **Current Branch → main**.
3. Click **Fetch origin**, then **Pull origin** if GitHub Desktop offers it. This checks for teammates' latest changes.
4. Select **Current Branch → New Branch**.
5. Name your branch something like `feature/40-networking-experiment`, substituting your own issue number and description.
6. Click **Create Branch**.

[GitHub's branch walkthrough](https://docs.github.com/en/desktop/making-changes-in-a-branch/managing-branches-in-github-desktop)

**Using a cloud coding agent?** It can usually prepare a branch in its remote workspace. You don't need GitHub Desktop for that. Ask the assistant to confirm which repository and branch it will change.

## Step 4 — Build the feature in small pieces

When the plan makes sense and you're on your own branch, tell your assistant:

> Please implement the **first small part** of issue **#XX**, following its acceptance criteria and the repository's instructions. Reuse what's already there. Explain what you change in simple terms, run relevant checks, and show me the result before moving to the next part. Don't change unrelated features. Ask me before changing shared data formats, database structure, authentication, dependencies, or deployment.

Work through one part at a time. You can ask questions like:

- "Can you show me what this feature looks like?"
- "What part of the issue does this change complete?"
- "Why did you change this file?"
- "Can you explain that error without technical jargon?"

**It's okay if another feature isn't finished yet.** Your assistant may be able to use clearly labeled sample data. Just remember that a working sample is **not** proof that everything is connected to the real application.

## Step 5 — Check that it actually works

**AI saying 'done' is not the same as the feature working.** Before sharing your work:

1. Look at the issue's acceptance criteria. Which boxes can you honestly check?
2. Ask your AI assistant to run the relevant tests and explain the results.
3. Try the feature yourself if it has a screen or something you can interact with.
4. Try one unusual case, such as an empty answer or invalid input.
5. Check what **wasn't** tested, especially if it needs an unfinished feature or a paid AI service.

Copy this prompt:

> Please check issue **#XX** against each acceptance criterion. Tell me **Passed, Not passed, or Not tested** for each one, with the evidence. Run the appropriate tests if available. Don't claim something works just because example data or a mock was used. Show me how to try the feature myself.

If you're blocked, tell the team. You can still share your progress, but **don't mark an incomplete issue as finished**.

## Step 6 — Share your changes with a pull request

A **pull request (PR)** is how you ask the team to review your work before it gets added to `main`.

There are three small steps:

1. **Commit** — Save a checkpoint of the changes in your branch.
2. **Push** — Send that branch to GitHub.
3. **Open a PR** — Ask teammates to review and eventually add your changes.

Your AI assistant may be able to do all three. **Review which files changed first**, and ask it to stop before pushing if anything looks unexpected. Never include passwords, API keys, or the `.env` file.

Tell your assistant:

> Please review all changes for issue **#XX**. Check that there are no unrelated files or secrets, explain what changed, and show me the test results. Then help me commit to my feature branch, push it, and open a pull request **into `main`**. Don't merge the PR. If the issue is only partly complete, open a **draft PR** and clearly say what's missing. Ask before any action you can't safely undo.

### Prefer using GitHub Desktop?

After you check your changes:

1. In **GitHub Desktop**, review the changed files.
2. Enter a short description in **Summary**, then choose **Commit to [your branch]**.
3. Click **Publish branch** (the first time) or **Push origin** (later).
4. Choose **Create Pull Request** or **Preview Pull Request** to open GitHub.
5. Make sure the PR goes **from your branch into `main`**. Add a title and description, then create it.

If the button isn't shown, visit the repository's **Pull requests → New pull request** page. [GitHub's pull request guide](https://docs.github.com/en/desktop/working-with-your-remote-repository-on-github-or-github-enterprise/creating-an-issue-or-pull-request-from-github-desktop)

### What to write in your PR

Keep it short. You can ask your AI assistant to draft this:

```md
## Related issue

#XX

## What I built

- ...

## What I tested

- ...

## Still unfinished or blocked

- ...
```

Use **`Closes #XX` only if the entire issue is actually finished**. Otherwise, use **`Related to #XX`** so a partial PR doesn't close the task by accident.

Move the task to **In Review**, if you can edit its status, and share the PR link with the team.

## Step 7 — Get a review and finish

1. Ask another teammate to review and approve your PR. A coding assistant can help them, too.
2. If they suggest changes, make them **in the same branch** and push again. The PR will update.
3. When the required checks pass and another teammate has approved the PR, an authorized teammate can **merge** it—meaning add it to the shared `main` version.
4. Mark the issue **Done only when its complete acceptance criteria are met**. If some integration is still missing, keep that work visible.
5. Let the team know what you finished and what they can use next.

**Extra review is important** when changes affect the database, login and permissions, shared data formats, or deployment. Don't feel you have to solve those parts alone.

## If you get stuck

| Situation                                      | What to do                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **I don't understand the issue.**              | Ask the AI to explain it with an example, or ask a teammate.                                                               |
| **My AI can't run the app.**                   | Ask what setup is missing. You may still be able to test part of the feature; report what wasn't verified.                 |
| **Another person is changing the same file.**  | Tell the team before continuing. Don't overwrite their work.                                                               |
| **My tests fail.**                             | Ask the AI to explain and investigate. Don't disable tests just to get a green result.                                     |
| **I can't push or create a PR.**               | Ask the team to check your GitHub permissions. Don't create a separate copy or force changes through without coordinating. |
| **My AI wants to make big unrelated changes.** | Stop and ask it to stay within the issue. Check with the team before approving shared changes.                             |
| **I'm waiting for someone else.**              | Tell the team and note what you're waiting for in the issue. Ask if you can test using sample data meanwhile.              |

## The only rules you really need to remember

- **One issue at a time.** Let the team know what you're working on.
- **Use your own branch.** Don't edit or push directly to `main`; use a reviewed pull request.
- **Check the result yourself.** Report honestly what worked and what hasn't been tested.
- **Ask before risky changes.** No surprise database resets, credential sharing, or major rewrites.
- **Get a review.** Nobody needs to understand the whole project alone.

**That's it!** After your first PR, the process is the same for the next issue: choose a task, work on a branch, test it, and share it for review.

---

**Helpful links:** [Team project board](https://github.com/users/peterbucci/projects/7) · [Repository](https://github.com/peterbucci/ai-teaching-platform) · [GitHub Desktop](https://desktop.github.com/) · [GitHub basics](https://docs.github.com/en/get-started)
