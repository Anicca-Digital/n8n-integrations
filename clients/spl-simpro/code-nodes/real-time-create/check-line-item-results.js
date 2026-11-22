// Node: Check Line Item Results   ([SPL] Simpro -> HubSpot (Real Time))
// The batch create answers 2xx even when single line items are rejected, so inspect it and guard the count.
const sent = $('Build Line Items').all().reduce((n, i) => n + (i.json.meta ? i.json.meta.count : 0), 0);
const errors = [];
let created = 0;
for (const item of $input.all()) {
  const b = item.json ?? {};
  const errs = Array.isArray(b.errors) ? b.errors : [];
  if (errs.length || Number(b.numErrors) > 0) {
    errors.push(...errs.map(e => (e && (e.message || e.category)) || JSON.stringify(e)));
    if (!errs.length) errors.push('numErrors=' + b.numErrors);
  }
  created += Array.isArray(b.results) ? b.results.length : 0;
}
if (errors.length) throw new Error('HubSpot rejected part of the line items: ' + errors.slice(0, 5).join(' | '));
if (created !== sent) throw new Error('HubSpot created ' + created + ' line item(s) but ' + sent + ' were sent.');
return [{ json: { lineItems: created } }];
