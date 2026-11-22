// Node: Build Record Reads   ([SPL] HubSpot -> Simpro (Real Time))
// Read the records named in the webhook from HubSpot: one batch read per record type (100 per call), with every
// property needed for Simpro, so there is no separate read per record.
const cfg = $('Workflow Config').first().json;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const requests = [];
for (const type of Object.keys(cfg.types)) {
  const ids = cfg.records.filter(r => r.type === type).map(r => r.hsId);
  chunk(ids, 100).forEach((part, n) => requests.push({
    url: cfg.hubspotApiBase + '/' + cfg.types[type].path + '/batch/read',
    body: { properties: cfg.types[type].properties, inputs: part.map(id => ({ id })) },
    meta: { type, batch: n + 1 },
  }));
}
return requests.map(r => ({ json: r }));
