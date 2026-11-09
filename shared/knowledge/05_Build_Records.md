# Build Records

> **WARNING: Anicca-internal reference.** Every value in this file belongs to Anicca Digital's own instance and accounts. Never carry any ID, property name, credential name or URL from here into a client workflow. For client work, resolved values live only in `clients/<client>/BUILD_RECORDS.md`.

One block per delivered automation: the resolved, instance-specific values that build produced. Not general rules (those live in docs 01–03) — this is the lookup table for when someone next touches that workflow, or when an ID changes and you need to know where it's referenced.

Add a block at the end of every build. Anything resolved from a live system — IDs, internal property names, enum maps, model strings, flag names, workflow IDs — belongs in it.

These values belong to the client named in the block. Never carry them into another client's build.

## Block template

```markdown
## <n>. <Automation name>
*<Source system> → <Destination system>. <N> workflows: <names>. Client: <client>. Instance: <version>. Status: built / tested / live.*

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

## 1. Deal in Delivery → ClickUp Project

*HubSpot → ClickUp. Three workflows: HubSpot Delivery Dispatcher → Deal in Delivery -> ClickUp Project (per-deal sub-workflow) → Error Handler - Post to ClickUp (shared). Client: Anicca Digital. Instance: n8n 2.23.2. Built and live-tested.*

**HubSpot**

| Value | Resolved |
|---|---|
| Portal | 45466437 |
| Pipeline (Hubspot Services) | 125007463 |
| Delivery stage | 1084213066 — **not** 1327154479, which is a test pipeline's Delivery |
| Closed Won stage | 218953590 |
| Stage-entry property | `hs_v2_date_entered_1084213066` |
| Dedup flag property | `clickup_project_created` (checkbox) |

**ClickUp**

| Value | Resolved |
|---|---|
| Space | 90145570760 |
| Workspace / team | 9014564858 |
| #n8n-errors channel | 8cmynzu-10734 |

**Other**

- Gemini model: `gemini-3.5-flash-lite`
- Error Handler workflow ID (set as Error Workflow on the others): `QNYAnKuVfGkqyfFN`
- Dispatcher workflow ID: `H9xOm0tdZepfiFYm`

**Complexity map (HubSpot number → ClickUp dropdown option):** 1 Basic · 2 Standard · 3 Medium · 4 Advanced · 5 Custom · 6 N/A

**Package conditional hours — only these two get a workflow-set `time_estimate`:**

- "Data Migration" → Migration Hours
- "Developer Support Hours" → Dev Hours
- Every other package: left unset **deliberately** — a ClickUp automation supplies standard hours. Confirmed intentional; do not "fix" this.

**Cutover note:** the `hs_v2_date_entered_… >= now-14d` filter keeps the standing ~178-deal Delivery backlog out of scope. A handful fall inside the window — bulk-tick `clickup_project_created` on those before publishing if you don't want projects for them.

**Known open items on these files:**

1. Stale second credential on *Search HubSpot Deals* ("Zest HubSpot Private App" — a different client's app) and on *Set ClickUp Project Created Flag* ("Header Auth account" = the Gemini key). Inert but should be cleared.
2. Credential "Header Auth account" should be renamed to *Gemini API Key*.
3. The sub-workflow's Execute Workflow Trigger carries empty `parameters`. Fine while it runs, but re-importing this file into a fresh workflow would import it as a zero-field schema that silently drops every dispatched record. Set `inputSource: "passthrough"`.
4. *Dispatch Deal* in the original dispatcher used `mode: "each"` — deprecated and subject to the 2.16+ parent-stuck-in-Waiting regression. The FIXED file uses the Loop Over Deals wiring instead.
5. Residual question: *Update Master Task Status* sits as the last single-item step, before the package fan-out — so the ClickUp automation it triggers fires before the package sub-tasks exist. Fine if that automation only reads master-task fields; verify it doesn't depend on the children.

---

## 2. Deal Closed → Xero Invoices

*HubSpot → Xero. Two workflows: HubSpot Invoice Dispatcher → Deal Closed -> Xero Invoices (per-deal sub-workflow). Shares Error Handler - Post to ClickUp. Client: Anicca Digital. Instance: n8n 2.23.2. Built, tested, published.*

**Workflow IDs**

| Workflow | ID |
|---|---|
| HubSpot Invoice Dispatcher | 5dlltwu9OMUTAtlM |
| Deal Closed → Xero Invoices | g8E66Ah2gzQxlwQZ |
| Error Workflow (both) | QNYAnKuVfGkqyfFN ✅ set on both |

**Xero**

| Value | Resolved |
|---|---|
| Tenant | 79581a8c-f208-446f-8488-063908ffa92d (Anicca Digital Pty Ltd) |
| Credential | Anicca Xero App Auth (`xeroOAuth2Api`, Web app flow) — carries the token, **not** the tenant; send `xero-tenant-id` as a header |
| Scopes | `accounting.contacts`, `accounting.transactions` |
| API base | `https://api.xero.com/api.xro/2.0` |
| Invoice type / status | `ACCREC` / `DRAFT` (raised as drafts — confirmed intentional) |
| Line amount types | `Exclusive` (amounts exclude GST; Xero adds it) |
| Tax type | `OUTPUT` (AU "GST on Income") |
| Sales account ID | 7e7c5371-462d-4f6d-87a0-613a03c5e8ad ("Sales"). `salesAccountCode` is blank and, if set, is used instead |
| Item code | `Tailored Transformation` (the human-readable code — Xero's API won't accept the item GUID) |

