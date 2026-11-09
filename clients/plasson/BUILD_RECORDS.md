# Plasson Build Records

Resolved, instance-specific values for Plasson builds. **Only Plasson values belong here.** Never copy values from another client's records or from `shared/knowledge/05_Build_Records.md` (Anicca-internal). Leave a field empty until it is confirmed from Plasson's own systems.

---

## 1. NetSuite Quote → HubSpot Deal Lines
*NetSuite → HubSpot. 2 workflows: NetSuite Quote Dispatcher, NetSuite Quote -> HubSpot Deal Lines. Client: Plasson. Instance: UNKNOWN. Status: UAT (existing exports; dispatcher filtered to titles starting `HS-TEST-`).*

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
- Validator (2026-11-09): 6 ERRORs (5 unparenthesised `jsonBody` object literals, deprecated `mode: each`). Not yet fixed; needs a decision.
- `active: true` in both exports; no `settings.errorWorkflow` set.
- Dispatcher references the sub-workflow as "NetSuite Quote -> HubSpot Deal Lines v2" but the export is named without `v2`.
- UAT prefix `HS-TEST-` still active; go-live requires clearing it.
