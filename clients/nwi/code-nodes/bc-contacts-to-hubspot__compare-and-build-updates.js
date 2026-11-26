// Joins the changed BC contacts with the matching HubSpot contacts (by business_central_record_id)
// and keeps ONLY the properties whose value differs. BC wins; a blank BC value never overwrites HubSpot.
// Output: one item per HubSpot batch-update call (up to 100 contacts each). No changes = no items.
const cfg = $('Workflow Config').first().json;
const map = typeof cfg.fieldMap === 'string' ? JSON.parse(cfg.fieldMap) : cfg.fieldMap; // BC field -> HubSpot property
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());

// Standard fields come from the changed-contacts list; Segment / Sub_Segment come from the BC contact card page.
const pageFields = {};
for (const item of $('Read BC Contact Details').all()) {
  for (const c of item.json.value || []) pageFields[String(c.No)] = c;
}
const contacts = {};
for (const c of $('List Changed BC Contacts').first().json.value || []) contacts[String(c.number)] = { ...c, ...(pageFields[String(c.number)] || {}) };

const inputs = [];
for (const item of $input.all()) {
  for (const contact of item.json.results || []) {
    const bc = contacts[norm(contact.properties[cfg.matchProperty])];
    if (!bc) continue;
    const properties = {};
    for (const [bcField, hsProp] of Object.entries(map)) {
      const bcValue = norm(bc[bcField]);
      if (!bcValue) continue;                                   // blank in BC: leave HubSpot alone
      const same = bcField === 'email'
        ? bcValue.toLowerCase() === norm(contact.properties[hsProp]).toLowerCase()
        : bcValue === norm(contact.properties[hsProp]);
      if (!same) properties[hsProp] = bcValue;
    }
    if (Object.keys(properties).length) inputs.push({ id: contact.id, properties });
  }
}

const out = [];
for (let i = 0; i < inputs.length; i += 100) out.push({ json: { inputs: inputs.slice(i, i + 100) } });
return out;
