// 1) Builds the full BC customer number -> HubSpot company id map (existing + just created).
// 2) Joins every BC Person contact to its customer (via the customer's company contact) and
//    returns contact batches of 100. Contacts of blocked / out-of-scope customers are skipped.
const cfg = $('Workflow Config').first().json;
const asObj = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const map = asObj(cfg.contactFieldMap);       // BC contact field -> HubSpot contact property
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());

const companyId = {};                          // BC customer number -> HubSpot company id
for (const item of $('Build Company Writes').all()) Object.assign(companyId, item.json.existing || {});   // already in HubSpot
for (const item of $input.all()) {                                                                    // just created
  if (item.json.errors && item.json.errors.length) {
    throw new Error(`HubSpot rejected some company creates: ${JSON.stringify(item.json.errors).slice(0, 500)}`);
  }
  for (const r of item.json.results || []) { const n = norm(r.properties && r.properties[cfg.companyMatchProperty]); if (n) companyId[n] = r.id; }
}
const scope = $('Prepare Customer Batches').all().flatMap((b) => b.json.numbers);
const missing = scope.filter((n) => !companyId[n]);
if (missing.length) throw new Error(`${missing.length} customers have no HubSpot company after the create step, e.g. ${missing.slice(0, 5).join(', ')}`);

// customer number -> its BC company contact number
const customerByCompanyContact = {};
for (const page of $('Read BC Company Contacts').all()) {
  for (const c of page.json.value || []) {
    const company = (c.contactsInformation || []).find((x) => x.contactType === 'Company');
    if (company && companyId[norm(c.number)]) customerByCompanyContact[norm(company.contactNumber)] = norm(c.number);
  }
}

// Segment / Sub_Segment live on the BC contact card page, keyed by contact number.
const pageFields = {};
for (const page of $('Read BC Contact Segments').all()) {
  for (const c of page.json.value || []) pageFields[norm(c.No)] = c;
}

const rows = [];
for (const page of $('Read BC Person Contacts').all()) {
  for (const person of page.json.value || []) {
    const p = { ...person, ...(pageFields[norm(person.number)] || {}) };
    // The BC contacts API has no first name / surname fields: split the display name at the first space.
    // "Yeran Hettiarachchy" -> first "Yeran", last "Hettiarachchy"; a one-word name ("ACCOUNTS") is the first name.
    const full = norm(p.displayName);
    const space = full.indexOf(' ');
    p.firstName = space < 0 ? full : full.slice(0, space);
    p.surname = space < 0 ? '' : full.slice(space + 1).trim();
    const customer = customerByCompanyContact[norm(p.companyNumber)];
    if (!customer) continue;                                     // not linked to an in-scope customer
    const properties = { [cfg.contactMatchProperty]: norm(p.number) };
    for (const [bcField, hsProp] of Object.entries(map)) {
      const v = norm(p[bcField]);
      if (v) properties[hsProp] = v;
    }
    rows.push({ number: norm(p.number), companyId: companyId[customer], properties });
  }
}

const out = [];
for (let i = 0; i < rows.length; i += 100) {
  const contacts = rows.slice(i, i + 100);
  out.push({ json: { numbers: contacts.map((r) => r.number), contacts } });
}
return out;
