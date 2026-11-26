// For each batch: HubSpot contacts that already exist (matched on business_central_record_id) are
// left alone; the rest become the create payload. `pairs` keeps contact -> company for the association step.
const cfg = $('Workflow Config').first().json;
const batches = $('Build Company Map And Contact Batches').all();
return $input.all().map((item, i) => {
  const batch = batches[i].json;
  const existing = {};
  for (const r of item.json.results || []) existing[String(r.properties[cfg.contactMatchProperty]).trim()] = r.id;
  const inputs = batch.contacts.filter((c) => !existing[c.number]).map((c) => ({ properties: c.properties }));
  const pairs = batch.contacts.map((c) => ({ number: c.number, companyId: c.companyId }));
  return { json: { inputs, existing, pairs } };
});
