// Node: Build Association Reads   ([SPL] Simpro -> HubSpot Quotes Sync)
// 1) Turns the read-back answers into Simpro ID -> HubSpot ID for the records just written.
// 2) Works out which related Simpro records each record should link to (LINKS below).
// 3) Builds ONE set of read requests: the HubSpot IDs of the related records (by their unique Simpro ID
//    property) and the links each record has in HubSpot right now (so only missing links are added).
const cfg = $('Build Sync Window').first().json;
const { records } = $('Select Test Records').first().json;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// Link ownership (agreed with SPL): the CHILD record manages its own links, so two workflows never fight
// over the same link. EVERY link is addOnly: add what is missing, never remove (a record is linked to everything it relates
// to that already exists in HubSpot, whichever record was created first).
const LINKS = [
  { key: 'site', toType: 'site', mode: 'addOnly', desired: (r) => [r.Site?.ID] },
  // Primary contact (CustomerContact) carries SPL's "Decision Maker" label (USER_DEFINED, association ID 10, 1-to-many);
  // the additional contacts are linked with NO label.
  { key: 'contact', toType: 'contact', mode: 'addOnly',
    desired: (r) => [r.CustomerContact?.ID, ...(r.AdditionalContacts ?? []).map(c => c.ID)],
    primary: (r) => r.CustomerContact?.ID,
    label: { types: [{ associationCategory: 'USER_DEFINED', associationTypeId: 10 }] } },
  { key: 'company', toType: 'company', mode: 'addOnly', desired: (r) => [r.Customer?.ID] },
];

const OBJECTS = {
  company: { object: 'companies', path: 'crm/objects/2026-09/companies', idProperty: 'simpro_customer_id' },
  contact: { object: 'contacts', path: 'crm/objects/2026-09/contacts', idProperty: 'simpro_contact_id' },
  site: { object: '0-420', path: 'crm/objects/2026-09/0-420', idProperty: 'simpro_site_id' },
  quote: { object: 'deals', path: 'crm/objects/2026-09/deals', idProperty: 'simpro_quote_id' }, // a quote is a deal
};

const hsIdBySimproId = {};
for (const item of $input.all()) {
  const r = item.json ?? {};
  if (r.statusCode !== 200 && r.statusCode !== 207) {
    throw new Error('Read Back HubSpot IDs failed (HTTP ' + r.statusCode + '): ' + JSON.stringify(r.body).slice(0, 300));
  }
  for (const x of ((r.body && r.body.results) || [])) {
    const sid = x.properties ? x.properties[cfg.idProperty] : undefined;
    if (sid !== undefined && sid !== null) hsIdBySimproId[String(sid)] = String(x.id);
  }
}
const idMap = {};
const missing = [];
for (const r of records) {
  const sid = String(r.ID);
  if (hsIdBySimproId[sid] === undefined) missing.push(sid); else idMap[sid] = hsIdBySimproId[sid];
}
if (missing.length) {
  throw new Error('HubSpot has no ' + cfg.label + ' record for Simpro ID ' + missing.slice(0, 10).join(', ')
    + ' straight after the write - NOT advancing the window. Re-run.');
}

const desired = {}; // linkKey -> simproId -> [related simpro ids]
const primary = {}; // linkKey -> simproId -> primary related simpro id (links with a label only)
const needed = {};  // toType -> Set(related simpro ids)
for (const l of LINKS) {
  desired[l.key] = {};
  primary[l.key] = {};
  for (const r of records) {
    const ids = [...new Set((l.desired(r) ?? [])
      .filter(v => v !== undefined && v !== null && v !== '').map(String))];
    desired[l.key][String(r.ID)] = ids;
    if (l.primary) {
      const p = l.primary(r);
      primary[l.key][String(r.ID)] = (p === undefined || p === null || p === '') ? null : String(p);
    }
    for (const id of ids) { (needed[l.toType] = needed[l.toType] ?? new Set()).add(id); }
  }
}
const plan = {
  idMap,
  desired,
  primary,
  links: LINKS.map(l => ({ key: l.key, toType: l.toType, mode: l.mode, label: l.label ?? null, quoteIsFrom: !!l.quoteIsFrom, fromObject: cfg.assocObject, toObject: OBJECTS[l.toType].object })),
};

const requests = [];
for (const [toType, set] of Object.entries(needed)) {
  const o = OBJECTS[toType];
  chunk([...set], cfg.hubspotBatchSize).forEach((part, n) => requests.push({
    url: cfg.hubspotApiBase + '/' + o.path + '/batch/read',
    body: { idProperty: o.idProperty, properties: [o.idProperty], inputs: part.map(id => ({ id })) },
    meta: { kind: 'lookup', toType, idProperty: o.idProperty, batch: n + 1 },
  }));
}
const fromIds = Object.values(idMap);
for (const l of plan.links) {
  chunk(fromIds, cfg.hubspotBatchSize).forEach((part, n) => requests.push({
    url: cfg.hubspotApiBase + '/crm/v4/associations/' + l.fromObject + '/' + l.toObject + '/batch/read',
    body: { inputs: part.map(id => ({ id })) },
    meta: { kind: 'current', linkKey: l.key, batch: n + 1 },
  }));
}
if (requests.length === 0) {
  throw new Error('Build Association Reads produced no requests - check LINKS in this node.');
}
// ONE state item; Split Association Reads turns the requests into one item per call.
return [{ json: { plan, requests } }];
