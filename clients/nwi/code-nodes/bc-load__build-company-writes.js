// For each batch of 100 customers: companies missing in HubSpot are CREATED; companies already there
// (matched on business_central_id) are UPDATED, but only the properties whose value differs (BC wins,
// blanks are never sent). Emits up to three items per batch: create, update, and a marker with the
// existing id map (so the next step always runs).
const cfg = $('Workflow Config').first().json;
const asObj = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const countries = asObj(cfg.countryMap);
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());
const toCode = (v) => { const s = norm(v); return /^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : (countries[s.toLowerCase()] || s); };
const batches = $('Prepare Customer Batches').all();

return $input.all().flatMap((item, i) => {
  const batch = batches[i].json;
  const found = {};
  for (const r of item.json.results || []) found[norm(r.properties[cfg.companyMatchProperty])] = r;

  const existing = {}, creates = [], updates = [];
  for (const c of batch.customers) {
    const hs = found[c.number];
    if (!hs) { creates.push({ properties: c.properties }); continue; }
    existing[c.number] = hs.id;
    const properties = {};
    for (const [prop, value] of Object.entries(c.properties)) {
      if (prop === cfg.companyMatchProperty) continue;
      const same = prop === 'country' ? toCode(value) === toCode(hs.properties[prop]) : norm(value) === norm(hs.properties[prop]);
      if (!same) properties[prop] = value;
    }
    if (Object.keys(properties).length) updates.push({ id: hs.id, properties });
  }
  const out = [];
  if (creates.length) out.push({ json: { op: 'create', inputs: creates } });
  if (updates.length) out.push({ json: { op: 'update', inputs: updates } });
  out.push({ json: { op: 'none', existing } });
  return out;
});
