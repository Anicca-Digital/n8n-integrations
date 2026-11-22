// Node: Build Company Related Lookups   ([SPL] Simpro -> HubSpot (Real Time))
// The Company was just CREATED in HubSpot. Work out which related Simpro records it should link to (LINKS)
// and ask HubSpot, in one batch read per related type, which of them already exist (by the unique
// Simpro ID property). Related records that are not in HubSpot are NOT created here - they are skipped.
// Returns no items when there is nothing to link, which ends the branch on purpose.
const record = $('Get Simpro Customer').first().json;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const LINKS = [
  { key: 'contact', toType: 'contact', desired: (r) => (r.Contacts ?? []).map(c => c.ID) },
  { key: 'site', toType: 'site', desired: (r) => (r.Sites ?? []).map(s => s.ID) },
];

const OBJECTS = {
  company: { path: 'crm/objects/2026-09/companies', idProperty: 'simpro_customer_id' },
  contact: { path: 'crm/objects/2026-09/contacts', idProperty: 'simpro_contact_id' },
  site: { path: 'crm/objects/2026-09/0-420', idProperty: 'simpro_site_id' },
};

const needed = {}; // toType -> Set(related simpro ids)
for (const l of LINKS) {
  for (const id of (l.desired(record) ?? [])) {
    if (id === undefined || id === null || id === '') continue;
    (needed[l.toType] = needed[l.toType] ?? new Set()).add(String(id));
  }
}

const requests = [];
for (const [toType, set] of Object.entries(needed)) {
  const o = OBJECTS[toType];
  chunk([...set], 100).forEach((part, n) => requests.push({
    url: 'https://api.hubapi.com/' + o.path + '/batch/read',
    body: { idProperty: o.idProperty, properties: [o.idProperty], inputs: part.map(id => ({ id })) },
    meta: { toType, idProperty: o.idProperty, batch: n + 1 },
  }));
}
return requests.map(r => ({ json: r }));
