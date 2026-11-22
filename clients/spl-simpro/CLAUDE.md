# SPL: HubSpot ↔ Simpro

Read this before editing anything in `clients/spl-simpro/`. Full detail is in `README.md` in this folder.

## Systems
- **HubSpot**: CRM (companies, contacts, Sites custom object `0-420`, Quote and Jobs deal pipelines, line items). Credential: `SPL Account` (HubSpot app token).
- **Simpro**: field-service system at `spl.simprosuite.com` (customers/companies, sites, contacts, quotes, jobs, cost centers). Credential: `SPL Simpro` (OAuth2).

## Folders (match the n8n project folders)
- `workflows/hubspot-to-simpro/`: HubSpot changes pushed into Simpro.
- `workflows/simpro-to-hubspot/`: Simpro changes pushed into HubSpot.
- `workflows/sub/`: sub-workflows (upserts) called by the routers.
- `code-nodes/`: Code node JS extracted from workflows. `code-nodes/simpro-to-hubspot-sync/` holds every Code node of the five batch sync workflows (`common__*` are identical in all five, `<type>__*` are specific).

## Workflows
| Folder | Workflow | Trigger |
|---|---|---|
| hubspot-to-simpro | [SPL] HubSpot -> Simpro (Scheduled Updates) | Every 30 min. Polls HubSpot for changed Companies, Sites, Contacts, Quote and Job deals and calls the Real Time router for each |
| hubspot-to-simpro | [SPL] HubSpot-> Simpro (Real Time) | Webhook `POST /simpro-upsert`, or called by the poller. Router to the Simpro upsert sub-workflows, links associations, sends deals to Quote or Job by pipeline |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot (Scheduled Updates) | Every 30 min. Polls Simpro (If-Modified-Since) for changed Customers, Sites, Contacts, Quotes, Jobs |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot (Real Time) | Webhook `POST /hubsput-upsert` only (the `Receive Record` trigger and `Merge` were removed 2026-11-22) | **Create and link only (edited 2026-11-22).** A test record that is NOT yet in HubSpot is created (via the existing Upsert sub-workflows) and linked to related records that already exist in HubSpot. Anything already in HubSpot is left alone (the 30-min sync updates it). See "Real Time: create and link only" below |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot Companies / Contacts / Sites / Quotes / Jobs Sync (5 files, `spl__simpro-hubspot-<type>-sync__v1.json`) | Every 30 min, staggered :00 / :05 / :10 / :15 / :20 | Batch replacement for the poll path of the Simpro -> HubSpot Scheduled Updates workflow. Each polls one record type and writes to HubSpot in batches of 100. See "Batch sync workflows" below. Ship unpublished |
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
| HubSpot Simpro ID properties | `simpro_customer_id` (companies), `simpro_contact_id` (contacts), `simpro_site_id` (Sites 0-420), `simpro_quote_id` and `simpro_job_id` (deals) are set to "require unique values" (confirmed by SPL 2026-11-22). The batch sync relies on this |
| Simpro company ID for Quotes and Jobs | 4 (confirmed by SPL 2026-11-22). Customers, Contacts and Sites use the shared company 0 |
| HubSpot automations on create/edit | None react to creates or edits (confirmed 2026-11-22) |

Credential names and errorWorkflow state confirmed on 2026-11-09 from the workflow exports in `clients/spl-simpro/workflows/`. Version and hosting updated 2026-11-11 (see above). Resolved IDs go in `BUILD_RECORDS.md`.

## Known validator findings (2026-11-09, existing exports)
`python3 shared/tools/validate_workflow.py` reports 12 ERRORs on the existing exports: 10 sub-workflow triggers missing `inputSource: "passthrough"`, and no authentication on the `/simpro-upsert` and `/hubsput-upsert` webhooks. Do not fix these as a side effect of another change; raise them first.

## n8n v3 readiness (2026-11-11)
Migration report `migration-report-v3-2026-11-11.csv` (instance 2.45.5): 25 workflows scanned, 0 affected. Four instance-level rules, checked against the exports:
- Compression node limits lowered: not used (no Compression or binary handling). No risk.
- SSRF blocks more IP ranges: not affected. All 116 HTTP Request nodes call public hosts only (`api.hubapi.com`, `spl.simprosuite.com`). Keep it that way; do not add private-IP or localhost URLs.
- Task runner timeout default 1 minute: low risk. 24 Code nodes, all small data-shaping JS with bounded loops and no network calls. Watch `Build Record List` in both Scheduled Updates workflows after upgrade if a run follows a long gap.
- Workflow import from URL removed: import by JSON file only (see README).
Not checked: workflow-level v3 changes (the CSV lists none). Open: confirm Cloud vs self-hosted and the upgrade date with the client.

