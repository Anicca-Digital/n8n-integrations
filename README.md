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
├── .claude/
│   ├── skills/n8n-workflow-builder/   # Build process Claude Code follows
│   ├── commands/                      # /new-workflow, /validate-workflow, /kb-update
│   └── settings.json                  # Minimal permissions
├── shared/
│   ├── knowledge/            # n8n knowledge base (docs 00-06)
│   ├── tools/                # validate_workflow.py
│   ├── reference-implementations/  # Anicca example exports (patterns only)
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

## Knowledge base, skill and commands
- `shared/knowledge/` holds the n8n knowledge base: instructions (00), schema and gotchas (01), workflow patterns (02), app integration notes (03), QA checklist (04), Anicca-internal build records (05), intake template (06).
- The `n8n-workflow-builder` skill (`.claude/skills/`) is how Claude Code builds, edits and reviews workflow JSON. It reads the knowledge docs on demand. It writes a plain-language Build Spec and waits for approval before writing any JSON.
- Resolved IDs live only in the client's folder (`clients/<client>/BUILD_RECORDS.md`). Per-client instance facts are in `clients/<client>/CLAUDE.md`. Never copy values between clients.
- Slash commands:
  - `/new-workflow <client> "<description>"`: check instance facts, ask for gaps, produce the Build Spec and stop for approval.
  - `/validate-workflow <path>`: run the validator and QA checklist and report ERROR/WARN/INFO and what's still manual.
  - `/kb-update`: propose knowledge-base additions from the last build as a diff for approval.
- Claude Code can't import or run workflows on a live n8n instance. Every workflow PR lists the manual checks (credentials, sub-workflow, Error Workflow, cutover).

## Branch and PR workflow
1. Branch from `main` as `type/client-description` (`feat/`, `fix/`, `chore/`).
2. Commit small, clear changes. Use `git mv` for moves or renames.
3. Open a PR. The `validate-n8n` check must pass: valid JSON, no likely secrets, and no validator ERRORs on changed workflow files (warnings are printed, not blocking).
4. Never commit directly to `main`.
