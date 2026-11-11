# NWI: Deal Closed Won -> Business Central

One workflow: `[NWI] HubSpot Deal Closed Won -> BC Customer + Sales Order` (`workflows/nwi__deal-closedwon-to-bc__v1.json`).

**Trigger:** HubSpot webhook `POST /webhook/nwi-hubspot-deal-closedwon`, real time, one execution per deal. The workflow in n8n is the source of truth (exported 2026-11-11, n8n Cloud `nwigroup.app.n8n.cloud`).

**What it does:** loads the deal, its contact and line items. One HubSpot **contact** = one BC **customer**. The contact hosts all the customer properties (address, phone, email, website, `business_central_record_id`); the BC customer name is the contact's **Company name** property (`company`). Contact has `business_central_record_id`: update that BC customer through the OData page (also sets Segment / Responsibility_Center). No ID: create the BC customer through the OData `Customer_Card` page and write its number back to the contact. Then create the BC sales order (header + lines) and write the order's BC number (the `No` field) to `bc_order_id` on the deal. Finally the HubSpot contact is created as a BC **Person contact** under the customer's company contact and set as the customer's **Primary Contact No.**, which BC shows as *ERC Primary Contact Name* (that field is read-only; it cannot be written directly).

## Safety rails
- NOTE: the live workflow has no trigger-event filter. Every event the HubSpot subscription sends starts an order, including an un-tick of `closed_won`.
- Deal with no associated contact or no line items fails the run. Several contacts: the first one returned is used.
- Contact with no Company name fails the run (it becomes the BC customer name).
- Duplicate guard: a deal that already has `bc_order_id` is skipped. The BC order's Purchase order No. is left blank on purpose, so BC holds no copy of the deal ID. If an order is created but the write-back to the deal fails, set `bc_order_id` by hand before re-running, or a second order is created.
- Any line with no SKU, quantity or price fails the run before anything is written to BC.
- `business_central_record_id` on the contact that finds 0 or 2+ BC customers fails the run; no duplicate customer is created.
- No retries on the two create calls.

## Why customers are created through OData
The standard API create fails with "GST Bus. Posting Group ... (GST 10%) cannot be found": BC applies a customer template default that does not exist, and no API field can override it. The OData `Customer_Card` page (web service published in BC, page 21) accepts the posting groups directly (`DOMESTIC` for Gen., VAT/GST and Customer posting group, same as existing customers). Keep that web service published. Fixing the GST group on the BC customer templates (COMPANY / CUST000001) would let this go back to the standard API.

## Primary contact
Runs after the order number is written to the deal, so a failure here never blocks the order. It looks up the customer's company contact, reuses a Person contact under it that matches the HubSpot contact's email (or name when there is no email), otherwise creates one, then sets `Primary_Contact_No` on the customer card. Skipped when the HubSpot contact has no first or last name. Segment and Responsibility_Center must be valid BC codes.
