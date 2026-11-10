# NWI: HubSpot ↔ Business Central

Read this before editing anything in `clients/nwi/`. Full detail is in `README.md` in this folder.

## Systems
- **HubSpot**: CRM (deals, companies, contacts, line items). Credential: `HubSpot Service Key account` (`hubspotAppToken`).
- **Business Central (BC)**: master for customers, quotes, inventory, finance. API v2.0. Credential: `Business Central – NWI Group (client credentials)` (`oAuth2Api`, client credentials grant). Name taken from a screenshot; the dash is an en dash.
- BC's native HubSpot connector already syncs Contacts and Products. Do not duplicate that.

## Folders
- `workflows/`: workflow JSON, one workflow per file.
- `code-nodes/`: Code node JS extracted from the workflows.

## Instance facts
Read these before building or editing. An export in this folder always wins over a recorded value here. Do not copy facts to or from other clients.

| Fact | Value |
|---|---|
| n8n version | UNKNOWN (ask). typeVersions authored against n8n 2.23 patterns, unverified on this instance |
| Cloud or self-hosted | UNKNOWN (ask) |
| Error handler workflow ID | UNKNOWN (ask) |
| Credential names (exact spelling) | BC: see above. HubSpot app token and webhook auth names are still placeholders |
| BC tenant ID | `0dc6b780-5b9e-4809-afb6-6bc499280f23` |
| BC environment | `Production` |
| BC company | `National Weighing & Instrument`, GUID `4b4f1461-9f6d-ea11-a813-000d3acaa8ce` (set in Workflow Config; found by running a GET on the BC companies endpoint) |
| Consultant access level | UNKNOWN (ask) |

Recorded 2026-11-09. No export from this instance exists yet.

## Decisions
- HubSpot -> n8n uses the native Webhooks API (HubSpot developer app), not Data Hub.
- Trigger: HubSpot webhook (developer platform project `nwi-bc-sync`, account nwi-group 443450748). Subscription property is set in the project's `webhooks-hsmeta.json`.
- One HubSpot contact = one BC customer. Contact property `business_central_id` holds the BC customer number. BC customer name = contact `company` property.
- Match on SKU: HubSpot line item `hs_sku` = BC item `number`.
- HubSpot properties: contact `business_central_id` (BC customer number), deal `bc_order_id` (BC sales order number).
