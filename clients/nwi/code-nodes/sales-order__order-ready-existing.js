// An order for this deal already exists in BC (e.g. an earlier run failed at the write-back).
const existing = ($input.first().json.value || [])[0];
return [{ json: { orderNumber: existing.number } }];