**Invoice dating** — Xero applies no Invoice Settings or per-contact terms via the API, so both dates are set explicitly.

- Timezone anchor: `Australia/Sydney` (Cloud Run is UTC; an early-morning AEST run would otherwise date yesterday)
- Payment 1: issue date +7 days; each later payment +14 days
- Computed as `issue + firstTerm + interval × (n−1)` — i.e. 7 / 21 / 35 — derived from the issue date, not accumulated, so a retry creating only payment 3 still lands on the right date

**HubSpot properties** (the `P` map, defined once in the dispatcher and passed with each deal)

| Purpose | Internal name |
|---|---|
| Deal name / record ID / amount | `dealname` · `hs_object_id` · `amount` |
| Number of Payments (Invoice) | `number_of_payments` |
| Organisation (Invoice) | `organisation__invoice_` |
| Finance Email (Invoice) | `finance_email__invoice_` |
| Qwilr Signee Email (Invoice) | `qwilr_signee_email__invoice_` |
| Statement of Work link | `statement_of_work_link` |
| Invoices created (reconciliation list) | `xero_invoices_created` |
| Completion flag (dispatcher filter only) | `xero_invoicing_complete` — the worker never trusts it; it recomputes from the list |

**Trigger** — poll every 30 min; stage IN [Closed Won `218953590`, Delivery `1084213066`] (pipeline `125007463`), Amount > 0, Close Date within the last 3 days and not future, completion flag NEQ true OR NOT_HAS_PROPERTY.

**Known finding:** the Delivery half of the trigger is near-dead — Close Date is stamped at Closed Won, so of 182 Delivery deals exactly one fell inside the 3-day window, and Closed Won catches the deal first anyway. If it's meant as a safety net, filter on `hs_v2_date_entered_<stageId>` instead.

**Discrepancy to fix:** the dispatcher's sticky note says it polls "every 15 min", but the Schedule Trigger is set to 30. Harmless today, but the note is what the next person reads.

**What this build fixed vs. the ClickUp dispatcher it was copied from:** no stale second credential, Error Workflow set on both workflows, and forward-compatible dispatch wiring (Loop Over Deals batch-1 with `reset: false` → Dispatch Deal in run-once-with-all-items, wired back into the loop) instead of the deprecated `mode: "each"`.
