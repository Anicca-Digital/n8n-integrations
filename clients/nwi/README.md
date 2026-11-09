# NWI: Deal Closed Won -> Business Central

One workflow: `[NWI] HubSpot Deal Closed Won -> BC Customer + Sales Order` (`workflows/nwi__deal-closedwon-to-bc__v1.json`).

**Trigger:** HubSpot webhook `POST /webhook/nwi-hubspot-deal-closedwon` (header auth), real time, one execution per deal. HubSpot subscription: Deal property `closed_won`.

**What it does:** loads the deal, its company, contact and line items. Company has `business_central_id`: update the BC customer. No ID: create the BC customer and write its number back to the company. Then create the BC sales order (header + lines) and write its number to `bc_order_id` on the deal.

## Safety rails
- Event is not `closed_won` -> `true` (e.g. un-tick): execution ends quietly.
- A webhook call carrying more than one closed-won deal fails loudly (this workflow handles one deal per run).
- Deal already has `bc_order_id`, is not in pipeline `default`, or `closed_won` is not ticked: skipped.
- BC sales order is looked up by `externalDocumentNumber` = HubSpot deal ID before creating, so a re-run never creates a second order.
- Any line with no SKU, quantity or price fails the run before anything is written to BC.
- `business_central_id` that finds 0 or 2+ BC customers fails the run; no duplicate customer is created.
- No retries on the two create calls.
