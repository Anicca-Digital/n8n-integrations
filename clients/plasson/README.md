# Plasson: NetSuite → HubSpot

n8n workflow exports for the Plasson NetSuite Quote → HubSpot Deal Lines sync. Client folder: `clients/plasson/`.

```
clients/plasson/
├── CLAUDE.md
├── BUILD_RECORDS.md
├── code-nodes/          # Code node JS extracted from workflows
└── workflows/
    └── netsuite-to-hubspot/   # NetSuite quotes pushed into HubSpot deals
```

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| NetSuite Quote Dispatcher (`plasson__netsuite-quote-dispatcher__v1.json`) | Every 30 min | Gets a NetSuite OAuth2 M2M token (signed JWT, PS256), runs a SuiteQL query for the latest Estimate per opportunity changed since the watermark (plus parked quotes), calls the sub-workflow once per quote, then saves the watermark. Any failed quote holds the watermark so the next run retries |
| NetSuite Quote -> HubSpot Deal Lines (`plasson__netsuite-quote-to-hubspot-deal-lines__v1.json`) | Called by the dispatcher | Finds the HubSpot deal by quote number or NetSuite opportunity ID, maps the NetSuite status to `quote_status` and deal stage, replaces the deal's line items (create new, then archive old), then updates amount, status and stage. Deals not in the Existing Stockist pipeline, or not found, are skipped and parked for `parkDays` |

## Importing

In n8n: **Workflows → Import from File**, then re-link the credentials (`Netsuite JWT Auth account` JWT auth, `Plasson HubSpot` app token). The dispatcher's **Sync Each Quote** node references the sub-workflow by n8n workflow ID, so re-select it if you import into a different instance. Exports are committed with `pinData` removed (the original contained a live NetSuite access token).
