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
| sub | [SPL] Upsert Contact in HubSpot | Called by a workflow | Simpro contact → HubSpot contact |
| sub | [SPL] Upsert Job in HubSpot | Called by a workflow | Simpro job → HubSpot deal (Jobs pipeline) plus line items from cost centers |
| sub | [SPL] Upsert Contact in Simpro | Called by a workflow | HubSpot contact → Simpro customer contact |
| sub | [SPL] Upsert Job in Simpro | Called by a workflow | HubSpot deal → Simpro job plus cost centers from line items |

## Importing

In n8n: **Workflows → Import from File**, then re-link the credentials (`SPL Simpro` OAuth2, `SPL Account` HubSpot app token). Sub-workflow references use n8n workflow IDs, so re-select them if you import into a different instance.
