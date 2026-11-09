# n8n-integrations

Anicca Digital's single repo for **all n8n workflow work**, across clients. n8n only: no HubSpot custom code, landing pages or other projects.

## Layout

```
n8n-integrations/
├── CLAUDE.md                 # Rules for Claude Code and contributors
├── clients/
│   └── spl-simpro/           # One folder per client
│       ├── CLAUDE.md         # Client context: systems, workflows, rules
│       ├── README.md
│       ├── workflows/        # n8n exports (one workflow per JSON file)
│       └── code-nodes/       # Code node JS extracted from workflows
├── shared/
│   ├── templates/            # Base workflows: error handler, retry, upsert patterns
│   ├── code-snippets/        # Reusable Code node JS
│   └── docs/                 # Naming conventions, deployment checklist
├── scripts/
│   ├── export-n8n.sh         # Pull workflows from an n8n instance into a folder
│   └── import-n8n.sh         # Push workflow JSON files to an n8n instance
└── .github/                  # CODEOWNERS, PR template, validate-n8n CI
```

## Adding a new client
1. Create `clients/<client>/` with `README.md`, `CLAUDE.md`, `workflows/` and `code-nodes/` (use `clients/spl-simpro/` as the model).
2. In the client `CLAUDE.md`, record the systems involved, credential names as they appear in n8n, folder meanings and any client-specific rules.
3. Add the client folder to `.github/CODEOWNERS`.
4. Open a PR (`feat/<client>-initial-setup`).

## Workflow files
- One workflow per JSON file. New files: `<client>__<process>__v<n>.json`.
- Never commit credentials, API keys or tokens. Credential IDs and names only.
- Use `scripts/export-n8n.sh` to export and `scripts/import-n8n.sh` to import (see the header of each script).

## Branch and PR workflow
1. Branch from `main` as `type/client-description` (`feat/`, `fix/`, `chore/`).
2. Commit small, clear changes. Use `git mv` for moves or renames.
3. Open a PR. The `validate-n8n` check must pass (valid JSON, no likely secrets).
4. Never commit directly to `main`.
