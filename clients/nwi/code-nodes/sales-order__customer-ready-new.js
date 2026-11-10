// Customer was just created through OData Customer_Card; the HubSpot write-back has already succeeded.
// The page record has the customer number as "No" and no GUID.
const c = $('Create BC Customer').first().json;
return [{ json: { customerNumber: c.No } }];
