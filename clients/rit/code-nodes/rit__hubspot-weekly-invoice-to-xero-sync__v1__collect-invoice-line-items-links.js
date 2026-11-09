const ctx = $('Index Invoice Details').first().json;
const lineItemIdsByInvoice = {};
const pagedInvoiceIds = [];
const all = new Set();
for (const item of $input.all()) {
  const r = item.json;
  // HubSpot reports a record with NO associations as an error entry rather than leaving it out. That is normal, not a failure.
  const real = (r.errors || []).filter(e => e.subCategory !== 'crm.associations.NO_ASSOCIATIONS_FOUND');
  if (real.length || (r.numErrors > 0 && !r.errors)) {
    throw new Error(`Invoice to line item read returned errors: ${JSON.stringify(real.length ? real : r.errors)}`);
  }
  for (const row of r.results || []) {
    const inv = String(row.from.id);
    if (row.paging && row.paging.next) pagedInvoiceIds.push(inv);
    const ids = (row.to || []).map(t => String(t.toObjectId));
    lineItemIdsByInvoice[inv] = ids;
    ids.forEach(id => all.add(id));
  }
}
return [{ json: { ...ctx, lineItemIdsByInvoice, pagedInvoiceIds, lineItemIds: [...all] } }];
