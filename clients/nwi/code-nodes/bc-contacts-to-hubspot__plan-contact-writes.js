// Daily contact sync, step 1. For each batch of changed BC Person contacts:
//  - already in HubSpot (matched on business_central_record_id) -> UPDATE, only properties that differ
//  - not in HubSpot -> a "plan" item with the new contacts and the BC customers they belong to
//    (companies are looked up next, so each new contact can be associated to its company)
// BC wins; blanks are never sent. First name / surname are taken from the BC display name.
const cfg = $('Workflow Config').first().json;
const map = typeof cfg.fieldMap === 'string' ? JSON.parse(cfg.fieldMap) : cfg.fieldMap; // BC field -> HubSpot property
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());
const batches = $('Build BC Read Batches').all();
const details = $('Read BC Contact Details').all();
const list = {};
for (const c of $('List Changed BC Contacts').first().json.value || []) list[norm(c.number)] = c;

return $input.all().flatMap((item, i) => {
  const found = {};
  for (const r of item.json.results || []) found[norm(r.properties[cfg.matchProperty])] = r;
  const page = {};
  for (const c of details[i].json.value || []) page[norm(c.No)] = c;

  const updates = [], candidates = [];
  for (const number of batches[i].json.numbers) {
    if (!list[number]) continue;
    const bc = { ...list[number], ...(page[number] || {}) };
    const hs = found[number];
    // The BC contacts API has no first name / surname fields: split the display name at the first space.
    // "Yeran Hettiarachchy" -> first "Yeran", last "Hettiarachchy"; a one-word name ("ACCOUNTS") is the first name.
    const full = norm(bc.displayName);
    const space = full.indexOf(' ');
    const view = { ...bc, firstName: space < 0 ? full : full.slice(0, space), surname: space < 0 ? '' : full.slice(space + 1).trim() };
    const properties = {};
    for (const [bcField, hsProp] of Object.entries(map)) {
      const v = norm(view[bcField]);
      if (v) properties[hsProp] = v;
    }
    if (!hs) {
      candidates.push({ number, customerNumber: norm((page[number] || {}).IntegrationCustomerNo), properties: { [cfg.matchProperty]: number, ...properties } });
      continue;
    }
    const changed = {};
    for (const [prop, value] of Object.entries(properties)) {
      const cur = norm(hs.properties[prop]);
      const same = prop === 'email' ? value.toLowerCase() === cur.toLowerCase() : value === cur;
      if (!same) changed[prop] = value;
    }
    if (Object.keys(changed).length) updates.push({ id: hs.id, properties: changed });
  }
  const withCustomer = candidates.filter((c) => c.customerNumber);   // only contacts we can link to a customer
  const out = [];
  if (updates.length) out.push({ json: { op: 'update', inputs: updates } });
  if (withCustomer.length) {
    out.push({ json: { op: 'plan', candidates: withCustomer, customerNumbers: [...new Set(withCustomer.map((c) => c.customerNumber))] } });
  }
  return out;
});
