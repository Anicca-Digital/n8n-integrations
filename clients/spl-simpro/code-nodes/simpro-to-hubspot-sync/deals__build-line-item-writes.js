// Node: Build Line Item Writes   (quote and job workflows)
// Rebuilds each deal's line items exactly as the existing sub-workflow does (archive the old ones, create
// the new ones from the Simpro cost centers), but in batches of 100.
// Items run in order, so ALL archives come before ANY create.
const cfg = $('Build Sync Window').first().json;
const plan = $('Plan Line Items').first().json.plan;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const archiveIds = [];
const inputItems = $input.all();
const fromRead = inputItems.length > 0 && inputItems[0].json.statusCode !== undefined;
if (fromRead) {
  for (const item of inputItems) {
    const r = item.json;
    if (r.statusCode === 404) continue; // none of these deals has line items
    if (r.statusCode !== 200 && r.statusCode !== 207) {
      throw new Error('Read Existing Line Items failed (HTTP ' + r.statusCode + '): ' + JSON.stringify(r.body).slice(0, 300));
    }
    for (const row of ((r.body && r.body.results) || [])) {
      for (const t of (row.to ?? [])) archiveIds.push(String(t.toObjectId));
    }
  }
}

const createInputs = Object.values(plan.creates).flat();
const writes = [];
chunk(archiveIds, cfg.hubspotBatchSize).forEach((part, n) => writes.push({
  url: cfg.hubspotApiBase + '/crm/objects/2026-09/line_items/batch/archive',
  body: { inputs: part.map(id => ({ id })) }, meta: { kind: 'archive', batch: n + 1 } }));
chunk(createInputs, cfg.hubspotBatchSize).forEach((part, n) => writes.push({
  url: cfg.hubspotApiBase + '/crm/objects/2026-09/line_items/batch/create',
  body: { inputs: part }, meta: { kind: 'create', batch: n + 1, count: part.length } }));

const stats = { archived: archiveIds.length, created: createInputs.length };
// ONE state item; Split Line Item Writes turns the requests into one item per call, in order.
return [{ json: { stats, requests: writes } }];
