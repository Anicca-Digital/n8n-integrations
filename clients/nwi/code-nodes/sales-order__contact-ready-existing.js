// A Person contact for this HubSpot contact already exists under the company: reuse it.
const found = ($input.first().json.value || [])[0];
return [{ json: { contactNumber: found.number } }];
