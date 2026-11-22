// Node: Check Upsert Results   (all five sync workflows)
// HubSpot batch endpoints answer 200/207 even when single records were rejected, so inspect every
// response, and guard the count: if HubSpot returned a different number of results than we sent,
// stop (the window is NOT advanced, the next run re-reads it; upserts are idempotent).
const cfg = $('Build Sync Window').first().json;
const { records } = $('Select Test Records').first().json;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const errors = [];
let written = 0;
for (const item of $input.all()) {
  const b = item.json ?? {};
  const errs = Array.isArray(b.errors) ? b.errors : [];
  if (errs.length || Number(b.numErrors) > 0) {
    errors.push(...errs.map(e => (e && (e.message || e.category)) || JSON.stringify(e)));
    if (!errs.length) errors.push('numErrors=' + b.numErrors);
  }
  written += Array.isArray(b.results) ? b.results.length : 0;
}
if (errors.length) {
  throw new Error('HubSpot rejected part of the ' + cfg.label + ' batch. The window is NOT advanced. First errors: ' + errors.slice(0, 5).join(' | '));
}
if (written !== records.length) {
  throw new Error('HubSpot returned ' + written + ' result(s) for ' + records.length + ' ' + cfg.label
    + ' sent - NOT advancing the window. Re-run; if it repeats, check for duplicate Simpro IDs/emails in one batch.');
}

// ONE state item. When IDs are needed afterwards (associations / line items) it carries the read-back
// requests: the HubSpot ID of every record, read by the unique Simpro ID property. Split Read-Back Requests
// turns them into one item per batch call.
const requests = cfg.needsReadBack
  ? chunk(records.map(r => ({ id: String(r.ID) })), cfg.hubspotBatchSize).map((part, n) => ({
      url: cfg.objectUrl + '/batch/read',
      body: { idProperty: cfg.idProperty, properties: [cfg.idProperty], inputs: part },
      meta: { kind: 'readBack', batch: n + 1, count: part.length },
    }))
  : [];
return [{ json: { written, requests } }];
