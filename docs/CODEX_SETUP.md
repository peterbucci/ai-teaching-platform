# Set Up Codex for Learning Pulse

**Want to use Codex to help build our hackathon project?** This guide will help you connect it to the code. You do **not** need to know how to program to get started.

Codex is an AI coding assistant: you can ask it to explain the project, help set things up, write code, and test changes. **You only need to choose one setup method below.**

**Our repository:** [peterbucci/ai-teaching-platform](https://github.com/peterbucci/ai-teaching-platform)  
**Our task board:** [Learning Pulse GitHub Project](https://github.com/users/peterbucci/projects/7)

> **Not sure which method to choose?** Start with **Option A (desktop app)**. If you already use VS Code, choose **Option B**. You can ask a teammate for help at any point.

## Choose how you'll use Codex

| Option                   | Difficulty      | Best for                                                                    |
| ------------------------ | --------------- | --------------------------------------------------------------------------- |
| **A. Desktop app**       | **Easy**        | You want to chat with an AI assistant without learning a code editor first. |
| **B. VS Code extension** | **Easy–Medium** | You already use VS Code or want to see the files beside Codex.              |
| **C. Codex Cloud**       | **Medium**      | You'd rather work on a remote copy of the repository in your browser.       |
| **D. Terminal (CLI)**    | **Hard**        | You're comfortable typing commands and managing developer tools.            |

You do **not** need to install every option. For most teammates, A or B is enough.

---

## Option A — Desktop app (Easy, recommended)

**What you'll use:** The ChatGPT desktop app's **Codex** coding workspace, plus a local copy of our repository.

1. **Install the desktop app.** Follow [OpenAI's official desktop quickstart](https://learn.chatgpt.com/docs/quickstart). Choose the download for your computer (Windows or Mac).
2. **Open the app and sign in** with your ChatGPT account. If it says Codex isn't available on your account, ask the team before purchasing anything.
3. **Get the project onto your computer.** If you already have a folder named `ai-teaching-platform` from GitHub, skip to Step 4. Otherwise, the easiest visual method is:
   - Install [GitHub Desktop](https://desktop.github.com/) and sign in to GitHub.
   - In GitHub Desktop, select **File → Clone repository**.
   - Choose the **URL** option and enter `https://github.com/peterbucci/ai-teaching-platform.git`.
   - Choose where to save it, then select **Clone**. (A _clone_ is simply a working copy of the project, connected to GitHub.)
4. **Open the project in Codex.** Select **Codex** from the desktop app's **ChatGPT** dropdown, then choose to open or add a local folder/project. Select the `ai-teaching-platform` folder you just cloned. Menu labels may vary slightly.
5. **Check the correct folder is open.** Ask Codex: “Can you see `README.md`, `AGENTS.md`, and `PROJECT_CONTEXT.md` in this project?” It should be able to read them.
6. **Paste the setup prompt below.** Codex can then check what's needed and offer to handle the technical setup.

**You're connected when:** Codex can read the project's files and explain what Learning Pulse does. Running the actual website is a separate check that Codex can help with.

## Option B — VS Code extension (Easy–Medium)

**What you'll use:** Visual Studio Code (a program for viewing and editing code), with Codex in a side panel.

1. Install [Visual Studio Code](https://code.visualstudio.com/) if you don't already have it.
2. Install the [official Codex extension](https://learn.chatgpt.com/docs/codex/ide). You can follow the link to the VS Code extension listing, or search for **Codex** in VS Code's Extensions panel. Check that it is the official OpenAI extension.
3. Open the project folder in VS Code using **File → Open Folder**. If you don't have the folder yet, use the GitHub Desktop cloning steps under Option A.
4. Open **Codex** from its icon in VS Code. If you don't see it, open the Command Palette (**Ctrl+Shift+P** on Windows or **Cmd+Shift+P** on Mac) and search for **Codex: Open Codex Sidebar**.
5. Sign in when asked.
6. Ask Codex to read `README.md`, `AGENTS.md`, and `PROJECT_CONTEXT.md`. Then paste the setup prompt below.

**You're connected when:** You can see the project files in VS Code and Codex can explain them. You don't need to write code by hand to begin.

## Option C — Codex Cloud (Medium, no local clone required)

This option runs coding tasks in a **remote workspace** instead of directly on your computer. It can be useful if you don't want to set up all the development tools locally.

1. Open [ChatGPT](https://chatgpt.com/) and sign in.
2. Find the **Codex** cloud workflow. In current interfaces, you can use **Work in → Cloud → Select environment**; menu labels may change.
3. Create an environment or select an existing, published team-approved one.
4. For a new environment, connect GitHub if asked and select `peterbucci/ai-teaching-platform`. Review which repository permissions you're granting.
5. Let Codex inspect the repository and prepare the new environment. Review the setup and test results, save changes, select **Publish**, and wait for **Environment published**.
6. Select **Start a new task** after publishing, or start immediately in an existing environment. Paste the setup prompt below, and tell Codex you're using a cloud workspace.

**Important:** A cloud task may be able to read, change, and test code without running our complete Docker application. Ask what it **actually verified**. Don't assume the website or database works just because a cloud setup succeeded. Review all changes before making a pull request.

[Official Codex Cloud guide](https://learn.chatgpt.com/docs/cloud)

## Option D — Terminal / CLI (Hard, optional)

Codex also works through a **terminal**, a window where you type commands instead of clicking buttons. You can install the Codex CLI, open the repository folder, run `codex`, and sign in.

We won't require this method for the team. If you prefer it, follow the [official Codex CLI guide](https://learn.chatgpt.com/docs/codex/cli) for your operating system and ask Codex or a teammate for help with Git and environment setup.

---

## Next — Ask Codex to finish your setup

Once Codex can access the repository, copy and paste this message:

> I'm new to this project and would like help getting ready for my first task.
>
> **Repository:** https://github.com/peterbucci/ai-teaching-platform
>
> Please:
>
> 1. Check that you can access the repository and read `README.md`, `AGENTS.md`, `PROJECT_CONTEXT.md`, and the relevant setup instructions, especially `database/README.md` if I'll run the application.
> 2. Explain what this project does in simple terms.
> 3. Check what this computer or cloud workspace needs for the type of task I'll be doing.
> 4. Do as much of the setup as you safely can, including project dependencies, local configuration, and starting the website and database **if needed**.
> 5. Run appropriate checks and tell me what actually worked. Help troubleshoot anything that didn't.
>
> **Please keep it beginner-friendly.** Explain unfamiliar terms and give me one action at a time if you need my help. Ask before installing system software, changing important settings, overwriting files, deleting data, granting account permissions, or spending money.
>
> Keep passwords and API keys private. Don't display secrets in chat or logs, and never commit them to GitHub. You may help create the project's ignored local `.env` configuration file, but don't overwrite an existing one without asking. **Don't change the application source code, create commits, or push anything to GitHub during setup.** Don't create new project instruction files unless I ask.
>
> When you're finished, give me a short summary: **what's ready, what you tested, what's still missing, and whether I can start my first GitHub issue.**

### You may still need to do a few things yourself

Codex can often install project dependencies, prepare local configuration, start services, run tests, and explain errors. But it may need you to:

- **Sign in** to GitHub, ChatGPT, or a computer account yourself.
- **Approve an installation**, start Docker Desktop, or grant access to a folder.
- **Ask the team** about paid services or credentials that aren't available to you.

Our app uses **Docker and PostgreSQL** to run its website and database; it does **not** need Supabase. If you want to run the site on your computer, Codex should follow [`database/README.md`](../database/README.md) and [`GETTING_STARTED.md`](GETTING_STARTED.md), rather than inventing a different setup.

**A Codex account is not the same as our app's OpenAI API key.** You don't need the application's API key just to connect Codex to the repo. Ask the team before attempting live, paid AI model tests.

## Quick check: are you ready?

- [ ] I can open the Learning Pulse repository in Codex, or select it in my cloud workspace.
- [ ] Codex can read `README.md` and `AGENTS.md`.
- [ ] Codex explained what is ready and what, if anything, is still missing.
- [ ] I know whether the website needs to run for my first task.
- [ ] I know where to find our [GitHub Project board](https://github.com/users/peterbucci/projects/7).

**You don't need every part of the app running to start every kind of task.** For example, a teammate working on a visual mockup may be able to begin with sample data.

## If something doesn't work

| Problem                                        | What to do                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Codex can't find the project files.**        | Check that you've opened the `ai-teaching-platform` folder, not its parent folder or a ZIP download.                     |
| **I can see the repo but can't push changes.** | Ask the team for GitHub access. Viewing a public repository does not mean you can change it.                             |
| **Codex wants to install lots of software.**   | Ask why each item is needed. Approve only what's necessary for your task.                                                |
| **Docker won't start.**                        | Ask Codex to explain the exact error and what you need to do. It may require installing Docker Desktop or restarting it. |
| **A test fails.**                              | Ask Codex to say whether it actually ran the test and show the error in simple terms. Don't treat a failure as success.  |
| **Codex asks for an API key or payment.**      | Check with the team. Never paste secrets into chat or commit them to the repo.                                           |

## What comes next?

Return to [Start Here](START_HERE.md), then follow the team's [contribution guide](../CONTRIBUTING.md) and [first-task walkthrough](FIRST_TASK.md). **Don't edit or push directly to `main`**, the team's shared branch. Your first task should begin on its own branch, with a teammate available to review it.
