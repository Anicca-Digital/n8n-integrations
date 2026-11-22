// Node: Build Association Reads   ([SPL] HubSpot -> Simpro (Real Time))
// Contacts need their company, Sites their companies and contacts. One batch read per type and link (100 per call).
// Companies need none: nothing to read = a single { skip: true } item.
const cfg = $('Workflow Config').first().json;
const { records } = $('Prepare Records').first().json;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const TO = { contact: ['companies'], site: ['companies', 'contacts'] };
const requests = [];
for (const type of Object.keys(TO)) {
  const ids = records.filter(r => r.type === type).map(r => r.hsId);
  for (const to of TO[type]) {
    chunk(ids, 100).forEach((part, n) => requests.push({
      url: cfg.hubspotApiBase + '/crm/v4/associations/' + cfg.types[type].assoc + '/' + to + '/batch/read',
      body: { inputs: part.map(id => ({ id })) },
      meta: { type, to, batch: n + 1 },
    }));
  }
}
if (requests.length === 0) return [{ json: { skip: true } }];
return requests.map(r => ({ json: r }));
