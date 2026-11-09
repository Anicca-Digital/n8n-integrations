# NWI: Deal Closed Won -> Business Central

| Workflow | Trigger | What it does |
|---|---|---|
| `[NWI] HubSpot Deal Closed Won -> BC (Dispatcher)` | HubSpot webhook `POST /webhook/nwi-hubspot-deal-closedwon` (header auth) | Keeps deals moved to `closedwon`, de-duplicates, runs the sub-workflow once per deal |
| `[NWI] Deal Closed Won -> BC Customer + Sales Order` | Called by the dispatcher | Loads deal + company + contact + line items. Company has `business_central_id`: update the BC customer. No ID: create the BC customer and write its number back. Then create the BC sales order (header + lines) and write its number to `bc_order_id` on the deal |

## Import order
1. Sub-workflow `nwi__deal-closedwon-to-bc__sales-order__v1.json`
2. Dispatcher `nwi__deal-closedwon-to-bc__dispatcher__v1.json` (then pick the sub-workflow in its Execute Workflow node)

## Safety rails
- Deal already has `bc_order_id`, or is not in pipeline `default` / stage `closedwon`: skipped.
- BC sales order is looked up by `externalDocumentNumber` = HubSpot deal ID before creating, so a re-run never creates a second order.
- Any line with no SKU, quantity or price fails the run before anything is written to BC.
- `business_central_id` that finds 0 or 2+ BC customers fails the run; no duplicate customer is created.
- No retries on the two create calls.
