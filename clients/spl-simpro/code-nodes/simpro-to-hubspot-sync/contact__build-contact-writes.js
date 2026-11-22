// Node: Build Contact Writes   ([SPL] Simpro -> HubSpot Contacts Sync)
// Same behaviour as [SPL] Upsert Contact in HubSpot, in batches:
//   already in HubSpot (found by simpro_contact_id) -> update that contact
//   not found, has an email                         -> upsert on email (adopts an existing HubSpot contact with that email)
//   not found, no email                             -> create
const cfg = $('Build Sync Window').first().json;
const { records } = $('Select Test Records').first().json;
const blank = (v) => v === null || v === undefined || v === '' || v === 'null';
const keep = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => !blank(v)).map(([k, v]) => [k, String(v)]));
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const found = {}; // simpro_contact_id -> HubSpot id
for (const item of $input.all()) {
  const r = item.json ?? {};
  if (r.statusCode === 404) continue; // none of this batch exists yet
  if (r.statusCode !== 200 && r.statusCode !== 207) {
    throw new Error('Look Up Existing Contacts failed (HTTP ' + r.statusCode + '): ' + JSON.stringify(r.body).slice(0, 300));
  }
  for (const x of ((r.body && r.body.results) || [])) {
    const sid = x.properties ? x.properties[cfg.idProperty] : undefined;
    if (sid !== undefined && sid !== null) found[String(sid)] = String(x.id);
  }
}

const updates = [];
const upserts = [];
const creates = [];
for (const c of records) {
  const properties = keep({
    simpro_contact_id: c.ID,
    firstname: c.GivenName,
    lastname: c.FamilyName,
    jobtitle: c.Position,
    phone: c.WorkPhone,
    salutation: c.Title,
    department: c.Department,
  });
  const hsId = found[String(c.ID)];
  const email = String(c.Email ?? '').trim();
  if (hsId) updates.push({ id: hsId, properties });
  else if (email) upserts.push({ idProperty: 'email', id: email, properties });
  else creates.push({ properties });
}

const items = [];
const add = (inputs, path, kind) => chunk(inputs, cfg.hubspotBatchSize).forEach((part, n) => items.push({
  json: { url: cfg.objectUrl + path, body: { inputs: part }, meta: { kind, batch: n + 1, count: part.length } } }));
add(updates, '/batch/update', 'update');
add(upserts, '/batch/upsert', 'upsertByEmail');
add(creates, '/batch/create', 'create');
return items;
