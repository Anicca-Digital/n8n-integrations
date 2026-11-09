const ctx = $('Collect Companies').first().json;
const found = new Map();
let total = 0;
for (const item of $input.all()) {
  const page = item.json;
  if (typeof page.total === 'number') total = page.total;
  for (const inv of page.results || []) found.set(String(inv.id), inv);
}
if (found.size !== total) {
  throw new Error(`Invoice guard search returned ${found.size} of ${total} invoices - paging was incomplete. Aborting before anything is created.`);
}
const guardInvoices = [...found.values()].map(inv => {
  const p = inv.properties || {};
  return { id: String(inv.id), status: String(p.hs_invoice_status || '').toLowerCase(), createdMs: new Date(p.hs_createdate).getTime(), xeroId: String(p.xero_invoice_id || '').trim() };
});
return [{ json: { ...ctx, guardInvoices } }];
