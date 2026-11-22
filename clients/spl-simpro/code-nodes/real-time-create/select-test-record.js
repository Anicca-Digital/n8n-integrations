// Node: Select Test Record   ([SPL] Simpro -> HubSpot (Real Time))
// Applies the test-record rule (name starts with HSTEST- OR email domain is a test domain) to the Simpro
// record that was just fetched. A record that is not a test record ends here on purpose (no item out), so
// nothing else is called. Otherwise builds the HubSpot search that
// answers "is this record already in HubSpot?" (a contact is also matched on email, see Check Is New).
const cfg = $('Workflow Config').first().json;
const rec = $input.first().json;
if (typeof cfg.testNamePrefix !== 'string' || !Array.isArray(cfg.testEmailDomains)) {
  throw new Error("Workflow Config is out of date: it needs testNamePrefix (text) and testEmailDomains (list). "
    + "Replace the test-record settings in the Workflow Config node, or re-import the workflow.");
}

// Name: Name (sites, quotes, jobs), CompanyName (companies), GivenName + FamilyName (contacts)
const name = String(rec.Name ?? rec.CompanyName ?? [rec.GivenName, rec.FamilyName].filter(Boolean).join(' ')).trim().toLowerCase();
const nameMatches = name.startsWith(String(cfg.testNamePrefix).toLowerCase());
// Email: the record's own Email (contacts, companies). Records without one (sites, quotes, jobs) match on name only.
const email = String(rec.Email ?? '').trim().toLowerCase();
const domain = email.includes('@') ? email.split('@').pop() : '';
const domainMatches = domain !== '' && cfg.testEmailDomains.map(d => String(d).trim().toLowerCase()).includes(domain);
const isTest = nameMatches || domainMatches;
if (!isTest) return [];

const o = cfg.objects[cfg.type];
const filterGroups = [{ filters: [{ propertyName: o.idProperty, operator: 'EQ', value: String(rec.ID) }] }];
const properties = [o.idProperty];
if (cfg.type === 'contact') {
  properties.push('email');
  if (email) filterGroups.push({ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] });
}
return [{ json: { url: cfg.hubspotApiBase + '/' + o.path + '/search', body: { filterGroups, properties, limit: 5 } } }];
