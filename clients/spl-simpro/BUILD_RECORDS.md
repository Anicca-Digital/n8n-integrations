# SPL Build Records

Resolved, instance-specific values for SPL builds. **Only SPL values belong here.** Never copy values from another client's records or from `shared/knowledge/05_Build_Records.md` (Anicca-internal). Leave a field empty until it is confirmed from SPL's own systems.

Template (copy per automation):

```markdown
## <n>. <Automation name>
*<Source system> → <Destination system>. <N> workflows: <names>. Client: SPL. Instance: <version>. Status: built / tested / live.*

**Workflow IDs**
| Workflow | ID |
|---|---|

**<System A>** — resolved values
**<System B>** — resolved values
**Enum / option maps**
**Trigger definition**
**Known findings and open items**
```

---

## 1. HubSpot ↔ Simpro sync
*HubSpot ↔ Simpro. 15 workflows (see `workflows/`). Client: SPL. Instance: UNKNOWN. Status: live (existing exports).*

**Workflow IDs**
| Workflow | ID |
|---|---|
| (not recorded) | |

**HubSpot** — resolved values
**Simpro** — resolved values
**Enum / option maps**
**Trigger definition**
**Known findings and open items**
- Validator (2026-11-09) on the existing exports: 12 ERRORs. 10 sub-workflow Execute Workflow Triggers lack `inputSource: "passthrough"`; the two real-time router webhooks have no authentication. No workflow sets `settings.errorWorkflow`. Not yet fixed; needs a decision.


---

## 2. Simpro -> HubSpot batch sync (five workflows)
*Simpro -> HubSpot. 5 workflows: Companies, Contacts, Sites, Quotes, Jobs Sync (`workflows/simpro-to-hubspot/spl__simpro-hubspot-<type>-sync__v1.json`). Client: SPL. Instance: n8n 2.45.5 (v3 upgrade pending; Cloud vs self-hosted unconfirmed). Status: built, validated and simulated, NOT yet imported or run on SPL's instance.*

**Workflow IDs**
| Workflow | ID |
|---|---|
| (assigned at import; record here) | |

**HubSpot** (credential `SPL Account`, `hubspotAppToken`): unique-value ID properties `simpro_customer_id` (companies), `simpro_contact_id` (contacts), `simpro_site_id` (0-420), `simpro_quote_id`, `simpro_job_id` (deals), all confirmed unique 2026-11-22. Quote deals: pipeline `default`, stages 3788243436 (to be completed/overdue), `closedwon`, `closedlost`, 3788243437 (default); Simpro custom fields Tender Number 35, Tender Status 36, Vertical 49. Job deals: pipeline 2172954069, stages 3783391728 (pending/default), 3783391729 (progress), 3783391730 (complete), 3783391734 (archived). Values copied from the existing `[SPL] Upsert Quote/Job in HubSpot` workflows.
**Simpro** (credential `SPL Simpro`, OAuth2): `spl.simprosuite.com/api/v1.0`; company 4 for quotes and jobs (confirmed), 0 for customers, contacts, sites.
**Data table:** `SPL Users` (ID `eEgc6EYXSSxSkc8D`, columns `Simpro_ID`, `HubSpot_ID`), read once per run by Quotes and Jobs.
**Test-record rule:** name starts with `HS TEST - `, except the Quotes Sync which uses `HSTEST-` (SPL, 2026-11-22). Contacts: email domain `aniccadigital.io`, `spl.com`, `spl.com.au`.
**Trigger definition:** cron per workflow (`0,30` / `5,35` / `10,40` / `15,45` / `20,50`), If-Modified-Since window with 2 min overlap, first run looks back 35 min.
**Known findings and open items**
- First real run must confirm four assumptions that could only be simulated: (1) HubSpot batch upsert sets the unique ID property on create when `idProperty`/`id` is given and the property is not repeated in `properties`; (2) batch read by `idProperty` returns the just-written records; (3) v4 `associations/{from}/{to}/batch/read` returns `results[].from.id` + `to[].toObjectId`; (4) HTTP Request "Batching" (5 per 1000 ms), the Schedule Trigger cron field and Data Table "Return all" import with their values intact. Each failure mode is a loud error and does not advance the window.
- Stale Contact-Site / Site-Contact links are no longer removed automatically (see `CLAUDE.md`).
- The Quote workflow keeps the existing `ProjectManager.ID` lookup for both owner and project manager.


### 2a. Real Time webhook: create and link only (edited 2026-11-22)
Edited in place from the live export (real `Check Simpro Test Record` sub-workflow ID retained). Webhook path `hubsput-upsert` and webhook ID unchanged. 114 -> 60 nodes (webhook is the only trigger: `Receive Record` and `Merge` removed). Validated (1 ERROR: the known unauthenticated webhook, left on purpose) and simulated end to end (20 scenarios, including the Job -> Quote link: new/existing/non-test for every type, missing related records skipped, email conflict, search error). Not yet imported or run on SPL's instance.
- **Decisions (SPL, 2026-11-22):** link only to related records already in HubSpot; a contact's email and Simpro ID must match (no adopt-by-email in Real Time); leave webhook auth alone.
- **Observed payload:** `{ID: "job.status", name: "Job", action: "status", reference: {companyID: 4, jobID: 474119, statusID: 56}}`. No `created` sample was available, so the workflow keys on "not in HubSpot yet", not the event name.
- **To confirm on the first real events:** the HubSpot search on `simpro_*_id` finds existing records; the batch read by `idProperty` and batch associate respond as simulated.
- **Job -> Quote link (added 2026-11-22):** Simpro `ConvertedFromQuote.ID`; HubSpot label Job/Quote, association ID 11 (USER_DEFINED, `quote_job`), quote as FROM. Assumption to confirm on the first job: the label "Job" shows on the quote record and "Quote" on the job record. If reversed, swap FROM and TO in `job__build-associations.js`.
- **Line item price = `Total.ExTax` (2026-11-22, Simpro -> HubSpot only).** HubSpot -> Simpro cost center writes still use `IncTax`: see CLAUDE.md "Amounts" for the mismatch. Existing line items change the next time their deal is rewritten.
