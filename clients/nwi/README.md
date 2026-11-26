# NWI: Deal Closed Won -> Business Central

One workflow: `[NWI] HubSpot Deal Closed Won -> BC Customer + Sales Order` (`workflows/nwi__deal-closedwon-to-bc__v1.json`).

**Trigger:** HubSpot webhook `POST /webhook/nwi-hubspot-deal-closedwon`, real time, one execution per deal. The workflow in n8n is the source of truth (exported 2026-11-11, n8n Cloud `nwigroup.app.n8n.cloud`).

**What it does:** loads the deal, its **primary company**, its first **contact** and line items. HubSpot **company** = BC **customer**: the company hosts all customer properties (name, address, phone, email, invoice email, website, ABN, segment, responsibility center, location code, `business_central_id`). Company has `business_central_id`: update that BC customer through the OData page. No ID: create it through the OData `Customer_Card` page and write its number back to the company. Then create the BC sales order (header + lines), write the order number to `bc_order_id` on the deal and set the order page fields. Finally the HubSpot **contact** = BC **Person contact**: created under the customer's company contact (or updated when the contact has `business_central_record_id`), its number written back to the contact, and set as the customer's **Primary Contact No.** (shown as *ERC Primary Contact Name*, which is read-only).

## Safety rails
- NOTE: the live workflow has no trigger-event filter. Every event the HubSpot subscription sends starts an order, including an un-tick of `closed_won`.
- Deal with no associated company or no line items fails the run. Several companies: the one marked Primary is used. A deal with no contact still gets its customer and order.
- Company with no name fails the run (it becomes the BC customer name).
- Duplicate guard: a deal that already has `bc_order_id` is skipped. The BC order's Purchase order No. is left blank on purpose, so BC holds no copy of the deal ID. If an order is created but the write-back to the deal fails, set `bc_order_id` by hand before re-running, or a second order is created.
- Any line with no SKU, quantity or price fails the run before anything is written to BC.
- `business_central_id` on the company (or `business_central_record_id` on the contact) that finds 0 or 2+ BC records fails the run; no duplicate is created.
- No retries on the two create calls.

## Why customers are created through OData
The standard API create fails with "GST Bus. Posting Group ... (GST 10%) cannot be found": BC applies a customer template default that does not exist, and no API field can override it. The OData `Customer_Card` page (web service published in BC, page 21) accepts the posting groups directly (`DOMESTIC` for Gen., VAT/GST and Customer posting group, same as existing customers). Keep that web service published. Fixing the GST group on the BC customer templates (COMPANY / CUST000001) would let this go back to the standard API.

## Primary contact
Runs after the order is created, so a failure here never blocks the order. It looks up the customer's company contact, then updates the BC contact (contact has a BC ID) or creates a Person contact under it and writes the number to the HubSpot contact, then sets `Primary_Contact_No` on the customer card. Skipped when the deal has no contact or the contact has no first or last name.

## Sales order fields
The order is created through the standard API (header + lines, with Order / Posting / Requested Delivery dates from the deal). After the order number is written to the deal's `bc_order_id`, the Sales Order page (web service `SalesOrder`, page 42) sets the rest: Document_Date (`document_date`), Due_Date (`due_date`), ERC_Print_Option (`print_option`), ERC_FOB_Option (`fob_option`), Product_Category (`product_category`), WorkDescription (`description`) and Job_Description (`job_description`). Blank values are not sent. The order's Purchase order No. (External_Document_No) is left blank. Keep the `SalesOrder` web service published.

## Daily BC -> HubSpot syncs (update only, never create)
Three scheduled workflows run at midnight (Australia/Sydney). Each finds BC records changed in the last 25 hours, matches the HubSpot record by its BC number, and writes only properties that differ. BC wins; a blank BC value never clears HubSpot.
- `nwi__bc-salesorders-to-hubspot-deals__v1.json`: sales orders -> deals (match `bc_order_id`).
- `nwi__bc-customers-to-hubspot-companies__v1.json`: customers -> companies (match `business_central_id`).
- `nwi__bc-contacts-to-hubspot-contacts__v1.json`: Person contacts -> contacts (match `business_central_record_id`).

## One-off load: BC -> HubSpot (`nwi__bc-load-customers-contacts-to-hubspot__v1.json`)
Manual run, once. Creates a HubSpot company for every unblocked BC customer and a HubSpot contact for every BC Person contact linked to those customers, then associates each contact to its company. Records missing in HubSpot (matched on `business_central_id` / `business_central_record_id`) are created; records already there are updated, but only the properties whose value differs (BC wins, blanks never clear HubSpot). Re-runs are safe. Test first with `maxCustomers` = 50. Company Segment and Sub Segment (`sub_segement` in HubSpot) and contact Segment and Sub Segment (`sub_segment`) are loaded, and kept in sync by the daily syncs. Contact values are read from the BC `Contact_Card` web service.
