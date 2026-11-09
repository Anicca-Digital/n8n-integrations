# RIT: Caterlink / HubSpot / Xero

Read this before editing anything in `clients/rit/`. Full detail is in `README.md` in this folder.

## Systems
- **HubSpot**: CRM (contacts, companies, deals, line items, invoices `0-53`, custom Assets object `2-217972099`). Credential: `RIT HubSpot` (HubSpot app token).
- **Xero**: accounting (contacts, invoices, bills, inventory items, Fixed Assets API). Credentials: `RIT Xero` (Xero OAuth2, n8n Xero nodes) and `Xero Additional Scope` (generic OAuth2, used for Assets API and raw Xero calls).
- **Microsoft Outlook**: inbound email triggers. Credentials: `Quote Email Connector`, `Invoice Email Connector`.
- **Caterlink**: supplier. Sends quote and delivery-invoice PDFs by email.

## Folders
- `workflows/caterlink/`: workflows driven by Caterlink emails (quote PDF, delivery invoice PDF).
- `workflows/hubspot-xero/`: workflows driven by HubSpot webhooks that write to Xero.
- `code-nodes/`: Code node JS extracted from the workflows, named `<workflow-file>__<node-slug>.js`. The JSON is still the source of truth for import; keep both in step.

## Workflows
| Folder | File | Trigger |
|---|---|---|
| caterlink | `rit__caterlink-quote-to-hubspot__v1.json` | Outlook poll (every minute), PDF named `RIT Quote <n>.pdf`. Creates contact, company, deal and line items |
| caterlink | `rit__caterlink-delivery-invoice-asset-update__v1.json` | Outlook poll (every minute), first PDF. Updates HubSpot Assets by PO / contract number |
| hubspot-xero | `rit__hubspot-asset-to-xero-fixed-asset__v1.json` | Webhook `POST /create-asset` (deal Closed Won). Creates Draft Xero fixed assets and items |
| hubspot-xero | `rit__hubspot-deposit-to-xero-invoice__v1.json` | Webhook `POST /create-deposit-invoice`. Draft Xero invoice with security deposit lines |
| hubspot-xero | `rit__hubspot-adhoc-to-xero-invoice__v1.json` | Webhook `POST /create-ad-hoc-invoice`. Draft Xero invoice, plus a bill and registered fixed assets |

| hubspot-xero | `rit__hubspot-weekly-invoice-to-xero-sync__v1.json` | Schedule Trigger, weekly at 10:00. Creates Weekly invoices in HubSpot, then Draft invoices in Xero. Duplicate check window = start of trigger day to one minute before the next run (from the trigger timestamp, set in `Workflow Config`) |

## Instance facts
An export in this folder always wins over a recorded value here. Do not copy facts to or from other clients.

| Fact | Value |
|---|---|
| n8n | Cloud, `rentittoday.app.n8n.cloud` |
| n8n version | UNKNOWN (ask) |
| Error handler workflow ID | `GBIRaHZowF94O4cL` (set as `settings.errorWorkflow` on all five) |
| Credential names (exact spelling) | `RIT HubSpot`, `RIT Xero`, `Xero Additional Scope`, `Quote Email Connector`, `Invoice Email Connector` |
| Xero tenant ID | `1e9660fb-45a7-4a9b-9158-cc54c9e78f34` (hardcoded in nodes) |
| Consultant access level | UNKNOWN (ask) |

Confirmed 2026-11-09 from the exports in `clients/rit/workflows/`.

## Known validator findings (2026-11-09)
`python3 shared/tools/validate_workflow.py clients/rit/workflows/*/*.json` reports 6 ERRORs on the existing exports:
- 3 HubSpot webhooks (`create-asset`, `create-deposit-invoice`, `create-ad-hoc-invoice`) have no authentication.
- `fanout-first` on `Raise Error` (Quote, Delivery Invoice) and `Plan Asset Updates` (Delivery Invoice).
Do not fix these as a side effect of another change; raise them first.

## Things to raise (not fixed here)
- Adhoc workflow's `Build Xero Bill Line Items Payload` references `Build Xero Line Items Payload`, which is not upstream on every path.
- Adhoc and Deposit use one HubSpot webhook ID `e1933c07-45c4-45ac-9d49-af3d431c188f` in both exports; check this is not a copy/paste clash.
- Pinned data in the exports contains staff email addresses and sample HubSpot/Xero IDs.
