# RIT Build Records

Resolved, instance-specific values for RIT builds. **Only RIT values belong here.** Never copy values from another client's records or from `shared/knowledge/05_Build_Records.md`. Leave a field empty until confirmed from RIT's own systems.

## 1. Caterlink / HubSpot / Xero
*Caterlink email + HubSpot → HubSpot / Xero. 5 workflows (see `workflows/`). Client: RIT. Instance: n8n Cloud, version UNKNOWN. Status: live (existing exports).*

**Workflow IDs** (from export `id`)
| Workflow | ID |
|---|---|
| RIT - Caterlink Quote→ Create Contact/Company/Deal/Line Item | `ChG0yvC0HYOsbkF7` |
| RIT - HubSpot Asset Created → Xero Fixed Asset Create | `a6u3OZCpcVRIOodW` |
| RIT - Caterlink Delivery Invoice → Asset Update | `AVfNbcFzjNq4EPEA` |
| RIT - HubSpot Deposit → Xero Invoice Create | `J9ZbnlctFRc4LPjS` |
| RIT - HubSpot Adhoc → Xero Invoice Create | `FrSreNi92cYxdSLW` |
| Shared error workflow | `GBIRaHZowF94O4cL` |

**HubSpot**: custom Assets object `2-217972099`; invoices `0-53`; Quote-created deal stage `3350251995`; association type IDs used: contact→company `931` (HUBSPOT_DEFINED), contact→deal `29` (USER_DEFINED).
**Xero**: tenant `1e9660fb-45a7-4a9b-9158-cc54c9e78f34`. Asset types: Legacy `df53318e-024d-4762-b99c-ac4fce94e910`, VIC `034b445f-23dd-4b76-a96c-15b9258bc612`, WA `73e83679-cfee-4a78-ab6b-587c271d24f4`. Invoice branding themes: deposit `d6390f4d-9d01-45e3-857f-65eac584f76d`, ad hoc / bill `294af06f-b8a6-4049-8420-763713693f3a`.
**Account codes**: deposits WA1106 / VIC1106 / 1106 (legacy); rental income WA5000 / VIC5000 / NSW5000; rental assets at cost WA1460 / VIC1460 / 1460.
**Webhooks**: `/create-asset`, `/create-deposit-invoice`, `/create-ad-hoc-invoice` (all no auth).
**Known findings and open items**: see `CLAUDE.md`.
