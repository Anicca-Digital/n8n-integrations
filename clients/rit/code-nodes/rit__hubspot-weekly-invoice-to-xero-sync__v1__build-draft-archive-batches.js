const ctx = $('Apply Guard').first().json;
const size = $('Workflow Config').first().json.batchSize;
const lineItemIds = new Set();
for (const item of $input.all()) {
  const r = item.json;
  // HubSpot reports a record with NO associations as an error entry rather than leaving it out. That is normal, not a failure.
  const real = (r.errors || []).filter(e => e.subCategory !== 'crm.associations.NO_ASSOCIATIONS_FOUND');
  if (real.length || (r.numErrors > 0 && !r.errors)) {
    throw new Error(`Draft invoice line item read returned errors: ${JSON.stringify(real.length ? real : r.errors)}`);
  }
  for (const row of r.results || []) {
    if (row.paging && row.paging.next) {
      throw new Error(`Leftover draft invoice ${row.from.id} has more line items than one read returns. Delete the draft manually in HubSpot, then re-run.`);
    }
    for (const t of row.to || []) lineItemIds.add(String(t.toObjectId));
  }
}
const chunk = (list) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};
// FAN-OUT: line item batches first, then draft invoice batches, so a failure part-way leaves a draft that is found and cleaned again next run.
return [
  ...chunk([...lineItemIds]).map(ids => ({ json: { objectType: 'line_items', ids } })),
  ...chunk(ctx.draftInvoiceIds).map(ids => ({ json: { objectType: 'invoices', ids } }))
];
