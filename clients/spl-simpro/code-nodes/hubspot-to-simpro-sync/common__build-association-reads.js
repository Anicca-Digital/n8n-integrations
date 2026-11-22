// Node: Build Association Reads   (contacts, sites, quotes and jobs)
// Which related HubSpot records does each changed record have? One batch read per association type (100 records per call).
// Deals also read their line items. Always at least one request (this node only runs when there are records).
const cfg = $('Build Sync Window').first().json;
const { records } = $('Prepare Records').first().json;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const TO = {
  contact: ['companies'],
  site: ['companies', 'contacts'],
  quote: ['companies', 'contacts', '0-420', 'line_items'],
  job: ['companies', 'contacts', '0-420', 'line_items'],
};
const ids = records.map(r => r.hsId);
const requests = [];
for (const to of TO[cfg.recordType] ?? []) {
  chunk(ids, 100).forEach((part, n) => requests.push({
    url: cfg.hubspotApiBase + '/crm/v4/associations/' + cfg.assocObject + '/' + to + '/batch/read',
    body: { inputs: part.map(id => ({ id })) },
    meta: { to, batch: n + 1 },
  }));
}
return requests.map(r => ({ json: r }));
