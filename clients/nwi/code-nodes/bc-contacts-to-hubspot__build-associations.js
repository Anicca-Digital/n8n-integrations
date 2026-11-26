// Daily contact sync, step 3. Associates each newly created contact to its company (default
// association, so the company becomes the contact's primary company).
const cfg = $('Workflow Config').first().json;
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());
const contactId = {};
for (const item of $input.all()) {
  if (item.json.errors && item.json.errors.length) {
    throw new Error(`HubSpot rejected some contact creates: ${JSON.stringify(item.json.errors).slice(0, 500)}`);
  }
  for (const r of item.json.results || []) {
    const n = norm(r.properties && r.properties[cfg.matchProperty]);
    if (n) contactId[n] = r.id;
  }
}
const pairs = $('Build Contact Creates').all().flatMap((i) => i.json.pairs);
const missing = pairs.filter((p) => !contactId[p.number]);
if (missing.length) throw new Error(`${missing.length} new contacts have no HubSpot id after the create step, e.g. ${missing.slice(0, 5).map((p) => p.number).join(', ')}`);
const inputs = pairs.map((p) => ({ from: { id: contactId[p.number] }, to: { id: p.companyId } }));
const out = [];
for (let i = 0; i < inputs.length; i += 100) out.push({ json: { inputs: inputs.slice(i, i + 100) } });
return out;
