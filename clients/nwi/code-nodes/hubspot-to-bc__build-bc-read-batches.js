// All HubSpot records changed in the window (every search page) -> batches for one BC read each.
// Only records that already have a BC number are kept (this sync never creates anything in BC).
const cfg = $('Workflow Config').first().json;
const size = Number(cfg.batchSize) || 50;
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());
const records = $input.all()
  .flatMap((i) => i.json.results || [])
  .map((r) => ({ id: r.id, number: norm(r.properties[cfg.matchProperty]), properties: r.properties }))
  .filter((r) => r.number);
const batches = [];
for (let i = 0; i < records.length; i += size) {
  const chunk = records.slice(i, i + size);
  batches.push({ json: { records: chunk, filter: chunk.map((r) => `No eq '${r.number.replace(/'/g, "''")}'`).join(' or ') } });
}
return batches;
