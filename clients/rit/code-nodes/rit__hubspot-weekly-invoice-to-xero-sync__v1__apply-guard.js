const ctx = $('Index Guard Invoices').first().json;
const cfg = $('Workflow Config').first().json;
const windowStart = cfg.windowStartMs;      // start of the trigger day (minus guardLookbackDays for a recovery run)
const windowEnd = cfg.windowEndMs;          // one minute before the next weekly execution
const selected = new Set(ctx.companyIds);
const invoiceCompany = {};
for (const item of $input.all()) {
  const r = item.json;
  if (!Array.isArray(r.results)) continue;          // the no-guard-invoices path passes the context item straight through
  // An invoice with no company comes back as a NO_ASSOCIATIONS_FOUND error entry: it is simply ignored below.
  const real = (r.errors || []).filter(e => e.subCategory !== 'crm.associations.NO_ASSOCIATIONS_FOUND');
  if (real.length || (r.numErrors > 0 && !r.errors)) {
    throw new Error(`Invoice to company read returned errors: ${JSON.stringify(real.length ? real : r.errors)}`);
  }
  for (const row of r.results) {
    const ids = (row.to || []).map(t => String(t.toObjectId)).filter(id => selected.has(id));
    if (ids.length) invoiceCompany[String(row.from.id)] = ids[0];
  }
}
const alreadyInvoiced = new Set();
const pendingXero = [];
const draftInvoiceIds = [];
for (const inv of ctx.guardInvoices) {
  const companyId = invoiceCompany[inv.id];
  if (!companyId) continue;
  if (inv.status === 'draft') { draftInvoiceIds.push(inv.id); continue; }
  if ((inv.status === 'open' || inv.status === 'paid') && inv.createdMs >= windowStart && inv.createdMs <= windowEnd) {
    alreadyInvoiced.add(companyId);
    if (inv.status === 'open' && !inv.xeroId) pendingXero.push({ invoiceId: inv.id, companyId });
  }
}
const outcomes = { ...ctx.outcomes };
for (const id of alreadyInvoiced) outcomes[id] = { status: 'already_invoiced', message: 'A Weekly invoice already exists inside the duplicate window' };
const { guardInvoices, ...rest } = ctx;
return [{ json: { ...rest, outcomes, pendingXero, draftInvoiceIds, eligibleIds: ctx.companyIds.filter(id => !alreadyInvoiced.has(id)) } }];
