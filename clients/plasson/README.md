# Plasson: NetSuite → HubSpot (Phase 1)

n8n workflows that keep Plasson's HubSpot deals in step with NetSuite quotes. Every 30 minutes the dispatcher finds NetSuite quotes that changed, and for each one a sub-workflow updates the matching HubSpot deal: line items, amount, quote status and deal stage. Client folder: `clients/plasson/`. Branch history: `feat/plasson-phase-1`.

Direction is **NetSuite → HubSpot only**. Nothing is written back to NetSuite.

## Layout

```
clients/plasson/
├── CLAUDE.md                 # Rules and instance facts for Claude Code and contributors
├── README.md                 # This file
├── BUILD_RECORDS.md          # Resolved IDs and open items
├── code-nodes/               # Code node JS extracted from the dispatcher
│   ├── get-watermark.js
│   └── save-watermark.js
└── workflows/
    └── netsuite-to-hubspot/
        ├── plasson__netsuite-quote-dispatcher__v2.json                    # current dispatcher
        ├── plasson__netsuite-quote-to-hubspot-deal-lines__v1.json         # current sub-workflow
        └── archive/
            └── plasson__netsuite-quote-dispatcher__v1.json                # superseded UAT version
```

## Workflows

| Workflow | File | Trigger |
|---|---|---|
| NetSuite Quote Dispatcher | `plasson__netsuite-quote-dispatcher__v2.json` | Every 30 minutes |
| NetSuite Quote -> HubSpot Deal Lines | `plasson__netsuite-quote-to-hubspot-deal-lines__v1.json` | Called by the dispatcher, once per quote |

### Dispatcher

```
Schedule → Settings → Get Watermark → Sign NetSuite JWT → Get NetSuite Token
        → Query NetSuite Quotes → Split Out Quotes → Attach Token
        → Sync Each Quote (sub-workflow, once per quote) → Save Watermark
```

1. **Settings** holds every run setting: NetSuite account host and timezone, overlap, park days, `forceSince`, `uatTitlePrefix`, the NetSuite Client ID and Certificate ID.
2. **Get Watermark** (Code) works out where this pull starts: `forceSince`, else the saved `lastSuccessfulRun`, else 30 minutes before the first trigger. It subtracts `overlapMinutes` (10) and converts to NetSuite time (`Australia/Sydney`). It also lists up to 500 *parked* quote IDs (see below).
3. **Sign NetSuite JWT** and **Get NetSuite Token** do NetSuite's OAuth2 machine-to-machine login (signed JWT, PS256, 5-minute assertion). The token lasts 60 minutes and is passed to the sub-workflow.
4. **Query NetSuite Quotes** runs SuiteQL: Estimates that have an opportunity, changed since the watermark (or parked), and only the **latest quote per opportunity** (highest ID). Pages 1000 at a time, up to 50 requests. If `uatTitlePrefix` is set it also filters on the quote title.
5. **Sync Each Quote** runs the sub-workflow once per quote. A failing quote returns an error item and does not stop the others.
6. **Save Watermark** (Code) runs once all quotes are done. If any quote failed it throws, which **holds the watermark** so the next run retries, and raises an alert through the error workflow. Otherwise it saves the new watermark and updates the parked list.

**Parked quotes.** A quote with no matching HubSpot deal, or whose deal is not in the Existing Stockist pipeline, is *skipped*, not failed. It is parked and re-pulled every run for `parkDays` (14) so it syncs once the deal exists. After 14 days it is dropped.

### Sub-workflow: NetSuite Quote -> HubSpot Deal Lines

```
Trigger → Execution Data → Config → Search HubSpot Deal → Match Deal → Can Sync?
   ├─ no  → Stop: Cannot Sync (error)
   └─ yes → Deal In Stockist Pipeline?
        ├─ no  → Skip Quote (parked by the dispatcher)
        └─ yes → Get Quote Lines → Prepare Lines → Get Deal Line Items → Quote Has Lines?
             ├─ yes → Create Line Items → All Lines Created? ─ no → Stop: Create Failed
             │                                   └ yes ┐
             └─ no ────────────────────────────────────┴→ Deal Has Old Lines? → Archive Old Line Items
                                                                          └→ Update Deal → Finish
```

