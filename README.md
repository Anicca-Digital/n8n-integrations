# spl

n8n workflow exports for the SPL HubSpot ↔ Simpro sync. The folders match the n8n project folders.

```
workflows/
├── hubspot-to-simpro/   # "HubSpot - Simpro" folder: HubSpot changes pushed into Simpro
├── simpro-to-hubspot/   # "Simpro - HubSpot" folder: Simpro changes pushed into HubSpot
└── sub/                 # "Sub" folder: sub-workflows called by the routers above
```

## Workflows

| Folder | Workflow | Trigger | What it does |
|---|---|---|---|
| hubspot-to-simpro | [SPL] HubSpot -> Simpro (Scheduled Updates) | Every 30 min | Polls HubSpot for changed Companies, Sites, Contacts, Quote and Job deals and runs the HubSpot -> Simpro (Real Time) router for each one |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot (Scheduled Updates) | Every 30 min | Polls Simpro (If-Modified-Since) for changed Customers, Sites, Contacts, Quotes and Jobs and runs the [SPL] Simpro -> HubSpot router for each one |
| sub | [SPL] Upsert Company in HubSpot | Called by a workflow | Simpro company customer → HubSpot company |
| sub | [SPL] Upsert Contact in HubSpot | Called by a workflow | Simpro contact → HubSpot contact |
| sub | [SPL] Upsert Job in HubSpot | Called by a workflow | Simpro job → HubSpot deal (Jobs pipeline) plus line items from cost centers |
| sub | [SPL] Upsert Company in Simpro | Called by a workflow | HubSpot company → Simpro company customer |
| sub | [SPL] Upsert Contact in Simpro | Called by a workflow | HubSpot contact → Simpro customer contact (upserts the company first) |
| sub | [SPL] Upsert Site in Simpro | Called by a workflow | HubSpot Site (0-420) → Simpro site |
| sub | [SPL] Upsert Quote in Simpro | Called by a workflow | HubSpot deal (Quote pipeline) → Simpro quote, custom fields (Tender Number, Tender Status, Vertical) and cost centers from line items |
| sub | [SPL] Upsert Job in Simpro | Called by a workflow | HubSpot deal (Jobs pipeline) → Simpro job plus cost centers from line items |

## Importing

In n8n: **Workflows → Import from File**, then re-link the credentials (`SPL Simpro` OAuth2, `SPL Account` HubSpot app token). Sub-workflow references use n8n workflow IDs, so re-select them if you import into a different instance.
