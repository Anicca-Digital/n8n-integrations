const ctx = $('Collect Created Line Items').first().json;
const chunks = $('Chunk Invoice Opens').all();      // one item per batch, in the order the HTTP node ran them
const openedIds = new Set();
const errors = [];
const results = $input.all();
for (let i = 0; i < results.length; i++) {
  const item = results[i];
  const r = item.json || {};
  // A batch that errored comes back as { error: ... } (onError: continueRegularOutput). A partial batch comes back with results AND errors.
  for (const row of (r.results || [])) openedIds.add(String(row.id));
  if (r.error || r.numErrors > 0 || (r.errors && r.errors.length)) {
    const idx = item.pairedItem && item.pairedItem.item !== undefined ? item.pairedItem.item : i;
    const sent = (((chunks[idx] || {}).json || {}).inputs || []).length;
    const detail = r.error ? (typeof r.error === 'string' ? r.error : (r.error.message || JSON.stringify(r.error))) : JSON.stringify(r.errors);
    errors.push(`batch ${idx + 1} (${sent} invoices): ${String(detail).slice(0, 300)}`);
  }
}
const outcomes = { ...ctx.outcomes };
const issues = [...(ctx.issues || [])];
const createdInvoices = [];
let failed = 0;
for (const [companyId, invoiceId] of Object.entries(ctx.invoiceByCompany)) {
  if (openedIds.has(String(invoiceId))) {
    createdInvoices.push({ invoiceId, companyId });
    outcomes[companyId] = { status: 'invoiced', invoiceId, message: ctx.billingByCompany[companyId] ? 'Invoice opened with billing contact' : 'Invoice opened - NO billing contact found' };
  } else {
    failed++;
    const name = (ctx.companies[companyId] || {}).name || 'Company';
    const message = `${name} (${companyId}): invoice ${invoiceId} could not be opened and is still a draft. Re-run the same day: drafts are archived and rebuilt.`;
    outcomes[companyId] = { status: 'issue', invoiceId, message };
    issues.push(message);
  }
}
if (failed) issues.push(`HubSpot rejected ${errors.length} open batch(es): ${errors.join(' | ')}`);
return [{ json: { ...ctx, outcomes, issues, createdInvoices } }];
