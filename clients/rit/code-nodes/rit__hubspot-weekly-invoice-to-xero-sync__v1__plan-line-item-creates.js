const ctx = $('Plan Invoice Creates').first().json;
const cfg = $('Workflow Config').first().json;
const invoiceByCompany = {};
for (const item of $input.all()) {
  const r = item.json;
  if (r.numErrors > 0 || (r.errors && r.errors.length)) {
    throw new Error(`Invoice to company read returned errors: ${JSON.stringify(r.errors)}`);
  }
  for (const row of r.results || []) {
    const cid = String(((row.to || [])[0] || {}).toObjectId);
    if (invoiceByCompany[cid]) throw new Error(`Company ${cid} ended up with two new invoices (${invoiceByCompany[cid]}, ${row.from.id}). Stopping before line items are created.`);
    invoiceByCompany[cid] = String(row.from.id);
  }
}
const lineItemInputs = [];
for (const cid of ctx.planIds) {
  if (!invoiceByCompany[cid]) throw new Error(`No newly created invoice found for company ${cid}. Stopping before line items are created; the drafts are archived by the next run.`);
  for (const properties of ctx.plans[cid]) {
    lineItemInputs.push({
      properties,
      associations: [{ to: { id: invoiceByCompany[cid] }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: cfg.assocTypeIds.lineItemToInvoice }] }]
    });
  }
}
const { plans, invoiceInputs, ...rest } = ctx;
return [{ json: { ...rest, invoiceByCompany, lineItemInputs } }];
