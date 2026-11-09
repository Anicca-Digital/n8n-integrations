const found = new Map();
let total = 0;
for (const item of $input.all()) {
  const page = item.json;
  if (typeof page.total === 'number') total = page.total;
  for (const c of page.results || []) found.set(String(c.id), c);
}
if (found.size !== total) {
  throw new Error(`Company search returned ${found.size} of ${total} companies - paging was incomplete. Aborting before anything is created.`);
}
if (!found.size) return [];      // nothing to invoice: the run ends cleanly here
const companies = {};
for (const [id, c] of found) {
  const p = c.properties || {};
  companies[id] = { name: p.name || '', state: String(p.state || '').trim(), xeroContactId: String(p.xero_customer_id || '').trim(), ownerId: p.hubspot_owner_id || '', expiryDay: String(p.weekly_invoice_expiry_date || '').trim() };
}
return [{ json: { companies, companyIds: Object.keys(companies), outcomes: {}, issues: [], pendingXero: [] } }];
