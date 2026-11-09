# SPL: HubSpot ↔ Simpro

Read this before editing anything in `clients/spl-simpro/`. Full detail is in `README.md` in this folder.

## Systems
- **HubSpot**: CRM (companies, contacts, Sites custom object `0-420`, Quote and Jobs deal pipelines, line items). Credential: `SPL Account` (HubSpot app token).
- **Simpro**: field-service system at `spl.simprosuite.com` (customers/companies, sites, contacts, quotes, jobs, cost centers). Credential: `SPL Simpro` (OAuth2).

## Folders (match the n8n project folders)
- `workflows/hubspot-to-simpro/`: HubSpot changes pushed into Simpro.
- `workflows/simpro-to-hubspot/`: Simpro changes pushed into HubSpot.
- `workflows/sub/`: sub-workflows (upserts) called by the routers.
- `code-nodes/`: Code node JS extracted from workflows (empty for now).

## Workflows
| Folder | Workflow | Trigger |
|---|---|---|
| hubspot-to-simpro | [SPL] HubSpot -> Simpro (Scheduled Updates) | Every 30 min. Polls HubSpot for changed Companies, Sites, Contacts, Quote and Job deals and calls the Real Time router for each |
| hubspot-to-simpro | [SPL] HubSpot-> Simpro (Real Time) | Webhook `POST /simpro-upsert`, or called by the poller. Router to the Simpro upsert sub-workflows, links associations, sends deals to Quote or Job by pipeline |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot (Scheduled Updates) | Every 30 min. Polls Simpro (If-Modified-Since) for changed Customers, Sites, Contacts, Quotes, Jobs |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot (Real Time) | Webhook `POST /hubsput-upsert`, or called by the poller. Skips non-test records, routes to the HubSpot upserts, then syncs associations |
| sub | [SPL] Check Simpro Test Record | Called by a workflow. Returns the Simpro record with `isTestRecord` |
| sub | [SPL] Upsert Company / Contact / Site / Quote / Job in HubSpot | Called by a workflow. Simpro record to HubSpot |
| sub | [SPL] Upsert Company / Contact / Site / Quote / Job in Simpro | Called by a workflow. HubSpot record to Simpro |

## Test-record rule
Simpro -> HubSpot only processes test records (set in the Workflow Config node):
- Contacts: email domain is `aniccadigital.io`, `spl.com` or `spl.com.au`.
- Everything else: name starts with `HS TEST - `.
Do not loosen this without asking.

## Importing
Credentials must be re-linked after import. Sub-workflow references use n8n workflow IDs, so re-select them when importing into a different instance.
