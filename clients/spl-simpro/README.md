# SPL: HubSpot ↔ Simpro

n8n workflow exports for the SPL HubSpot ↔ Simpro sync. The folders match the n8n project folders. Client folder: `clients/spl-simpro/`.

```
clients/spl-simpro/
├── CLAUDE.md
├── code-nodes/          # Code node JS extracted from workflows (empty for now)
└── workflows/
    ├── hubspot-to-simpro/   # "HubSpot - Simpro" folder: HubSpot changes pushed into Simpro
    ├── simpro-to-hubspot/   # "Simpro - HubSpot" folder: Simpro changes pushed into HubSpot
    └── sub/                 # "Sub" folder: sub-workflows called by the routers above
```

## Workflows

| Folder | Workflow | Trigger | What it does |
|---|---|---|---|
| hubspot-to-simpro | [SPL] HubSpot -> Simpro (Scheduled Updates) | Every 30 min | Polls HubSpot for changed Companies, Sites, Contacts, Quote and Job deals and runs the HubSpot -> Simpro (Real Time) router for each one |
| hubspot-to-simpro | [SPL] HubSpot-> Simpro (Real Time) | Webhook `POST /simpro-upsert`, or called by the HubSpot poller | Router: routes Site / Company / Contact / Deal events to the Simpro upsert sub-workflows, links associations, and sends deals to Quote or Job by pipeline |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot (Real Time) | Webhook `POST /hubsput-upsert` only | Create and link only: a test record that is not yet in HubSpot is created and linked to the related records that already exist in HubSpot. Existing records are left alone (the sync workflows update them) |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot (Scheduled Updates) | Every 30 min | Polls Simpro (If-Modified-Since) for changed Customers, Sites, Contacts, Quotes and Jobs and runs the [SPL] Simpro -> HubSpot router for each one |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot Companies Sync | Every 30 min (:00, :30) | Changed Simpro company customers -> HubSpot companies, in batches of 100 (upsert on `simpro_customer_id`). Test records only |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot Contacts Sync | Every 30 min (:05, :35) | Changed contacts -> HubSpot contacts (update found, upsert on email, create without email). Links contact-company (reconcile) and contact-site (add-only) |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot Sites Sync | Every 30 min (:10, :40) | Changed sites -> HubSpot Sites (0-420). Links site-company (reconcile) and primary contact (add-only) |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot Quotes Sync | Every 30 min (:15, :45) | Changed quotes -> HubSpot deals (Quote pipeline) with site/contact/company links reconciled and line items rebuilt from cost centers, all batched |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot Jobs Sync | Every 30 min (:20, :50) | Same for jobs (Jobs pipeline) |
| sub | [SPL] Check Simpro Test Record | Called by a workflow | Gate for Simpro -> HubSpot (Real Time): fetches the Simpro record behind the event and returns it with `isTestRecord`: Contacts = email domain is aniccadigital.io, spl.com or spl.com.au; everything else = name starts with `HS TEST - ` (both set in Workflow Config) |
| sub | [SPL] Upsert Company in HubSpot | Called by a workflow | Simpro company customer → HubSpot company |
| sub | [SPL] Upsert Contact in HubSpot | Called by a workflow | Simpro contact → HubSpot contact |
| sub | [SPL] Upsert Site in HubSpot | Called by a workflow | Simpro site → HubSpot Site (0-420) |
| sub | [SPL] Upsert Quote in HubSpot | Called by a workflow | Simpro quote → HubSpot deal (Quote pipeline, stage from quote status) plus line items from cost centers |
| sub | [SPL] Upsert Job in HubSpot | Called by a workflow | Simpro job → HubSpot deal (Jobs pipeline) plus line items from cost centers |
| sub | [SPL] Upsert Company in Simpro | Called by a workflow | HubSpot company → Simpro company customer |
| sub | [SPL] Upsert Contact in Simpro | Called by a workflow | HubSpot contact → Simpro customer contact (upserts the company first) |
| sub | [SPL] Upsert Site in Simpro | Called by a workflow | HubSpot Site (0-420) → Simpro site |
| sub | [SPL] Upsert Quote in Simpro | Called by a workflow | HubSpot deal (Quote pipeline) → Simpro quote, custom fields (Tender Number, Tender Status, Vertical) and cost centers from line items |
| sub | [SPL] Upsert Job in Simpro | Called by a workflow | HubSpot deal (Jobs pipeline) → Simpro job plus cost centers from line items |

## Importing

In n8n: **Workflows → Import from File**, then re-link the credentials (`SPL Simpro` OAuth2, `SPL Account` HubSpot app token). Sub-workflow references use n8n workflow IDs, so re-select them if you import into a different instance.

n8n v3 removes import from URL, so always import from a JSON file.

## n8n v3 readiness

Checked 2026-11-11 against the v3 migration report (instance on 2.45.5): 0 of 25 workflows affected, and none of the four instance rules apply to these exports (no Compression nodes, only public HTTP hosts, small Code nodes, no URL import). Details and open items are in `CLAUDE.md`.

## Batch sync workflows (Simpro -> HubSpot)

`spl__simpro-hubspot-{companies,contacts,sites,quotes,jobs}-sync__v1.json` replace the poll path of `[SPL] Simpro -> HubSpot (Scheduled Updates)`. They are standalone (no sub-workflow calls), write to HubSpot in batches of 100, run staggered in dependency order, and each keeps its own watermark. Their Code nodes live in `code-nodes/simpro-to-hubspot-sync/`. Behaviour, link ownership and caveats are in `CLAUDE.md`.

Before publishing: connect the `SPL Simpro` and `SPL Account` credentials on every node and confirm no "not connected" warning remains, set the Error Workflow, check `Load SPL Users` (Quotes, Jobs) reads the SPL Users data table, publish the five, then **unpublish** the old Scheduled Updates workflow.
