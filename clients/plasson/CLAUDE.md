# Plasson: NetSuite → HubSpot

Read this before editing anything in `clients/plasson/`. `README.md` in this folder has the full flow, mappings and deployment steps; this file holds the rules and facts.

## Systems
- **NetSuite**: account `6798253`, SuiteTalk REST + SuiteQL. OAuth2 machine-to-machine: signed JWT client assertion (PS256) exchanged for a 60-minute token. Credential: `Netsuite JWT Auth account` (`jwtAuth`, PEM private key). Client ID and Certificate ID sit in the dispatcher's Settings node (identifiers, not secrets; the private key is only in the n8n credential).
- **HubSpot**: deals in the Existing Stockist pipeline (`2107090401`) and their line items. Credential: `Plasson HubSpot` (`hubspotAppToken`).
  - Deal properties: `netsuite_quote_number`, `netsuite_record_id`, `quote_status`, plus standard `amount`, `dealstage`, `pipeline`.
  - Line item properties: `netsuite_line_id`, plus standard `name`, `description`, `hs_sku`, `quantity`, `price`.
- Direction is NetSuite → HubSpot only.

## Files
| Path | What |
|---|---|
| `workflows/netsuite-to-hubspot/plasson__netsuite-quote-dispatcher__v2.json` | Current dispatcher (every 30 min). UAT filter cleared |
| `workflows/netsuite-to-hubspot/plasson__netsuite-quote-to-hubspot-deal-lines__v1.json` | Current sub-workflow, called once per quote |
| `workflows/netsuite-to-hubspot/archive/plasson__netsuite-quote-dispatcher__v1.json` | Superseded UAT dispatcher (`HS-TEST-` filter). Reference only |
| `code-nodes/get-watermark.js`, `save-watermark.js` | Code node JS from the dispatcher (taken from v2) |
| `BUILD_RECORDS.md` | Resolved IDs, stage IDs, open items |

## Rules
- **Versioning:** a behaviour change is a new file (`...__v<n+1>.json`). Move the superseded file into `archive/` with `git mv`. Never delete or overwrite a live export.
- **Never commit `pinData`.** Exports from n8n carry pinned test data; the original sub-workflow export held a live NetSuite bearer token. Strip `pinData` (set it to `{}`) before committing and re-check with a search for `eyJ`.
- **Code nodes:** the workflow JSON is the source of truth. When Get Watermark or Save Watermark change, update `code-nodes/` in the same commit.
- **Watermark:** it and the parked quotes live in the dispatcher's workflow static data. Get Watermark and Save Watermark must stay Code nodes. Any failed quote must hold the watermark; do not change this.
- **No retry on create:** Create Line Items must not `retryOnFail` (a retry could duplicate lines). Old lines are archived only after all new lines exist.
- **Stage handling:** the deal stage only changes when `quote_status` changed. Keep it, so manual stage moves in HubSpot are not overwritten.
- **Status mapping** lives in `statusToStage` in the sub-workflow Config node. A new NetSuite status must be added there and to the HubSpot `quote_status` dropdown.
- **UAT filter:** `uatTitlePrefix` in the dispatcher Settings. `v2` has it empty (all quotes sync). Do not set it again without asking. To test safely, use a copy, not the live workflow.
- **Timezone:** `netsuiteTimezone` is `Australia/Sydney`. NetSuite SuiteQL timestamps are compared in that zone.
- **Webhooks:** none in this client. If one is added, it needs header or basic auth.

## Importing
Sub-workflow first, then the dispatcher. Re-link credentials, re-select the sub-workflow in **Sync Each Quote** (reference ID `DFU30ofiXJopLQrm`, cached name "NetSuite Quote -> HubSpot Deal Lines v2"; IDs differ on another instance), set the Error Workflow on both, then publish. Exports ship `"active": false`.

## Instance facts
An export in this folder always wins over a recorded value here. Do not copy facts to or from other clients.

| Fact | Value |
|---|---|
| n8n version | UNKNOWN (ask) |
| Cloud or self-hosted | UNKNOWN (ask) |
| Error handler workflow ID | UNKNOWN (ask). Neither export sets `settings.errorWorkflow`; Save Watermark relies on one for alerts |
| Credential names (exact spelling) | `Netsuite JWT Auth account` (`jwtAuth`), `Plasson HubSpot` (`hubspotAppToken`) |
| Consultant access level | UNKNOWN (ask) |
| Workflow IDs | Dispatcher `Sbm5HvYBZ8U4NBiC`, sub-workflow `DFU30ofiXJopLQrm` (see `BUILD_RECORDS.md`) |

Confirmed on 2026-11-23 from the exports in `workflows/` (credential names, workflow IDs and errorWorkflow state only).

## Known validator findings (2026-11-23)
`python3 shared/tools/validate_workflow.py` on the current exports reports ERRORs that predate this repo and were deliberately **not** fixed, because the workflows run live and the fixes change behaviour risk:
- Dispatcher v2: `Sync Each Quote` uses `mode: each` (deprecated, removed in n8n 3.0; can hang the parent on multi-item runs from 2.16); `Query NetSuite Quotes` `jsonBody` has an unparenthesised object literal.
- Sub-workflow: `jsonBody` object literal not parenthesised in Get Quote Lines, Create Line Items, Archive Old Line Items, Update Deal.
- Warnings: no `settings.errorWorkflow` on either workflow; `retryOnFail` on Archive Old Line Items (a POST, but archiving is idempotent).
Raise these before touching the nodes. They are the likely cause of a failing `validate-n8n` check on this client's files.
