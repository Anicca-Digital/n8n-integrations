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

// Fields written through the Sales Order page after the order exists (page field names). Blank = not sent.
const t = (v) => (v === undefined || v === null ? undefined : String(v).trim());
const orderPageFields = Object.fromEntries(Object.entries({
  Document_Date: toDate(d.document_date),   // before Due_Date: BC recalculates the due date from the document date
  Due_Date: toDate(d.due_date),
  ERC_Print_Option: t(d.print_option),
  ERC_FOB_Option: t(d.fob_option),
  Product_Category: t(d.product_category),
  WorkDescription: t(d.description),
  Job_Description: t(d.job_description) === undefined ? undefined : t(d.job_description).slice(0, 100),
}).filter(([, v]) => v !== undefined && v !== ''));

return [{ json: {
  dealId,
  orderPageFields,
  customerNumber: cust.customerNumber,
  salesOrderPayload: {
    customerNumber: cust.customerNumber,
    ...datePart,
    salesOrderLines: lines,
  },
} }];