- **Deal matching:** by `netsuite_quote_number`, else by `netsuite_record_id` (the NetSuite opportunity ID). More than one match, or an unmapped NetSuite status, stops the quote with an error and writes nothing.
- **Status mapping:** the NetSuite status label is normalised (a `Lead -`, `Prospect -` or `Customer -` prefix and leading numbering are removed, case ignored) and looked up in `statusToStage` in the Config node. That gives a HubSpot `quote_status` and a deal stage.
- **Line items are replaced, not edited:** new lines are created first; only if all were created are the old lines archived. If creation fails, old lines stay and the next run retries.
- **Deal update is the last write:** `amount` (ex-GST subtotal of the lines), `quote_status`, `netsuite_quote_number`, and `dealstage`. The stage only moves when `quote_status` changed, so manual stage moves in HubSpot are kept.
- **Line mapping:** unit price = line amount ÷ quantity (ex GST); quantity and the subtotal are absolute values.

### Status → stage map

| HubSpot stage | NetSuite statuses |
|---|---|
| Quote Request Received | Proposal |
| Quoted | Quote Sent |
| Follow-up/Negotiation | In Discussion, In Negotiation, P&A, Store Set Up, Budget Pricing, Tooling, Tool Hire, Tender, Bulk Buy, Service, Renewal |
| Quote Closed Won | Purchasing, Closed - Partial Supply, Closed - Won |
| Quote Closed Lost | Closed - Lost, Lost - Price, Lost - Customer Lost Job, Lost - Lead Time, Lost - Unable Supply Full Request, Expired |

## Credentials

| Credential (exact name in n8n) | Type | Used by |
|---|---|---|
| `Netsuite JWT Auth account` | JWT Auth (PEM private key, PS256) | Dispatcher: Sign NetSuite JWT |
| `Plasson HubSpot` | HubSpot App Token (`hubspotAppToken`) | Sub-workflow: all HubSpot calls |

## Importing / deploying

Import order: **sub-workflow first, then dispatcher.**

1. Import `plasson__netsuite-quote-to-hubspot-deal-lines__v1.json` (n8n: **Workflows → Import from File**). Re-link `Plasson HubSpot`.
2. Import `plasson__netsuite-quote-dispatcher__v2.json`. Re-link `Netsuite JWT Auth account`.
3. In the dispatcher's **Sync Each Quote** node, re-select the sub-workflow you just imported (the reference is an n8n workflow ID).
4. Set the **Error Workflow** on both workflows (Settings → Error Workflow). Without it, a failed run raises no alert.
5. Check no node shows "credential not connected", then publish both workflows. Exports ship `"active": false`.

Importing onto a canvas that already has nodes appends and renames nodes. For a small change, edit in place; for a full replacement, select all, delete, then import.

## Go-live and operations

- **UAT vs live.** `v1` (archived) only synced quotes whose title starts with `HS-TEST-`. `v2` has `uatTitlePrefix` cleared, so **all quotes sync**. The first run starts from the saved watermark; if there isn't one, from 30 minutes before the first trigger. Set `forceSince` for a one-off re-pull from a given time (clear it afterwards).
- **Retries.** A failed run needs no manual cleanup: the watermark is held, and re-running is safe because lines are replaced and the deal is updated in place.
- **New NetSuite status.** The quote fails with "Unmapped NetSuite status". Add it to `statusToStage` in the sub-workflow Config node **and** to the HubSpot `quote_status` dropdown.
- **Duplicate deals.** If two HubSpot deals share a quote number, the quote fails until one is removed.
- **Workflow state.** The workflow state (watermark, parked quotes) lives in the dispatcher's workflow static data, which only updates on production (published) runs, not test runs.

## Known limitations

- Only the **latest** quote per NetSuite opportunity is synced.
- The sub-workflow reads up to 100 existing line items on a deal and creates new lines in one batch; a deal with more than 100 lines would need paging.
- When a run returns no changed quotes, Save Watermark does not run, so the watermark only advances on runs that process at least one quote. This is harmless (the overlap window just grows), but note it when reading the saved watermark.
- Validator findings on the exports are listed in `CLAUDE.md`.
