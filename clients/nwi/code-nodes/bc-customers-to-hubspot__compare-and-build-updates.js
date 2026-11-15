// Joins BC customer details with the matching HubSpot companies (by business_central_id) and keeps
// ONLY the properties whose value differs. BC wins; a blank BC value never overwrites HubSpot.
// Output: one item per HubSpot batch-update call (up to 100 companies each). No changes = no items.
const cfg = $('Workflow Config').first().json;
const asObj = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const map = asObj(cfg.fieldMap);            // BC Customer_Card field -> HubSpot company property
const countries = asObj(cfg.countryMap);    // 'australia' -> 'AU'
const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const countryName = Object.fromEntries(Object.entries(countries).map(([name, code]) => [code, title(name)]));
const toCode = (v) => {
  const s = String(v || '').trim();
  if (!s) return '';
  return /^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : (countries[s.toLowerCase()] || s);
};
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());

const customers = {};
for (const item of $('Read BC Customer Details').all()) {
  for (const c of item.json.value || []) customers[String(c.No)] = c;
}

const inputs = [];
for (const item of $input.all()) {
  for (const company of item.json.results || []) {
    const cust = customers[norm(company.properties[cfg.matchProperty])];
    if (!cust) continue;
    const properties = {};
    for (const [bcField, hsProp] of Object.entries(map)) {
      const bcValue = norm(cust[bcField]);
      if (!bcValue) continue;                                   // blank in BC: leave HubSpot alone
      const current = company.properties[hsProp];
      if (bcField === 'Country_Region_Code') {                  // HubSpot may hold "Australia", BC holds "AU"
        if (toCode(current) !== bcValue.toUpperCase()) properties[hsProp] = countryName[bcValue.toUpperCase()] || bcValue;
      } else if (bcValue !== norm(current)) {
        properties[hsProp] = bcValue;
      }
    }
    if (Object.keys(properties).length) inputs.push({ id: company.id, properties });
  }
}

const out = [];
for (let i = 0; i < inputs.length; i += 100) out.push({ json: { inputs: inputs.slice(i, i + 100) } });
return out;
