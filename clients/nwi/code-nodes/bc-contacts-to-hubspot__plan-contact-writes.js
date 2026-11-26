// Daily contact sync, step 1. For each batch of changed BC Person contacts:
//  - already in HubSpot (matched on business_central_record_id) -> UPDATE, only properties that differ
//  - not in HubSpot -> a "plan" item with the new contacts and the BC customers they belong to
//    (companies are looked up next, so each new contact can be associated to its company)
// BC wins; blanks are never sent. A generic contact with no first name / surname uses its display name.
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
    const noNameInBc = !norm(bc.firstName) && !norm(bc.surname);
    const noNameInHubSpot = !hs || (!norm(hs.properties[map.firstName]) && !norm(hs.properties[map.surname]));
    const view = noNameInBc && noNameInHubSpot ? { ...bc, firstName: bc.displayName } : bc;
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
