# AI Teaching Platform

A PEAAII AI Applications Hackathon project exploring source-grounded tutoring and
teacher insights from learning evidence. The planned demonstration uses one
reading, five approved concepts, and fictional students only.

The repository currently contains a minimal Next.js application shell. Tutoring,
database integration, and the teacher dashboard are tracked as upcoming work.

The prepared [Network Performance content and team review summary](content/README.md)
are integrated as static files for Issue #2. Teacher approval is pending, and
missing per-concept diagnostic/retest coverage and reuse concerns remain open.
The package is not loaded by the application or exposed as student content.

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
npm run content:check
npm run format:check
npm run build
```

Use `npm run format` to apply formatting. GitHub Actions runs the checks above on
pull requests and pushes to `main`. Add focused behavioral tests only when they
cover meaningful risks; no broad testing framework is required for this shell.

The content check requires Python 3 on `PATH` (`python --version`); it uses only
the standard library and does not rewrite the imported verification report.
Python is needed for this check, not for running the application shell. Imported
content is excluded from automatic formatting to preserve its supplied bytes.

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

GitHub rejected branch protection for this private repository on the owner's
current free plan. Keep the repository private and follow the review-and-check
convention manually. If the account is upgraded to GitHub Pro, protect `main`
with one approving review, the `quality` check required, stale approvals
dismissed, conversations resolved, and force pushes/deletion disabled.
Repository and Project access must be granted to actual teammates before they
can collaborate.

The initial dependency audit found no production vulnerabilities. Development
lint tooling includes an upstream `braces` advisory; revisit compatible updates
before processing untrusted repositories. Do not apply the audit's incompatible
Next.js lint-configuration downgrade.
