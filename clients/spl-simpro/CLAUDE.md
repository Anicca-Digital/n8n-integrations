# SPL: HubSpot ↔ Simpro

Read this before editing anything in `clients/spl-simpro/`. Full detail is in `README.md` in this folder.

## Systems
- **HubSpot**: CRM (companies, contacts, Sites custom object `0-420`, Quote and Jobs deal pipelines, line items). Credential: `SPL Account` (HubSpot app token).
- **Simpro**: field-service system at `spl.simprosuite.com` (customers/companies, sites, contacts, quotes, jobs, cost centers). Credential: `SPL Simpro` (OAuth2).

## Folders (match the n8n project folders)
- `workflows/hubspot-to-simpro/`: HubSpot changes pushed into Simpro.
- `workflows/simpro-to-hubspot/`: Simpro changes pushed into HubSpot.
- `workflows/sub/`: sub-workflows (upserts) called by the routers.
- `code-nodes/hubspot-to-simpro-sync/` holds every Code node of the five HubSpot -> Simpro sync workflows; `code-nodes/hubspot-to-simpro-realtime/` those of the HubSpot -> Simpro Real Time workflow.
- `code-nodes/`: Code node JS extracted from workflows. `code-nodes/simpro-to-hubspot-sync/` holds every Code node of the five batch sync workflows (`common__*` are identical in all five, `<type>__*` are specific).

## Workflows
| Folder | Workflow | Trigger |
|---|---|---|
| hubspot-to-simpro | [SPL] HubSpot -> Simpro (Scheduled Updates) | Every 30 min. Polls HubSpot for changed Companies, Sites, Contacts, Quote and Job deals and calls the Real Time router for each |
| hubspot-to-simpro | [SPL] HubSpot-> Simpro (Real Time) | Webhook `POST /simpro-upsert` only | **Create only, companies / contacts / sites, self-contained (rebuilt 2026-11-22).** A test record that has no Simpro ID yet is created in Simpro and its ID saved on the HubSpot record. Deal events (quotes, jobs) are ignored. No sub-workflows. See "HubSpot -> Simpro Real Time" below |
| hubspot-to-simpro | [SPL] HubSpot -> Simpro Companies / Contacts / Sites / Quotes / Jobs Sync (5 files, `spl__hubspot-simpro-<type>-sync__v1.json`) | Every 30 min, staggered :02 / :07 / :12 / :17 / :22 | Batch replacement for the poll path of the HubSpot -> Simpro Scheduled Updates workflow. TEST MODE on. See "HubSpot -> Simpro sync workflows" below. Ship unpublished |
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
- **Links (changed 2026-11-22): every record is linked to EVERYTHING it relates to that already exists in HubSpot, add-only, whichever record was created first.** No link is ever removed, and links that already exist are left alone (each run reads the current links, so a second run writes nothing). Companies link their contacts and sites; Contacts their companies and sites; Sites their companies and primary contact; Quotes and Jobs their site, company and contacts (the primary contact `CustomerContact` carries the **Decision Maker** label, ID 10, and `AdditionalContacts` have no label; a contact that stops being primary is unlinked and re-linked without the label first, because the label allows one contact per deal; a primary already linked without a label gets the label added); **Jobs also link the quote they were converted from** (`ConvertedFromQuote`, label Job/Quote, USER_DEFINED 11, quote = FROM side). A link whose other end is not in HubSpot yet is skipped and listed, and is made as soon as both exist, because either side (for example the Companies sync, which lists its contacts and sites) adds it. Trade-off: outdated links are never cleaned up automatically. Line items are not part of linking (see Line items).
- **Related record not in HubSpot yet:** that link is skipped and listed under `associations.warnings` in the Finish Run output. It is not created by the child's workflow. It heals when that record next changes.
- **Quote margin (2026-11-27):** the Quotes sync also writes `estimate_net_margin` (Simpro `Totals.NettMargin.Estimate`), adopted from SPL's live copy of the workflow. Throws if a quote has no `Totals.NettMargin`.
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

