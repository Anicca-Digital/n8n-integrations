// Daily customer sync. For each batch of changed BC customers:
//  - not in HubSpot yet (no company with that business_central_id) -> CREATE (skips blocked / nameless customers)
//  - already in HubSpot -> UPDATE, but only the properties whose value differs
// BC wins; a blank BC value is never sent, so it never clears HubSpot.
const cfg = $('Workflow Config').first().json;
const asObj = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const map = asObj(cfg.fieldMap);            // BC Customer_Card field -> HubSpot company property
const countries = asObj(cfg.countryMap);    // 'australia' -> 'AU'
const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const countryName = Object.fromEntries(Object.entries(countries).map(([n, c]) => [c, title(n)]));
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());
const toCode = (v) => { const s = norm(v); return /^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : (countries[s.toLowerCase()] || s); };
const details = $('Read BC Customer Details').all();

return $input.all().flatMap((item, i) => {
  const found = {};
  for (const r of item.json.results || []) found[norm(r.properties[cfg.matchProperty])] = r;
  const creates = [], updates = [];
  for (const c of details[i].json.value || []) {
    const number = norm(c.No);
    const properties = {};
    for (const [bcField, hsProp] of Object.entries(map)) {
      let v = norm(c[bcField]);
      if (!v) continue;                                          // blank in BC: not sent
      if (bcField === 'Country_Region_Code') v = countryName[v.toUpperCase()] || v;
      properties[hsProp] = v;
    }
    const hs = found[number];
    if (!hs) {
      if (norm(c.Blocked) || !norm(c.Name)) continue;            // never create blocked / nameless customers
      creates.push({ properties: { [cfg.matchProperty]: number, ...properties } });
      continue;
    }
    const changed = {};
    for (const [prop, value] of Object.entries(properties)) {
      const same = prop === 'country' ? toCode(value) === toCode(hs.properties[prop]) : value === norm(hs.properties[prop]);
      if (!same) changed[prop] = value;
    }
    if (Object.keys(changed).length) updates.push({ id: hs.id, properties: changed });
  }
  const out = [];
  if (creates.length) out.push({ json: { op: 'create', inputs: creates } });
  if (updates.length) out.push({ json: { op: 'update', inputs: updates } });
  return out;
});
