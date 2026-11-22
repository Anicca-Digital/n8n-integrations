// Node: Build ID Write-Back   ([SPL] HubSpot -> Simpro (Real Time))
// Right after records are created in Simpro, save the new Simpro IDs on the HubSpot records (one batch update per type).
// Doing this straight away is what stops a repeated webhook from creating the same record in Simpro twice.
const cfg = $('Workflow Config').first().json;
const safeAll = (name) => { try { return $(name).all(); } catch (e) { return []; } };
const idxOf = (item, k) => (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const reqs = safeAll('Build Record Writes').filter(i => !(i.json && i.json.skip));
const byType = {};
safeAll('Write Records to Simpro').filter(i => !(i.json && i.json.skip)).forEach((item, k) => {
  const m = reqs[idxOf(item, k)].json.meta; const r = item.json ?? {};
  if ((r.statusCode === 200 || r.statusCode === 201) && r.body && r.body.ID !== undefined) {
    (byType[m.type] = byType[m.type] ?? []).push({ id: m.hsId, properties: { [cfg.types[m.type].idProperty]: String(r.body.ID) } });
  }
});
const out = [];
for (const [type, updates] of Object.entries(byType)) {
  chunk(updates, 100).forEach((part, n) => out.push({ url: cfg.hubspotApiBase + '/' + cfg.types[type].path + '/batch/update', body: { inputs: part }, meta: { type, batch: n + 1, count: part.length } }));
}
if (out.length === 0) return [{ json: { skip: true } }];
return out.map(r => ({ json: r }));
