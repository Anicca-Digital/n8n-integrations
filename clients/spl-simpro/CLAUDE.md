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
| simpro-to-hubspot | [SPL] Simpro -> HubSpot (Real Time) | Webhook `POST /hubsput-upsert` only | **Create and link only, self-contained (rebuilt 2026-11-22).** A test record that is NOT yet in HubSpot is created and linked to the related records that already exist in HubSpot. No sub-workflows. See "Real Time" below |
| simpro-to-hubspot | [SPL] Simpro -> HubSpot Companies / Contacts / Sites / Quotes / Jobs Sync (5 files, `spl__simpro-hubspot-<type>-sync__v1.json`) | Every 30 min, staggered :00 / :05 / :10 / :15 / :20 | Batch replacement for the poll path of the Simpro -> HubSpot Scheduled Updates workflow. Each polls one record type and writes to HubSpot in batches of 100. See "Batch sync workflows" below. Ship unpublished |
| sub | [SPL] Check Simpro Test Record | Called by a workflow. Returns the Simpro record with `isTestRecord` |
| sub | [SPL] Upsert Company / Contact / Site / Quote / Job in HubSpot | Called by a workflow. Simpro record to HubSpot |
| sub | [SPL] Upsert Company / Contact / Site / Quote / Job in Simpro | Called by a workflow. HubSpot record to Simpro |

## Test-record rule
Simpro -> HubSpot only processes test records (set in the Workflow Config node):
- Contacts: email domain is `aniccadigital.io`, `spl.com` or `spl.com.au`.
- Everything else: name starts with `HS TEST - `.
- **Exception, Companies Sync (2026-11-22):** same rule as Real Time: company name starts with `HSTEST-` OR the company's own `Email` has the domain `aniccadigital.io` or `spl.com.au` (exact domain, case-insensitive). `HS TEST - ` no longer counts for companies in that workflow. Set in `Build Sync Window` (`testRecords.namePrefix` and `testRecords.orEmailDomains`; the optional `orEmailDomains` rule lives in the shared `Select Test Records` code and is off unless a workflow sets it).
- **Exception, Sites and Jobs Syncs (2026-11-22):** name starts with `HSTEST-` (any case; `HS TEST - ` no longer counts for sites or jobs in those workflows). Sites and jobs have no email of their own, so there is no email rule.
- **Exception, Quotes Sync (2026-11-22):** quote name starts with `HSTEST-` (any case; `HS TEST - ` no longer counts for quotes in that workflow). The Real Time workflow uses its own, different rule (name starts with `HSTEST-` OR email domain `aniccadigital.io` / `spl.com.au`, see the Real Time section). Companies, Sites, Jobs and Quotes syncs now use `HSTEST-` (Companies also the email rule). Only the Contacts sync still uses its own rule (email domain incl. `spl.com`, no name rule), so it disagrees with Real Time until aligned.
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
| Quote <-> Job association (HubSpot deals) | Custom label "Job" on the quote, inverse "Quote" on the job. Internal name `quote_job`, USER_DEFINED, association ID 11, 1-to-many (confirmed from HubSpot API details 2026-11-22). Used with the quote deal as the FROM side |
| Simpro job -> quote | The job carries `ConvertedFromQuote.ID` (also `ConvertedFrom` with `Type: "Quote"`), confirmed from a Simpro job payload 2026-11-22 |
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
- **Link ownership (agreed 2026-11-22), the child record owns its links:** Companies own none. Sites reconcile Site-Company and add-only Site-primary Contact. Contacts reconcile Contact-Company and add-only Contact-Site. Quotes and Jobs reconcile their Site, Contact and Company; their primary contact (`CustomerContact`) carries the **Decision Maker** label (ID 10) and `AdditionalContacts` are linked with no label (a contact that stops being primary is unlinked and re-linked without the label first, because the label allows one contact per deal; a primary that is already linked without a label gets the label added). Stale Contact-Site / Site-Contact links are therefore not removed automatically (the old router made the two fight).
- **Related record not in HubSpot yet:** that link is skipped and listed under `associations.warnings` in the Finish Run output. It is not created by the child's workflow. It heals when that record next changes.
- **Carried over unchanged:** the Quote mapping looks up both owner and project manager with `ProjectManager.ID` (as `[SPL] Upsert Quote in HubSpot` does). Raise with SPL before changing.
- **Cutover:** publish the five, unpublish the old Scheduled Updates workflow (otherwise records sync twice). Set `settings.errorWorkflow` on each (instance-specific ID).
- **Editing:** change a Code node here AND in `code-nodes/simpro-to-hubspot-sync/` (the file name says which node).

