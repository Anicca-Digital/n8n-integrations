// Single source of truth for this automation. Nothing else needs editing to retune it.
const TIMEZONE = 'Australia/Brisbane';      // 'today' and the duplicate window are read in this zone
const GUARD_LOOKBACK_DAYS = 0;              // 0 = window starts at the start of the trigger day. Set to 1 for ONE recovery run the day after a failed run, then set back to 0.

// Duplicate-check window, taken from the Schedule Trigger (not from "now"):
// from the start of the day the schedule fired, to one minute before the next weekly execution.
const runAt = DateTime.fromISO($('Schedule Trigger').first().json.timestamp, { zone: TIMEZONE });
if (!runAt.isValid) throw new Error('Schedule Trigger did not return a valid timestamp - cannot work out the duplicate-check window.');
const windowStartMs = runAt.startOf('day').minus({ days: GUARD_LOOKBACK_DAYS }).toMillis();
const windowEndMs = runAt.plus({ days: 7 }).minus({ minutes: 1 }).toMillis();

return [{
  json: {
    // ---- Xero (values carried over from the original sync workflow) ----
    xeroBatchSize: 50,          // invoices per Xero request. Xero's guidance is "up to 50"; was 100. HubSpot batch calls cap at 100.
    batchWaitSeconds: 10,       // pause between Xero batches (seconds). Keep under 65 so the execution is not offloaded to the database.
    xeroTenantId: '1e9660fb-45a7-4a9b-9158-cc54c9e78f34',   // Xero organisation (tenant) - Anicca RIT
    brandingThemeId: '294af06f-b8a6-4049-8420-763713693f3a',
    currency: 'AUD',
    invoiceStatus: 'DRAFT',     // status the invoice is created with in Xero
    // Xero rental income account by company state. Anything else (or blank) falls back to defaultAccountId.
    stateAccounts: { WA: 'WA5000', VIC: 'VIC5000', NSW: 'NSW5000' },
    defaultAccountId: 'WA5000',

    // ---- HubSpot (portal 443317712) ----
    apiBase: 'https://api.hubapi.com',
    apiVersion: '2026-09',                     // date-based HubSpot API version, read by every HubSpot request URL
    batchSize: 50,                             // ids per HubSpot batch call (HubSpot allows 100)
    openBatchSize: 10,                         // invoices per draft -> open call. Smaller than batchSize on purpose: opening is the heavy HubSpot step (a 50-invoice call returned 500 INTERNAL_ERROR on 8 Nov 2026).
    guardLookbackDays: GUARD_LOOKBACK_DAYS,    // see top of node
    windowStartMs,                             // duplicate window start (ms): start of the trigger day, minus guardLookbackDays
    windowEndMs,                               // duplicate window end (ms): trigger time + 7 days - 1 minute (one minute before the next weekly run)
    companyFlagProperty: 'asset_delivered',    // company number property: invoiced when > 0
    assetObjectType: '2-217972099',            // custom Assets object (p443317712_assets)
    billableStatuses: ['active', 'to be returned'],   // asset status, compared lower-case
    invoiceType: 'Weekly',
    invoiceCurrency: 'AUD',
    // The duplicate check looks at Weekly invoices created inside the window above (trigger day -> one minute before the next run) that have a company.
    timezone: TIMEZONE,                        // the window and the invoice dates are read in this zone
    issueWeekday: 1,                           // invoice date = the FOLLOWING Monday (1 = Monday). Run on a Monday -> next week's Monday.
    // Due date = the first such weekday on/after the invoice date, from the company's weekly_invoice_expiry_date (Tue-Fri today)
    expiryWeekdays: { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 },
    billingContactTypeIds: [930, 931],         // Billing Contact association types (matched with the label below)
    billingContactLabel: 'billing contact',
    assocTypeIds: { invoiceToCompany: 179, invoiceToContact: 177, lineItemToInvoice: 410 },
    companyProps: ['name', 'asset_delivered', 'state', 'xero_customer_id', 'hubspot_owner_id', 'weekly_invoice_expiry_date'],
    assetProps: ['name', 'status', 'serial_number', 'contract_number', 'asset_number', 'xero_asset_id', 'xero_item_id'],
    sourceLineItemProps: ['name', 'price', 'quantity', 'hs_product_id', 'hs_sku', 'description'],
    invoiceDetailProps: ['hs_number', 'hs_purchase_order_number', 'hubspot_owner_id', 'hs_invoice_date', 'hs_due_date', 'hs_createdate', 'hs_invoice_status', 'xero_invoice_id'],
    xeroLineItemProps: ['amount', 'price', 'quantity', 'name', 'asset_number', 'xero_asset_id', 'xero_item_id', 'description', 'serial_number']
  }
}];
