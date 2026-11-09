// Runs once after the loop finishes (Loop Through Line Items "done" output, index 0).
// Builds the full Xero LineItems array from every line item processed during the loop.
const items = $input.all();

// Formats a date as D/M/YYYY (no leading zeros), matching the invoice style.
const formatDate = (date) =>
  `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;

// Returns the Sunday that ends the Monday-Sunday week containing the delivery date:
// - if delivery is on a Sunday, the end date is that same day
// - if delivery is on a Monday, the end date is 6 days later (that week's Sunday)
// - otherwise, it's the next Sunday after the delivery date
const getEndOfWeekSunday = (deliveryDate) => {
  const day = deliveryDate.getUTCDay(); // Sunday = 0 ... Saturday = 6
  const diffToSunday = (7 - day) % 7;
  const sunday = new Date(deliveryDate);
  sunday.setUTCDate(sunday.getUTCDate() + diffToSunday);
  return sunday;
};

const lineItems = items.map((item) => {
  const deliveryDate = new Date(item.json.properties.delivery_date + 'T00:00:00Z');
  const endSunday = getEndOfWeekSunday(deliveryDate);
  const dateRange = `${formatDate(deliveryDate)} - ${formatDate(endSunday)}`;

  return {
    Description: `${item.json.properties.asset_number} | Initial Invoice ${dateRange} | ${item.json.properties.name}\nSerial Number ${item.json.properties.serial_number}`,
    Quantity: 1,
    UnitAmount: parseFloat(item.json.properties.amount),
    ItemCode: item.json.properties.asset_number,
    AccountCode: item.json.account_id,
    LineAmount: parseFloat(item.json.properties.amount),
  };
});

// InvoiceID is constant across all line items for this run - pull it from the
// original Loop Through Line Items output, since the current items now hold the
// HubSpot line item fetch response instead (InvoiceID doesn't survive that call).
const invoiceId = $('Loop Over Line Items').first().json.InvoiceID;

return [{ json: { invoiceId, lineItems } }];