## Real Time: create and link only, self-contained (Simpro -> HubSpot, rebuilt 2026-11-22)
`[SPL] Simpro -> HubSpot (Real Time)` was rebuilt in place (same file, workflow ID, webhook path and ID `hubsput-upsert`, so Simpro's registered URL stays valid). **No sub-workflows:** it no longer calls `[SPL] Check Simpro Test Record` or any `[SPL] Upsert ... in HubSpot`. 22 nodes, one generic pipeline (was 114).
- **Pipeline:** `Simpro Webhook` -> `Workflow Config` (all settings, event -> record type + Simpro URL; unknown types end) -> `Log Event` -> `Get Simpro Record` -> `Select Test Record` (not a test record = stop) -> `Find in HubSpot` -> `Check Is New` (already there = stop) -> `Load SPL Users` -> `Build Create Request` -> `Create Record in HubSpot` -> then two branches: related lookups -> associations, and (quotes/jobs only) sections -> cost centers -> line items.
- **Trigger rule:** the event name does NOT matter (Simpro sends `created`, `updated`, `status`, ... e.g. `job.status`). Existence in HubSpot decides: found by its unique `simpro_*_id` = do nothing (the 30-min sync owns updates); not found = create and link.
- **Linking:** one batch read per related type, then batch associate / batch create. Related records not in HubSpot are skipped (listed in `skipped` and in the execution's custom data `skippedLinks`), never created or updated. Nothing is ever removed.
- **Quote and Job contacts:** the primary contact (`CustomerContact`) gets the HubSpot label **Decision Maker** (USER_DEFINED, ID 10); `AdditionalContacts` are linked with **no label**. A contact listed as both gets only the label.
- **Job -> Quote:** a new Job is linked to the quote it was converted from (`ConvertedFromQuote.ID`, or `ConvertedFrom` with `Type: Quote`) with the Job/Quote label (USER_DEFINED 11), quote deal as the FROM side. A quote not in HubSpot is skipped.
- **Contacts:** email and Simpro ID must match. One search covers both. A new contact whose email belongs to another HubSpot contact is not created or merged: the run fails with a clear message so the error workflow can alert. (The Contacts batch sync still adopts by email.)
- **Line items:** one per Simpro cost center, price = GST-exclusive `Total.ExTax`, batches of 100.
- **Test rule here (changed 2026-11-22, differs from the sync workflows):** a record is a test record if its NAME starts with `HSTEST-` OR its own email's domain is `aniccadigital.io` or `spl.com.au` (exact domain, case-insensitive), for every record type. `HS TEST - ` and `spl.com` no longer count in Real Time. Name = `Name` (sites, quotes, jobs), `CompanyName` (companies), `GivenName FamilyName` (contacts). Only a record's own `Email` is checked (contacts, companies); sites, quotes and jobs have none, so they match on name only. Settings are in `Workflow Config` (`testNamePrefix`, `testEmailDomains`).
- **Calls per event (simulated):** non-test record = 1 (Simpro). Test record already in HubSpot = 2. New site with a company and primary contact = 7. Code nodes live in `code-nodes/real-time-create/`.
- **Known limits:** two events for the same new record within seconds can both pass the existence check before HubSpot's search index updates; the second create is then rejected by the unique property (a failed run, no duplicate). If line items fail after the deal was created, the deal exists without them and a re-run will not add them; the Quotes/Jobs sync rebuilds them the next time that quote/job changes. The webhook still has NO authentication (known open finding, deliberately left; the CI validator reports it as an ERROR on this file).
- **No longer used by Real Time (left in place, safe to archive):** `[SPL] Check Simpro Test Record` and the five `[SPL] Upsert ... in HubSpot` sub-workflows. The old `[SPL] Simpro -> HubSpot (Scheduled Updates)` poller can no longer call Real Time (its trigger is gone) and must stay unpublished.
- **Applying it:** open the live Real Time workflow, select all, delete, import the file (keeps the same webhook), reconnect credentials, check `Load SPL Users` reads the SPL Users data table, set the Error Workflow, then publish.

## Amounts: GST-exclusive line items (Simpro -> HubSpot, 2026-11-22)
Quote and Job deals: `amount` is the Simpro `Total.ExTax` (always was). Line item `price` is now the cost center's GST-exclusive `Total.ExTax` (was `Total.IncTax`). Changed in the Quotes Sync, the Jobs Sync, `[SPL] Upsert Quote in HubSpot` and `[SPL] Upsert Job in HubSpot` (the last two are no longer used by Real Time, which now creates line items itself with the same ex-GST price).
- **KNOWN MISMATCH, deliberately not changed:** `[SPL] Upsert Quote in Simpro` and `[SPL] Upsert Job in Simpro` (HubSpot -> Simpro) still write a line item's price to Simpro as `Total: { IncTax: price }`. With ex-GST prices in HubSpot, syncing line items back would store an ex-GST amount as GST-inclusive. Keep the HubSpot -> Simpro line item sync off, or change those two nodes (needs a confirmed Simpro cost center `Total.ExTax` write) before using it.
- Existing HubSpot line items keep their old GST-inclusive prices until the deal is next rewritten by a sync run.
