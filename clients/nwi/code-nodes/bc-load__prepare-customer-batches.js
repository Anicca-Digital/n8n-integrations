// All BC customers -> HubSpot company payloads, in batches of 100.
// Skips blocked customers and customers without a name.
const cfg = $('Workflow Config').first().json;
const asObj = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const map = asObj(cfg.companyFieldMap);       // BC Customer_Card field -> HubSpot company property
const countries = asObj(cfg.countryMap);      // 'australia' -> 'AU'
const title = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const countryName = Object.fromEntries(Object.entries(countries).map(([n, c]) => [c, title(n)]));
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());

let customers = [];
for (const page of $('Read BC Customers').all()) customers = customers.concat(page.json.value || []);
customers = customers.filter((c) => !norm(c.Blocked) && norm(c.Name));   // skip blocked + nameless

const rows = customers.map((c) => {
  const properties = { [cfg.companyMatchProperty]: norm(c.No) };
  for (const [bcField, hsProp] of Object.entries(map)) {
    let v = norm(c[bcField]);
    if (!v) continue;                                            // blank in BC: not sent
    if (bcField === 'Country_Region_Code') v = countryName[v.toUpperCase()] || v;
    properties[hsProp] = v;
  }
  return { number: norm(c.No), properties };
});

const out = [];
for (let i = 0; i < rows.length; i += 100) {
  const customersBatch = rows.slice(i, i + 100);
  out.push({ json: { numbers: customersBatch.map((r) => r.number), customers: customersBatch } });
}
return out;
