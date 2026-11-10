// The BC ID on the HubSpot company must resolve to exactly one BC customer.
const found = $input.first().json.value || [];
const ref = $('Build Customer Payload').first().json.bcId;
if (found.length !== 1) {
  throw new Error(`HubSpot contact has business_central_id "${ref}" but Business Central returned ${found.length} matching customers. Not creating a duplicate - fix the ID in HubSpot.`);
}
return [{ json: { customerId: found[0].id, customerNumber: found[0].number } }];
