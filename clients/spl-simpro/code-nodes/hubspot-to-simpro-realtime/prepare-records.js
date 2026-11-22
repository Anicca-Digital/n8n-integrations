// Node: Prepare Records   ([SPL] HubSpot -> Simpro (Real Time))
// Real Time only CREATES: a record that already has a Simpro ID is left alone (the 30-minute sync updates it).
// While TEST MODE is on, only test records (name starts with the prefix, or own email domain is a test domain) go on.
// Nothing left = the run ends here on purpose. One state item out.
const cfg = $('Workflow Config').first().json;
const reqs = $('Build Record Reads').all(); // the requests, in the order they were sent
const rule = cfg.testRecords;
const prefix = String(rule.namePrefix).toLowerCase();
const domains = rule.emailDomains.map(d => String(d).trim().toLowerCase());

const records = [];
const counts = { inWebhook: cfg.records.length, ignoredEvents: cfg.ignored, notFound: 0, alreadyInSimpro: 0, skippedNonTest: 0 };
$input.all().forEach((item, k) => {
  const idx = (item.pairedItem && item.pairedItem.item !== undefined) ? item.pairedItem.item : k;
  const meta = reqs[idx].json.meta;
  const r = item.json ?? {};
  if (r.statusCode === 404) { counts.notFound += reqs[idx].json.body.inputs.length; return; }
  if (r.statusCode !== 200 && r.statusCode !== 207) {
    throw new Error('HubSpot read of ' + meta.type + ' records failed (HTTP ' + r.statusCode + '): ' + JSON.stringify(r.body).slice(0, 300));
  }
  const t = cfg.types[meta.type];
  const found = new Set();
  for (const row of ((r.body && r.body.results) || [])) {
    found.add(String(row.id));
    const p = row.properties ?? {};
    const sid = p[t.idProperty];
    if (sid !== undefined && sid !== null && sid !== '') { counts.alreadyInSimpro++; continue; }
    if (cfg.testOnly) {
      const name = t.nameFields.map(f => p[f]).filter(Boolean).join(' ').trim().toLowerCase();
      const email = String(t.emailField ? (p[t.emailField] ?? '') : '').trim().toLowerCase();
      const domain = email.includes('@') ? email.split('@').pop() : '';
      if (!(name.startsWith(prefix) || (domain !== '' && domains.includes(domain)))) { counts.skippedNonTest++; continue; }
    }
    records.push({ type: meta.type, hsId: String(row.id), props: p });
  }
  counts.notFound += reqs[idx].json.body.inputs.filter(i => !found.has(String(i.id))).length;
});
if (records.length === 0) return []; // nothing to create
return [{ json: { records, counts } }];
