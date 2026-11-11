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

## Instance facts
Read these before building or editing. An export in this folder always wins over a recorded value here. Do not copy facts to or from other clients.

| Fact | Value |
|---|---|
| n8n version | 2.45.5 (from the n8n v3 migration report, synced 2026-11-11). Upgrade to v3 pending |
| Cloud or self-hosted | Probably Cloud: a pasted test payload in the Simpro -> HubSpot Real Time export shows host `spls.app.n8n.cloud`. Not confirmed, ask |
| Error handler workflow ID | UNKNOWN (ask). No existing workflow sets `settings.errorWorkflow` |
| Credential names (exact spelling) | `SPL Account` (HubSpot app token, `hubspotAppToken`), `SPL Simpro` (OAuth2) |
| Consultant access level | UNKNOWN (ask) |

Credential names and errorWorkflow state confirmed on 2026-11-09 from the workflow exports in `clients/spl-simpro/workflows/`. Version and hosting updated 2026-11-11 (see above). Resolved IDs go in `BUILD_RECORDS.md`.

## Known validator findings (2026-11-09)
`python3 shared/tools/validate_workflow.py` reports 12 ERRORs on the existing exports: 10 sub-workflow triggers missing `inputSource: "passthrough"`, and no authentication on the `/simpro-upsert` and `/hubsput-upsert` webhooks. Do not fix these as a side effect of another change; raise them first.

## n8n v3 readiness (2026-11-11)
Migration report `migration-report-v3-2026-11-11.csv` (instance 2.45.5): 25 workflows scanned, 0 affected. Four instance-level rules, checked against the exports:
- Compression node limits lowered: not used (no Compression or binary handling). No risk.
- SSRF blocks more IP ranges: not affected. All 116 HTTP Request nodes call public hosts only (`api.hubapi.com`, `spl.simprosuite.com`). Keep it that way; do not add private-IP or localhost URLs.
- Task runner timeout default 1 minute: low risk. 24 Code nodes, all small data-shaping JS with bounded loops and no network calls. Watch `Build Record List` in both Scheduled Updates workflows after upgrade if a run follows a long gap.
- Workflow import from URL removed: import by JSON file only (see README).
Not checked: workflow-level v3 changes (the CSV lists none). Open: confirm Cloud vs self-hosted and the upgrade date with the client.