## Batch sync workflows (Simpro -> HubSpot, built 2026-11-22)
Five workflows replace the poll path of `[SPL] Simpro -> HubSpot (Scheduled Updates)` (that file stays as is; the webhook `[SPL] Simpro -> HubSpot (Real Time)` router was edited, see below). Companies :00/:30, Contacts :05/:35, Sites :10/:40, Quotes :15/:45, Jobs :20/:50 (dependency order). Each keeps its own watermark.
- **Shape per run:** list changed IDs (If-Modified-Since) -> fetch details (5/s) -> test-record rule -> HubSpot batch upsert on the unique `simpro_*_id` (contacts: update found, upsert on email, create without email) -> read IDs back -> batch associations -> (Quotes/Jobs) rebuild line items from Simpro cost centers. Window advances only after a fully successful run.
- **Link ownership (agreed 2026-11-22), the child record owns its links:** Companies own none. Sites reconcile Site-Company and add-only Site-primary Contact. Contacts reconcile Contact-Company and add-only Contact-Site. Quotes and Jobs reconcile their Site, Contact and Company. Stale Contact-Site / Site-Contact links are therefore not removed automatically (the old router made the two fight).
- **Related record not in HubSpot yet:** that link is skipped and listed under `associations.warnings` in the Finish Run output. It is not created by the child's workflow. It heals when that record next changes.
- **Carried over unchanged:** the Quote mapping looks up both owner and project manager with `ProjectManager.ID` (as `[SPL] Upsert Quote in HubSpot` does). Raise with SPL before changing.
- **Cutover:** publish the five, unpublish the old Scheduled Updates workflow (otherwise records sync twice). Set `settings.errorWorkflow` on each (instance-specific ID).
- **Editing:** change a Code node here AND in `code-nodes/simpro-to-hubspot-sync/` (the file name says which node).

## Real Time: create and link only (Simpro -> HubSpot, edited 2026-11-22)
`[SPL] Simpro -> HubSpot (Real Time)` was edited in place (same file, same webhook path and ID `hubsput-upsert`, so Simpro's registered URL stays valid). It now only creates and links; the five sync workflows own updates.
- **Trigger rule:** the event name does NOT matter (Simpro sends `created`, `updated`, `status`, ... e.g. `job.status` with `action: "status"`). After the test-record gate, each type searches HubSpot for its unique `simpro_*_id`. Found -> do nothing (`Already In HubSpot - Skip`). Not found -> create it with the existing `[SPL] Upsert ... in HubSpot` sub-workflows (unchanged), then link it.
- **Linking:** one batch read of the related records by their unique Simpro ID, then one batch associate per link type. Related records that are not in HubSpot are skipped (listed under `skipped` in `Build ... Associations`), never created or updated. Nothing is ever removed.
- **Contacts:** the email and Simpro ID must match. If a new Simpro contact's email already belongs to another HubSpot contact (different or no `simpro_contact_id`) nothing is created or merged and the run fails with a clear message (`Report Email Conflict`) so the error workflow can alert. The Contacts batch sync still adopts by email; that behaviour was not changed.
- **Webhook is the only trigger.** `Receive Record` (the old poller's entry point) and `Merge` were removed, so the old `[SPL] Simpro -> HubSpot (Scheduled Updates)` workflow can no longer call this one: it must stay unpublished (the cutover step above).
- **Removed from this workflow:** the stale-link reconcile (archive) branches, the per-association GETs, the loops that upserted related records, and the Plan/Route nodes. Code nodes for the new steps are in `code-nodes/real-time-create/`.
- **Known limits:** two events for the same new record within seconds (e.g. created then status) can both pass the existence check before HubSpot's search index updates; the second create is then rejected by the unique property (a failed run, no duplicate). The webhook still has NO authentication (known open finding, deliberately left; the CI validator reports it as an ERROR on this file because the file changed).
- **Applying it:** open the live Real Time workflow, select all, delete, import the file (keeps the same webhook), re-select sub-workflows if asked, reconnect credentials, set the Error Workflow, then publish.
