// Node: Select Test Record   ([SPL] Simpro -> HubSpot (Real Time))
// Applies the test-record rule to the Simpro record that was just fetched. A record that is not a test record
// ends here on purpose (no item out), so nothing else is called. Otherwise builds the HubSpot search that
// answers "is this record already in HubSpot?" (a contact is also matched on email, see Check Is New).
const cfg = $('Workflow Config').first().json;
const rec = $input.first().json;

let isTest;
if (cfg.type === 'contact') {
  const email = String(rec.Email ?? '').trim().toLowerCase();
  const domain = email.includes('@') ? email.split('@').pop() : '';
  isTest = cfg.contactEmailDomains.map(d => String(d).trim().toLowerCase()).includes(domain);
} else {
  const name = String(rec.Name ?? rec.CompanyName ?? '').trim().toLowerCase();
  const prefix = String(cfg.type === 'quote' ? cfg.quoteNamePrefix : cfg.testNamePrefix).toLowerCase();
  isTest = name.startsWith(prefix);
}
if (!isTest) return [];

const o = cfg.objects[cfg.type];
const filterGroups = [{ filters: [{ propertyName: o.idProperty, operator: 'EQ', value: String(rec.ID) }] }];
const properties = [o.idProperty];
if (cfg.type === 'contact') {
  properties.push('email');
  const email = String(rec.Email ?? '').trim().toLowerCase();
  if (email) filterGroups.push({ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] });
}
return [{ json: { url: cfg.hubspotApiBase + '/' + o.path + '/search', body: { filterGroups, properties, limit: 5 } } }];
