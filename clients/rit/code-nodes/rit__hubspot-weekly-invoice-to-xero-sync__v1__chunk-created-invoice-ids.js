const plan = $('Plan Invoice Creates').first().json;
const size = $('Workflow Config').first().json.batchSize;
const ids = [];
for (const item of $input.all()) {
  const r = item.json;
  if (r.numErrors > 0 || (r.errors && r.errors.length)) {
    throw new Error(`Invoice batch create failed: ${JSON.stringify(r.errors)}. Drafts created so far are archived by the next run.`);
  }
  for (const inv of r.results || []) ids.push(String(inv.id));
}
if (ids.length !== plan.invoiceInputs.length) {
  throw new Error(`Created ${ids.length} of ${plan.invoiceInputs.length} draft invoices. Not continuing; the drafts are archived by the next run.`);
}
const chunks = [];
for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
// FAN-OUT: batches of created invoice ids. Which invoice belongs to which company is read back from HubSpot rather than assumed from response order.
return chunks.map(c => ({ json: { ids: c } }));
