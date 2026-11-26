// HubSpot contact -> BC contact. Compares each changed contact with its BC contact and returns one
// item per BC contact that needs an update, with ONLY the differing fields. HubSpot wins.
// The BC name is the HubSpot first name + last name. Blank HubSpot values are never sent.
const cfg = $('Workflow Config').first().json;
const map = typeof cfg.fieldMap === 'string' ? JSON.parse(cfg.fieldMap) : cfg.fieldMap;   // BC Contact_Card field -> HubSpot property
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());
const batches = $('Build BC Read Batches').all();

return $input.all().flatMap((item, i) => {
  const bc = {};
  for (const c of item.json.value || []) bc[norm(c.No)] = c;
  const out = [];
  for (const rec of batches[i].json.records) {
    const cur = bc[rec.number];
    if (!cur) continue;                                          // not in BC: never created here
    const wanted = { ...Object.fromEntries(Object.entries(map).map(([bcField, hsProp]) => [bcField, norm(rec.properties[hsProp])])) };
    wanted.Name = [rec.properties.firstname, rec.properties.lastname].map(norm).filter(Boolean).join(' ');
    const body = {};
    for (const [bcField, value] of Object.entries(wanted)) {
      if (!value) continue;                                      // blank in HubSpot: never clears BC
      const same = bcField === 'E_Mail' ? value.toLowerCase() === norm(cur[bcField]).toLowerCase() : value === norm(cur[bcField]);
      if (!same) body[bcField] = value;
    }
    if (Object.keys(body).length) out.push({ json: { number: rec.number, body } });
  }
  return out;
});
