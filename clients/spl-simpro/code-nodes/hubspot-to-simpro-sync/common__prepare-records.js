// Node: Prepare Records   (all five HubSpot -> Simpro sync workflows)
// Collects every page of the HubSpot search into ONE list of changed records and applies the test-record rule
// (while testOnly is on). One state item out; later nodes read it with $('Prepare Records').first().
const cfg = $('Build Sync Window').first().json;
const pages = $('Find Changed Records').all().map(i => i.json);

const seen = new Set();
const found = [];
let rows = 0;
let reportedTotal = null;
for (const page of pages) {
  if (!Array.isArray(page.results)) {
    throw new Error('Find Changed Records: expected a results array from HubSpot, got ' + JSON.stringify(page).slice(0, 300));
  }
  if (reportedTotal === null && page.total !== undefined) reportedTotal = Number(page.total);
  for (const row of page.results) {
    if (row === null || typeof row !== 'object' || !row.id) throw new Error('Find Changed Records: a returned record has no id.');
    rows++;
    if (seen.has(String(row.id))) continue;
    seen.add(String(row.id));
    found.push(row);
  }
}
// The page cap stops silently - fail loudly instead of syncing a partial window.
if (reportedTotal !== null && rows < reportedTotal) {
  throw new Error('Find Changed Records: read ' + rows + ' of ' + reportedTotal + ' changed ' + cfg.label
    + ' (HubSpot search limit reached). Shorten the window (windowStartOverride in Build Sync Window) and run again.');
}

// Test-record rule, same as the Real Time workflow: name starts with the prefix OR the record's own email domain is a test domain.
const rule = cfg.testRecords;
const prefix = String(rule.namePrefix).toLowerCase();
const domains = rule.emailDomains.map(d => String(d).trim().toLowerCase());
const isTest = (p) => {
  const name = rule.nameFields.map(f => p[f]).filter(Boolean).join(' ').trim().toLowerCase();
  if (name.startsWith(prefix)) return true;
  const email = String(rule.emailField ? (p[rule.emailField] ?? '') : '').trim().toLowerCase();
  const domain = email.includes('@') ? email.split('@').pop() : '';
  return domain !== '' && domains.includes(domain);
};

const records = [];
let skippedNonTest = 0;
for (const row of found) {
  const p = row.properties ?? {};
  if (cfg.testOnly && !isTest(p)) { skippedNonTest++; continue; }
  const sid = p[cfg.idProperty];
  records.push({ hsId: String(row.id), simproId: (sid === undefined || sid === null || sid === '') ? null : String(sid), props: p });
}
return [{ json: { hasRecords: records.length > 0, records, counts: { changedInHubSpot: found.length, skippedNonTest } } }];
