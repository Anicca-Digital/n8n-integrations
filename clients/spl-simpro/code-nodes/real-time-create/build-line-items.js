// Node: Build Line Items   ([SPL] Simpro -> HubSpot (Real Time))
// One HubSpot line item per Simpro cost center, linked to the new deal. Same fields as the old sub-workflows,
// but the price is the GST-EXCLUSIVE total (Total.ExTax). Batches of 100. No cost centers = the branch ends.
const cfg = $('Workflow Config').first().json;
const dealId = String($('Create Record in HubSpot').first().json.id);
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const costCenters = $input.all().map(i => i.json).filter(c => c && c.ID);
const inputs = costCenters.map(c => ({
  properties: {
    name: c.Name ?? c.CostCenter.Name,
    quantity: '1',
    price: c.Total.ExTax.toString(),
    cost_centre: c.CostCenter.ID.toString(),
    simpro_id: c.ID.toString(),
  },
  associations: [{ to: { id: dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 20 }] }],
}));
return chunk(inputs, 100).map((part, n) => ({
  json: { url: cfg.hubspotApiBase + '/crm/objects/2026-09/line_items/batch/create', body: { inputs: part }, meta: { batch: n + 1, count: part.length } },
}));
