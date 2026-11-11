// Input is the customer ({ customerNumber }), from either branch. The order is created by customer number.
const cust = $input.first().json;
const dealId = $('Pick Associated Records').first().json.dealId;
const lines = $('Validate Order Lines').first().json.lines;
const d = $('Get Deal').first().json.properties || {};

// HubSpot date properties come back as YYYY-MM-DD (or epoch ms). BC wants YYYY-MM-DD. Blank = not sent, BC defaults apply.
const toDate = (v) => {
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{10,}$/.test(s)) return new Date(Number(s)).toISOString().slice(0, 10);
  return undefined;
};
const dates = {
  orderDate: toDate(d.order_date),
  postingDate: toDate(d.posting_date),
  requestedDeliveryDate: toDate(d.requested_delivery_date),
};
const datePart = Object.fromEntries(Object.entries(dates).filter(([, v]) => v !== undefined));

return [{ json: {
  dealId,
  customerNumber: cust.customerNumber,
  salesOrderPayload: {
    customerNumber: cust.customerNumber,
    ...datePart,
    salesOrderLines: lines,
  },
} }];
