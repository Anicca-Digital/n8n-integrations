// Node: Build Section Reads   (quotes and jobs)
// For every deal that has line items: read the sections of its Simpro quote/job (cost centers live inside sections).
const cfg = $('Build Sync Window').first().json;
const plan = $('Resolve Plan').first().json.records;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const safeAll = (name) => { try { return $(name).all(); } catch (e) { return []; } }; // [] when that stage did not run
const live = (name) => safeAll(name).filter(i => !(i.json && i.json.skip));
const idxOf = (item, k) => (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
// What Simpro holds today for each record we are updating (from Read from Simpro)
const current = {};
{ const reqs = live('Build Simpro Reads');
  live('Read from Simpro').forEach((item, k) => { const m = reqs[idxOf(item, k)].json.meta; const r = item.json ?? {}; if (r.statusCode === 200) current[m.hsId] = r.body; }); }
// Simpro IDs created in this run (from Write Records to Simpro)
const created = {};
{ const reqs = live('Build Record Writes');
  live('Write Records to Simpro').forEach((item, k) => { const m = reqs[idxOf(item, k)].json.meta; const r = item.json ?? {};
    if (m.kind === 'create' && (r.statusCode === 200 || r.statusCode === 201) && r.body && r.body.ID !== undefined) created[m.hsId] = String(r.body.ID); }); }
const finalId = (rec) => rec.simproId ?? created[rec.hsId] ?? null;
const recordUrl = (rec) => rec.createUrl.replace(/\/$/, '') + '/' + finalId(rec);


const reads = plan.filter(r => r.lineItems.length > 0 && finalId(r))
  .map(r => ({ json: { url: recordUrl(r) + '/sections/?pageSize=250', meta: { hsId: r.hsId } } }));
if (reads.length === 0) return [{ json: { skip: true } }];
return reads;
