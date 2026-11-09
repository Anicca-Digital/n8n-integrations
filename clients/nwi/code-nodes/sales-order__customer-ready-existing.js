// Output of "Update BC Customer" is the updated customer.
const c = $input.first().json;
return [{ json: { customerId: c.id, customerNumber: c.number } }];
