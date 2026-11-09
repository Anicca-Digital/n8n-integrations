# NWI: HubSpot ↔ Business Central

Read this before editing anything in `clients/nwi/`. Full detail is in `README.md` in this folder.

## Systems
- **HubSpot**: CRM (deals, companies, contacts, line items). Credential: `NWI HubSpot App Token` (`hubspotAppToken`) - PLACEHOLDER name, confirm.
- **Business Central (BC)**: master for customers, quotes, inventory, finance. API v2.0. Credential: `NWI Business Central OAuth2` (`oAuth2Api`) - PLACEHOLDER name, confirm.
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
| Credential names (exact spelling) | UNKNOWN. Placeholders above |
| BC tenant / environment / company ID | UNKNOWN (placeholders `REPLACE_*` in the Workflow Config node) |
| Consultant access level | UNKNOWN (ask) |

Recorded 2026-11-09. No export from this instance exists yet.

## Decisions
- HubSpot -> n8n uses the native Webhooks API (HubSpot developer app), not Data Hub.
- Match on SKU: HubSpot line item `hs_sku` = BC item `number`.
- HubSpot properties: company `business_central_id` (BC customer number), deal `bc_order_id` (BC sales order number).
