# AI Teaching Platform

A PEAAII AI Applications Hackathon project exploring source-grounded tutoring and
teacher insights from learning evidence. The planned demonstration uses one
reading, five approved concepts, and fictional students only.

The repository currently contains a minimal Next.js application shell. Tutoring,
database integration, and the teacher dashboard are tracked as upcoming work.

[Project board: AI Teaching Platform — PEAAII Hackathon](https://github.com/users/peterbucci/projects/7)

## Run locally

Use Node.js 22.13 or newer in the Node 22 release line and npm. `.nvmrc` selects
Node 22 for compatible version managers.

```sh
git clone https://github.com/peterbucci/ai-teaching-platform.git
cd ai-teaching-platform
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The application shell needs no
environment variables. `.env.example` lists placeholders for later integrations;
keep actual credentials in an ignored `.env.local` file and never commit them.

## Quality checks

```sh
npm run lint
npm run typecheck
npm run format:check
npm run build
```

Use `npm run format` to apply formatting. GitHub Actions runs the checks above on
pull requests and pushes to `main`. Add focused behavioral tests only when they
cover meaningful risks; no broad testing framework is required for this shell.

## Working together

Read [AGENTS.md](AGENTS.md) for development guidelines and
[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the intended product. Keep changes
scoped to an existing issue and coordinate before changing shared contracts.

- Create a feature or fix branch, such as `feature/2-demo-content`, from current
  `main`; keep `main` ready to run.
- Move the issue through Backlog, Todo, In Progress, In Review, and Done on the
  Project board. Issues remain unassigned until teammates are identified.
- Open a focused pull request with its issue link, a short explanation, and the
  checks actually run. Use `Closes #N` only when all issue criteria are met.
- Review the diff, get a teammate's review, and merge after the checks pass. Avoid
  force-pushing shared branches or rewriting someone else's work.

The repository is public. The protected `main` branch requires a pull request,
one approving review, resolved conversations, and the passing `quality` check
on an up-to-date branch. New commits dismiss stale approvals. Protection applies
to administrators; force pushes and branch deletion are disabled.

Grant repository write access and Project access to actual teammates so they can
review changes and manage the board.

The initial dependency audit found no production vulnerabilities. Development
lint tooling includes an upstream `braces` advisory; revisit compatible updates
before processing untrusted repositories. Do not apply the audit's incompatible
Next.js lint-configuration downgrade.
