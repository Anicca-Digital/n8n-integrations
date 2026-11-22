// Node: Check Association Results   ([SPL] Simpro -> HubSpot (Real Time))
// Batch associate/create answer 2xx even when single links are rejected (for example a label limit), so inspect
// every response and fail loudly.
const errors = [];
for (const item of $input.all()) {
  const b = item.json ?? {};
  const errs = Array.isArray(b.errors) ? b.errors : [];
  if (errs.length || Number(b.numErrors) > 0) {
    errors.push(...errs.map(e => (e && (e.message || e.category)) || JSON.stringify(e)));
    if (!errs.length) errors.push('numErrors=' + b.numErrors);
  }
}
if (errors.length) throw new Error('HubSpot rejected part of the associations: ' + errors.slice(0, 5).join(' | '));
return [{ json: { ok: true, calls: $input.all().length } }];
