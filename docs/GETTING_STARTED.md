# Getting Started with Learning Pulse

**Want to understand each setup step?** This guide walks you through getting the project onto your computer and opening it with an AI coding assistant. You don't need to know how to program to follow along. For the quickest AI-assisted path, use [Start Here](START_HERE.md).

**Our project:** [Learning Pulse repository](https://github.com/peterbucci/ai-teaching-platform)  
**Our task board:** [GitHub Project](https://github.com/users/peterbucci/projects/7)

## What we're going to do

1. Sign in to GitHub.
2. Copy the project onto your computer with GitHub Desktop.
3. Open it in the AI coding tool you prefer.
4. Set up the app so you can see it running.
5. Check that you're ready for your first task.

**Good to know:** You can use Codex, Claude Code, or another coding assistant. Everyone follows the same team workflow. You only need **one** coding assistant.

**Two parts to this guide:**

- **Part A — Get connected (Steps 1–3):** These steps open a local copy in your coding assistant. If you're using a cloud coding environment, follow the [Codex](CODEX_SETUP.md) or [Claude Code](CLAUDE_CODE_SETUP.md) cloud instructions instead; you can skip local cloning and Docker setup.
- **Part B — Run the app (Steps 4–6):** Do this if you'll test the website or its database on your computer. It's okay to get help with this part. If your first task only uses sample screens or documentation, you may not need Part B for it.

---

## Step 1 — Get access to the project

1. Create a free account at [github.com](https://github.com/) if you don't have one.
2. Open our [repository](https://github.com/peterbucci/ai-teaching-platform) and [project board](https://github.com/users/peterbucci/projects/7).
3. Ask the team lead to confirm you have permission to contribute. Anyone can view this public repository, but you need the right access to push changes directly to it.

**What is GitHub?** It's where we keep our project's files and organize everyone's work.

## Step 2 — Get the project onto your computer

For local work, we'll use **GitHub Desktop**, which makes working with GitHub easier without needing to learn commands. Its [cloning guide](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop) has screenshots if you need them.

1. Install [GitHub Desktop](https://desktop.github.com/) and sign in to your GitHub account.
2. In GitHub Desktop, select **File → Clone repository**.
3. Choose the **URL** tab and paste:

   `https://github.com/peterbucci/ai-teaching-platform.git`

4. Choose a folder on your computer where you want to keep the project. Avoid folders that automatically sync through OneDrive, Dropbox, or iCloud if possible.
5. Click **Clone**.

You should now have a folder named `ai-teaching-platform` on your computer.

**What does “clone” mean?** It simply means making a working copy of the GitHub repository on your computer. Unlike **Download ZIP**, it keeps the connection to GitHub so you can share changes later.

## Step 3 — Choose an AI coding assistant

Pick whichever tool you're most comfortable using. You do **not** need to install both Codex and Claude Code.

| Option                      | Suggested starting point                                            | Difficulty for a beginner |
| --------------------------- | ------------------------------------------------------------------- | ------------------------- |
| **Codex**                   | [Desktop setup guide](CODEX_SETUP.md)                               | **Easy**                  |
| **Codex in VS Code**        | [Official extension guide](https://developers.openai.com/codex/ide) | **Easy–Medium**           |
| **Claude Code**             | [Claude Desktop / Code](https://code.claude.com/docs/en/desktop)    | **Easy**                  |
| **Claude Code in VS Code**  | [Official extension guide](https://code.claude.com/docs/en/vs-code) | **Easy–Medium**           |
| **Terminal-based AI tools** | Follow the tool's official installation instructions                | **Harder**                |

These difficulty labels are just guidance, not a rule. Some tools may require a subscription or paid access.

After installing your tool:

1. Sign in if prompted.
2. Choose **Open folder**, **Open project**, or the equivalent option.
3. Select the **same `ai-teaching-platform` folder** you cloned in Step 2.
4. Ask the assistant to read the project instructions without making any changes.

**Copy this as your first message:**

> I've just opened the Learning Pulse repository. Please read `README.md`, `AGENTS.md`, and `PROJECT_CONTEXT.md`. Explain what the project does in simple terms and tell me if I opened the right folder. Don't change any files yet.

If your chosen assistant works entirely in the cloud instead of on your computer, its setup will be different. Use its GitHub connection instructions and ask a teammate for help if needed. The steps below describe the **recommended local setup**.

## Step 4 — Install Docker Desktop

Our application uses **Docker** to run the website and its database together. A _database_ is where the app stores information, such as practice answers and fictional student records.

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. Open Docker Desktop and complete any first-time setup it asks for.
3. Wait until Docker says its engine is running.

**Windows:** Docker Desktop may ask you to enable or update **WSL 2** (a Windows feature it uses). Follow the [official Windows instructions](https://docs.docker.com/desktop/setup/install/windows-install/), or ask for help. Our app uses Linux containers, which can run on a supported Windows Home installation too.

**Mac:** Follow the installer for your Mac; Docker offers versions for Apple silicon and Intel.

You don't need Supabase or a separate PostgreSQL account. Our database runs inside Docker.

## Step 5 — Add your local settings (one-time setup)

The project needs a few local passwords before it can start. They go in a file named **`.env`**.

**What is `.env`?** It's a settings file for _your computer_. It's deliberately excluded from GitHub. **Never commit it, upload it, paste it into an AI chat, or send it to another teammate.**

### 5A. Make the settings file

Open a terminal **inside your project folder**. If you're using VS Code, choose **Terminal → New Terminal**. Otherwise, you can open a terminal from GitHub Desktop's **Repository** menu (the wording varies by operating system).

**If `.env` already exists, don't copy over it.** Keep your existing settings and ask your assistant or a teammate to check whether anything is missing.

If it doesn't exist, copy and run **one** of these commands:

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
```

**Mac (Terminal):**

```bash
cp .env.example .env
```

Then open `.env` in your editor. You'll see names such as `POSTGRES_PASSWORD=` followed by empty spaces for values.

### 5B. Fill in the required values

You'll need:

| Setting in `.env`                                        | What to enter                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `POSTGRES_PASSWORD`                                      | A long, random password for the database                                 |
| `PGPASSWORD`                                             | A **different** long, random password for the app's database connection  |
| `AUTH_SECRET`                                            | A **third** random secret of at least 32 characters for sign-in security |
| `DEMO_TEACHER_EMAIL` and `DEMO_TEACHER_PASSWORD`         | A **fictional** teacher email and a strong password                      |
| `DEMO_STUDENT_ONE_EMAIL` and `DEMO_STUDENT_ONE_PASSWORD` | A **fictional** first student email and password                         |
| `DEMO_STUDENT_TWO_EMAIL` and `DEMO_STUDENT_TWO_PASSWORD` | A **fictional** second student email and password                        |

For the fictional emails, you can use `teacher@example.invalid`, `student-one@example.invalid`, and `student-two@example.invalid`. Use a different password of 12–128 characters for each account.

You can generate passwords with a password manager. Or, **after Docker is running**, copy this command into your terminal once. It prints six different random values you can copy into the matching lines of `.env`:

```bash
docker run --rm node:22.23.2-bookworm-slim node -e "const c=require('node:crypto'); for(const k of ['POSTGRES_PASSWORD','PGPASSWORD','AUTH_SECRET','DEMO_TEACHER_PASSWORD','DEMO_STUDENT_ONE_PASSWORD','DEMO_STUDENT_TWO_PASSWORD']) console.log(k+'='+c.randomBytes(24).toString('hex'))"
```

The first time, Docker may take a moment to download what it needs. **Keep the generated values private.** The command doesn't send them to our teammates or to GitHub.

Leave `AUTH_URL=http://localhost:3000` as it is for local setup. You can leave `OPENAI_API_KEY` and `OPENAI_MODEL` blank for now; **you don't need an application API key to start the app and check its login.** The application API key is separate from a Codex or Claude subscription. Ask the team lead before configuring live AI access.

Save the `.env` file. Keep the same passwords when restarting an existing database; changing this file alone won't update its accounts. [Database setup](../database/README.md) has more detail if you need it.

## Step 6 — Start the application

Make sure Docker Desktop is still running, then use a terminal in the `ai-teaching-platform` folder.

**First, start the app:**

```bash
docker compose up --build
```

The first run may take several minutes. You'll see text appearing in the terminal as Docker builds and starts the app. **Leave this terminal open.**

Wait until the terminal says the app is ready or you can open the login page. **Then open a second terminal in the same project folder** and enter:

```bash
docker compose exec app npm run db:seed
```

This creates the fictional teacher and student accounts and some example data. You normally only need to do this once for a new local database.

**Now open:** [http://localhost:3000/login](http://localhost:3000/login)

Sign in using one of the fictional email/password combinations you put in `.env`.

**You did it!** If the login works, you've confirmed that the website and local database can run on your computer. You haven't tested the unfinished AI tutoring features yet.

**When you're done:** In the first terminal, press **Ctrl+C** to stop the running app. You can start it again later with `docker compose up --build`.

**Please don't use `docker compose down --volumes`** as a cleanup command. It can erase your local database and example accounts.

## Step 7 — Check you're ready for your first task

- [ ] I can open the [GitHub project board](https://github.com/users/peterbucci/projects/7).
- [ ] I cloned the repository locally or connected it to my cloud coding environment.
- [ ] My AI coding assistant can read the project files and instructions.
- [ ] If my task needs local setup, Docker starts the application or I've told the team I need help.
- [ ] If I finished local setup, I can open the login page and sign in.
- [ ] I know **not** to edit `main` directly or share my `.env` file.

**Next:** Read the [Team Development Guide](../CONTRIBUTING.md) for our teamwork rules, then follow [First Task](FIRST_TASK.md). Use [Codex setup](CODEX_SETUP.md) or [Claude Code setup](CLAUDE_CODE_SETUP.md) if you need help with your chosen assistant.

---

## If something goes wrong

**“I can't clone or push the repository.”**  
Make sure GitHub Desktop is signed in. Cloning the public repository should work, but pushing changes requires permission. Ask the team lead if you're missing access.

**“Docker doesn't start.”**  
Open Docker Desktop and check for setup messages. On Windows, WSL 2 may need an update or a computer restart. Share the _error message_ with a teammate, but not your passwords.

**“A command says Docker isn't recognized.”**  
Make sure Docker Desktop is installed and running. Close and reopen the terminal, then try again.

**“The app says a password or setting is missing.”**  
Check that you created `.env` (not `.env.txt`) and filled in the required lines. Don't post the file into a chat to ask for help.

**“The website opens, but I can't log in.”**  
Double-check the fictional login you chose. Make sure you ran the `db:seed` command successfully. If it still fails, ask a teammate before resetting anything.

**“I don't understand a step.”**  
Ask your coding assistant to explain the _instruction_, or message the team. There's no need to troubleshoot alone.

### Optional: running code outside Docker

If a later issue requires running development commands directly on your computer, you may need **Node.js 22.13 or newer** and `npm ci`. **You don't need to install Node just to use the Docker-only steps above.** Your coding assistant or a teammate can help you set up local development when that becomes necessary.

**Remember:** The goal of this guide is to get you set up, not to teach you programming in one sitting.
