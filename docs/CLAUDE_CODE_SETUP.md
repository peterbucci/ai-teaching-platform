# Set Up Claude Code for Learning Pulse

**Want to use Claude Code to help build our hackathon project?** This guide will help you connect it to our code. You do **not** need to know how to program to get started.

Claude Code is an AI coding assistant. You can ask it to explain the project, prepare your computer, write code, and test changes. **Pick just one option below**—you don't need to install everything.

**Our repository:** [peterbucci/ai-teaching-platform](https://github.com/peterbucci/ai-teaching-platform)  
**Our task board:** [Learning Pulse GitHub Project](https://github.com/users/peterbucci/projects/7)

> **Not sure which option to choose?** Start with **Option A (desktop app)**. If you already use VS Code, try **Option B**. If you get stuck, ask a teammate.

## Choose how you'll use Claude Code

| Option                           | Difficulty      | Best for                                                                      |
| -------------------------------- | --------------- | ----------------------------------------------------------------------------- |
| **A. Claude Desktop (Code tab)** | **Easy**        | You want a simple app where you can talk to the AI and review its work.       |
| **B. VS Code extension**         | **Easy–Medium** | You already use VS Code or want to browse project files alongside the AI.     |
| **C. Claude Code on the web**    | **Medium**      | You prefer working in your browser without setting up the entire app locally. |
| **D. Terminal (CLI)**            | **Hard**        | You're comfortable typing commands or working in a developer environment.     |

**Before you begin:** Desktop and cloud sessions require an eligible paid Claude subscription. The VS Code extension and terminal also support Claude Console access. If sign-in asks you to upgrade or pay, **check with the team before purchasing anything**. You do not need to install both Claude Desktop and the VS Code extension.

---

## Option A — Claude Desktop (Easy, recommended)

**What you'll use:** The Claude desktop app and a folder containing the Learning Pulse project.

1. **Install Claude Desktop.** Follow [Claude's official desktop setup guide](https://code.claude.com/docs/en/desktop-quickstart). Choose the download for your computer. The Code tab includes Claude Code, so you don't need to install Node.js or the separate terminal tool for this option.
2. **Open Claude and sign in** to your Claude account.
3. At the top of the app, choose **Code** (not Chat). The Code tab is the part that can work with project files.
4. **Get a copy of our repository.** If you already have an `ai-teaching-platform` folder from GitHub, skip to Step 5. Otherwise, an easy visual option is:
   - Install [GitHub Desktop](https://desktop.github.com/) and sign in to GitHub.
   - Choose **File → Clone repository → URL**.
   - Enter `https://github.com/peterbucci/ai-teaching-platform.git`.
   - Choose where to save the folder and click **Clone**.

   _Clone_ just means "make a working copy of the project that's connected to GitHub."

5. Back in Claude's **Code** tab, choose **Local** and then **Select folder**. Open the `ai-teaching-platform` folder.
6. For your first session, choose **Manual** permission mode so you can approve commands and changes. **Plan** is useful for reading and discussing the setup, but you'll need to leave Plan mode before Claude can perform it.
7. Ask: **"Please read `README.md`, `AGENTS.md`, and `PROJECT_CONTEXT.md` in this folder, and follow the project instructions."**
8. If Claude can read them, paste the **setup prompt** farther down this page.

**You're connected when:** Claude Code can read the project files and explain what Learning Pulse does. You do not need to have the website running yet.

---

## Option B — VS Code extension (Easy–Medium)

**What you'll use:** Visual Studio Code (a program for opening and editing project files) with Claude Code in a panel.

1. Install or update [Visual Studio Code](https://code.visualstudio.com/) if needed.
2. In VS Code, open **Extensions** (the icon that looks like blocks). Search for **Claude Code** and install the **official Anthropic extension**. You can also follow [Claude's VS Code instructions](https://code.claude.com/docs/en/vs-code).
3. **Open our repository folder** using **File → Open Folder**. If you don't have a local copy yet, follow the GitHub Desktop steps in Option A.
4. Open a file, such as `README.md`. Look for the **Claude Code spark icon**, or open the Command Palette (`Ctrl+Shift+P` on Windows / `Cmd+Shift+P` on Mac) and search for **Claude Code**.
5. Click **Sign in** and complete the sign-in in your browser if asked.
6. Ask Claude to read `README.md`, `AGENTS.md`, and `PROJECT_CONTEXT.md` and follow the project instructions. Then paste the setup prompt below.

**Good to know:** The VS Code extension includes what it needs for its own chat panel. **You do not have to install the separate Claude Code terminal tool** just to use the extension.

**You're connected when:** You can see the Learning Pulse files in VS Code and Claude can explain them.

---

## Option C — Claude Code on the web (Medium)

This option runs Claude Code in an online workspace instead of directly on your computer. You **don't need to clone the repository first**.

1. Open [Claude Code on the web](https://claude.ai/code) and sign in.
2. Follow the prompts to **connect GitHub**. Check which permissions you are granting.
3. Select **`peterbucci/ai-teaching-platform`** for a new session. If the repository does not appear, ask the team to check your GitHub connection and access.
4. Tell Claude you're using a **cloud workspace**, and paste the setup prompt below.
5. Ask Claude to explain what it successfully checked and what would still need to run on a local computer.

**Important:** Running checks in Claude's cloud workspace is **not the same as** confirming that the complete website and Docker database run on your own computer. A cloud session cannot install Docker or configure files on your laptop. Some tasks can be done entirely online; others may require the team's local or hosted application.

[Official Claude Code cloud guide](https://code.claude.com/docs/en/claude-code-on-the-web)

---

## Option D — Terminal / CLI (Hard, optional)

A **terminal** is a window where you type commands instead of clicking buttons. Claude Code can also run there.

If you prefer this method, follow [Claude's official installation guide](https://code.claude.com/docs/en/setup). It covers Windows, Mac, Linux, and Windows Subsystem for Linux (WSL). Install Claude Code, open a terminal in the repository folder, and start a session by typing `claude`.

**Windows:** Follow the official installation steps for the terminal you're using, such as PowerShell or Command Prompt. If you choose WSL, install and run Claude inside its Linux terminal rather than mixing Windows and Linux commands.

You **do not need the terminal method** if you chose the desktop app or VS Code extension.

---

## Next — Ask Claude to finish the setup

Once Claude Code can access the repository, **copy and paste this message**:

> I'm new to this project and would like help getting ready for my first task.
>
> **Repository:** https://github.com/peterbucci/ai-teaching-platform
>
> Please:
>
> 1. Check that you can access the repository and read and follow `README.md`, `AGENTS.md`, `PROJECT_CONTEXT.md`, and the relevant setup instructions, especially `database/README.md` if I'll run the application. Check for existing work before changing any files.
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

Claude can often set up project dependencies, prepare local files, start services, and explain errors. But you may still need to:

- **Sign in** to Claude and GitHub yourself.
- **Approve access** to your project folder or GitHub repository.
- **Install or start Docker Desktop** if you'll run the website and database locally.
- **Ask the team** about paid services or credentials.

Our application uses **Docker and PostgreSQL**, not Supabase. When running the app locally, Claude should follow [`database/README.md`](../database/README.md) and the more detailed [Getting Started guide](GETTING_STARTED.md).

**Your Claude Code account is separate from the OpenAI API key our application may use.** Connecting Claude Code to GitHub doesn't require that application key. Ask the team before running tests that require a paid AI API.

**One Claude-specific detail:** Our shared instructions are in `AGENTS.md`. Claude Code's [automatic instruction loading](https://code.claude.com/docs/en/memory#agentsmd) depends on its version, settings, and other instruction files. The setup prompt explicitly tells Claude to read and follow ours; don't assume they loaded automatically. There's no need to generate a new instruction file just to get started.

## Quick check: are you ready?

- [ ] Claude Code can open the Learning Pulse repository, locally or in the cloud.
- [ ] Claude can read and explain `README.md` and `AGENTS.md`.
- [ ] Claude has checked what's necessary for my first task.
- [ ] I know which checks actually passed and which haven't been run.
- [ ] I know where to find the [GitHub Project board](https://github.com/users/peterbucci/projects/7).

**You don't need every part of the application working before every kind of task.** Someone working on a sample screen may not need a running database yet.

## If something doesn't work

| Problem                                        | What to try                                                                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **I only see Chat, not Code.**                 | Check that you're using a supported Claude Desktop version and an eligible account. Ask the team before upgrading or paying.                 |
| **Claude can't find the project.**             | Open the actual `ai-teaching-platform` folder, not a ZIP file or its parent folder. In cloud sessions, select the correct GitHub repository. |
| **The VS Code extension doesn't appear.**      | Open a file, look for the spark icon, or restart VS Code. Check that you installed the official Anthropic extension.                         |
| **GitHub won't let me push.**                  | Ask the team about repository access. Public visibility does not automatically give write permission.                                        |
| **Claude wants to install a lot of software.** | Ask which parts are necessary for your first task. You can approve them one at a time.                                                       |
| **Docker or a test won't start.**              | Ask Claude to explain the actual error. Don't assume the website works until someone has tested it.                                          |
| **Claude asks for payment or an API key.**     | Check with the team first. Don't paste secrets into chats or project files tracked by GitHub.                                                |

## What comes next?

Return to [Start Here](START_HERE.md), then see our team [contribution guide](../CONTRIBUTING.md) and [First Task walkthrough](FIRST_TASK.md).

**Don't edit or push directly to `main`**, our shared project branch. For your first issue, use your own branch and ask a teammate to review your work before it is added to the project.

---

_Setup information based on [Claude Desktop](https://code.claude.com/docs/en/desktop-quickstart), [Claude Code for VS Code](https://code.claude.com/docs/en/vs-code), [Claude Code cloud](https://code.claude.com/docs/en/claude-code-on-the-web), and [Claude Code installation](https://code.claude.com/docs/en/setup) documentation (checked October 16, 2026)._
