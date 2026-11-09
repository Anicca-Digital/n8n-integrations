const ctx = $('Plan Line Item Creates').first().json;
let created = 0;
for (const item of $input.all()) {
  const r = item.json;
  if (r.numErrors > 0 || (r.errors && r.errors.length)) {
    throw new Error(`Line item batch create failed: ${JSON.stringify(r.errors)}. The invoices stay drafts and are archived by the next run.`);
  }
  created += (r.results || []).length;
}
if (created !== ctx.lineItemInputs.length) {
  throw new Error(`Created ${created} of ${ctx.lineItemInputs.length} invoice line items. Not opening any invoice; the drafts are archived by the next run.`);
}
return [{ json: { ...ctx, openInvoiceIds: Object.values(ctx.invoiceByCompany), lineItemsCreated: created } }];
