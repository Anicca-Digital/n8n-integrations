// Runs once, after the whole invoice has been processed. Works out the final outcome of every
// line item, writes the summary to the console, and returns it as this node's output.
const plan = $('Plan Asset Updates').first().json;
const incoming = $input.first().json; // batch-update response, or the plan itself when nothing was sent

const errText = (e) => typeof e === 'string'
  ? e
  : (e && (e.message || e.description)) || JSON.stringify(e).slice(0, 300);

const rows = plan.rows.map((r) => ({ ...r }));
const queued = rows.filter((r) => r.status === 'queued');

let batchNote = null;
if (queued.length > 0) {
  if (incoming.error) {
    batchNote = `Batch update call failed: ${errText(incoming.error)}`;
    queued.forEach((r) => { r.status = 'failed'; r.detail = batchNote; });
  } else {
    // HubSpot can return success for some records and errors for others, so check each asset ID
    const okIds = new Set((incoming.results || []).map((x) => String(x.id)));
    const errs = incoming.errors || [];
    queued.forEach((r) => {
      if (okIds.has(r.assetId)) { r.status = 'updated'; return; }
      const hit = errs.find((e) => JSON.stringify(e).includes(`"${r.assetId}"`));
      r.status = 'failed';
      r.detail = hit
        ? `HubSpot rejected the update: ${errText(hit)}`
        : 'Asset ID missing from the HubSpot batch response.';
    });
    if (incoming.status && incoming.status !== 'COMPLETE') batchNote = `HubSpot batch status: ${incoming.status}`;
  }
}

const count = (s) => rows.filter((r) => r.status === s).length;
const updated = count('updated');
const skipped = count('skipped');
const failed = count('failed');

const deliveryDate = Number.isFinite(plan.deliveryDateMs)
  ? new Date(plan.deliveryDateMs).toISOString().slice(0, 10)
  : 'unknown';
const short = (s) => String(s ?? '').replace(/\s+/g, ' ').slice(0, 70);

const lines = [
  '=== Caterlink delivery invoice -> asset update ===',
  `PO: ${plan.poNum} | Invoice: ${plan.invoiceNum ?? 'n/a'} | Delivery date: ${deliveryDate}`,
  `Line items: ${rows.length} | Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed}`,
];
if (plan.fatal) lines.push(`FATAL: ${plan.fatal}`);
if (batchNote) lines.push(`NOTE: ${batchNote}`);
for (const r of rows) {
  const target = r.assetId ? ` -> asset ${r.assetId}${r.assetNumber ? ` (${r.assetNumber})` : ''}` : '';
  lines.push(`  ${r.status.toUpperCase().padEnd(7)} #${r.itemNum} ${short(r.description)}${target}${r.detail ? ` | ${r.detail}` : ''}`);
}
const report = lines.join('\n');

console.log(report);

return [{
  json: {
    poNum: plan.poNum,
    invoiceNum: plan.invoiceNum,
    total: rows.length,
    updated,
    skipped,
    failed,
    hasFailures: failed > 0,
    report,
    rows,
  },
}];
