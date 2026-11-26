// Builds the contact -> company associations (default association, so the company becomes the
// contact's primary company). Runs for every contact, new or existing: it is idempotent.
const cfg = $('Workflow Config').first().json;
const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());
const contactId = {};
for (const item of $('Build Contact Writes').all()) Object.assign(contactId, item.json.existing || {});   // already in HubSpot
for (const item of $input.all()) {                                                                    // just created
  if (item.json.errors && item.json.errors.length) {
    throw new Error(`HubSpot rejected some contact creates: ${JSON.stringify(item.json.errors).slice(0, 500)}`);
  }
  for (const r of item.json.results || []) { const n = norm(r.properties && r.properties[cfg.contactMatchProperty]); if (n) contactId[n] = r.id; }
}
const pairs = $('Build Contact Writes').all().flatMap((i) => i.json.pairs || []);
const missing = pairs.filter((p) => !contactId[p.number]);
if (missing.length) throw new Error(`${missing.length} contacts have no HubSpot id after the create step, e.g. ${missing.slice(0, 5).map((p) => p.number).join(', ')}`);

const inputs = pairs.map((p) => ({ from: { id: contactId[p.number] }, to: { id: p.companyId } }));
const out = [];
for (let i = 0; i < inputs.length; i += 100) out.push({ json: { inputs: inputs.slice(i, i + 100) } });
return out;
