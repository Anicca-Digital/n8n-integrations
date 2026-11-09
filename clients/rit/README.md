# RIT: Caterlink / HubSpot / Xero

n8n workflow exports for Rent It Today (RIT). Folders group workflows by trigger source. Client folder: `clients/rit/`.

```
clients/rit/
├── CLAUDE.md
├── BUILD_RECORDS.md
├── code-nodes/            # Code node JS extracted from the workflows
└── workflows/
    ├── caterlink/         # Triggered by Caterlink emails (PDF quote / delivery invoice)
    └── hubspot-xero/      # Triggered by HubSpot webhooks, writing to Xero
```

## Flow

1. Caterlink quote email → HubSpot contact, company, deal and line items.
2. Deal reaches Closed Won → HubSpot workflow calls `/create-asset` → Draft Xero fixed assets + items; assets ticked `asset_created`.
3. Caterlink delivery invoice email → matching HubSpot Assets get delivery date, price, serial number, manufacturer.
4. HubSpot deposit invoice → `/create-deposit-invoice` → Draft Xero invoice with deposit lines.
5. HubSpot ad hoc (initial) invoice → `/create-ad-hoc-invoice` → Draft Xero invoice, Draft bill, fixed assets moved to Registered.

## Workflows

| Folder | File | n8n name | Trigger |
|---|---|---|---|
| caterlink | `rit__caterlink-quote-to-hubspot__v1.json` | RIT - Caterlink Quote→ Create Contact/Company/Deal/Line Item | Outlook poll, `RIT Quote <n>.pdf` |
| caterlink | `rit__caterlink-delivery-invoice-asset-update__v1.json` | RIT - Caterlink Delivery Invoice → Asset Update | Outlook poll, first PDF |
| hubspot-xero | `rit__hubspot-asset-to-xero-fixed-asset__v1.json` | RIT - HubSpot Asset Created → Xero Fixed Asset Create | Webhook `/create-asset` |
| hubspot-xero | `rit__hubspot-deposit-to-xero-invoice__v1.json` | RIT - HubSpot Deposit → Xero Invoice Create | Webhook `/create-deposit-invoice` |
| hubspot-xero | `rit__hubspot-weekly-invoice-to-xero-sync__v1.json` | RIT - HubSpot Weekly Invoice → Xero Invoice Sync | Schedule, weekly 10:00 |
| hubspot-xero | `rit__hubspot-adhoc-to-xero-invoice__v1.json` | RIT - HubSpot Adhoc → Xero Invoice Create | Webhook `/create-ad-hoc-invoice` |


## Importing
Credentials must be re-linked after import. All six are exported with `active: true`; check before importing into a live instance.
