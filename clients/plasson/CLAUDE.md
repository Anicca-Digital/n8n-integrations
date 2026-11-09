# Plasson: NetSuite → HubSpot

Read this before editing anything in `clients/plasson/`. Full detail is in `README.md` in this folder.

## Systems
- **NetSuite**: account `6798253`, SuiteTalk REST + SuiteQL, OAuth2 machine-to-machine (JWT client assertion, PS256). Credential: `Netsuite JWT Auth account` (`jwtAuth`, PEM private key). Client ID and Certificate ID are set in the dispatcher's Settings node.
- **HubSpot**: deals in the Existing Stockist pipeline (`2107090401`), line items. Credential: `Plasson HubSpot` (HubSpot app token, `hubspotAppToken`). Custom deal properties: `netsuite_quote_number`, `netsuite_record_id`, `quote_status`. Custom line item property: `netsuite_line_id`.

## Folders
- `workflows/netsuite-to-hubspot/`: NetSuite quote changes pushed into HubSpot.
- `code-nodes/`: Code node JS extracted from the dispatcher (`get-watermark.js`, `save-watermark.js`). The workflow JSON is the source of truth; keep them in sync.

## Workflows
| Workflow | Trigger |
|---|---|
| NetSuite Quote Dispatcher | Every 30 min. Token, SuiteQL pull since watermark, one sub-workflow run per quote, then save watermark |
| NetSuite Quote -> HubSpot Deal Lines | Called by the dispatcher. Match deal, map status to stage, replace line items, update deal |

## Rules
- The watermark and parked quotes live in the dispatcher's workflow static data. Get Watermark and Save Watermark must stay Code nodes.
- Any failed quote must hold the watermark. Do not change this.
- Create Line Items must not retry (a retry could duplicate lines). Old lines are archived only after all new lines are created.
- Status → stage mapping lives in the sub-workflow's Config node (`statusToStage`). A new NetSuite status must be added there and to the HubSpot `quote_status` dropdown.
- UAT filter: the dispatcher's `uatTitlePrefix` (currently `HS-TEST-`) limits sync to quotes whose title starts with it. Clearing it is the go-live step. Do not clear it without asking.
- The dispatcher is cloud-time sensitive: `netsuiteTimezone` is `Australia/Sydney`.

## Importing
Credentials must be re-linked after import. Sub-workflow reference uses an n8n workflow ID (`DFU30ofiXJopLQrm`, cached name "NetSuite Quote -> HubSpot Deal Lines v2"), so re-select it when importing into a different instance.

## Instance facts
An export in this folder always wins over a recorded value here. Do not copy facts to or from other clients.

| Fact | Value |
|---|---|
| n8n version | UNKNOWN (ask) |
| Cloud or self-hosted | UNKNOWN (ask) |
| Error handler workflow ID | UNKNOWN (ask). Neither export sets `settings.errorWorkflow`, but the dispatcher's Save Watermark relies on an error workflow for alerts |
| Credential names (exact spelling) | `Netsuite JWT Auth account` (`jwtAuth`), `Plasson HubSpot` (`hubspotAppToken`) |
| Consultant access level | UNKNOWN (ask) |

Confirmed on 2026-11-09 from the exports in `clients/plasson/workflows/` (credential names and errorWorkflow state only). Resolved IDs go in `BUILD_RECORDS.md`.

## Known validator findings (2026-11-09)
`python3 shared/tools/validate_workflow.py` reports 6 ERRORs on the existing exports: 5 `jsonBody` expressions with an unparenthesised object literal (Query NetSuite Quotes, Get Quote Lines, Create Line Items, Archive Old Line Items, Update Deal) and Sync Each Quote using deprecated `mode: each`. Do not fix these as a side effect of another change; raise them first.

## Secrets
The original sub-workflow export contained a live NetSuite bearer token in `pinData`. It was stripped before commit and the token expires after 60 min, but the person who exported it should be told. Never commit `pinData` from this client without checking it.
