const ctx = $('Gather Xero Invoices').first().json;
const counts = {};
for (const o of Object.values(ctx.outcomes)) counts[o.status] = (counts[o.status] || 0) + 1;
console.log(`HubSpot: ${JSON.stringify(counts)}. Invoices considered for Xero: ${ctx.xeroCandidates.length}.`);
if (ctx.issues.length) {
  const list = ctx.issues.slice(0, 20).map(i => `- ${i}`).join('\n');
  throw new Error(`Weekly invoicing finished with ${ctx.issues.length} issue(s) that need a person (everything else completed). HubSpot: ${JSON.stringify(counts)}\n${list}`);
}
return [{ json: { counts, invoicesConsideredForXero: ctx.xeroCandidates.length } }];
