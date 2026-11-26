// Daily contact sync, step 2. Keeps only the new contacts whose BC customer already has a HubSpot
// company (blocked / not-yet-synced customers have none, so their contacts are skipped), and builds
// the create payload plus the contact -> company pairs for the association step.
const cfg = $('Workflow Config').first().json;
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());
const plans = $('Plan Contact Writes').all().filter((i) => i.json.op === 'plan');
return $input.all().flatMap((item, i) => {
  const companyId = {};
  for (const r of item.json.results || []) companyId[norm(r.properties[cfg.companyMatchProperty])] = r.id;
  const ready = plans[i].json.candidates.filter((c) => companyId[c.customerNumber]);
  if (!ready.length) return [];
  return [{ json: {
    inputs: ready.map((c) => ({ properties: c.properties })),
    pairs: ready.map((c) => ({ number: c.number, companyId: companyId[c.customerNumber] })),
  } }];
});
