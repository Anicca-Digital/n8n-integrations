// Node: Build Company Associations   ([SPL] Simpro -> HubSpot (Real Time))
// Links the newly created Company to the related records that already exist in HubSpot (one batch call per
// link type, default association). Related records not in HubSpot are skipped and listed in `skipped`
// so they are visible in the execution. Nothing is ever removed or updated here.
const record = $('Get Simpro Customer').first().json;
const fromId = String($('Upsert Company in HubSpot').first().json.id);
const lookups = $('Build Company Related Lookups').all(); // the requests, in the order they were sent

const LINKS = [
  { key: 'contact', toType: 'contact', desired: (r) => (r.Contacts ?? []).map(c => c.ID) },
  { key: 'site', toType: 'site', desired: (r) => (r.Sites ?? []).map(s => s.ID) },
];

const OBJECTS = { company: 'companies', contact: 'contacts', site: '0-420' };

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
for (const l of LINKS) {
  const inputs = [];
  for (const relatedId of [...new Set((l.desired(record) ?? []).filter(v => v !== undefined && v !== null && v !== '').map(String))]) {
    const hs = found[l.toType] ? found[l.toType][relatedId] : undefined;
    if (hs) inputs.push({ from: { id: fromId }, to: { id: hs } });
    else skipped.push({ link: l.key, relatedSimproId: relatedId, reason: 'not in HubSpot - link skipped' });
  }
  if (inputs.length) {
    requests.push({
      url: 'https://api.hubapi.com/crm/v4/associations/companies/' + OBJECTS[l.toType] + '/batch/associate/default',
      body: { inputs },
      meta: { link: l.key, count: inputs.length },
    });
  }
}
// Make skipped links visible even when nothing is left to link (no items = nothing else to look at).
if (skipped.length) $execution.customData.set('skippedLinks', skipped.map(s => s.link + ':' + s.relatedSimproId).join(', ').slice(0, 250));
return requests.map(r => ({ json: { ...r, skipped } }));
