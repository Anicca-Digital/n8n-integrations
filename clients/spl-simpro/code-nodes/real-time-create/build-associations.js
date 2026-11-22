// Node: Build Associations   ([SPL] Simpro -> HubSpot (Real Time))
// Links the newly created record to the related records that already exist in HubSpot. Related records that
// are not in HubSpot are skipped and listed (`skipped` on the items and `skippedLinks` in the execution's custom
// data, so it stays visible even when nothing is left to link). Nothing is ever removed or updated.
//   plain links     -> batch associate (default, NO label)
//   labelled links  -> batch create with the label: the primary contact of a quote/job gets "Decision Maker";
//                      a job's quote link uses the Job/Quote label with the quote as the FROM side.
const cfg = $('Workflow Config').first().json;
const spec = $('Build Create Request').first().json;
const fromId = String($('Create Record in HubSpot').first().json.id);
const lookups = $('Build Related Lookups').all(); // the requests, in the order they were sent
const base = cfg.hubspotApiBase + '/crm/v4/associations/';

const found = {}; // toType -> { simproId: hubspotId }
$input.all().forEach((item, k) => {
  const idx = (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
  const meta = lookups[idx].json.meta;
  const r = item.json ?? {};
  if (r.statusCode === 404) return; // none of this batch exists in HubSpot
  if (r.statusCode !== 200 && r.statusCode !== 207) {
    throw new Error('HubSpot lookup of related ' + meta.toType + ' failed (HTTP ' + r.statusCode + '): ' + JSON.stringify(r.body).slice(0, 300));
  }
  found[meta.toType] = found[meta.toType] ?? {};
  for (const x of ((r.body && r.body.results) || [])) {
    const sid = x.properties ? x.properties[meta.idProperty] : undefined;
    if (sid !== undefined && sid !== null) found[meta.toType][String(sid)] = String(x.id);
  }
});

const skipped = [];
const requests = [];
for (const rel of spec.related) {
  const toObject = cfg.objects[rel.toType].assoc;
  const plain = [];
  const labelled = [];
  for (const id of rel.ids) {
    const hs = found[rel.toType] ? found[rel.toType][id] : undefined;
    if (!hs) { skipped.push({ link: rel.key, relatedSimproId: id, reason: 'not in HubSpot - link skipped' }); continue; }
    if (rel.quoteIsFrom) labelled.push({ from: { id: hs }, to: { id: fromId }, types: rel.label });
    else if (rel.label && id === rel.primary) labelled.push({ from: { id: fromId }, to: { id: hs }, types: rel.label });
    else plain.push({ from: { id: fromId }, to: { id: hs } });
  }
  if (plain.length) requests.push({ url: base + spec.fromObject + '/' + toObject + '/batch/associate/default', body: { inputs: plain }, meta: { link: rel.key, kind: 'plain', count: plain.length } });
  if (labelled.length) {
    const pair = rel.quoteIsFrom ? 'deals/deals' : spec.fromObject + '/' + toObject;
    requests.push({ url: base + pair + '/batch/create', body: { inputs: labelled }, meta: { link: rel.key, kind: 'labelled', count: labelled.length } });
  }
}
if (skipped.length) $execution.customData.set('skippedLinks', skipped.map(s => s.link + ':' + s.relatedSimproId).join(', ').slice(0, 250));
return requests.map(r => ({ json: { ...r, skipped } }));
