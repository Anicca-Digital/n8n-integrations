// Runs once all quotes are done. Must stay a Code node: it writes workflow static data.
// Any failure holds the watermark (the next run retries) and raises an alert via the error workflow.
const results = $input.all().map(i => i.json);
const failed = results.filter(r => r.ok !== true);
if (failed.length > 0) {
  throw new Error(failed.length + ' of ' + results.length + ' quotes failed. Watermark held; the next run retries them. First failures: '
    + failed.slice(0, 5).map(r => r.error || JSON.stringify(r)).join(' | '));
}
const run = $('Get Watermark').first().json;
const store = $getWorkflowStaticData('global');
const parked = { ...(store.parkedQuotes || {}) };
for (const r of results) {
  if (r.skipped) {
    parked[r.quoteId] = { firstParked: parked[r.quoteId]?.firstParked || run.runStartedAt, quoteNumber: r.quoteNumber, lastReason: r.reason };
  } else {
    delete parked[r.quoteId];
  }
}
const cutoff = DateTime.utc().minus({ days: run.parkDays }).toISO();
for (const id of Object.keys(parked)) {
  if (parked[id].firstParked < cutoff) delete parked[id];
}
store.parkedQuotes = parked;
store.lastSuccessfulRun = run.runStartedAt;
return [{ json: {
  watermarkAdvancedTo: run.runStartedAt,
  synced: results.filter(r => !r.skipped).length,
  skipped: results.filter(r => r.skipped),
  parkedCount: Object.keys(parked).length
} }];
