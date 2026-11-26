// For each batch of 100 contacts: contacts missing in HubSpot are CREATED; contacts already there
// (matched on business_central_record_id) are UPDATED, but only the properties whose value differs
// (BC wins, blanks are never sent). Emits up to three items per batch: create, update, and a marker with
// the existing id map and the contact -> company pairs (so the next step always runs).
const cfg = $('Workflow Config').first().json;
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());
const batches = $('Build Company Map And Contact Batches').all();

return $input.all().flatMap((item, i) => {
  const batch = batches[i].json;
  const found = {};
  for (const r of item.json.results || []) found[norm(r.properties[cfg.contactMatchProperty])] = r;

  const existing = {}, creates = [], updates = [];
  for (const c of batch.contacts) {
    const hs = found[c.number];
    if (!hs) { creates.push({ properties: c.properties }); continue; }
    existing[c.number] = hs.id;
    const properties = {};
    for (const [prop, value] of Object.entries(c.properties)) {
      if (prop === cfg.contactMatchProperty) continue;
      const same = prop === 'email' ? norm(value).toLowerCase() === norm(hs.properties[prop]).toLowerCase() : norm(value) === norm(hs.properties[prop]);
      if (!same) properties[prop] = value;
    }
    if (Object.keys(properties).length) updates.push({ id: hs.id, properties });
  }
  const pairs = batch.contacts.map((c) => ({ number: c.number, companyId: c.companyId }));
  const out = [];
  if (creates.length) out.push({ json: { op: 'create', inputs: creates } });
  if (updates.length) out.push({ json: { op: 'update', inputs: updates } });
  out.push({ json: { op: 'none', existing, pairs } });
  return out;
});
