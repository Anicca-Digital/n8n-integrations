// Input is the customer ({ customerNumber }), from either branch. The order is created by customer number.
const cust = $input.first().json;
const dealId = $('Pick Associated Records').first().json.dealId;
const lines = $('Validate Order Lines').first().json.lines;
return [{ json: {
  dealId,
  customerNumber: cust.customerNumber,
  salesOrderPayload: {
    customerNumber: cust.customerNumber,
    externalDocumentNumber: dealId,   // HubSpot deal ID: traceability + duplicate guard
    salesOrderLines: lines,
  },
} }];
