// Node: Build Related Reads   (contacts, sites, quotes and jobs)
// Reads the Simpro ID of every related company / contact / site (and the line items of deals) in batches of 100.
// No related records at all = a single { skip: true } item.
const cfg = $('Build Sync Window').first().json;
const reqs = $('Build Association Reads').all(); // the requests, in the order they were sent
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const need = { companies: new Set(), contacts: new Set(), '0-420': new Set(), line_items: new Set() };
$input.all().forEach((item, k) => {
  const idx = (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
  const meta = reqs[idx].json.meta;
  const r = item.json ?? {};
  if (r.statusCode === 404) return; // none of these records has links of this type
  if (r.statusCode !== 200 && r.statusCode !== 207) {
    throw new Error('HubSpot association read (' + meta.to + ') failed (HTTP ' + r.statusCode + '): ' + JSON.stringify(r.body).slice(0, 300));
  }
  for (const row of ((r.body && r.body.results) || [])) for (const t of (row.to ?? [])) need[meta.to].add(String(t.toObjectId));
});

const OBJECTS = {
  companies: { path: 'crm/objects/2026-09/companies', properties: ['simpro_customer_id'] },
  contacts: { path: 'crm/objects/2026-09/contacts', properties: ['simpro_contact_id'] },
  '0-420': { path: 'crm/objects/2026-09/0-420', properties: ['simpro_site_id'] },
  line_items: { path: 'crm/objects/2026-09/line_items', properties: ['price', 'simpro_id', 'cost_centre', 'name', 'simpro_section_id'] },
};
const out = [];
for (const [type, set] of Object.entries(need)) {
  chunk([...set], 100).forEach((part, n) => out.push({
    url: cfg.hubspotApiBase + '/' + OBJECTS[type].path + '/batch/read',
    body: { properties: OBJECTS[type].properties, inputs: part.map(id => ({ id })) },
    meta: { type, batch: n + 1 },
  }));
}
if (out.length === 0) return [{ json: { skip: true } }];
return out.map(r => ({ json: r }));
