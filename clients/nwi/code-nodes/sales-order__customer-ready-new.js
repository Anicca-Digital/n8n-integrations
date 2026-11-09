// Customer was just created; the HubSpot write-back has already succeeded.
const c = $('Create BC Customer').first().json;
return [{ json: { customerId: c.id, customerNumber: c.number } }];
