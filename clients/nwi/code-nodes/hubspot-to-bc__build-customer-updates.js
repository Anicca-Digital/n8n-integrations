// HubSpot company -> BC customer. Compares each changed company with its BC customer and returns one
// item per customer that needs an update, with ONLY the differing fields. HubSpot wins.
// Never sent: blank HubSpot values, anything for blocked customers, posting groups, payment terms.
const cfg = $('Workflow Config').first().json;
const asObj = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const map = asObj(cfg.fieldMap);            // BC Customer_Card field -> HubSpot company property
const countries = asObj(cfg.countryMap);    // 'australia' -> 'AU'
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());
const toCode = (v) => { const s = norm(v); return /^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : (countries[s.toLowerCase()] || ''); };
const batches = $('Build BC Read Batches').all();

return $input.all().flatMap((item, i) => {
  const bc = {};
  for (const c of item.json.value || []) bc[norm(c.No)] = c;
  const out = [];
  for (const rec of batches[i].json.records) {
    const cur = bc[rec.number];
    if (!cur || norm(cur.Blocked)) continue;                     // not in BC, or blocked: skip
    const body = {};
    for (const [bcField, hsProp] of Object.entries(map)) {
      const value = norm(rec.properties[hsProp]);
      if (!value) continue;                                      // blank in HubSpot: never clears BC
      if (bcField === 'Country_Region_Code') {
        const code = toCode(value);
        if (code && code !== norm(cur[bcField]).toUpperCase()) body[bcField] = code;
      } else if (value !== norm(cur[bcField])) {
        body[bcField] = value;
      }
    }
    if (Object.keys(body).length) out.push({ json: { number: rec.number, body } });
  }
  return out;
});
