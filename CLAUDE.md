# n8n-integrations

## Rules
- This repo is **n8n only**. No HubSpot custom code, landing pages or other projects.
- `clients/<client>/` holds all work for one client. `shared/` is reusable across clients.
- Always read the client's `CLAUDE.md` before editing anything for that client.
- One workflow per JSON file. Filenames for new files: `<client>__<process>__v<n>.json`. Do not rename existing SPL files without asking.
- Never commit credentials, API keys or tokens. Credential IDs/names only.
- When editing a workflow, extract Code node JS into the client's `code-nodes/` folder.
- Branch names: `type/client-description` (`feat/`, `fix/`, `chore/`), e.g. `fix/spl-simpro-quote-status`.
- Never commit directly to `main`. Always open a PR.
- Do not delete live workflow files. Use `git mv` to move or rename so history is preserved.
