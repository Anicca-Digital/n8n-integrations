---
description: Review the last build and propose additions to the knowledge docs as a diff for approval
---

Review the most recent build in this session or branch (PR description, workflow JSON, validator output, issues hit).

1. Identify what was learned that the docs didn't warn about: new gotchas (`shared/knowledge/01_...`), pattern variants (`02_...`), app behaviour and credential types (`03_...`), `typeVersion`s confirmed and on which n8n version and client, QA checklist gaps (`04_...`).
2. Resolved IDs and client-specific values do NOT go in `shared/knowledge/`. They go in `clients/<client>/BUILD_RECORDS.md`.
3. Show the proposed additions as a unified diff, with a one-line reason each.
4. **Do not apply them.** Wait for approval, then make the changes in a separate commit or PR from the build.
