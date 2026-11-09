const ctx = $input.first().json;
const seen = new Set();
const xeroCandidates = [];
// Invoices created this run, plus open Weekly invoices from the duplicate window that never reached Xero.
for (const x of [...(ctx.createdInvoices || []), ...(ctx.pendingXero || [])]) {
  if (seen.has(x.invoiceId)) continue;
  seen.add(x.invoiceId);
  xeroCandidates.push(x);
}
return [{ json: { companies: ctx.companies, outcomes: ctx.outcomes, issues: ctx.issues, xeroCandidates, createdCount: (ctx.createdInvoices || []).length } }];
