// Node: Build Job Associations   ([SPL] Simpro -> HubSpot (Real Time))
// Links the newly created Job to the related records that already exist in HubSpot (one batch call per
// link type, default association). Related records not in HubSpot are skipped and listed in `skipped`
// so they are visible in the execution. Nothing is ever removed or updated here.
const record = $('Get Simpro Job').first().json;
const fromId = String($('Upsert Job Deal in HubSpot').first().json.dealId);
const lookups = $('Build Job Related Lookups').all(); // the requests, in the order they were sent

const LINKS = [
  { key: 'site', toType: 'site', desired: (r) => [r.Site?.ID] },
  { key: 'contact', toType: 'contact', desired: (r) => [r.CustomerContact?.ID] },
  { key: 'company', toType: 'company', desired: (r) => [r.Customer?.ID] },
  // Quote deal -> Job deal with SPL's custom label: "Job" is shown on the quote, the inverse "Quote" on the
  // job (HubSpot internal name quote_job, USER_DEFINED, association ID 11, 1-to-many). The quote is the
  // FROM side because the ID describes the label of the TO record.
  { key: 'quote', toType: 'quote', desired: (r) => [r.ConvertedFromQuote?.ID ?? (r.ConvertedFrom?.Type === 'Quote' ? r.ConvertedFrom.ID : undefined)],
    labelled: { quoteIsFrom: true, types: [{ associationCategory: 'USER_DEFINED', associationTypeId: 11 }] } },
];

const OBJECTS = { company: 'companies', contact: 'contacts', site: '0-420', quote: 'deals' };

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
  const labelledInputs = [];
  for (const relatedId of [...new Set((l.desired(record) ?? []).filter(v => v !== undefined && v !== null && v !== '').map(String))]) {
    const hs = found[l.toType] ? found[l.toType][relatedId] : undefined;
    if (hs && l.labelled) labelledInputs.push({ from: { id: hs }, to: { id: fromId }, types: l.labelled.types });
    else if (hs) inputs.push({ from: { id: fromId }, to: { id: hs } });
    else skipped.push({ link: l.key, relatedSimproId: relatedId, reason: 'not in HubSpot - link skipped' });
  }
  if (labelledInputs.length) {
    requests.push({
      url: 'https://api.hubapi.com/crm/v4/associations/deals/deals/batch/create',
      body: { inputs: labelledInputs },
      meta: { link: l.key, count: labelledInputs.length },
    });
  }
  if (inputs.length) {
    requests.push({
      url: 'https://api.hubapi.com/crm/v4/associations/deals/' + OBJECTS[l.toType] + '/batch/associate/default',
      body: { inputs },
      meta: { link: l.key, count: inputs.length },
    });
  }
}
// Make skipped links visible even when nothing is left to link (no items = nothing else to look at).
if (skipped.length) $execution.customData.set('skippedLinks', skipped.map(s => s.link + ':' + s.relatedSimproId).join(', ').slice(0, 250));
return requests.map(r => ({ json: { ...r, skipped } }));
