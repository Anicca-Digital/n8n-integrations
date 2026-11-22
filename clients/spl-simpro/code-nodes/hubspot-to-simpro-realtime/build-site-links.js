// Node: Build Site Links   ([SPL] HubSpot -> Simpro (Real Time))
// A site was just created in Simpro: link it to its customers (only those already in Simpro) and set its primary contact
// (a HubSpot contact that already has a Simpro ID; HubSpot has no single "primary" site contact, so the first one).
// One PATCH per site. No links = { skip: true }.
const cfg = $('Workflow Config').first().json;
const { records } = $('Resolve Plan').first().json;
const safeAll = (name) => { try { return $(name).all(); } catch (e) { return []; } };
const idxOf = (item, k) => (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
const reqs = safeAll('Build Record Writes').filter(i => !(i.json && i.json.skip));
const createdSites = {};
safeAll('Write Records to Simpro').filter(i => !(i.json && i.json.skip)).forEach((item, k) => {
  const m = reqs[idxOf(item, k)].json.meta; const r = item.json ?? {};
  if (m.type === 'site' && (r.statusCode === 200 || r.statusCode === 201) && r.body && r.body.ID !== undefined) createdSites[m.hsId] = String(r.body.ID);
});
const out = [];
for (const rec of records) {
  if (rec.type !== 'site' || !createdSites[rec.hsId] || !rec.links) continue;
  const body = {};
  if (rec.links.customers.length) body.Customers = rec.links.customers;
  if (rec.links.primaryContact) body.PrimaryContact = { Contact: Number(rec.links.primaryContact) };
  if (Object.keys(body).length) out.push({ json: { method: 'PATCH', url: cfg.simproBaseUrl + '/companies/0/sites/' + createdSites[rec.hsId], body, meta: { type: 'site', hsId: rec.hsId, kind: 'siteLinks' } } });
}
if (out.length === 0) return [{ json: { skip: true } }];
return out;
