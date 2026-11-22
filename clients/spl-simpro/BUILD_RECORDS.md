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
**Test-record rule:** name starts with `HS TEST - `, except the Sites, Jobs and Quotes Syncs which use `HSTEST-` and the Companies Sync which uses `HSTEST-` OR own email domain `aniccadigital.io` / `spl.com.au`, like Real Time (SPL, 2026-11-22). Contacts: email domain `aniccadigital.io`, `spl.com`, `spl.com.au`.
**Trigger definition:** cron per workflow (`0,30` / `5,35` / `10,40` / `15,45` / `20,50`), If-Modified-Since window with 2 min overlap, first run looks back 35 min.
**Known findings and open items**
- First real run must confirm four assumptions that could only be simulated: (1) HubSpot batch upsert sets the unique ID property on create when `idProperty`/`id` is given and the property is not repeated in `properties`; (2) batch read by `idProperty` returns the just-written records; (3) v4 `associations/{from}/{to}/batch/read` returns `results[].from.id` + `to[].toObjectId`; (4) HTTP Request "Batching" (5 per 1000 ms), the Schedule Trigger cron field and Data Table "Return all" import with their values intact. Each failure mode is a loud error and does not advance the window.
- Stale Contact-Site / Site-Contact links are no longer removed automatically (see `CLAUDE.md`).
- The Quote workflow keeps the existing `ProjectManager.ID` lookup for both owner and project manager.


### 2a. Real Time webhook: create and link only, self-contained (rebuilt 2026-11-22)
Rebuilt in place (workflow ID, name, webhook path `hubsput-upsert` and webhook ID unchanged). 114 -> 22 nodes (plus 2 notes), zero sub-workflows (no more `[SPL] Check Simpro Test Record` or `[SPL] Upsert ... in HubSpot` calls). One generic pipeline; per-type behaviour lives in `Workflow Config` and `Build Create Request`. Validated (1 ERROR: the known unauthenticated webhook, left on purpose) and simulated end to end (26 scenarios). Not yet imported or run on SPL's instance.
- **Decisions (SPL, 2026-11-22):** link only to related records already in HubSpot; a contact's email and Simpro ID must match; leave webhook auth alone; quote/job primary contact = Decision Maker (USER_DEFINED 10), additional contacts no label; job linked to its quote with Job/Quote (USER_DEFINED 11, quote FROM).
- **Observed payload:** `{ID: "job.status", name: "Job", action: "status", reference: {companyID: 4, jobID: 474119, statusID: 56}}`. No `created` sample, so the workflow keys on "not in HubSpot yet", not the event name. Simpro job payload fields used: `ConvertedFromQuote.ID`, `CustomerContact.ID`, `AdditionalContacts[].ID`.
- **To confirm on the first real events:** (1) HubSpot search on `simpro_*_id` finds existing records; (2) Decision Maker ID 10 is accepted for deal -> contact in that direction (a 400 means the direction/ID is the other way round); (3) the Job/Quote label shows "Job" on the quote and "Quote" on the job (swap from/to in `build-associations.js` if reversed); (4) quotes carry `AdditionalContacts` like jobs do.
- **Test rule in Real Time (SPL, 2026-11-22):** name starts with `HSTEST-` OR the record's own email domain is `aniccadigital.io` or `spl.com.au`, for every record type (`testNamePrefix` / `testEmailDomains` in `Workflow Config`). The batch syncs still use their own rules (`HS TEST - `, contacts also `spl.com`, quotes `HSTEST-`), so they do not match Real Time.
