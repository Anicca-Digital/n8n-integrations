// Node: Build Record List   (all five sync workflows)
// Turns the paged "changed since" list from Simpro into ONE item per changed record ID (deduplicated).
// FAN-OUT: everything after this runs once per item until Select Test Records collapses it again.
const cfg = $('Build Sync Window').first().json;
const pages = $('Fetch Changed Records').all().map(i => i.json); // one item per page (fullResponse)

const ids = [];
const seen = new Set();
let rows = 0;
let reportedTotal = null;

for (const page of pages) {
  if (page.statusCode === 304) continue; // Simpro: nothing modified since the window start
  if (page.statusCode !== 200) {
    throw new Error('Fetch Changed Records: Simpro returned HTTP ' + page.statusCode + ' - ' + JSON.stringify(page.body).slice(0, 300));
  }
  if (!Array.isArray(page.body)) {
    throw new Error('Fetch Changed Records: expected a JSON array from Simpro, got ' + typeof page.body);
  }
  if (reportedTotal === null && page.headers && page.headers['result-total'] !== undefined) {
    reportedTotal = Number(page.headers['result-total']);
  }
  for (const row of page.body) {
    if (row === null || typeof row !== 'object' || row.ID === undefined || row.ID === null) {
      throw new Error('Fetch Changed Records: a returned record has no ID - check the columns=ID query parameter.');
    }
    rows++;
    const id = String(row.ID);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
}

// The pagination cap stops silently - fail loudly instead of syncing a partial window.
if (reportedTotal !== null && rows < reportedTotal) {
  throw new Error('Fetch Changed Records: read ' + rows + ' of ' + reportedTotal + ' changed ' + cfg.label
    + ' (page cap of 40 x 100 reached). Shorten the window (windowStartOverride in Build Sync Window) or raise Max Pages on that node.');
}

if (ids.length === 0) {
  return [{ json: { hasRecords: false, count: 0 } }];
}
return ids.map(id => ({ json: { hasRecords: true, id } }));