## Job deal stage (Simpro -> HubSpot)
Job deals take the stage from the Simpro job Stage (Pending/Progress/Complete/Archived). **Override (2026-11-23):** if the job Status name is `Job Paid` or `Job Invoiced` (case/space-insensitive), the deal goes to stage `3783391733` regardless of Stage. Config: `stageInvoiced` + `invoicedStatuses` in the Jobs sync `Build Sync Window` and the Real Time `Workflow Config`.

## Amounts: GST-exclusive line items (Simpro -> HubSpot, 2026-11-22)
Quote and Job deals: `amount` is the Simpro `Total.ExTax` (always was). Line item `price` is now the cost center's GST-exclusive `Total.ExTax` (was `Total.IncTax`). Changed in the Quotes Sync, the Jobs Sync, `[SPL] Upsert Quote in HubSpot` and `[SPL] Upsert Job in HubSpot` (the last two are no longer used by Real Time, which now creates line items itself with the same ex-GST price).
- **KNOWN MISMATCH, deliberately not changed:** `[SPL] Upsert Quote in Simpro` and `[SPL] Upsert Job in Simpro` (HubSpot -> Simpro) still write a line item's price to Simpro as `Total: { IncTax: price }`. With ex-GST prices in HubSpot, syncing line items back would store an ex-GST amount as GST-inclusive. Keep the HubSpot -> Simpro line item sync off, or change those two nodes (needs a confirmed Simpro cost center `Total.ExTax` write) before using it.
- Existing HubSpot line items keep their old GST-inclusive prices until the deal is next rewritten by a sync run.

