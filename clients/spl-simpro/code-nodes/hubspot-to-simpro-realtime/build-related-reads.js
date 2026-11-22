// Node: Build Related Reads   ([SPL] HubSpot -> Simpro (Real Time))
// Reads the Simpro ID of every related company and contact (batches of 100). No related records = { skip: true }.
const cfg = $('Workflow Config').first().json;
const reqs = $('Build Association Reads').all();
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const need = { companies: new Set(), contacts: new Set() };
$input.all().forEach((item, k) => {
  const idx = (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
  const meta = reqs[idx].json.meta;
  const r = item.json ?? {};
  if (r.statusCode === 404) return; // none of these records has links of this type
  if (r.statusCode !== 200 && r.statusCode !== 207) {
    throw new Error('HubSpot association read (' + meta.type + ' -> ' + meta.to + ') failed (HTTP ' + r.statusCode + '): ' + JSON.stringify(r.body).slice(0, 300));
  }
  for (const row of ((r.body && r.body.results) || [])) for (const t of (row.to ?? [])) need[meta.to].add(String(t.toObjectId));
});
const OBJ = { companies: { path: cfg.types.company.path, prop: cfg.types.company.idProperty }, contacts: { path: cfg.types.contact.path, prop: cfg.types.contact.idProperty } };
const out = [];
for (const [to, set] of Object.entries(need)) {
  chunk([...set], 100).forEach((part, n) => out.push({
    url: cfg.hubspotApiBase + '/' + OBJ[to].path + '/batch/read',
    body: { properties: [OBJ[to].prop], inputs: part.map(id => ({ id })) },
    meta: { to, batch: n + 1 },
  }));
}
if (out.length === 0) return [{ json: { skip: true } }];
return out.map(r => ({ json: r }));
