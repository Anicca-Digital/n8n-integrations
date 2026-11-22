// Node: Check Association Results   (site, contact, quote and job workflows)
// Reached either after Apply Association Changes or straight from "no changes" (skip item).
// Batch endpoints answer 2xx even when single links were rejected, so inspect the bodies.
let summary = { removed: 0, added: 0, warningCount: 0, warnings: [] };
try { summary = $('Plan Association Changes').first().json.summary ?? summary; } catch (e) { /* not executed */ }

const errors = [];
for (const item of $input.all()) {
  const b = item.json ?? {};
  if (b.skip) continue;
  const errs = Array.isArray(b.errors) ? b.errors : [];
  if (errs.length || Number(b.numErrors) > 0) {
    errors.push(...errs.map(e => (e && (e.message || e.category)) || JSON.stringify(e)));
    if (!errs.length) errors.push('numErrors=' + b.numErrors);
  }
}
if (errors.length) {
  throw new Error('HubSpot rejected part of the association changes. The window is NOT advanced. First errors: ' + errors.slice(0, 5).join(' | '));
}
return [{ json: { associations: summary } }];
