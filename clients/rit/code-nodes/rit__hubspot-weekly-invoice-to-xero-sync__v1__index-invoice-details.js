const ctx = $('Gather Xero Invoices').first().json;
const byId = {};
for (const item of $input.all()) {
  const r = item.json;
  if (r.numErrors > 0 || (r.errors && r.errors.length)) {
    throw new Error(`Invoice read returned errors: ${JSON.stringify(r.errors)}`);
  }
  for (const inv of r.results || []) byId[String(inv.id)] = inv;
}
const issues = [...ctx.issues];
const xeroInvoices = [];
let alreadyInXero = 0;
for (const cand of ctx.xeroCandidates) {
  const inv = byId[cand.invoiceId];
  const name = (ctx.companies[cand.companyId] || {}).name || 'Company';
  if (!inv) { issues.push(`${name} (${cand.companyId}): invoice ${cand.invoiceId} could not be read back from HubSpot - not sent to Xero`); continue; }
  const p = inv.properties || {};
  if (String(p.xero_invoice_id || '').trim()) { alreadyInXero++; continue; }          // dedup flag: already in Xero
  const status = String(p.hs_invoice_status || '').toLowerCase();
  if (status !== 'open') { issues.push(`${name} (${cand.companyId}): invoice ${cand.invoiceId} is ${status || 'unknown'}, not open - not sent to Xero`); continue; }
  xeroInvoices.push({
    invoiceId: cand.invoiceId, companyId: cand.companyId, number: p.hs_number || '', po: p.hs_purchase_order_number || '',
    ownerId: p.hubspot_owner_id || '', date: String(p.hs_invoice_date || p.hs_createdate || '').slice(0, 10), dueDate: String(p.hs_due_date || '').slice(0, 10)
  });
}
return [{ json: { ...ctx, issues, xeroInvoices, alreadyInXero } }];
