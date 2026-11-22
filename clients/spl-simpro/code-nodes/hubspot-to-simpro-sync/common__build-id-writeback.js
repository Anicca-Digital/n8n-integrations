// Node: Build ID Write-Back   (all five HubSpot -> Simpro sync workflows)
// Right after a record is created in Simpro, save its new Simpro ID on the HubSpot record (batches of 100).
// Doing this straight away is what prevents a second run from creating the same record in Simpro twice.
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


const updates = Object.entries(created).map(([hsId, simproId]) => ({ id: hsId, properties: { [cfg.idProperty]: simproId } }));
if (updates.length === 0) return [{ json: { skip: true } }];
return chunk(updates, 100).map((part, n) => ({
  json: { url: cfg.hubspotApiBase + '/' + cfg.objectPath + '/batch/update', body: { inputs: part }, meta: { batch: n + 1, count: part.length } },
}));