## HubSpot -> Simpro sync workflows (built 2026-11-22)
Five workflows replace the poll path of `[SPL] HubSpot -> Simpro (Scheduled Updates)` (that file and the HubSpot -> Simpro Real Time webhook router stay untouched). Companies :02/:32, Contacts :07/:37, Sites :12/:42, Quotes :17/:47, Jobs :22/:52 (dependency order, offset from the Simpro -> HubSpot syncs). Standalone, no sub-workflows, 16 to 34 nodes each. Each keeps its own watermark.
- **TEST MODE is ON** (`testOnly: true` in each `Build Sync Window`): only test records are sent to Simpro (name starts with `HSTEST-`, or the record's own email domain is `aniccadigital.io` / `spl.com.au`). Set it to `false` to send everything.
- **Which records:** changed in HubSpot since the window start (`hs_lastmodifieddate`, contacts `lastmodifieddate`), 200 per search page with all needed properties (no separate read per record). Quotes: pipeline `default`. Jobs: pipeline `2172954069`. Companies and Contacts: only those that already have a Simpro ID (`onlyAlreadyInSimpro`, as today, so HubSpot-only companies/contacts are never created in Simpro). Sites, Quotes, Jobs also create new records. Backfill / "all": set `windowStartOverride` (for example `2020-01-01T00:00:00Z`) for one run, then clear it.
- **Compare before write (stops the HubSpot <-> Simpro ping-pong):** records that already have a Simpro ID are read from Simpro first and only the differing fields are PATCHed; nothing differs = no call. New records (no Simpro ID) are POSTed, and the new ID is saved on the HubSpot record straight away (before links/line items) so a retry cannot create it twice. A record that is 404 in Simpro is reported, never re-created.
- **Needs a parent in Simpro:** Contacts are created under their company (must have a Simpro customer ID). Quotes and Jobs need their company and site to have Simpro IDs. If not, the record is skipped and listed in the run summary (`skippedDetails`); nothing is created half-linked. The quote/job contact is the one with the **Decision Maker** label (ID 10), else the first contact.
- **Links (all add-only):** Companies: their sites that have a Simpro ID are added to the Simpro customer (`PATCH customers/companies/{id}` with `Sites`, existing sites kept). Sites: customers are only ADDED (never removed); the primary contact is set only when Simpro has none (HubSpot has no notion of a single "primary" site contact). Contacts are created under their company. Quotes/Jobs: Customer, CustomerContact (the Decision Maker, else the first contact) and Site go in the record body. Not synced to Simpro: additional contacts and the quote <-> job link (no confirmed write format).
- **Quotes:** custom fields Tender Number / Tender Status / Vertical (35/36/49) are written only when they differ. The **Salesperson is only set when a quote is created, never updated**: the Simpro -> HubSpot quote mapping puts the project manager in `hubspot_owner_id` (carried-over quirk), so syncing it back would overwrite the real sales person. Jobs sync Salesperson and ProjectManager normally.
- **Line items -> cost centers (quotes and jobs):** compared with the Simpro cost centers of the quote/job (sections and cost centers are read first); changed ones are PATCHed, new ones are created in the deal's first section, and the Simpro ID + section are saved on the HubSpot line item. Price is the GST-EXCLUSIVE total (`costCenterTotalField: 'ExTax'`). Line items are never deleted in Simpro.
- **Companies:** the billing postcode is read from `billing_zip` (what the Simpro -> HubSpot sync writes) as well as `billing_postalcode`, so it is never blanked.
- **Throttle:** every Simpro call runs at most 5 per second. Simpro has no batch API, so Simpro writes are one call per record; everything on the HubSpot side is batched (100 per call).
- **Failures:** per-record failures do not stop the others; at the end the run fails (error workflow) and the window is NOT advanced, so the next run retries. Only a fully successful run advances the window.
- **Cutover:** publish the five, unpublish the old `[SPL] HubSpot -> Simpro (Scheduled Updates)` (otherwise records sync twice). Set `settings.errorWorkflow` on each.
- **Unverified on SPL's instance (simulated only), check on the first run:** Simpro accepts `Total.ExTax` when writing a cost center; one PATCH carrying both `Customers` and `PrimaryContact` on a site; the HTTP Request throttling option, the cron field and the Data Table "Return all" import intact.

## HubSpot -> Simpro Real Time: create only (rebuilt 2026-11-22)
`[SPL] HubSpot-> Simpro (Real Time)` was rebuilt in place (same file, workflow ID, webhook path `simpro-upsert` and webhook ID, so HubSpot's subscription URL stays valid). **No sub-workflows** (no more `[SPL] Upsert ... in Simpro`) and **no quote/job handling** (quotes and jobs are created in Simpro, not HubSpot): deal events end immediately. 22 nodes (was 40). The old `[SPL] Upsert Company/Contact/Site/Quote/Job in Simpro` sub-workflows are left in place, now unused.
- **Create only:** a record is created in Simpro only if it has NO Simpro ID yet; one that already has one is left alone (the 30-minute HubSpot -> Simpro syncs update it). The event type does not matter (creation, edit, ...).
- **Webhook payload:** HubSpot can send several events in one call; ALL are read (the old router read only the first), deduplicated, and read from HubSpot in batches (one read per record type). Deletions, deals, association-change events and anything without an `objectId` are ignored.
- **TEST MODE is ON** (`testOnly: true` in `Workflow Config`): only records whose name starts with `HSTEST-`, or whose own email domain is `aniccadigital.io` / `spl.com.au`, are created. Set it to `false` to create everything.
- **Per type:** Company: created as today. Contact: created UNDER its company, which must already have a Simpro customer ID, otherwise it is skipped and reported (`skippedDetails`), never created half-linked. Site: created, then linked to its associated companies that already have a Simpro ID, with a primary contact set from a HubSpot contact that already has a Simpro ID (one PATCH). Related records are never created.
- **Duplicates:** the new Simpro ID is saved on the HubSpot record straight after creation (before the site links), so a repeated webhook cannot create a record twice. Simpro creates are not retried automatically and are throttled to 5 per second.
- **Failures:** any failed call fails the run (error workflow) with the details at the end (`Report Result`); records that were created keep their saved IDs.
- **Known gap:** a contact whose company is created in the SAME webhook call (or not yet in Simpro) is skipped and reported, and the Contacts sync only updates contacts that already have a Simpro ID, so it is not created later. To heal this, set `onlyAlreadyInSimpro: false` in the Contacts sync (it will then create contacts whose company has a Simpro ID; test mode still applies).
- **Webhook:** still NO authentication in n8n (known open finding, deliberately left; HubSpot signs its calls, a signature check could be added later). The CI validator reports it as an ERROR on this file.
- **Applying it:** open the live HubSpot -> Simpro Real Time workflow, select all, delete, import the file (keeps the same webhook), reconnect credentials, set the Error Workflow, publish. Optionally remove the deal subscriptions from the HubSpot app (they are ignored here).
