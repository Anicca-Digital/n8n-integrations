const ctx = $('Build Invoice Plan').first().json;
const cfg = $('Workflow Config').first().json;
const issues = [...ctx.issues];
const billingByCompany = {};
for (const item of $input.all()) {
  const r = item.json;
  // HubSpot reports a record with NO associations as an error entry rather than leaving it out. That is normal, not a failure.
  const real = (r.errors || []).filter(e => e.subCategory !== 'crm.associations.NO_ASSOCIATIONS_FOUND');
  if (real.length || (r.numErrors > 0 && !r.errors)) {
    throw new Error(`Company to contact read returned errors: ${JSON.stringify(real.length ? real : r.errors)}`);
  }
  for (const row of r.results || []) {
    const cid = String(row.from.id);
    const hit = (row.to || []).find(t => (t.associationTypes || []).some(a =>
      cfg.billingContactTypeIds.includes(a.typeId) || String(a.label || '').toLowerCase() === cfg.billingContactLabel));
    if (hit) billingByCompany[cid] = String(hit.toObjectId);
    else if (row.paging && row.paging.next) {
      issues.push(`${(ctx.companies[cid] || {}).name || 'Company'} (${cid}): contact list is longer than one HubSpot read returns - invoice created WITHOUT a billing contact`);
    }
  }
}
const start = DateTime.now().setZone(cfg.timezone).startOf('day');
const daysAhead = ((cfg.issueWeekday - start.weekday + 7) % 7) || 7;      // always the FOLLOWING Monday, never today
const issue = start.plus({ days: daysAhead });
const issueDate = issue.toFormat('yyyy-MM-dd');
const cat = 'HUBSPOT_DEFINED';
// Associations are set at creation so a half-built draft can always be found from its company.
const invoiceInputs = ctx.planIds.map(cid => {
  const company = ctx.companies[cid] || {};
  const weekday = cfg.expiryWeekdays[company.expiryDay];
  let dueDate = issueDate;
  if (weekday) {
    dueDate = issue.plus({ days: (weekday - issue.weekday + 7) % 7 }).toFormat('yyyy-MM-dd');
  } else {
    issues.push(`${company.name || 'Company'} (${cid}): Weekly Invoice Expiry Date is ${company.expiryDay ? '"' + company.expiryDay + '"' : 'blank'} - due date set to the invoice date`);
  }
  const associations = [{ to: { id: cid }, types: [{ associationCategory: cat, associationTypeId: cfg.assocTypeIds.invoiceToCompany }] }];
  if (billingByCompany[cid]) {
    associations.push({ to: { id: billingByCompany[cid] }, types: [{ associationCategory: cat, associationTypeId: cfg.assocTypeIds.invoiceToContact }] });
  }
  return { properties: { hs_currency: cfg.invoiceCurrency, hs_invoice_date: issueDate, hs_due_date: dueDate, type: cfg.invoiceType }, associations };
});
return [{ json: { ...ctx, issues, billingByCompany, invoiceInputs, invoiceDate: issueDate } }];
