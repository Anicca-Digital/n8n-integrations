// Node: Build Contact Lookups   ([SPL] Simpro -> HubSpot Contacts Sync)
// Which of these Simpro contacts already exist in HubSpot (by the unique property simpro_contact_id)?
// One batch read per 100 contacts. Not-found IDs simply come back missing.
const cfg = $('Build Sync Window').first().json;
const { records } = $('Select Test Records').first().json;
const blank = (v) => v === null || v === undefined || v === '' || v === 'null';
const keep = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => !blank(v)).map(([k, v]) => [k, String(v)]));
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

return chunk(records.map(r => ({ id: String(r.ID) })), cfg.hubspotBatchSize).map((part, n) => ({
  json: {
    url: cfg.objectUrl + '/batch/read',
    body: { idProperty: cfg.idProperty, properties: [cfg.idProperty], inputs: part },
    meta: { kind: 'lookup', batch: n + 1, count: part.length },
  },
}));
