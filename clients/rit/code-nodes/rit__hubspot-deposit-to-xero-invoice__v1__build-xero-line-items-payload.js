// Runs once after the loop finishes (Loop Through Line Items "done" output, index 0).
// Builds the full Xero LineItems array from every line item processed during the loop.
const items = $input.all();

const lineItems = items.map((item) => ({
  Description: item.json.properties.asset_number + " | Security Deposit | " + item.json.properties.name,
  Quantity: 8,
  UnitAmount: parseFloat(item.json.properties.amount) / 8,
  ItemCode: item.json.properties.asset_number,
  AccountCode: item.json.account_id,
  LineAmount: parseFloat(item.json.properties.amount),
}));

// InvoiceID is constant across all line items for this run - pull it from the
// original Loop Through Line Items output, since the current items now hold the
// HubSpot line item fetch response instead (InvoiceID doesn't survive that call).
const invoiceId = $('Loop Over Line Items').first().json.InvoiceID;

return [{ json: { invoiceId, lineItems } }];
