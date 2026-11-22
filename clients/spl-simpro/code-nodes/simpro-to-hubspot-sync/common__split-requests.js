// Node: Split ... Requests   (all workflows that make batch calls)
// Turns the ONE state item from the previous Code node into one item per HubSpot/Simpro call.
// No requests = a single { skip: true } item, which the next "Any ...?" check routes around the call.
const requests = $input.first().json.requests ?? [];
if (requests.length === 0) return [{ json: { skip: true } }];
return requests.map(r => ({ json: r }));
