---
description: Run the validator and QA checklist on workflow JSON and report ERROR/WARN/INFO plus manual steps
argument-hint: <path-to-workflow.json> [more paths]
---

Arguments: $ARGUMENTS (one or more workflow JSON paths).

1. Run `python3 shared/tools/validate_workflow.py $ARGUMENTS` and show the output.
2. Work through `shared/knowledge/04_QA_Validation_Checklist.md` for each file. Execute the mechanical checks, don't eyeball them. Mark each item pass, fail, or manual.
3. Report: ERRORs (defects to fix), WARNs (each with a decision and reason), INFOs, and a "still manual" list (credentials to connect, sub-workflow to pick, Error Workflow to set, cutover action, live testing in n8n).
4. Do not edit files unless the user asks. You cannot run workflows on a live n8n instance; say so.
