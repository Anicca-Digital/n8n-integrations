// Joins BC order details with the matching HubSpot deals (by bc_order_id) and keeps ONLY the
// properties whose value differs. BC wins; a blank BC value never overwrites a HubSpot value.
// Output: one item per HubSpot batch-update call (up to 100 deals each). No changes = no items.
const cfg = $('Workflow Config').first().json;
const map = typeof cfg.fieldMap === 'string' ? JSON.parse(cfg.fieldMap) : cfg.fieldMap; // BC page field -> HubSpot property

// BC sends 0001-01-01 for an empty date and 0 for an empty option: both count as blank.
const norm = (bcField, v) => {
  if (v === null || v === undefined) return '';
  let s = String(v).replace(/\r\n/g, '\n').trim();
  if (s === '0' || s === '0001-01-01') return '';
  if (/Date$/.test(bcField)) s = s.slice(0, 10);
  return s;
};

const orders = {};
for (const item of $('Read BC Order Details').all()) {
  for (const o of item.json.value || []) orders[String(o.No)] = o;
}

const inputs = [];
for (const item of $input.all()) {
  for (const deal of item.json.results || []) {
    const order = orders[String(deal.properties.bc_order_id || '').trim()];
    if (!order) continue;
    const properties = {};
    for (const [bcField, hsProp] of Object.entries(map)) {
      const bcValue = norm(bcField, order[bcField]);
      if (!bcValue) continue;                                   // blank in BC: leave the deal alone
      if (bcValue !== norm(bcField, deal.properties[hsProp])) properties[hsProp] = bcValue;
    }
    if (Object.keys(properties).length) inputs.push({ id: deal.id, properties });
  }
}

const out = [];
for (let i = 0; i < inputs.length; i += 100) {
  out.push({ json: { inputs: inputs.slice(i, i + 100) } });
}
return out;
