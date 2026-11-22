// Node: Build Related Lookups   ([SPL] Simpro -> HubSpot (Real Time))
// The record was just CREATED in HubSpot. Ask HubSpot, in one batch read per related type, which of the related
// Simpro records already exist (by their unique Simpro ID property). Related records that are not in HubSpot are
// NOT created here: they are skipped. No items out = nothing to link, the branch ends on purpose.
const cfg = $('Workflow Config').first().json;
const spec = $('Build Create Request').first().json;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const needed = {}; // toType -> Set(simpro ids)
for (const rel of spec.related) {
  for (const id of rel.ids) (needed[rel.toType] = needed[rel.toType] ?? new Set()).add(id);
}
const requests = [];
for (const [toType, set] of Object.entries(needed)) {
  const o = cfg.objects[toType];
  chunk([...set], 100).forEach((part, n) => requests.push({
    url: cfg.hubspotApiBase + '/' + o.path + '/batch/read',
    body: { idProperty: o.idProperty, properties: [o.idProperty], inputs: part.map(id => ({ id })) },
    meta: { toType, idProperty: o.idProperty, batch: n + 1 },
  }));
}
return requests.map(r => ({ json: r }));
