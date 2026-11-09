// Input is the customer ({ customerId, customerNumber }), from either branch.
const cust = $input.first().json;
const dealId = $('Pick Associated Records').first().json.dealId;
const lines = $('Validate Order Lines').first().json.lines;
return [{ json: {
  dealId,
  customerNumber: cust.customerNumber,
  salesOrderPayload: {
    customerId: cust.customerId,
    externalDocumentNumber: dealId,   // HubSpot deal ID: traceability + duplicate guard
    salesOrderLines: lines,
  },
} }];
