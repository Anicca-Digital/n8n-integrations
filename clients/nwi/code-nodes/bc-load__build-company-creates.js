// For each batch: the HubSpot companies that already exist (matched on business_central_id) are
// left alone; the rest become the create payload. Items stay in the same order as the batches.
const cfg = $('Workflow Config').first().json;
const batches = $('Prepare Customer Batches').all();
return $input.all().map((item, i) => {
  const batch = batches[i].json;
  const existing = {};
  for (const r of item.json.results || []) existing[String(r.properties[cfg.companyMatchProperty]).trim()] = r.id;
  const inputs = batch.customers
    .filter((c) => !existing[c.number])
    .map((c) => ({ properties: c.properties }));
  return { json: { inputs, existing } };
});
