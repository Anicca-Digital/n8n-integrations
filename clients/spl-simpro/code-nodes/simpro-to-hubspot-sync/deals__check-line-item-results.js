// Node: Check Line Item Results   (quote and job workflows)
// Reached after Write Line Items, or straight from "nothing to write" (skip item).
// The create endpoint answers 2xx even when single line items were rejected, so inspect it and
// guard the count.
const plan = $('Plan Line Items').first().json.plan;
let stats = { archived: 0, created: 0 };
try { stats = $('Build Line Item Writes').first().json.stats ?? stats; } catch (e) { /* not executed */ }

const errors = [];
let created = 0;
let sawCreate = false;
for (const item of $input.all()) {
  const b = item.json ?? {};
  if (b.skip) continue;
  const errs = Array.isArray(b.errors) ? b.errors : [];
  if (errs.length || Number(b.numErrors) > 0) {
    errors.push(...errs.map(e => (e && (e.message || e.category)) || JSON.stringify(e)));
    if (!errs.length) errors.push('numErrors=' + b.numErrors);
  }
  if (Array.isArray(b.results)) { sawCreate = true; created += b.results.length; }
}
if (errors.length) {
  throw new Error('HubSpot rejected part of the line item writes. The window is NOT advanced (the next run rebuilds them). First errors: ' + errors.slice(0, 5).join(' | '));
}
if (sawCreate && created !== stats.created) {
  throw new Error('HubSpot created ' + created + ' line item(s) but ' + stats.created + ' were sent - NOT advancing the window.');
}
return [{ json: { lineItems: stats, failures: plan.failures } }];
