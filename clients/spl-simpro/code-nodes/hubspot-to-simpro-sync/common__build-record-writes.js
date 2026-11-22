// Node: Build Record Writes   (all five HubSpot -> Simpro sync workflows)
// New record (no Simpro ID) -> create it. Existing record -> update ONLY the fields that differ from what Simpro
// holds today (nothing to update = no call). A record Simpro no longer has (404) or could not be read is left alone
// and reported by Finish Run; it is never re-created.
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


const norm = (v) => (v === null || v === undefined) ? '' : String(v).trim();
const same = (want, have) => {
  if (Array.isArray(want)) { // lists of IDs (tags)
    const h = (Array.isArray(have) ? have : []).map(t => Number(t && t.ID !== undefined ? t.ID : t));
    return JSON.stringify([...want].map(Number).sort()) === JSON.stringify(h.sort());
  }
  if (want !== null && typeof want === 'object') return Object.entries(want).every(([k, v]) => same(v, have ? have[k] : undefined));
  if (have !== null && typeof have === 'object' && have.ID !== undefined) return norm(want) === norm(have.ID); // { ID } references
  return norm(want) === norm(have);
};

const writes = [];
for (const rec of plan) {
  if (rec.simproId) {
    const cur = current[rec.hsId];
    if (!cur) continue; // gone in Simpro or unreadable: reported by Finish Run
    const patch = {};
    for (const [k, v] of Object.entries(rec.body)) if (!same(v, cur[k])) patch[k] = v;
    if (Object.keys(patch).length) writes.push({ json: { method: 'PATCH', url: rec.updateUrl, body: patch, meta: { hsId: rec.hsId, kind: 'update', fields: Object.keys(patch) } } });
  } else {
    writes.push({ json: { method: 'POST', url: rec.createUrl, body: { ...rec.body, ...rec.createExtra }, meta: { hsId: rec.hsId, kind: 'create' } } });
  }
}
if (writes.length === 0) return [{ json: { skip: true } }];
return writes;
