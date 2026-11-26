# Plasson Build Records

Resolved, instance-specific values for Plasson builds. **Only Plasson values belong here.** Never copy values from another client's records or from `shared/knowledge/05_Build_Records.md` (Anicca-internal). Leave a field empty until it is confirmed from Plasson's own systems.

---

## 1. NetSuite Quote → HubSpot Deal Lines
*NetSuite → HubSpot. 2 workflows: NetSuite Quote Dispatcher, NetSuite Quote -> HubSpot Deal Lines. Client: Plasson. Instance: UNKNOWN. Status: go-live version ready (dispatcher v2, UAT filter cleared). Import and publish pending.*

**Workflow IDs**
| Workflow | ID |
|---|---|
| NetSuite Quote Dispatcher | `Sbm5HvYBZ8U4NBiC` |
| NetSuite Quote -> HubSpot Deal Lines | `DFU30ofiXJopLQrm` |

**NetSuite** — resolved values
- Account: `6798253`; timezone `Australia/Sydney`
- Client ID and Certificate ID: in the dispatcher Settings node

**HubSpot** — resolved values
- Pipeline (Existing Stockist): `2107090401`
- Stage IDs: Quote Request Received `3645814253`, Quoted `3645814254`, Follow-up/Negotiation `3645814255`, Quote Closed Won `3645814258`, Quote Closed Lost `3645814259`

**Enum / option maps**
NetSuite status → `quote_status` → stage: see `statusToStage` in the sub-workflow Config node (21 statuses mapped to the 5 stages above).

**Trigger definition**
Dispatcher: schedule every 30 min; overlap 10 min; parked quotes re-pulled for 14 days.

**Known findings and open items**
- Validator: dispatcher v2 has 2 ERRORs (deprecated `mode: each`, one unparenthesised `jsonBody` literal); sub-workflow has 4 (unparenthesised `jsonBody` literals). Not fixed (live workflows); needs a decision. `validate-n8n` CI will flag them.
- Both exports now ship `active: false`; no `settings.errorWorkflow` set on either (manual step at import).
- Dispatcher references the sub-workflow as "NetSuite Quote -> HubSpot Deal Lines v2" but the export is named without `v2`.
- UAT prefix `HS-TEST-` is cleared in `plasson__netsuite-quote-dispatcher__v2.json`. `v1` (still filtered) is archived in `workflows/netsuite-to-hubspot/archive/`. Status moves to live once v2 is imported and published.
