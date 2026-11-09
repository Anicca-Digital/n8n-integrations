---
description: Scope a new n8n workflow for a client and produce a plain-language Build Spec (stops for approval)
argument-hint: <client> "<description>"
---

Use the n8n-workflow-builder skill. Arguments: $ARGUMENTS (first word = client folder name under `clients/`, rest = description).

1. Read `clients/<client>/CLAUDE.md` ("Instance facts") and the existing workflow JSON in `clients/<client>/workflows/`. If the client folder doesn't exist, say so and stop.
2. List which instance facts are known and from what source. Ask in ONE consolidated list for anything missing or UNKNOWN: n8n version, cloud or self-hosted, existing credentials (exact names), error handler workflow, and the user's access level. Offer to use `shared/knowledge/06_Intake_Brief_Template.md` if the request is thin.
3. Write the plain-language Build Spec as one short table (trigger, records per run, actions, branches, loops, failure behaviour, done) and ask the outright questions from the skill (destination-app reactions, values deliberately left unset, in-between states, must-never-happen-twice, limits, owner).
4. **STOP and wait for approval.** Do not write or edit any workflow JSON until the user approves the spec.
