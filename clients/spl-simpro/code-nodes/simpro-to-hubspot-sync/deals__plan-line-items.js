// Node: Plan Line Items   (quote and job workflows)
// Builds the line items each deal should have (one per Simpro cost center; price = the cost center's
// GST-EXCLUSIVE total, Total.ExTax, since 2026-11-22) and asks HubSpot which line items each deal has NOW (one batch read per 100 deals).
// Deals whose Simpro fetch failed are left alone and reported.
const cfg = $('Build Sync Window').first().json;
const { records } = $('Select Test Records').first().json;
const idMap = $('Build Association Reads').first().json.plan.idMap;
const ccReqs = $('Split Cost Center Requests').all(); // the cost center requests, in the order they were sent
const failures = [...($('Build Cost Center Requests').first().json.failures ?? [])];
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const failed = new Set(failures.map(f => String(f.id)));
const costCenters = {}; // simproId -> [cost center]
records.forEach(r => { costCenters[String(r.ID)] = []; });

const inputItems = $input.all();
if (!(inputItems[0] && inputItems[0].json.skip === true)) {
  inputItems.forEach((item, k) => {
    const idx = (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
    const meta = ccReqs[idx].json.meta;
    const j = item.json ?? {};
    if (j.error !== undefined || !Array.isArray(j.body)) {
      failures.push({ type: cfg.recordType, id: meta.simproId, error: 'cost centers: ' + (j.error !== undefined ? (typeof j.error === 'string' ? j.error : JSON.stringify(j.error)) : 'unexpected response').slice(0, 250) });
      failed.add(String(meta.simproId));
      return;
    }
    for (const c of j.body) if (c && c.ID) costCenters[meta.simproId].push(c);
  });
}

const creates = {}; // dealId -> [line item inputs]
const rewriteDealIds = [];
for (const r of records) {
  const sid = String(r.ID);
  if (failed.has(sid)) continue; // leave this deal's existing line items untouched
  const dealId = String(idMap[sid]);
  rewriteDealIds.push(dealId);
  creates[dealId] = costCenters[sid].map(c => ({
    properties: {
      name: c.Name ?? c.CostCenter.Name,
      quantity: '1',
      price: c.Total.ExTax.toString(),
      cost_centre: c.CostCenter.ID.toString(),
      simpro_id: c.ID.toString(),
    },
    associations: [{ to: { id: dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 20 }] }],
  }));
}

const plan = { creates, rewriteDealIds, failures };
const requests = chunk(rewriteDealIds, cfg.hubspotBatchSize).map((part, n) => ({
  url: cfg.hubspotApiBase + '/crm/v4/associations/deals/line_items/batch/read',
  body: { inputs: part.map(id => ({ id })) },
  meta: { kind: 'readLineItems', batch: n + 1 },
}));
// ONE state item; Split Line Item Reads turns the requests into one item per call (none = nothing to rebuild).
return [{ json: { plan, requests } }];
