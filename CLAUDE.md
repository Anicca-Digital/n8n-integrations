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

## n8n workflow work
- Before creating or editing any workflow JSON, use the `n8n-workflow-builder` skill (`.claude/skills/n8n-workflow-builder/`). It enforces the Build Spec approval step, the non-negotiables and the validator.
- Knowledge lives in `shared/knowledge/`; the skill reads it on demand. Do not import those docs here.
- Resolved IDs live only in the client's own folder (`clients/<client>/BUILD_RECORDS.md`). `shared/knowledge/05_Build_Records.md` and `shared/reference-implementations/` are Anicca patterns, never to be copied into a client.
- Never trust a `typeVersion` without evidence from that client's instance.
- Commands: `/new-workflow`, `/validate-workflow`, `/kb-update`.
